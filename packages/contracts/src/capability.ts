export type CapabilityExecutionMode = 'sync' | 'stream' | 'async'
export type CapabilityRisk = 'low' | 'medium' | 'high'
export type CapabilityConfirmationPolicy = 'never' | 'required'

export type CapabilityJsonSchema = Record<string, unknown>

export interface CapabilityMetadata {
  id: string
  name: string
  description: string
  inputSchema: CapabilityJsonSchema
  outputSchema: CapabilityJsonSchema
  requiredScopes: string[]
  risk: CapabilityRisk
  confirmation: CapabilityConfirmationPolicy
  executionMode: CapabilityExecutionMode
}

export interface CapabilityContext {
  runId: string
  applicationId: string
  principalId?: string
  actorId?: string
  spaceId?: string
  scopes: string[]
}
