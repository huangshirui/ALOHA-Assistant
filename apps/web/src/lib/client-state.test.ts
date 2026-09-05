import { describe, expect, it } from 'vitest'

import {
  loadCurrentConversationId,
  loadTextDraft,
  saveCurrentConversationId,
  saveTextDraft,
  type ClientStorage,
} from './client-state'

class MemoryStorage implements ClientStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

describe('client state recovery', () => {
  it('round-trips the current conversation id', () => {
    const storage = new MemoryStorage()

    saveCurrentConversationId(storage, 'cnv_example')

    expect(loadCurrentConversationId(storage)).toBe('cnv_example')
  })

  it('clears the current conversation when a new context starts', () => {
    const storage = new MemoryStorage()
    saveCurrentConversationId(storage, 'cnv_example')

    saveCurrentConversationId(storage, undefined)

    expect(loadCurrentConversationId(storage)).toBeUndefined()
  })

  it('restores the exact meaningful text draft', () => {
    const storage = new MemoryStorage()
    const draft = 'first line\nsecond line'

    saveTextDraft(storage, draft)

    expect(loadTextDraft(storage)).toBe(draft)
  })

  it('does not persist whitespace-only drafts', () => {
    const storage = new MemoryStorage()

    saveTextDraft(storage, '   \n  ')

    expect(loadTextDraft(storage)).toBe('')
  })

  it('fails open when browser storage is unavailable', () => {
    const storage: ClientStorage = {
      getItem() {
        throw new Error('storage unavailable')
      },
      setItem() {
        throw new Error('storage unavailable')
      },
      removeItem() {
        throw new Error('storage unavailable')
      },
    }

    expect(loadCurrentConversationId(storage)).toBeUndefined()
    expect(loadTextDraft(storage)).toBe('')
    expect(() => saveCurrentConversationId(storage, 'cnv_example')).not.toThrow()
    expect(() => saveTextDraft(storage, 'hello')).not.toThrow()
  })
})
