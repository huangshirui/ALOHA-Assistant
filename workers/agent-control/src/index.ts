import type {
  CapabilityContext,
  InteractionInput,
  RunEvent,
  RuntimeCapabilityDescriptor,
} from '@aloha/contracts'
import {
  CapabilityInputError,
  createDefaultCapabilityRegistry,
} from '@aloha/capabilities'
import {
  N8nAgentRuntimeAdapter,
  N8nRuntimeError,
} from '@aloha/runtime-n8n'

interface Env {
  N8N_AGENT_WEBHOOK_URL?: string
  N8N_AGENT_AUTH_TOKEN?: string
  CAPABILITY_GRANT_SIGNING_KEY?: string
}

interface CapabilityGrantClaims {
  version: 1
  capabilityId: string
  runId: string
  applicationId: string
  scopes: string[]
  expiresAt: number
}

const ALOHA_APPLICATION_ID = 'aloha-assistant'
const CAPABILITY_GRANT_TTL_MS = 5 * 60 * 1000
const registry = createDefaultCapabilityRegistry()
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const json = (value: unknown, status = 200) =>
  Response.json(value, { status })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readInteractionInput = async (
  request: Request,
): Promise<InteractionInput | null> => {
  let value: unknown

  try {
    value = await request.json()
  } catch {
    return null
  }

  if (!isRecord(value)) {
    return null
  }

  return {
    requestId:
      typeof value.requestId === 'string' ? value.requestId : undefined,
    conversationId:
      typeof value.conversationId === 'string'
        ? value.conversationId
        : undefined,
    text: typeof value.text === 'string' ? value.text : undefined,
    attachments: Array.isArray(value.attachments)
      ? (value.attachments as InteractionInput['attachments'])
      : undefined,
  }
}

const toSseFrame = (event: RunEvent): Uint8Array =>
  encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

