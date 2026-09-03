import { DurableObject } from 'cloudflare:workers'

export type PersistedRunStatus =
  | 'accepted'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'superseded'

export interface PersistedConversation {
  id: string
  principalId: string
  createdAt: string
  updatedAt: string
  activeRunId?: string
  lastRunId?: string
}

export interface PersistedRun {
  id: string
  requestId: string
  conversationId: string
  principalId: string
  actorId: string
  applicationId: string
  status: PersistedRunStatus
  inputText: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  terminalAt?: string
  backendRunId?: string
  outputText?: string
  errorCode?: string
}

export interface RunAdmissionInput {
  requestId: string
  conversationId?: string
  principalId: string
  actorId: string
  applicationId: string
  inputText: string
}

export interface RunAdmissionResult {
  conversationId: string
  runId: string
  supersededRunId?: string
}

export interface StateTransaction {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}

export interface StateStorage extends StateTransaction {
  transaction<T>(
    closure: (transaction: StateTransaction) => Promise<T>,
  ): Promise<T>
}

interface AlohaUserStateEnv {}

const conversationKey = (conversationId: string) =>
  `conversation:${conversationId}`
const runKey = (runId: string) => `run:${runId}`
const now = () => new Date().toISOString()
const id = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isActiveStatus = (status: PersistedRunStatus) =>
  status === 'accepted' || status === 'running'

const adaptTransaction = (
  transaction: DurableObjectTransaction,
): StateTransaction => ({
  get: <T>(key: string) => transaction.get<T>(key),
  put: <T>(key: string, value: T) => transaction.put(key, value),
})

const adaptStorage = (storage: DurableObjectStorage): StateStorage => ({
  get: <T>(key: string) => storage.get<T>(key),
  put: <T>(key: string, value: T) => storage.put(key, value),
  transaction: <T>(closure: (transaction: StateTransaction) => Promise<T>) =>
    storage.transaction((transaction) => closure(adaptTransaction(transaction))),
})

const readAdmission = (value: unknown): RunAdmissionInput | null => {
  if (!isRecord(value)) {
    return null
  }

  if (
    typeof value.requestId !== 'string' ||
    (value.conversationId !== undefined &&
      typeof value.conversationId !== 'string') ||
    typeof value.principalId !== 'string' ||
    typeof value.actorId !== 'string' ||
    typeof value.applicationId !== 'string' ||
    typeof value.inputText !== 'string'
  ) {
    return null
  }

  return {
    requestId: value.requestId,
    ...(typeof value.conversationId === 'string'
      ? { conversationId: value.conversationId }
      : {}),
    principalId: value.principalId,
    actorId: value.actorId,
    applicationId: value.applicationId,
    inputText: value.inputText,
  }
}

export class ConversationRunStore {
  constructor(private readonly storage: StateStorage) {}

