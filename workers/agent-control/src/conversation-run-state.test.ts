import { describe, expect, it } from 'vitest'

import {
  ConversationRunStateError,
  ConversationRunStore,
  type StateStorage,
  type StateTransaction,
} from './conversation-run-state'

class MemoryStorage implements StateStorage {
  readonly values = new Map<string, unknown>()

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value))
  }

  async transaction<T>(
    closure: (transaction: StateTransaction) => Promise<T>,
  ): Promise<T> {
    return closure(this)
  }
}

const createStore = () => {
  const storage = new MemoryStorage()
  const store = new ConversationRunStore(storage)
  return { storage, store }
}

const admission = {
  requestId: 'request-example',
  principalId: 'usr_example',
  actorId: 'agt_aloha',
  applicationId: 'app_aloha',
  inputText: 'Hello ALOHA',
}

describe('ConversationRunStore', () => {
  it('creates a Conversation and persists accepted -> running -> completed Run state', async () => {
    const { store } = createStore()
    const accepted = await store.admit(admission)

    expect(accepted.conversationId).toMatch(/^cnv_/u)
    expect(accepted.runId).toMatch(/^run_/u)

    await expect(store.getRun(accepted.runId)).resolves.toMatchObject({
      id: accepted.runId,
      conversationId: accepted.conversationId,
      principalId: 'usr_example',
      actorId: 'agt_aloha',
      applicationId: 'app_aloha',
      status: 'accepted',
      inputText: 'Hello ALOHA',
    })

    await store.markRunning(accepted.runId)
    await expect(store.getRun(accepted.runId)).resolves.toMatchObject({
      status: 'running',
    })

    await store.complete(
      accepted.runId,
      'Hello from ALOHA',
      'execution-example',
    )

    await expect(store.getRun(accepted.runId)).resolves.toMatchObject({
      status: 'completed',
      outputText: 'Hello from ALOHA',
      backendRunId: 'execution-example',
    })
    await expect(
      store.getConversation(accepted.conversationId),
    ).resolves.toMatchObject({
      id: accepted.conversationId,
      lastRunId: accepted.runId,
    })
    expect(
      (await store.getConversation(accepted.conversationId))?.activeRunId,
    ).toBeUndefined()
  })

  it('supersedes an active same-conversation Run only after the replacement is admitted', async () => {
    const { store } = createStore()
    const first = await store.admit(admission)
    await store.markRunning(first.runId)

    const second = await store.admit({
      ...admission,
      requestId: 'request-replacement',
      conversationId: first.conversationId,
      inputText: 'Replace the prior instruction',
    })

    expect(second.supersededRunId).toBe(first.runId)
    await expect(store.getRun(first.runId)).resolves.toMatchObject({
      status: 'superseded',
    })
    await expect(store.getRun(second.runId)).resolves.toMatchObject({
      status: 'accepted',
    })
    await expect(
      store.getConversation(first.conversationId),
    ).resolves.toMatchObject({
      activeRunId: second.runId,
      lastRunId: second.runId,
    })
  })

  it('retains late output from a superseded Run without resurrecting it or clearing the newer active Run', async () => {
    const { store } = createStore()
    const first = await store.admit(admission)
    await store.markRunning(first.runId)
    const second = await store.admit({
      ...admission,
      requestId: 'request-replacement',
      conversationId: first.conversationId,
      inputText: 'Newer instruction',
    })

    await store.complete(first.runId, 'late old output', 'old-backend-run')

    await expect(store.getRun(first.runId)).resolves.toMatchObject({
      status: 'superseded',
      outputText: 'late old output',
      backendRunId: 'old-backend-run',
    })
    await expect(
      store.getConversation(first.conversationId),
    ).resolves.toMatchObject({ activeRunId: second.runId })
  })

  it('rejects a client-supplied unknown Conversation instead of silently creating it', async () => {
    const { store } = createStore()

    let caught: unknown
    try {
      await store.admit({
        ...admission,
        conversationId: 'cnv_unknown',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ConversationRunStateError)
    expect(caught).toMatchObject({
      code: 'conversation_not_found',
      status: 404,
    })
  })

  it('marks active failures terminal and clears only that Run from the Conversation', async () => {
    const { store } = createStore()
    const accepted = await store.admit(admission)
    await store.markRunning(accepted.runId)
    await store.fail(accepted.runId, 'n8n_backend_error')

    await expect(store.getRun(accepted.runId)).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'n8n_backend_error',
    })
    expect(
      (await store.getConversation(accepted.conversationId))?.activeRunId,
    ).toBeUndefined()
  })
})
