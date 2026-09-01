export interface InteractionAttachment {
  id: string
  kind: 'image' | 'file' | 'audio'
  contentType: string
  url?: string
}

export interface InteractionInput {
  requestId?: string
  text?: string
  attachments?: InteractionAttachment[]
}

export interface InteractionOutput {
  requestId: string
  kind: 'message'
  text: string
}

export interface CapabilityContext {
  principalId: string
  applicationId: string
  spaceId?: string
  scopes: string[]
}