  async admit(input: RunAdmissionInput): Promise<RunAdmissionResult> {
    return this.storage.transaction(async (transaction) => {
      const timestamp = now()
      const conversationId = input.conversationId ?? id('cnv')
      const key = conversationKey(conversationId)
      const existing = await transaction.get<PersistedConversation>(key)

      if (input.conversationId && !existing) {
        throw new ConversationRunStateError(
          'conversation_not_found',
          'The requested conversation does not exist for this principal.',
          404,
        )
      }

      if (existing && existing.principalId !== input.principalId) {
        throw new ConversationRunStateError(
          'conversation_not_found',
          'The requested conversation does not exist for this principal.',
          404,
        )
      }

      let supersededRunId: string | undefined

      if (existing?.activeRunId) {
        const previous = await transaction.get<PersistedRun>(
          runKey(existing.activeRunId),
        )

        if (previous && isActiveStatus(previous.status)) {
          supersededRunId = previous.id
          await transaction.put<PersistedRun>(runKey(previous.id), {
            ...previous,
            status: 'superseded',
            updatedAt: timestamp,
            terminalAt: timestamp,
          })
        }
      }

      const runId = id('run')
      const run: PersistedRun = {
        id: runId,
        requestId: input.requestId,
        conversationId,
        principalId: input.principalId,
        actorId: input.actorId,
        applicationId: input.applicationId,
        status: 'accepted',
        inputText: input.inputText,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const conversation: PersistedConversation = existing
        ? {
            ...existing,
            updatedAt: timestamp,
            activeRunId: runId,
            lastRunId: runId,
          }
        : {
            id: conversationId,
            principalId: input.principalId,
            createdAt: timestamp,
            updatedAt: timestamp,
            activeRunId: runId,
            lastRunId: runId,
          }

      await transaction.put(runKey(runId), run)
      await transaction.put(key, conversation)

      return {
        conversationId,
        runId,
        ...(supersededRunId ? { supersededRunId } : {}),
      }
    })
  }

  async markRunning(runId: string): Promise<void> {
    await this.storage.transaction(async (transaction) => {
      const run = await transaction.get<PersistedRun>(runKey(runId))

      if (!run || run.status !== 'accepted') {
        return
      }

      const timestamp = now()
      await transaction.put<PersistedRun>(runKey(runId), {
        ...run,
        status: 'running',
        startedAt: timestamp,
        updatedAt: timestamp,
      })
    })
  }

  async complete(
    runId: string,
    outputText: string,
    backendRunId?: string,
  ): Promise<void> {
    await this.finish(runId, {
      status: 'completed',
      outputText,
      backendRunId,
    })
  }

  async fail(runId: string, errorCode: string): Promise<void> {
    await this.finish(runId, { status: 'failed', errorCode })
  }

  async getConversation(
    conversationId: string,
  ): Promise<PersistedConversation | undefined> {
    return this.storage.get<PersistedConversation>(conversationKey(conversationId))
  }

  async getRun(runId: string): Promise<PersistedRun | undefined> {
    return this.storage.get<PersistedRun>(runKey(runId))
  }

  private async finish(
    runId: string,
    terminal:
      | { status: 'completed'; outputText: string; backendRunId?: string }
      | { status: 'failed'; errorCode: string },
  ): Promise<void> {
    await this.storage.transaction(async (transaction) => {
      const run = await transaction.get<PersistedRun>(runKey(runId))

      if (!run) {
        return
      }

      const timestamp = now()
      const terminalFields =
        terminal.status === 'completed'
          ? {
              outputText: terminal.outputText,
              ...(terminal.backendRunId
                ? { backendRunId: terminal.backendRunId }
                : {}),
            }
          : { errorCode: terminal.errorCode }

      if (isActiveStatus(run.status)) {
        await transaction.put<PersistedRun>(runKey(runId), {
          ...run,
          ...terminalFields,
          status: terminal.status,
          updatedAt: timestamp,
          terminalAt: timestamp,
        })
      } else {
        // Late output from a superseded/stopped Run is retained for History /
        // Trace, but must never resurrect the Run as active or completed.
        await transaction.put<PersistedRun>(runKey(runId), {
          ...run,
          ...terminalFields,
          updatedAt: timestamp,
        })
      }

      const conversation = await transaction.get<PersistedConversation>(
        conversationKey(run.conversationId),
      )

      if (conversation?.activeRunId === runId) {
        const { activeRunId: _activeRunId, ...withoutActiveRun } = conversation
        await transaction.put<PersistedConversation>(
          conversationKey(run.conversationId),
          {
            ...withoutActiveRun,
            updatedAt: timestamp,
          },
        )
      }
    })
  }
}

export class ConversationRunStateError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ConversationRunStateError'
    this.code = code
    this.status = status
  }
}

export class AlohaUserState extends DurableObject<AlohaUserStateEnv> {
  private readonly store: ConversationRunStore

  constructor(ctx: DurableObjectState, env: AlohaUserStateEnv) {
    super(ctx, env)
    this.store = new ConversationRunStore(adaptStorage(ctx.storage))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    let body: unknown

    if (request.method === 'POST') {
      try {
        body = await request.json()
      } catch {
        return Response.json({ error: 'invalid_json_body' }, { status: 400 })
      }
    }

    try {
      if (request.method === 'POST' && url.pathname === '/admit') {
        const admission = readAdmission(body)
        if (!admission) {
          return Response.json({ error: 'invalid_admission' }, { status: 400 })
        }
        return Response.json(await this.store.admit(admission))
      }

      if (request.method === 'POST' && url.pathname === '/running') {
        const runId = isRecord(body) ? body.runId : undefined
        if (typeof runId !== 'string') {
          return Response.json({ error: 'run_id_required' }, { status: 400 })
        }
        await this.store.markRunning(runId)
        return Response.json({ ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/complete') {
        const runId = isRecord(body) ? body.runId : undefined
        const outputText = isRecord(body) ? body.outputText : undefined
        const backendRunId = isRecord(body) ? body.backendRunId : undefined
        if (
          typeof runId !== 'string' ||
          typeof outputText !== 'string' ||
          (backendRunId !== undefined && typeof backendRunId !== 'string')
        ) {
          return Response.json({ error: 'invalid_completion' }, { status: 400 })
        }
        await this.store.complete(runId, outputText, backendRunId)
        return Response.json({ ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/fail') {
        const runId = isRecord(body) ? body.runId : undefined
        const errorCode = isRecord(body) ? body.errorCode : undefined
        if (typeof runId !== 'string' || typeof errorCode !== 'string') {
          return Response.json({ error: 'invalid_failure' }, { status: 400 })
        }
        await this.store.fail(runId, errorCode)
        return Response.json({ ok: true })
      }
    } catch (error) {
      if (error instanceof ConversationRunStateError) {
        return Response.json({ error: error.code }, { status: error.status })
      }
      throw error
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  }
}
