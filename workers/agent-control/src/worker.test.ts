import { describe, expect, it } from 'vitest'

import workerFromIndex from './index'
import worker, { AlohaUserState } from './worker'

describe('agent-control deployment compatibility entry', () => {
  it('preserves the current Agent Control worker as the default export', () => {
    expect(worker).toBe(workerFromIndex)
  })

  it('keeps the legacy Durable Object class inert without deleting its namespace', async () => {
    const response = await new AlohaUserState().fetch()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: 'legacy_durable_object_not_in_use',
    })
  })
})
