import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index'

const identityEnv = {
  N8N_AGENT_WEBHOOK_URL: 'https://runtime.example/aloha-agent',
  LIFESPACE_IDENTITY_BASE_URL: 'https://identity.example',
  LIFESPACE_APPLICATION_CREDENTIAL:
    'lsa_synthetic_application_credential_for_tests_only_1234567890',
}

const interaction = (body: Record<string, unknown> = { text: 'Hello ALOHA' }) =>
  new Request('https://aloha.example/v1/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Cf-Access-Jwt-Assertion': 'synthetic.payload.signature',
    },
    body: JSON.stringify(body),
  })

const installTrustedIdentityFetch = (
  onRuntime: (body: Record<string, unknown>) => Response | Promise<Response>,
) =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))

    if (url.origin === 'https://identity.example') {
      if (url.pathname === '/internal/v1/access/tokens') {
        return Response.json({ data: { accessToken: 'synthetic-user-token' } })
      }
      if (url.pathname === '/api/v1/me') {
        return Response.json({ data: { id: 'usr_example' } })
      }
      if (url.pathname === '/internal/v1/agents') {
        return Response.json({
          data: {
            items: [
              { id: 'agt_aloha', displayName: 'ALOHA Assistant', status: 'active' },
            ],
          },
        })
      }
      if (url.pathname === '/internal/v1/agent-tokens') {
        return Response.json({
          data: {
            accessToken: 'synthetic-delegated-token',
            principalId: 'usr_example',
            actor: { type: 'agent', id: 'agt_aloha' },
            applicationId: 'app_aloha',
          },
        })
      }
    }

    if (url.origin === 'https://runtime.example') {
      return onRuntime(JSON.parse(String(init?.body)) as Record<string, unknown>)
    }

    return new Response(null, { status: 404 })
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('trusted M3 Run integration', () => {
  it('builds Canonical Run Envelope v1 from LifeSpace identity and durable admission state', async () => {
    let runtimeEnvelope: Record<string, unknown> | undefined
    const stateCalls: Array<{ path: string; body: Record<string, unknown> }> = []
    const runtimeFetch = installTrustedIdentityFetch(async (body) => {
      runtimeEnvelope = body
      return Response.json({
        outputText: 'Hello from trusted ALOHA',
        backendRunId: 'execution-example',
      })
    })
    vi.stubGlobal('fetch', runtimeFetch)

    const stateStub = {
      async fetch(input: RequestInfo | URL, init?: RequestInit) {
        const url = new URL(String(input))
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        stateCalls.push({ path: url.pathname, body })

        if (url.pathname === '/admit') {
          expect(body).toMatchObject({
            requestId: 'request-example',
            principalId: 'usr_example',
            actorId: 'agt_aloha',
            applicationId: 'app_aloha',
            inputText: 'Hello ALOHA',
          })
          return Response.json({
            conversationId: 'cnv_persisted',
            runId: 'run_persisted',
          })
        }

        return Response.json({ ok: true })
      },
    }
    const stateNamespace = {
      getByName(name: string) {
        expect(name).toBe('usr_example')
        return stateStub
      },
    }

    const response = await worker.fetch(
      interaction({ requestId: 'request-example', text: 'Hello ALOHA' }),
      { ...identityEnv, ALOHA_STATE: stateNamespace },
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('event: run.completed')
    expect(runtimeEnvelope).toEqual({
      schemaVersion: 1,
      run: {
        requestId: 'request-example',
        runId: 'run_persisted',
        conversationId: 'cnv_persisted',
      },
      input: { text: 'Hello ALOHA' },
      identity: {
        principal: { type: 'user', id: 'usr_example' },
        actor: { type: 'agent', id: 'agt_aloha' },
        application: { id: 'app_aloha' },
      },
      context: { channel: 'web' },
      capabilities: [],
    })
    expect(stateCalls.map((call) => call.path)).toEqual([
      '/admit',
      '/running',
      '/complete',
    ])
    expect(stateCalls[2]?.body).toEqual({
      runId: 'run_persisted',
      outputText: 'Hello from trusted ALOHA',
      backendRunId: 'execution-example',
    })
  })

  it('fails closed before durable admission when configured identity has no Access assertion', async () => {
    const runtimeFetch = vi.fn()
    vi.stubGlobal('fetch', runtimeFetch)

    const response = await worker.fetch(
      new Request('https://aloha.example/v1/interactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Hello' }),
      }),
      identityEnv,
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'identity_assertion_required',
    })
    expect(runtimeFetch).not.toHaveBeenCalled()
  })

  it('requires durable Conversation state for trusted Runs instead of silently falling back to transient IDs', async () => {
    vi.stubGlobal(
      'fetch',
      installTrustedIdentityFetch(async () =>
        Response.json({ outputText: 'should not run' }),
      ),
    )

    const response = await worker.fetch(interaction(), identityEnv)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'conversation_state_not_configured',
    })
  })

  it('propagates an unknown persisted Conversation as a safe product-level not-found response', async () => {
    vi.stubGlobal(
      'fetch',
      installTrustedIdentityFetch(async () =>
        Response.json({ outputText: 'should not run' }),
      ),
    )

    const stateNamespace = {
      getByName() {
        return {
          async fetch(input: RequestInfo | URL) {
            const path = new URL(String(input)).pathname
            if (path === '/admit') {
              return Response.json({ error: 'conversation_not_found' }, { status: 404 })
            }
            return Response.json({ ok: true })
          },
        }
      },
    }

    const response = await worker.fetch(
      interaction({ conversationId: 'cnv_unknown', text: 'Hello' }),
      { ...identityEnv, ALOHA_STATE: stateNamespace },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'conversation_not_found',
    })
  })
})
