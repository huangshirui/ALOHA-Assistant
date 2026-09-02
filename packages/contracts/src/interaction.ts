export interface InteractionAttachment {
  id: string
  kind: 'image' | 'file' | 'audio'
  contentType: string
  url?: string
}

export interface InteractionInput {
  requestId?: string
  conversationId?: string
  text?: string
  attachments?: InteractionAttachment[]
}

interface RunEventBase {
  eventId: string
  runId: string
  conversationId: string
  sequence: number
  occurredAt: string
}

export interface RunStartedEvent extends RunEventBase {
  type: 'run.started'
  requestId: string
}

export interface OutputDeltaEvent extends RunEventBase {
  type: 'output.delta'
  delta: string
}

export interface RunCompletedEvent extends RunEventBase {
  type: 'run.completed'
}

export interface RunFailedEvent extends RunEventBase {
  type: 'run.failed'
  error: {
    code: string
    message: string
    retryable: boolean
  }
}

export type RunEvent =
  | RunStartedEvent
  | OutputDeltaEvent
  | RunCompletedEvent
  | RunFailedEvent
