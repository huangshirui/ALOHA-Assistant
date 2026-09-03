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

interface StateTransaction {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}

interface StateStorage extends StateTransaction {
  transaction<T>(
    closure: (transaction: StateTransaction) => Promise<T>,
  ): Promise<T>
}

const conversationKey = (conversationId: string) =>
  `conversation:${conversationId}`
const runKey = (runId: string) => `run:${runId}`
const now = () => new Date().toISOString()
const id = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`

const isActiveStatus = (status: PersistedRunStatus) =>
  status === 'accepted' || status === 'running'

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

export class AlohaUserState extends DurableObject {
  private readonly store: ConversationRunStore

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)
    this.store = new ConversationRunStore(
      ctx.storage as unknown as StateStorage,
    )
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
        return Response.json(
          await this.store.admit(body as RunAdmissionInput),
        )
      }

      if (request.method === 'POST' && url.pathname === '/running') {
        const runId = (body as { runId?: unknown })?.runId
        if (typeof runId !== 'string') {
          return Response.json({ error: 'run_id_required' }, { status: 400 })
        }
        await this.store.markRunning(runId)
        return Response.json({ ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/complete') {
        const value = body as {
          runId?: unknown
          outputText?: unknown
          backendRunId?: unknown
        }
        if (
          typeof value?.runId !== 'string' ||
          typeof value.outputText !== 'string' ||
          (value.backendRunId !== undefined &&
            typeof value.backendRunId !== 'string')
        ) {
          return Response.json({ error: 'invalid_completion' }, { status: 400 })
        }
        await this.store.complete(
          value.runId,
          value.outputText,
          value.backendRunId as string | undefined,
        )
        return Response.json({ ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/fail') {
        const value = body as { runId?: unknown; errorCode?: unknown }
        if (
          typeof value?.runId !== 'string' ||
          typeof value.errorCode !== 'string'
        ) {
          return Response.json({ error: 'invalid_failure' }, { status: 400 })
        }
        await this.store.fail(value.runId, value.errorCode)
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
