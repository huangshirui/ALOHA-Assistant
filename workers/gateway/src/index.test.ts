import { describe, expect, it, vi } from 'vitest'

import worker from './index'

describe('gateway routing', () => {
  it('forwards runtime capability invocation to Agent Control unchanged', async () => {
    const binding = {
      fetch: vi.fn(async (request: Request) => {
        expect(request.url).toBe(
          'https://example.com/v1/runtime/capabilities/math.calculate/invoke',
        )
        expect(request.headers.get('authorization')).toBe('Bearer synthetic-grant')
        await expect(request.json()).resolves.toEqual({
          input: { operation: 'add', left: 7, right: 5 },
        })
        return Response.json({ output: { value: 12 } })
      }),
    }

    const response = await worker.fetch(
      new Request(
        'https://example.com/v1/runtime/capabilities/math.calculate/invoke',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer synthetic-grant',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            input: { operation: 'add', left: 7, right: 5 },
          }),
        },
      ),
      { AGENT_CONTROL: binding },
    )

    expect(binding.fetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it('forwards runtime tool invocation to Agent Control unchanged', async () => {
    const binding = {
      fetch: vi.fn(async (request: Request) => {
        expect(request.url).toBe(
          'https://example.com/v1/runtime/tools/lifespace.read/invoke',
        )
        expect(request.headers.get('authorization')).toBe(
          'Bearer synthetic-tool-grant',
        )
        await expect(request.json()).resolves.toEqual({
          input: { operation: 'discover' },
        })
        return Response.json({ toolId: 'lifespace.read', output: { data: {} } })
      }),
    }

    const response = await worker.fetch(
      new Request(
        'https://example.com/v1/runtime/tools/lifespace.read/invoke',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer synthetic-tool-grant',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            input: { operation: 'discover' },
          }),
        },
      ),
      { AGENT_CONTROL: binding },
    )

    expect(binding.fetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it('preserves the server-visible Cloudflare Access assertion for Agent Control identity resolution', async () => {
    const binding = {
      fetch: vi.fn(async (request: Request) => {
        expect(request.headers.get('Cf-Access-Jwt-Assertion')).toBe(
          'synthetic.payload.signature',
        )
        return new Response('event: run.completed\ndata: {}\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
      }),
    }

    const response = await worker.fetch(
      new Request('https://example.com/v1/interactions', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': 'synthetic.payload.signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: 'Synthetic interaction' }),
      }),
      { AGENT_CONTROL: binding },
    )

    expect(binding.fetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it.each([
    '/v1/runtime/capabilities/math.calculate/invoke',
    '/v1/runtime/tools/lifespace.read/invoke',
  ])('does not expose runtime callback route %s without Agent Control binding', async (path) => {
    const response = await worker.fetch(
      new Request(`https://example.com${path}`, { method: 'POST' }),
      {},
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'agent_control_binding_not_configured',
    })
  })
})
