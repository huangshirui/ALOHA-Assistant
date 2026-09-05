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
  /**
   * Runtime-native/provider tools are deliberately separate from
   * ALOHA-managed capabilities. Optional keeps Canonical Run Envelope v1
   * source-compatible with M1-M3 runtimes that do not consume provider tools.
   */
  tools?: RuntimeToolDescriptor[]
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

/**
 * Describes a callable tool owned by an independent provider or adapter.
 * Presence in the envelope is not an authorization proof for the provider;
 * the invocation transport remains narrow and the provider re-authorizes.
 */
export interface RuntimeToolDescriptor {
  id: string
  name: string
  description: string
  inputSchema: CapabilityJsonSchema
  invocation: RuntimeToolInvocation
}

export interface RuntimeCapabilityInvocation {
  type: 'http'
  method: 'POST'
  url: string
  authorization: string
}

export interface RuntimeToolInvocation {
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
