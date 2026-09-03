import { describe, expect, it } from 'vitest'

import {
  CapabilityInputError,
  CapabilityRegistry,
  mathCalculateCapability,
} from './index'

const context = {
  runId: 'run-example',
  applicationId: 'aloha-example',
  scopes: [],
}

describe('CapabilityRegistry', () => {
  it('registers and discovers a capability by stable id', () => {
    const registry = new CapabilityRegistry()
    registry.register(mathCalculateCapability)

    expect(registry.get('math.calculate')).toBe(mathCalculateCapability)
    expect(registry.list()).toEqual([mathCalculateCapability])
  })

  it('rejects duplicate capability ids', () => {
    const registry = new CapabilityRegistry()
    registry.register(mathCalculateCapability)

    expect(() => registry.register(mathCalculateCapability)).toThrow(
      'Capability already registered: math.calculate',
    )
  })
})

describe('math.calculate', () => {
  it.each([
    ['add', 7, 5, 12],
    ['subtract', 7, 5, 2],
    ['multiply', 7, 5, 35],
    ['divide', 7, 2, 3.5],
  ] as const)('executes %s deterministically', async (operation, left, right, value) => {
    await expect(
      mathCalculateCapability.execute(
        { operation, left, right },
        context,
      ),
    ).resolves.toEqual({ value })
  })

  it('rejects invalid input rather than coercing values', async () => {
    await expect(
      mathCalculateCapability.execute(
        { operation: 'add', left: '7', right: 5 },
        context,
      ),
    ).rejects.toBeInstanceOf(CapabilityInputError)
  })

  it('rejects division by zero', async () => {
    await expect(
      mathCalculateCapability.execute(
        { operation: 'divide', left: 7, right: 0 },
        context,
      ),
    ).rejects.toThrow('Division by zero is not allowed.')
  })
})
