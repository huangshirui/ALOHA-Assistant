import type { CanonicalRunIdentity } from '@aloha/contracts'

export interface LifeSpaceIdentityEnv {
  LIFESPACE_IDENTITY_BASE_URL?: string
  LIFESPACE_APPLICATION_CREDENTIAL?: string
}

export type LifeSpaceIdentityResolution =
  | { mode: 'legacy-verification'; identity: null }
  | { mode: 'trusted'; identity: CanonicalRunIdentity }

export class LifeSpaceIdentityError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'LifeSpaceIdentityError'
    this.code = code
    this.status = status
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

const ACCESS_ASSERTION_HEADER = 'Cf-Access-Jwt-Assertion'
const MAX_ACCESS_ASSERTION_LENGTH = 32768

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseBaseUrl = (value: string): URL => {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new LifeSpaceIdentityError(
      'identity_invalid_config',
      'LifeSpace Identity base URL is invalid.',
      503,
    )
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new LifeSpaceIdentityError(
      'identity_invalid_config',
      'LifeSpace Identity base URL must use HTTPS without embedded credentials.',
      503,
    )
  }

  return url
}

const endpoint = (base: URL, path: string) => new URL(path, `${base.origin}/`)

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw new LifeSpaceIdentityError(
      'identity_invalid_response',
      'LifeSpace Identity returned an invalid response.',
      502,
    )
  }
}

const upstreamFailure = (status: number): LifeSpaceIdentityError => {
  if (status === 401) {
    return new LifeSpaceIdentityError(
      'identity_not_authenticated',
      'The current identity could not be authenticated.',
      401,
    )
  }

  if (status === 403 || status === 409 || status === 422) {
    return new LifeSpaceIdentityError(
      'identity_not_authorized',
      'The current identity is not authorized for ALOHA.',
      403,
    )
  }

  if (status >= 500) {
    return new LifeSpaceIdentityError(
      'identity_provider_unavailable',
      'LifeSpace Identity is temporarily unavailable.',
      503,
    )
  }

  return new LifeSpaceIdentityError(
    'identity_resolution_failed',
    'ALOHA could not resolve the current identity.',
    502,
  )
}

const requestJson = async (
  fetchImpl: FetchLike,
  url: URL,
  init: RequestInit,
): Promise<unknown> => {
  let response: Response

  try {
    response = await fetchImpl.call(undefined, url, init)
  } catch {
    throw new LifeSpaceIdentityError(
      'identity_provider_unavailable',
      'LifeSpace Identity is temporarily unavailable.',
      503,
    )
  }

  if (!response.ok) {
    throw upstreamFailure(response.status)
  }

  return readJson(response)
}

const bearerHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: 'application/json',
})

const applicationHeaders = (credential: string) => ({
  ...bearerHeaders(credential),
  'content-type': 'application/json',
})

const dataRecord = (payload: unknown): Record<string, unknown> | null => {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null
  }

  return payload.data
}

export const isLifeSpaceIdentityConfigured = (
  env: LifeSpaceIdentityEnv,
): boolean =>
  Boolean(env.LIFESPACE_IDENTITY_BASE_URL && env.LIFESPACE_APPLICATION_CREDENTIAL)

