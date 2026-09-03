import type { CapabilityJsonSchema } from './capability'
import type { InteractionAttachment } from './interaction'

export interface RuntimeRunRequest {
  requestId: string
  runId: string
  conversationId: string
  input: {
    text?: string
    attachments?: InteractionAttachment[]
  }
  capabilities: RuntimeCapabilityDescriptor[]
}

export interface RuntimeCapabilityDescriptor {
  id: string
  name: string
  description: string
  inputSchema: CapabilityJsonSchema
  invocation: RuntimeCapabilityInvocation
}

export interface RuntimeCapabilityInvocation {
  type: 'http'
  method: 'POST'
  url: string
  authorization: string
}

export interface RuntimeRunResult {
  outputText: string
  backendRunId?: string
}

export interface RuntimeAdapter {
  run(request: RuntimeRunRequest): Promise<RuntimeRunResult>
}
