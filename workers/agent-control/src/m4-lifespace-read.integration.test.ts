import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index'

const env = {
  N8N_AGENT_WEBHOOK_URL: 'https://runtime.example/aloha-agent',
  LIFESPACE_IDENTITY_BASE_URL: 'https://identity.example',
  LIFESPACE_CORE_API_BASE_URL: 'https://core.example/api/v1',
  LIFESPACE_APPLICATION_CREDENTIAL:
    'lsa_synthetic_application_credential_for_tests_only_1234567890',
  RUNTIME_TOOL_GRANT_SIGNING_KEY:
    'synthetic-runtime-tool-signing-key-for-tests-only-1234567890',
}

const stateNamespace = {
  getByName() {
    return {
      async fetch(input: RequestInfo | URL) {
        const path = new URL(String(input)).pathname
        if (path === '/admit') {
          return Response.json({
            conversationId: 'cnv_m4',
            runId: 'run_m4',
          })
        }
        return Response.json({ ok: true })
      },
    }
  },
}

const interaction = () =>
  new Request('https://aloha.example/v1/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Cf-Access-Jwt-Assertion': 'synthetic.payload.signature',
    },
    body: JSON.stringify({ text: 'What tasks can I see?' }),
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('M4 LifeSpace read path', () => {
  it('carries only a run-scoped ALOHA Tool grant to n8n and re-authorizes at LifeSpace on invocation', async () => {
    let runtimeEnvelope: {
      tools?: Array<{
        id: string
        invocation: { url: string; authorization: string }
      }>
    } | undefined
    const agentTokenScopes: unknown[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input))

        if (url.origin === 'https://identity.example') {
          if (url.pathname === '/internal/v1/access/tokens') {
            return Response.json({ data: { accessToken: 'synthetic-user-token' } })
          }
          if (url.pathname === '/api/v1/me') {
            return Response.json({ data: { id: 'usr_m4' } })
          }
          if (url.pathname === '/internal/v1/agents') {
            return Response.json({
              data: {
                items: [
                  { id: 'agt_m4', displayName: 'ALOHA Assistant', status: 'active' },
                ],
              },
            })
          }
          if (url.pathname === '/internal/v1/agent-tokens') {
            const body = JSON.parse(String(init?.body)) as { scopes?: unknown }
            agentTokenScopes.push(body.scopes)
            return Response.json({
              data: {
                accessToken: 'synthetic-core-only-delegated-token',
                principalId: 'usr_m4',
                actor: { type: 'agent', id: 'agt_m4' },
                applicationId: 'aloha-assistant',
              },
            })
          }
        }

        if (url.origin === 'https://runtime.example') {
          runtimeEnvelope = JSON.parse(String(init?.body)) as typeof runtimeEnvelope
          return Response.json({ outputText: 'I can inspect your LifeSpace tasks.' })
        }

        if (url.origin === 'https://core.example') {
          expect(url.pathname).toBe('/api/v1/me/_discovery')
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer synthetic-core-only-delegated-token',
          )
          return Response.json({
            data: {
              spaces: [
                {
                  spaceId: 'spc_m4',
                  models: [
                    { key: 'task', route: 'tasks', access: ['read'] },
                  ],
                },
              ],
            },
          })
        }

        return new Response(null, { status: 404 })
      }),
    )

    const runResponse = await worker.fetch(
      interaction(),
      { ...env, ALOHA_STATE: stateNamespace },
    )
    expect(await runResponse.text()).toContain('event: run.completed')

    const tool = runtimeEnvelope?.tools?.find((entry) => entry.id === 'lifespace.read')
    expect(tool).toBeDefined()
    expect(tool?.invocation.authorization).toMatch(/^Bearer [^.]+\.[^.]+$/u)
    expect(JSON.stringify(runtimeEnvelope)).not.toContain('lsa_')
    expect(JSON.stringify(runtimeEnvelope)).not.toContain(
      'synthetic-core-only-delegated-token',
    )

    const toolResponse = await worker.fetch(
      new Request(tool!.invocation.url, {
        method: 'POST',
        headers: {
          authorization: tool!.invocation.authorization,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ input: { operation: 'discover' } }),
      }),
      { ...env, ALOHA_STATE: stateNamespace },
    )

    expect(toolResponse.status).toBe(200)
    await expect(toolResponse.json()).resolves.toMatchObject({
      toolId: 'lifespace.read',
      output: {
        data: {
          spaces: [
            {
              spaceId: 'spc_m4',
              models: [{ key: 'task', route: 'tasks', access: ['read'] }],
            },
          ],
        },
      },
    })

    // M3 identity resolution deliberately requests no Core resource scope;
    // the M4 read Tool requests only resources:read at the moment of use.
    expect(agentTokenScopes).toEqual([[], ['resources:read']])
  })
})
