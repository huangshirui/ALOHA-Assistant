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

  it('does not expose capability routes without Agent Control binding', async () => {
    const response = await worker.fetch(
      new Request(
        'https://example.com/v1/runtime/capabilities/math.calculate/invoke',
        { method: 'POST' },
      ),
      {},
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'agent_control_binding_not_configured',
    })
  })
})