const fromBase64Url = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null
  }

  const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`

  try {
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

const importCapabilityGrantKey = (signingKey: string) =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )

const issueCapabilityGrant = async (
  claims: CapabilityGrantClaims,
  signingKey: string,
): Promise<string> => {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)))
  const key = await importCapabilityGrantKey(signingKey)
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
  )

  return `${payload}.${toBase64Url(signature)}`
}

const verifyCapabilityGrant = async (
  token: string,
  signingKey: string,
  expectedCapabilityId: string,
): Promise<CapabilityGrantClaims | null> => {
  const [payload, encodedSignature, extra] = token.split('.')

  if (!payload || !encodedSignature || extra) {
    return null
  }

  const payloadBytes = fromBase64Url(payload)
  const signature = fromBase64Url(encodedSignature)

  if (!payloadBytes || !signature) {
    return null
  }

  const key = await importCapabilityGrantKey(signingKey)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    encoder.encode(payload),
  )

  if (!valid) {
    return null
  }

  let claims: unknown

  try {
    claims = JSON.parse(decoder.decode(payloadBytes))
  } catch {
    return null
  }

  if (
    !isRecord(claims) ||
    claims.version !== 1 ||
    claims.capabilityId !== expectedCapabilityId ||
    typeof claims.runId !== 'string' ||
    claims.applicationId !== ALOHA_APPLICATION_ID ||
    !Array.isArray(claims.scopes) ||
    !claims.scopes.every((scope) => typeof scope === 'string') ||
    typeof claims.expiresAt !== 'number' ||
    claims.expiresAt <= Date.now()
  ) {
    return null
  }

  return claims as unknown as CapabilityGrantClaims
}

const capabilityIds = () => registry.list().map((capability) => capability.id)

const allowedCapabilities = (context: CapabilityContext) =>
  registry.list().filter(
    (capability) =>
      capability.confirmation === 'never' &&
      capability.requiredScopes.every((scope) => context.scopes.includes(scope)),
  )

const runtimeCapabilityDescriptors = async (
  request: Request,
  runId: string,
  signingKey?: string,
): Promise<RuntimeCapabilityDescriptor[]> => {
  if (!signingKey) {
    return []
  }

  const context: CapabilityContext = {
    runId,
    applicationId: ALOHA_APPLICATION_ID,
    scopes: [],
  }
  const origin = new URL(request.url).origin
  const descriptors: RuntimeCapabilityDescriptor[] = []

  for (const capability of allowedCapabilities(context)) {
    const token = await issueCapabilityGrant(
      {
        version: 1,
        capabilityId: capability.id,
        runId,
        applicationId: ALOHA_APPLICATION_ID,
        scopes: context.scopes,
        expiresAt: Date.now() + CAPABILITY_GRANT_TTL_MS,
      },
      signingKey,
    )

    descriptors.push({
      id: capability.id,
      name: capability.name,
      description: capability.description,
      inputSchema: capability.inputSchema,
      invocation: {
        type: 'http',
        method: 'POST',
        url: `${origin}/v1/runtime/capabilities/${encodeURIComponent(capability.id)}/invoke`,
        authorization: `Bearer ${token}`,
      },
    })
  }

  return descriptors
}

const capabilityIdFromPath = (pathname: string): string | null => {
  const match = pathname.match(/^\/v1\/runtime\/capabilities\/([^/]+)\/invoke$/u)

  if (!match) {
    return null
  }

  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

const invokeCapability = async (
  request: Request,
  env: Env,
  capabilityId: string,
): Promise<Response> => {
  const capability = registry.get(capabilityId)

  if (!capability) {
    return json({ error: 'capability_not_found' }, 404)
  }

  if (!env.CAPABILITY_GRANT_SIGNING_KEY) {
    return json({ error: 'capability_invocation_not_configured' }, 503)
  }

  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!token) {
    return json({ error: 'capability_grant_required' }, 401)
  }

  const claims = await verifyCapabilityGrant(
    token,
    env.CAPABILITY_GRANT_SIGNING_KEY,
    capabilityId,
  )

  if (!claims) {
    return json({ error: 'invalid_capability_grant' }, 401)
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json_body' }, 400)
  }

  if (!isRecord(body) || !Object.hasOwn(body, 'input')) {
    return json({ error: 'capability_input_required' }, 400)
  }

  const context: CapabilityContext = {
    runId: claims.runId,
    applicationId: claims.applicationId,
    scopes: claims.scopes,
  }

  if (
    capability.confirmation !== 'never' ||
    !capability.requiredScopes.every((scope) => context.scopes.includes(scope))
  ) {
    return json({ error: 'capability_not_allowed' }, 403)
  }

  try {
    const output = await capability.execute(body.input, context)
    return json({ capabilityId, output })
  } catch (error) {
    if (error instanceof CapabilityInputError) {
      return json({ error: 'invalid_capability_input' }, 400)
    }

    return json({ error: 'capability_execution_failed' }, 500)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const capabilityId = capabilityIdFromPath(url.pathname)

    if (capabilityId && request.method === 'POST') {
      return invokeCapability(request, env, capabilityId)
    }

    if (url.pathname === '/health') {
      return json({
        service: 'aloha-agent-control',
        ok: true,
        capabilities: capabilityIds(),
        capabilityInvocationConfigured: Boolean(env.CAPABILITY_GRANT_SIGNING_KEY),
        runtimeBackend: env.N8N_AGENT_WEBHOOK_URL ? 'n8n-agent' : null,
      })
    }

    if (url.pathname === '/v1/interactions' && request.method === 'POST') {
      const input = await readInteractionInput(request)

      if (!input) {
        return json({ error: 'invalid_json_body' }, 400)
      }

      const text = input.text?.trim()

      if (!text) {
        return json({ error: 'text_input_required' }, 400)
      }

      if (input.attachments && input.attachments.length > 0) {
        return json({ error: 'attachments_not_supported_in_slice_1' }, 400)
      }

      if (!env.N8N_AGENT_WEBHOOK_URL) {
        return json({ error: 'runtime_backend_not_configured' }, 503)
      }

      const requestId = input.requestId ?? crypto.randomUUID()
      const conversationId = input.conversationId ?? crypto.randomUUID()
      const runId = crypto.randomUUID()
      const capabilities = await runtimeCapabilityDescriptors(
        request,
        runId,
        env.CAPABILITY_GRANT_SIGNING_KEY,
      )
      const adapter = new N8nAgentRuntimeAdapter({
        webhookUrl: env.N8N_AGENT_WEBHOOK_URL,
        authToken: env.N8N_AGENT_AUTH_TOKEN,
      })

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let sequence = 0

          const base = () => ({
            eventId: crypto.randomUUID(),
            runId,
            conversationId,
            sequence: ++sequence,
            occurredAt: new Date().toISOString(),
          })

          const emit = (event: RunEvent) => {
            controller.enqueue(toSseFrame(event))
          }

          const execute = async () => {
            emit({
              ...base(),
              type: 'run.started',
              requestId,
            })

            try {
              const result = await adapter.run({
                requestId,
                runId,
                conversationId,
                input: { text },
                capabilities,
              })

              emit({
                ...base(),
                type: 'output.delta',
                delta: result.outputText,
              })

              emit({
                ...base(),
                type: 'run.completed',
              })
            } catch (error) {
              const normalized =
                error instanceof N8nRuntimeError
                  ? {
                      code: error.code,
                      retryable: error.retryable,
                    }
                  : {
                      code: 'runtime_execution_failed',
                      retryable: false,
                    }

              emit({
                ...base(),
                type: 'run.failed',
                error: {
                  ...normalized,
                  message: 'ALOHA could not complete this run.',
                },
              })
            } finally {
              controller.close()
            }
          }

          void execute()
        },
      })

      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
        },
      })
    }

    return json({ error: 'not_found' }, 404)
  },
}
