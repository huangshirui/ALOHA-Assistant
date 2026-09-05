import type {
  CanonicalRunIdentity,
  RuntimeToolDescriptor,
} from '@aloha/contracts'

export const LIFESPACE_READ_TOOL_ID = 'lifespace.read'

const TOOL_GRANT_TTL_MS = 5 * 60 * 1000
const LIFESPACE_READ_SCOPES = ['resources:read'] as const
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface LifeSpaceRuntimeToolEnv {
  LIFESPACE_IDENTITY_BASE_URL?: string
  LIFESPACE_CORE_API_BASE_URL?: string
  LIFESPACE_APPLICATION_CREDENTIAL?: string
  RUNTIME_TOOL_GRANT_SIGNING_KEY?: string
}

interface RuntimeToolGrantClaims {
  version: 1
  toolId: typeof LIFESPACE_READ_TOOL_ID
  runId: string
  principalId: string
  actorId: string
  applicationId: string
  expiresAt: number
}

type LifeSpaceReadInput =
  | { operation: 'discover' }
  | {
      operation: 'query'
      spaceId: string
      modelRoute: string
      query?: Record<string, string | number | boolean | string[]>
    }
  | {
      operation: 'get'
      spaceId: string
      modelRoute: string
      recordId: string
    }

export class LifeSpaceRuntimeToolError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
    this.name = 'LifeSpaceRuntimeToolError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizedBaseUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return null
    return url.toString().replace(/\/$/u, '')
  } catch {
    return null
  }
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

