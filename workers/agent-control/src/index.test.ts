import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('agent-control slice 1', () => {
  it('rejects a run before admission when text input is missing', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent' },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'text_input_required',
    })
  })

  it('requires the n8n runtime configuration before accepting a run', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'Hello' }),
      }),
      {},
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'runtime_backend_not_configured',
    })
  })

  it('normalizes a successful n8n result into canonical SSE events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ outputText: 'Hello from ALOHA' })),
    )

    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'request-example',
          conversationId: 'conversation-example',
          text: 'Hello',
        }),
      }),
      { N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent' },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const body = await response.text()
    expect(body).toContain('event: run.started')
    expect(body).toContain('event: output.delta')
    expect(body).toContain('Hello from ALOHA')
    expect(body).toContain('event: run.completed')
    expect(body).not.toContain('event: run.failed')
  })

  it('normalizes backend failure into a safe run.failed event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('synthetic backend detail', { status: 503 })),
    )

    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'Hello' }),
      }),
      { N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent' },
    )

    const body = await response.text()
    expect(body).toContain('event: run.started')
    expect(body).toContain('event: run.failed')
    expect(body).toContain('n8n_http_error')
    expect(body).not.toContain('synthetic backend detail')
  })
})
