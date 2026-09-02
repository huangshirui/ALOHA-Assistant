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
  name: string
  description: string
}

export interface RuntimeRunResult {
  outputText: string
  backendRunId?: string
}

export interface RuntimeAdapter {
  run(request: RuntimeRunRequest): Promise<RuntimeRunResult>
}
