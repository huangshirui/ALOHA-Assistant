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

    const requestInit = fetchImpl.mock.calls[0]?.[1]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('authorization')).toBe('Bearer synthetic-test-token')
  })

  it('normalizes retryable backend HTTP failures without reading the response body', async () => {
    const adapter = new N8nAgentRuntimeAdapter(
      { webhookUrl: 'https://example.com/aloha-agent' },
      async () => new Response('synthetic private backend detail', { status: 503 }),
    )

    await expect(adapter.run(runRequest)).rejects.toMatchObject({
      code: 'n8n_http_error',
      retryable: true,
    })
  })

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
