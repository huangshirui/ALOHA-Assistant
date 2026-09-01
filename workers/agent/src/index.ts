import type { InteractionInput, InteractionOutput } from '@aloha/contracts'
import { CapabilityRegistry } from '@aloha/capabilities'

const registry = new CapabilityRegistry()

const json = (value: unknown, status = 200) =>
  Response.json(value, { status })

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({ service: 'aloha-agent', ok: true, capabilities: registry.list() })
    }

    if (url.pathname === '/v1/interactions' && request.method === 'POST') {
      const input = (await request.json()) as InteractionInput
      const output: InteractionOutput = {
        requestId: input.requestId ?? crypto.randomUUID(),
        kind: 'message',
        text: 'ALOHA Agent Runtime is ready.',
      }

      return json(output)
    }

    return json({ error: 'not_found' }, 404)
  },
}
