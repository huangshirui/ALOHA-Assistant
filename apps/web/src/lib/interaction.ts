import type { InteractionInput, RunEvent } from '@aloha/contracts'

export class InteractionRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'InteractionRequestError'
    this.status = status
    this.code = code
  }
}

export interface RunInteractionOptions {
  signal?: AbortSignal
  gatewayUrl?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRunEvent = (value: unknown): value is RunEvent => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  return [
    'run.started',
    'output.delta',
    'run.completed',
    'run.failed',
  ].includes(value.type)
}

const readErrorCode = async (response: Response): Promise<string> => {
  try {
    const value: unknown = await response.json()
    if (isRecord(value) && typeof value.error === 'string') {
      return value.error
    }
  } catch {
    // Transport errors intentionally collapse to a safe client code.
  }

  return 'interaction_request_failed'
}

const defaultGatewayUrl = () =>
  (import.meta.env.VITE_GATEWAY_URL ?? '').replace(/\/$/, '')

export const runInteraction = async (
  input: InteractionInput,
  onEvent: (event: RunEvent) => void,
  options: RunInteractionOptions = {},
): Promise<void> => {
  const gatewayUrl = (options.gatewayUrl ?? defaultGatewayUrl()).replace(
    /\/$/,
    '',
  )
  const response = await fetch(`${gatewayUrl}/v1/interactions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new InteractionRequestError(
      response.status,
      await readErrorCode(response),
    )
  }

  if (!response.body) {
    throw new InteractionRequestError(502, 'interaction_stream_missing')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const consumeFrame = (frame: string) => {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')

    if (!data) {
      return
    }

    let value: unknown

    try {
      value = JSON.parse(data)
    } catch {
      throw new InteractionRequestError(502, 'invalid_interaction_event')
    }

    if (!isRunEvent(value)) {
      throw new InteractionRequestError(502, 'unknown_interaction_event')
    }

    onEvent(value)
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      consumeFrame(frame)
    }

    if (done) {
      break
    }
  }

  if (buffer.trim()) {
    consumeFrame(buffer)
  }
}
