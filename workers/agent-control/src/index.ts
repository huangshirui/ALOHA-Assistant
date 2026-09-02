import type { InteractionInput, RunEvent } from '@aloha/contracts'
import { CapabilityRegistry } from '@aloha/capabilities'
import {
  N8nAgentRuntimeAdapter,
  N8nRuntimeError,
} from '@aloha/runtime-n8n'

interface Env {
  N8N_AGENT_WEBHOOK_URL?: string
  N8N_AGENT_AUTH_TOKEN?: string
}

const registry = new CapabilityRegistry()
const encoder = new TextEncoder()

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

const capabilityDescriptors = () =>
  registry.list().map((name) => ({
    name,
    description: registry.get(name)?.description ?? name,
  }))

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({
        service: 'aloha-agent-control',
        ok: true,
        capabilities: registry.list(),
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
                capabilities: capabilityDescriptors(),
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
