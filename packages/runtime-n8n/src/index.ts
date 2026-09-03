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

const classifyFetchFailure = (error: unknown): N8nRuntimeError => {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('1042')) {
    return new N8nRuntimeError(
      'n8n_worker_route_conflict',
      'The n8n Agent runtime route conflicts with a same-zone Worker route.',
      false,
    )
  }

  if (message.includes('1021') || message.includes('1024')) {
    return new N8nRuntimeError(
      'n8n_target_unavailable',
      'The n8n Agent runtime target is unavailable from this Worker.',
      false,
    )
  }

  if (message.toLowerCase().includes('network connection lost')) {
    return new N8nRuntimeError(
      'n8n_network_connection_lost',
      'The network connection to the n8n Agent runtime was lost.',
      true,
    )
  }

  return new N8nRuntimeError(
    'n8n_unreachable',
    'The n8n Agent runtime could not be reached.',
    true,
  )
}

const classifyHttpFailure = (status: number): N8nRuntimeError => {
  if (status === 401 || status === 403) {
    return new N8nRuntimeError(
      'n8n_auth_failed',
      'The n8n Agent runtime rejected its deployment credential.',
      false,
    )
  }

  if (status === 404) {
    return new N8nRuntimeError(
      'n8n_endpoint_not_found',
      'The configured n8n Agent runtime endpoint was not found.',
      false,
    )
  }

  if (status === 405) {
    return new N8nRuntimeError(
      'n8n_method_not_allowed',
      'The n8n Agent runtime endpoint rejected the request method.',
      false,
    )
  }

  if (status === 408) {
    return new N8nRuntimeError(
      'n8n_request_timeout',
      'The n8n Agent runtime request timed out.',
      true,
    )
  }

  if (status === 429) {
    return new N8nRuntimeError(
      'n8n_rate_limited',
      'The n8n Agent runtime rate limited the request.',
      true,
    )
  }

  if (status >= 500) {
    return new N8nRuntimeError(
      'n8n_backend_error',
      'The n8n Agent runtime returned a backend error.',
      true,
    )
  }

  return new N8nRuntimeError(
    'n8n_http_error',
    'The n8n Agent runtime rejected the request.',
    false,
  )
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
      response = await this.fetchImpl.call(undefined, webhookUrl, {
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
    } catch (error) {
      throw classifyFetchFailure(error)
    }

    if (!response.ok) {
      throw classifyHttpFailure(response.status)
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
