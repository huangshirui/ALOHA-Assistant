import type { InteractionInput } from '@aloha/contracts'
import { CapabilityRegistry } from '@aloha/capabilities'

const registry = new CapabilityRegistry()

const json = (value: unknown, status = 200) =>
  Response.json(value, { status })

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({
        service: 'aloha-agent-control',
        ok: true,
        capabilities: registry.list(),
        runtimeBackend: null,
      })
    }

    if (url.pathname === '/v1/interactions' && request.method === 'POST') {
      const input = (await request.json()) as InteractionInput

      return json(
        {
          error: 'runtime_backend_not_configured',
          requestId: input.requestId ?? crypto.randomUUID(),
        },
        503,
      )
    }

    return json({ error: 'not_found' }, 404)
  },
}
