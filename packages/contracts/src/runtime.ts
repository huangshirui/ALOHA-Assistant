import type { CapabilityJsonSchema } from './capability'
import type { InteractionAttachment } from './interaction'

export interface CanonicalRunEnvelopeV1 {
  schemaVersion: 1
  run: {
    requestId: string
    runId: string
    conversationId: string
  }
  input: {
    text?: string
    attachments?: InteractionAttachment[]
  }
  identity: CanonicalRunIdentity | null
  context: CanonicalRunContext
  capabilities: RuntimeCapabilityDescriptor[]
}

export interface CanonicalRunIdentity {
  principal: {
    type: 'user'
    id: string
  }
  actor: {
    type: 'agent'
    id: string
  }
  application: {
    id: string
  }
}

export interface CanonicalRunContext {
  channel: 'web'
}

/**
 * Transitional source-compatible name for code that still refers to the
 * pre-M3 runtime request. The canonical southbound contract is the envelope.
 */
export type RuntimeRunRequest = CanonicalRunEnvelopeV1

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
  run(envelope: CanonicalRunEnvelopeV1): Promise<RuntimeRunResult>
}
