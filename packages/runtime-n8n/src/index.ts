import type {
  RuntimeAdapter,
  RuntimeRunRequest,
  RuntimeRunResult,
} from '@aloha/contracts'

export interface N8nAgentRuntimeConfig {
  webhookUrl: string
  authToken?: string
}

export class N8nRuntimeError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean) {
    super(message)
    this.name = 'N8nRuntimeError'
    this.code = code
    this.retryable = retryable
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseWebhookUrl = (value: string): URL => {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new N8nRuntimeError(
      'n8n_invalid_config',
      'The n8n Agent runtime webhook URL is invalid.',
      false,
    )
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new N8nRuntimeError(
      'n8n_invalid_config',
      'The n8n Agent runtime webhook URL must use HTTPS without embedded credentials.',
      false,
    )
  }

  return url
}

export class N8nAgentRuntimeAdapter implements RuntimeAdapter {
  private readonly config: N8nAgentRuntimeConfig
  private readonly fetchImpl: FetchLike

  constructor(config: N8nAgentRuntimeConfig, fetchImpl: FetchLike = fetch) {
    this.config = config
    this.fetchImpl = fetchImpl
  }

  async run(request: RuntimeRunRequest): Promise<RuntimeRunResult> {
    const webhookUrl = parseWebhookUrl(this.config.webhookUrl)
    const headers = new Headers({
      'content-type': 'application/json',
    })

    if (this.config.authToken) {
      headers.set('authorization', `Bearer ${this.config.authToken}`)
    }

    let response: Response

    try {
      response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          schemaVersion: 1,
          run: {
            requestId: request.requestId,
            runId: request.runId,
            conversationId: request.conversationId,
          },
          input: request.input,
          capabilities: request.capabilities,
        }),
      })
    } catch {
      throw new N8nRuntimeError(
        'n8n_unreachable',
        'The n8n Agent runtime could not be reached.',
        true,
      )
    }

    if (!response.ok) {
      throw new N8nRuntimeError(
        'n8n_http_error',
        `The n8n Agent runtime returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500,
      )
    }

    let payload: unknown

    try {
      payload = await response.json()
    } catch {
      throw new N8nRuntimeError(
        'n8n_invalid_response',
        'The n8n Agent runtime returned invalid JSON.',
        false,
      )
    }

    if (
      !isRecord(payload) ||
      typeof payload.outputText !== 'string' ||
      payload.outputText.length === 0
    ) {
      throw new N8nRuntimeError(
        'n8n_invalid_response',
        'The n8n Agent runtime response did not contain outputText.',
        false,
      )
    }

    return {
      outputText: payload.outputText,
      backendRunId:
        typeof payload.backendRunId === 'string'
          ? payload.backendRunId
          : undefined,
    }
  }
}