export const resolveLifeSpaceRunIdentity = async (
  request: Request,
  env: LifeSpaceIdentityEnv,
  fetchImpl: FetchLike = fetch,
): Promise<LifeSpaceIdentityResolution> => {
  const hasBaseUrl = Boolean(env.LIFESPACE_IDENTITY_BASE_URL)
  const hasCredential = Boolean(env.LIFESPACE_APPLICATION_CREDENTIAL)

  if (!hasBaseUrl && !hasCredential) {
    // M1/M2 production smoke tests intentionally remain usable until the M3
    // LifeSpace application credential is provisioned. This is never treated
    // as product identity authority and must not receive durable user state.
    return { mode: 'legacy-verification', identity: null }
  }

  if (!hasBaseUrl || !hasCredential) {
    throw new LifeSpaceIdentityError(
      'identity_invalid_config',
      'LifeSpace Identity integration is only partially configured.',
      503,
    )
  }

  const accessAssertion = request.headers.get(ACCESS_ASSERTION_HEADER)?.trim() ?? ''

  if (
    !accessAssertion ||
    accessAssertion.length > MAX_ACCESS_ASSERTION_LENGTH ||
    accessAssertion.split('.').length !== 3
  ) {
    throw new LifeSpaceIdentityError(
      'identity_assertion_required',
      'A verified Cloudflare Access assertion is required.',
      401,
    )
  }

  const baseUrl = parseBaseUrl(env.LIFESPACE_IDENTITY_BASE_URL!)
  const applicationCredential = env.LIFESPACE_APPLICATION_CREDENTIAL!
  const exchangePayload = await requestJson(
    fetchImpl,
    endpoint(baseUrl, '/internal/v1/access/tokens'),
    {
      method: 'POST',
      headers: applicationHeaders(applicationCredential),
      body: JSON.stringify({
        accessAssertion,
        requestedScopes: ['profile:read'],
      }),
    },
  )
  const exchange = dataRecord(exchangePayload)
  const userToken = exchange?.accessToken

  if (typeof userToken !== 'string' || !userToken) {
    throw new LifeSpaceIdentityError(
      'identity_invalid_response',
      'LifeSpace Identity token exchange returned an invalid response.',
      502,
    )
  }

  const profilePayload = await requestJson(
    fetchImpl,
    endpoint(baseUrl, '/api/v1/me'),
    {
      method: 'GET',
      headers: bearerHeaders(userToken),
    },
  )
  const profile = dataRecord(profilePayload)
  const principalId = profile?.id

  if (typeof principalId !== 'string' || !principalId.startsWith('usr_')) {
    throw new LifeSpaceIdentityError(
      'identity_invalid_response',
      'LifeSpace Identity profile returned an invalid principal.',
      502,
    )
  }

  const agentsPayload = await requestJson(
    fetchImpl,
    endpoint(baseUrl, '/internal/v1/agents'),
    {
      method: 'GET',
      headers: bearerHeaders(applicationCredential),
    },
  )
  const agentsData = dataRecord(agentsPayload)
  const items = agentsData?.items
  const activeAgents = Array.isArray(items)
    ? items.filter(
        (item): item is Record<string, unknown> =>
          isRecord(item) &&
          item.status === 'active' &&
          typeof item.id === 'string' &&
          item.id.startsWith('agt_'),
      )
    : []

  if (activeAgents.length !== 1) {
    throw new LifeSpaceIdentityError(
      'agent_identity_not_configured',
      'ALOHA requires exactly one active LifeSpace Agent identity.',
      503,
    )
  }

  const agentId = activeAgents[0]!.id as string
  const delegatedPayload = await requestJson(
    fetchImpl,
    endpoint(baseUrl, '/internal/v1/agent-tokens'),
    {
      method: 'POST',
      headers: applicationHeaders(applicationCredential),
      body: JSON.stringify({
        subjectId: principalId,
        agentId,
        scopes: [],
      }),
    },
  )
  const delegated = dataRecord(delegatedPayload)
  const actor = delegated?.actor

  if (
    delegated?.principalId !== principalId ||
    !isRecord(actor) ||
    actor.type !== 'agent' ||
    actor.id !== agentId ||
    typeof delegated?.applicationId !== 'string' ||
    !delegated.applicationId
  ) {
    throw new LifeSpaceIdentityError(
      'identity_invalid_response',
      'LifeSpace Identity returned an invalid delegated execution context.',
      502,
    )
  }

  return {
    mode: 'trusted',
    identity: {
      principal: { type: 'user', id: principalId },
      actor: { type: 'agent', id: agentId },
      application: { id: delegated.applicationId },
    },
  }
}
