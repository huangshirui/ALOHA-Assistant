import type { CapabilityContext } from '@aloha/contracts'

export interface CapabilityDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  execute(input: TInput, context: CapabilityContext): Promise<TOutput>
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>()

  register(capability: CapabilityDefinition): void {
    this.capabilities.set(capability.name, capability)
  }

  get(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name)
  }

  list(): string[] {
    return [...this.capabilities.keys()]
  }
}
