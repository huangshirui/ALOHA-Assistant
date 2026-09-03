import type {
  CapabilityContext,
  CapabilityMetadata,
} from '@aloha/contracts'

export interface CapabilityDefinition<TInput = unknown, TOutput = unknown>
  extends CapabilityMetadata {
  execute(input: TInput, context: CapabilityContext): Promise<TOutput>
}

export class CapabilityInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CapabilityInputError'
  }
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>()

  register(capability: CapabilityDefinition): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability already registered: ${capability.id}`)
    }

    this.capabilities.set(capability.id, capability)
  }

  get(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id)
  }

  list(): CapabilityDefinition[] {
    return [...this.capabilities.values()]
  }
}

export type MathOperation = 'add' | 'subtract' | 'multiply' | 'divide'

export interface MathCalculateInput {
  operation: MathOperation
  left: number
  right: number
}

export interface MathCalculateOutput {
  value: number
}

const mathInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['operation', 'left', 'right'],
  properties: {
    operation: {
      type: 'string',
      enum: ['add', 'subtract', 'multiply', 'divide'],
    },
    left: { type: 'number' },
    right: { type: 'number' },
  },
} as const

const mathOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: {
    value: { type: 'number' },
  },
} as const

const readMathInput = (input: unknown): MathCalculateInput => {
  if (typeof input !== 'object' || input === null) {
    throw new CapabilityInputError('Math input must be an object.')
  }

  const value = input as Record<string, unknown>
  const operation = value.operation
  const left = value.left
  const right = value.right

  if (
    operation !== 'add' &&
    operation !== 'subtract' &&
    operation !== 'multiply' &&
    operation !== 'divide'
  ) {
    throw new CapabilityInputError('Unsupported math operation.')
  }

  if (
    typeof left !== 'number' ||
    !Number.isFinite(left) ||
    typeof right !== 'number' ||
    !Number.isFinite(right)
  ) {
    throw new CapabilityInputError('Math operands must be finite numbers.')
  }

  if (operation === 'divide' && right === 0) {
    throw new CapabilityInputError('Division by zero is not allowed.')
  }

  return { operation, left, right }
}

export const mathCalculateCapability: CapabilityDefinition<
  unknown,
  MathCalculateOutput
> = {
  id: 'math.calculate',
  name: 'Math Calculate',
  description:
    'Perform one deterministic arithmetic operation: add, subtract, multiply, or divide two finite numbers.',
  inputSchema: mathInputSchema,
  outputSchema: mathOutputSchema,
  requiredScopes: [],
  risk: 'low',
  confirmation: 'never',
  executionMode: 'sync',
  async execute(input) {
    const { operation, left, right } = readMathInput(input)

    switch (operation) {
      case 'add':
        return { value: left + right }
      case 'subtract':
        return { value: left - right }
      case 'multiply':
        return { value: left * right }
      case 'divide':
        return { value: left / right }
    }
  },
}

export const createDefaultCapabilityRegistry = (): CapabilityRegistry => {
  const registry = new CapabilityRegistry()
  registry.register(mathCalculateCapability)
  return registry
}
