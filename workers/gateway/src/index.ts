interface AgentBinding {
  fetch(request: Request): Promise<Response>
}

interface Env {
  AGENT?: AgentBinding
}

const json = (value: unknown, status = 200) =>
  Response.json(value, { status })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({ service: 'aloha-gateway', ok: true })
    }

    if (url.pathname === '/v1/interactions' && request.method === 'POST') {
      if (!env.AGENT) {
        return json({ error: 'agent_binding_not_configured' }, 503)
      }

      return env.AGENT.fetch(request)
    }

    return json({ error: 'not_found' }, 404)
  },
}
