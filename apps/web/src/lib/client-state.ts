export interface ClientStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const CURRENT_CONVERSATION_KEY = 'aloha.currentConversationId'
const TEXT_DRAFT_KEY = 'aloha.textDraft'

const safeGet = (storage: ClientStorage, key: string): string | undefined => {
  try {
    return storage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

const safeSet = (storage: ClientStorage, key: string, value?: string) => {
  try {
    if (value === undefined) {
      storage.removeItem(key)
      return
    }

    storage.setItem(key, value)
  } catch {
    // Local recovery is best-effort and must never block the interaction path.
  }
}

export const loadCurrentConversationId = (
  storage: ClientStorage,
): string | undefined => {
  const value = safeGet(storage, CURRENT_CONVERSATION_KEY)?.trim()
  return value ? value : undefined
}

export const saveCurrentConversationId = (
  storage: ClientStorage,
  conversationId?: string,
) => {
  const value = conversationId?.trim()
  safeSet(storage, CURRENT_CONVERSATION_KEY, value || undefined)
}

export const loadTextDraft = (storage: ClientStorage): string =>
  safeGet(storage, TEXT_DRAFT_KEY) ?? ''

export const saveTextDraft = (storage: ClientStorage, draft: string) => {
  safeSet(storage, TEXT_DRAFT_KEY, draft.trim().length > 0 ? draft : undefined)
}
