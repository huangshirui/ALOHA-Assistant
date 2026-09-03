import { describe, expect, it, vi } from 'vitest'

import type { RuntimeRunRequest } from '@aloha/contracts'
import { N8nAgentRuntimeAdapter } from './index'

const runRequest: RuntimeRunRequest = {
  requestId: 'request-example',
  runId: 'run-example',
  conversationId: 'conversation-example',
  input: { text: 'Hello ALOHA' },
  capabilities: [],
}

describe('N8nAgentRuntimeAdapter', () => {
  it('maps the ALOHA runtime request to the n8n workflow contract', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>

      expect(body).toEqual({
        schemaVersion: 1,
        run: {
          requestId: 'request-example',
          runId: 'run-example',
          conversationId: 'conversation-example',
        },
        input: { text: 'Hello ALOHA' },
        capabilities: [],
      })

      return Response.json({
        outputText: 'Hello from n8n',
        backendRunId: 'execution-example',
      })
    })

    const adapter = new N8nAgentRuntimeAdapter(
      {
        webhookUrl: 'https://example.com/aloha-agent',
        authToken: 'synthetic-test-token',
      },
      fetchImpl,
    )

    await expect(adapter.run(runRequest)).resolves.toEqual({
      outputText: 'Hello from n8n',
      backendRunId: 'execution-example',
    })

    expect(fetchImpl.mock.calls[0]?.[0]).toEqual(
      new URL('https://example.com/aloha-agent'),
    )
    const requestInit = fetchImpl.mock.calls[0]?.[1]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('authorization')).toBe('Bearer synthetic-test-token')
  })

  it('invokes fetch without binding the adapter as the receiver', async () => {
    let receiver: unknown = 'not-called'
    const fetchImpl = async function (
      this: unknown,
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) {
      receiver = this
      return Response.json({ outputText: 'receiver-safe' })
    }

    const adapter = new N8nAgentRuntimeAdapter(
      { webhookUrl: 'https://example.com/aloha-agent' },
      fetchImpl,
    )

    await expect(adapter.run(runRequest)).resolves.toEqual({
      outputText: 'receiver-safe',
      backendRunId: undefined,
    })
    expect(receiver).toBeUndefined()
  })

  it('rejects malformed or unsafe webhook URLs before network access', async () => {
    const fetchImpl = vi.fn()
    const malformedAdapter = new N8nAgentRuntimeAdapter(
      { webhookUrl: 'not-a-url' },
      fetchImpl,
    )
    const insecureAdapter = new N8nAgentRuntimeAdapter(
      { webhookUrl: 'http://example.com/aloha-agent' },
      fetchImpl,
    )

    await expect(malformedAdapter.run(runRequest)).rejects.toMatchObject({
      code: 'n8n_invalid_config',
      retryable: false,
    })
    await expect(insecureAdapter.run(runRequest)).rejects.toMatchObject({
      code: 'n8n_invalid_config',
      retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['synthetic error 1042', 'n8n_worker_route_conflict', false],
    ['synthetic error 1021', 'n8n_target_unavailable', false],
    ['synthetic error 1024', 'n8n_target_unavailable', false],
    ['Network connection lost.', 'n8n_network_connection_lost', true],
    ['synthetic unknown fetch failure', 'n8n_unreachable', true],
  ])(
    'classifies fetch failure %s without exposing backend detail',
    async (failureMessage, expectedCode, retryable) => {
      const adapter = new N8nAgentRuntimeAdapter(
        { webhookUrl: 'https://example.com/aloha-agent' },
        async () => {
          throw new TypeError(failureMessage)
        },
      )

      let caught: unknown
      try {
        await adapter.run(runRequest)
      } catch (error) {
        caught = error
      }

      expect(caught).toMatchObject({ code: expectedCode, retryable })
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).not.toContain(failureMessage)
    },
  )

  it.each([
    [401, 'n8n_auth_failed', false],
    [403, 'n8n_auth_failed', false],
    [404, 'n8n_endpoint_not_found', false],
    [405, 'n8n_method_not_allowed', false],
    [408, 'n8n_request_timeout', true],
    [429, 'n8n_rate_limited', true],
    [503, 'n8n_backend_error', true],
    [400, 'n8n_http_error', false],
  ])(
    'classifies HTTP %s without reading backend response detail',
    async (status, expectedCode, retryable) => {
      const adapter = new N8nAgentRuntimeAdapter(
        { webhookUrl: 'https://example.com/aloha-agent' },
        async () => new Response('synthetic private backend detail', { status }),
      )

      let caught: unknown
      try {
        await adapter.run(runRequest)
      } catch (error) {
        caught = error
      }

      expect(caught).toMatchObject({ code: expectedCode, retryable })
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).not.toContain('synthetic private backend detail')
    },
  )

  it('rejects responses that do not implement the adapter contract', async () => {
    const adapter = new N8nAgentRuntimeAdapter(
      { webhookUrl: 'https://example.com/aloha-agent' },
      async () => Response.json({ text: 'wrong field' }),
    )

    await expect(adapter.run(runRequest)).rejects.toMatchObject({
      code: 'n8n_invalid_response',
      retryable: false,
    })
  })
})