const fromBase64Url = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null
  const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`
  try {
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

const importSigningKey = (signingKey: string) =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )

const issueRuntimeToolGrant = async (
  claims: RuntimeToolGrantClaims,
  signingKey: string,
): Promise<string> => {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)))
  const key = await importSigningKey(signingKey)
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
  )
  return `${payload}.${toBase64Url(signature)}`
}

const verifyRuntimeToolGrant = async (
  token: string,
  signingKey: string,
): Promise<RuntimeToolGrantClaims | null> => {
  const [payload, encodedSignature, extra] = token.split('.')
  if (!payload || !encodedSignature || extra) return null

  const payloadBytes = fromBase64Url(payload)
  const signature = fromBase64Url(encodedSignature)
  if (!payloadBytes || !signature) return null

  const key = await importSigningKey(signingKey)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature.buffer as ArrayBuffer,
    encoder.encode(payload),
  )
  if (!valid) return null

  let claims: unknown
  try {
    claims = JSON.parse(decoder.decode(payloadBytes))
  } catch {
    return null
  }

  if (
    !isRecord(claims) ||
    claims.version !== 1 ||
    claims.toolId !== LIFESPACE_READ_TOOL_ID ||
    typeof claims.runId !== 'string' ||
    typeof claims.principalId !== 'string' ||
    typeof claims.actorId !== 'string' ||
    typeof claims.applicationId !== 'string' ||
    typeof claims.expiresAt !== 'number' ||
    claims.expiresAt <= Date.now()
  ) {
    return null
  }

  return claims as unknown as RuntimeToolGrantClaims
}

export const isLifeSpaceReadToolConfigured = (
  env: LifeSpaceRuntimeToolEnv,
): boolean =>
  Boolean(
    normalizedBaseUrl(env.LIFESPACE_IDENTITY_BASE_URL) &&
      normalizedBaseUrl(env.LIFESPACE_CORE_API_BASE_URL) &&
      env.LIFESPACE_APPLICATION_CREDENTIAL?.trim() &&
      env.RUNTIME_TOOL_GRANT_SIGNING_KEY?.trim(),
  )

export const createLifeSpaceReadToolDescriptor = async (
  request: Request,
  runId: string,
  identity: CanonicalRunIdentity | null,
  env: LifeSpaceRuntimeToolEnv,
): Promise<RuntimeToolDescriptor | null> => {
  if (!identity || !isLifeSpaceReadToolConfigured(env)) return null

  const signingKey = env.RUNTIME_TOOL_GRANT_SIGNING_KEY?.trim()
  if (!signingKey) return null

  const grant = await issueRuntimeToolGrant(
    {
      version: 1,
      toolId: LIFESPACE_READ_TOOL_ID,
      runId,
      principalId: identity.principal.id,
      actorId: identity.actor.id,
      applicationId: identity.application.id,
      expiresAt: Date.now() + TOOL_GRANT_TTL_MS,
    },
    signingKey,
  )

  return {
    id: LIFESPACE_READ_TOOL_ID,
    name: 'LifeSpace Read',
    description:
      'Read the current user-authorized LifeSpace shared reality. Use discover first to learn reachable Spaces, model routes, fields, query metadata and effective read authority; then query or get only models returned by discovery.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['operation'],
          properties: { operation: { const: 'discover' } },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['operation', 'spaceId', 'modelRoute'],
          properties: {
            operation: { const: 'query' },
            spaceId: { type: 'string', minLength: 1 },
            modelRoute: { type: 'string', minLength: 1 },
            query: {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
            },
          },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['operation', 'spaceId', 'modelRoute', 'recordId'],
          properties: {
            operation: { const: 'get' },
            spaceId: { type: 'string', minLength: 1 },
            modelRoute: { type: 'string', minLength: 1 },
            recordId: { type: 'string', minLength: 1 },
          },
        },
      ],
    },
    invocation: {
      type: 'http',
      method: 'POST',
      url: `${new URL(request.url).origin}/v1/runtime/tools/${LIFESPACE_READ_TOOL_ID}/invoke`,
      authorization: `Bearer ${grant}`,
    },
  }
}

const stringField = (
  value: unknown,
  field: string,
): string => {
  if (typeof value !== 'string') {
    throw new LifeSpaceRuntimeToolError(`invalid_${field}`, 400)
  }
  const normalized = value.trim()
  if (!normalized || normalized.length > 256 || normalized.includes('/')) {
    throw new LifeSpaceRuntimeToolError(`invalid_${field}`, 400)
  }
  return normalized
}

const readInput = (value: unknown): LifeSpaceReadInput => {
  if (!isRecord(value) || typeof value.operation !== 'string') {
    throw new LifeSpaceRuntimeToolError('invalid_tool_input', 400)
  }

  if (value.operation === 'discover') {
    return { operation: 'discover' }
  }

  const spaceId = stringField(value.spaceId, 'space_id')
  const modelRoute = stringField(value.modelRoute, 'model_route')

  if (value.operation === 'get') {
    return {
      operation: 'get',
      spaceId,
      modelRoute,
      recordId: stringField(value.recordId, 'record_id'),
    }
  }

  if (value.operation === 'query') {
    const query = value.query
    if (query !== undefined && !isRecord(query)) {
      throw new LifeSpaceRuntimeToolError('invalid_query', 400)
    }
    const normalizedQuery: Record<string, string | number | boolean | string[]> = {}
    for (const [key, entry] of Object.entries(query ?? {})) {
      const normalizedKey = stringField(key, 'query_key')
      if (
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean' ||
        (Array.isArray(entry) && entry.every((item) => typeof item === 'string'))
      ) {
        normalizedQuery[normalizedKey] = entry
        continue
      }
      throw new LifeSpaceRuntimeToolError('invalid_query_value', 400)
    }
    return { operation: 'query', spaceId, modelRoute, query: normalizedQuery }
  }

  throw new LifeSpaceRuntimeToolError('unsupported_read_operation', 400)
}

const issueLifeSpaceAgentToken = async (
  claims: RuntimeToolGrantClaims,
  env: LifeSpaceRuntimeToolEnv,
): Promise<string> => {
  const identityBase = normalizedBaseUrl(env.LIFESPACE_IDENTITY_BASE_URL)
  const applicationCredential = env.LIFESPACE_APPLICATION_CREDENTIAL?.trim()
  if (!identityBase || !applicationCredential) {
    throw new LifeSpaceRuntimeToolError('lifespace_identity_not_configured', 503)
  }

  const response = await fetch(`${identityBase}/internal/v1/agent-tokens`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${applicationCredential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: claims.principalId,
      agentId: claims.actorId,
      scopes: [...LIFESPACE_READ_SCOPES],
    }),
  })

  const payload = await response.json().catch(() => null)
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
  if (
    !response.ok ||
    !data ||
    typeof data.accessToken !== 'string' ||
    data.principalId !== claims.principalId ||
    !isRecord(data.actor) ||
    data.actor.type !== 'agent' ||
    data.actor.id !== claims.actorId ||
    data.applicationId !== claims.applicationId
  ) {
    const status = response.status === 401 || response.status === 403 ? 403 : 502
    throw new LifeSpaceRuntimeToolError('lifespace_delegation_unavailable', status)
  }

  return data.accessToken
}

const corePath = (input: LifeSpaceReadInput): string => {
  if (input.operation === 'discover') return '/me/_discovery'

  const collection = `/spaces/${encodeURIComponent(input.spaceId)}/${encodeURIComponent(input.modelRoute)}`
  if (input.operation === 'get') {
    return `${collection}/${encodeURIComponent(input.recordId)}`
  }
  return collection
}

const queryString = (input: LifeSpaceReadInput): string => {
  if (input.operation !== 'query' || !input.query) return ''
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(input.query)) {
    if (Array.isArray(value)) {
      for (const entry of value) parameters.append(key, entry)
    } else {
      parameters.append(key, String(value))
    }
  }
  const encoded = parameters.toString()
  return encoded ? `?${encoded}` : ''
}

export const invokeLifeSpaceReadTool = async (
  request: Request,
  env: LifeSpaceRuntimeToolEnv,
): Promise<Response> => {
  const signingKey = env.RUNTIME_TOOL_GRANT_SIGNING_KEY?.trim()
  if (!signingKey) {
    return Response.json({ error: 'runtime_tool_invocation_not_configured' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization')
  const grant = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  if (!grant) {
    return Response.json({ error: 'runtime_tool_grant_required' }, { status: 401 })
  }

  const claims = await verifyRuntimeToolGrant(grant, signingKey)
  if (!claims) {
    return Response.json({ error: 'invalid_runtime_tool_grant' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!isRecord(body) || !Object.hasOwn(body, 'input')) {
      throw new LifeSpaceRuntimeToolError('runtime_tool_input_required', 400)
    }
    const input = readInput(body.input)
    const coreBase = normalizedBaseUrl(env.LIFESPACE_CORE_API_BASE_URL)
    if (!coreBase) {
      throw new LifeSpaceRuntimeToolError('lifespace_core_not_configured', 503)
    }

    // The delegated Core JWT exists only inside this trusted invocation and is
    // never placed in the Canonical Run Envelope or returned to the Runtime.
    const delegatedToken = await issueLifeSpaceAgentToken(claims, env)
    const response = await fetch(`${coreBase}${corePath(input)}${queryString(input)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${delegatedToken}`,
      },
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      // Preserve LifeSpace's authorization/not-found status while avoiding raw
      // upstream text or credential-bearing transport details.
      return Response.json(
        { error: 'lifespace_request_denied', status: response.status, detail: payload },
        { status: response.status },
      )
    }

    return Response.json({ toolId: LIFESPACE_READ_TOOL_ID, output: payload })
  } catch (error) {
    if (error instanceof LifeSpaceRuntimeToolError) {
      return Response.json({ error: error.code }, { status: error.status })
    }
    return Response.json({ error: 'lifespace_runtime_tool_failed' }, { status: 502 })
  }
}
