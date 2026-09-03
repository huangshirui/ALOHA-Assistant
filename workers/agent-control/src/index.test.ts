import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index'

const signingKey = 'synthetic-capability-signing-key-for-tests-only'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('agent-control runtime and direct capability slice', () => {
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

  it('keeps capabilities hidden from the runtime until capability grants are configured', async () => {
    let runtimeBody: Record<string, unknown> | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init) => {
        runtimeBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return Response.json({ outputText: 'No capability needed' })
      }),
    )

    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'Hello' }),
      }),
      { N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent' },
    )

    await response.text()
    expect(runtimeBody?.capabilities).toEqual([])
  })

  it('exposes an authorized math capability and accepts its run-scoped grant', async () => {
    let runtimeBody: {
      capabilities?: Array<{
        id: string
        inputSchema: Record<string, unknown>
        invocation: {
          url: string
          authorization: string
        }
      }>
    } | undefined

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init) => {
        runtimeBody = JSON.parse(String(init?.body)) as typeof runtimeBody
        return Response.json({ outputText: 'The result is 12.' })
      }),
    )

    const env = {
      N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent',
      CAPABILITY_GRANT_SIGNING_KEY: signingKey,
    }
    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'What is 7 + 5?' }),
      }),
      env,
    )

    const streamBody = await response.text()
    expect(streamBody).toContain('event: run.completed')

    const descriptor = runtimeBody?.capabilities?.[0]
    expect(descriptor?.id).toBe('math.calculate')
    expect(descriptor?.inputSchema).toMatchObject({ type: 'object' })
    expect(descriptor?.invocation.url).toBe(
      'https://example.com/v1/runtime/capabilities/math.calculate/invoke',
    )
    expect(descriptor?.invocation.authorization).toMatch(/^Bearer [^.]+\.[^.]+$/u)

    const invocation = await worker.fetch(
      new Request(descriptor!.invocation.url, {
        method: 'POST',
        headers: {
          authorization: descriptor!.invocation.authorization,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          input: { operation: 'add', left: 7, right: 5 },
        }),
      }),
      env,
    )

    expect(invocation.status).toBe(200)
    await expect(invocation.json()).resolves.toEqual({
      capabilityId: 'math.calculate',
      output: { value: 12 },
    })
  })

  it('denies capability invocation without a grant', async () => {
    const response = await worker.fetch(
      new Request(
        'https://example.com/v1/runtime/capabilities/math.calculate/invoke',
        {
          method: 'POST',
          body: JSON.stringify({
            input: { operation: 'add', left: 7, right: 5 },
          }),
        },
      ),
      { CAPABILITY_GRANT_SIGNING_KEY: signingKey },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'capability_grant_required',
    })
  })

  it('denies a tampered capability grant', async () => {
    let authorization = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          capabilities: Array<{
            invocation: { authorization: string }
          }>
        }
        authorization = body.capabilities[0]?.invocation.authorization ?? ''
        return Response.json({ outputText: 'Synthetic result' })
      }),
    )

    const env = {
      N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent',
      CAPABILITY_GRANT_SIGNING_KEY: signingKey,
    }
    const runResponse = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'Calculate something' }),
      }),
      env,
    )
    await runResponse.text()

    const response = await worker.fetch(
      new Request(
        'https://example.com/v1/runtime/capabilities/math.calculate/invoke',
        {
          method: 'POST',
          headers: { authorization: `${authorization}tampered` },
          body: JSON.stringify({
            input: { operation: 'add', left: 7, right: 5 },
          }),
        },
      ),
      env,
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_capability_grant',
    })
  })

  it('rejects invalid capability input without exposing internal detail', async () => {
    let descriptor:
      | { invocation: { url: string; authorization: string } }
      | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          capabilities: Array<{
            invocation: { url: string; authorization: string }
          }>
        }
        descriptor = body.capabilities[0]
        return Response.json({ outputText: 'Synthetic result' })
      }),
    )

    const env = {
      N8N_AGENT_WEBHOOK_URL: 'https://example.com/n8n-agent',
      CAPABILITY_GRANT_SIGNING_KEY: signingKey,
    }
    const runResponse = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'Calculate something' }),
      }),
      env,
    )
    await runResponse.text()

    const response = await worker.fetch(
      new Request(descriptor!.invocation.url, {
        method: 'POST',
        headers: { authorization: descriptor!.invocation.authorization },
        body: JSON.stringify({
          input: { operation: 'divide', left: 7, right: 0 },
        }),
      }),
      env,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_capability_input',
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

  it('normalizes invalid runtime configuration into a safe run.failed event', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)

    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({ text: 'Hello' }),
      }),
      { N8N_AGENT_WEBHOOK_URL: 'not-a-url' },
    )

    const body = await response.text()
    expect(body).toContain('event: run.started')
    expect(body).toContain('event: run.failed')
    expect(body).toContain('n8n_invalid_config')
    expect(body).not.toContain('not-a-url')
    expect(fetchImpl).not.toHaveBeenCalled()
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
    expect(body).toContain('n8n_backend_error')
    expect(body).not.toContain('synthetic backend detail')
  })
})
