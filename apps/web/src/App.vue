<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  loadCurrentConversationId,
  loadTextDraft,
  saveCurrentConversationId,
  saveTextDraft,
} from './lib/client-state'
import { InteractionRequestError, runInteraction } from './lib/interaction'

type SurfaceState = 'idle' | 'working' | 'completed' | 'failed'

const storage = window.localStorage
const compactPlatformQuery = window.matchMedia('(max-width: 64rem)')

const draft = ref(loadTextDraft(storage))
const latestInput = ref('')
const output = ref('')
const surfaceErrorMessage = ref('')
const submissionErrorMessage = ref('')
const surfaceState = ref<SurfaceState>('idle')
const conversationId = ref<string | undefined>(
  loadCurrentConversationId(storage),
)
const contextGeneration = ref(0)
const activeSubmissionToken = ref(0)
const isSubmitting = ref(false)
const isCompactPlatform = ref(compactPlatformQuery.matches)
const composerExpanded = ref(
  !compactPlatformQuery.matches || draft.value.trim().length > 0,
)
const editor = ref<HTMLTextAreaElement>()

let nextSubmissionToken = 0

const isWorking = computed(() => surfaceState.value === 'working')
const canSend = computed(
  () => draft.value.trim().length > 0 && !isSubmitting.value,
)
const statusLabel = computed(() => {
  if (isSubmitting.value) {
    return isWorking.value ? '正在提交新指令…' : '正在连接 ALOHA…'
  }

  switch (surfaceState.value) {
    case 'working':
      return 'ALOHA 正在处理…'
    case 'completed':
      return '已完成'
    case 'failed':
      return '执行失败'
    default:
      return conversationId.value ? '继续当前上下文' : '可以开始了'
  }
})

watch(draft, (value) => saveTextDraft(storage, value))

const handlePlatformChange = (event: MediaQueryListEvent) => {
  isCompactPlatform.value = event.matches

  if (!event.matches) {
    composerExpanded.value = true
  } else if (!draft.value.trim()) {
    composerExpanded.value = false
  }
}

onMounted(() => {
  compactPlatformQuery.addEventListener('change', handlePlatformChange)
})

onBeforeUnmount(() => {
  compactPlatformQuery.removeEventListener('change', handlePlatformChange)
})

const expandComposer = async () => {
  composerExpanded.value = true
  await nextTick()
  editor.value?.focus()
}

const submit = async () => {
  const text = draft.value.trim()
  if (!text || isSubmitting.value) {
    return
  }

  const generation = contextGeneration.value
  const submissionToken = ++nextSubmissionToken
  const submittedDraft = draft.value
  let accepted = false

  submissionErrorMessage.value = ''
  isSubmitting.value = true

  try {
    await runInteraction(
      {
        conversationId: conversationId.value,
        text,
      },
      (event) => {
        if (generation !== contextGeneration.value) {
          return
        }

        switch (event.type) {
          case 'run.started':
            accepted = true
            isSubmitting.value = false
            activeSubmissionToken.value = submissionToken
            conversationId.value = event.conversationId
            saveCurrentConversationId(storage, event.conversationId)
            latestInput.value = text
            output.value = ''
            surfaceErrorMessage.value = ''
            surfaceState.value = 'working'

            if (draft.value === submittedDraft) {
              draft.value = ''
            }

            if (isCompactPlatform.value) {
              composerExpanded.value = false
            }
            break
          case 'output.delta':
            if (activeSubmissionToken.value !== submissionToken) {
              return
            }
            output.value += event.delta
            surfaceState.value = 'working'
            break
          case 'run.completed':
            if (activeSubmissionToken.value !== submissionToken) {
              return
            }
            surfaceState.value = 'completed'
            break
          case 'run.failed':
            if (activeSubmissionToken.value !== submissionToken) {
              return
            }
            surfaceErrorMessage.value = event.error.message
            surfaceState.value = 'failed'
            break
        }
      },
    )
  } catch (error) {
    if (generation !== contextGeneration.value) {
      return
    }

    if (error instanceof InteractionRequestError) {
      if (error.code === 'conversation_not_found') {
        conversationId.value = undefined
        saveCurrentConversationId(storage, undefined)
        submissionErrorMessage.value =
          '当前上下文已失效，已准备新上下文。请重新发送。'
      } else if (error.code === 'runtime_backend_not_configured') {
        submissionErrorMessage.value = 'n8n Agent 后端尚未配置。'
      } else {
        submissionErrorMessage.value = 'ALOHA 暂时无法接受这个请求。'
      }
    } else {
      submissionErrorMessage.value = 'ALOHA 暂时无法连接。'
    }
  } finally {
    if (!accepted && generation === contextGeneration.value) {
      isSubmitting.value = false
    }
  }
}

const handleComposerKeydown = (event: KeyboardEvent) => {
  if (
    event.key !== 'Enter' ||
    event.shiftKey ||
    isCompactPlatform.value ||
    !canSend.value
  ) {
    return
  }

  event.preventDefault()
  void submit()
}

const handleEditorBlur = () => {
  if (isCompactPlatform.value && !draft.value.trim()) {
    composerExpanded.value = false
  }
}

const newContext = () => {
  if (
    draft.value.trim() &&
    !window.confirm('当前还有未发送的草稿。要丢弃草稿并创建新上下文吗？')
  ) {
    return
  }

  contextGeneration.value += 1
  activeSubmissionToken.value = 0
  conversationId.value = undefined
  saveCurrentConversationId(storage, undefined)
  latestInput.value = ''
  output.value = ''
  surfaceErrorMessage.value = ''
  submissionErrorMessage.value = ''
  draft.value = ''
  surfaceState.value = 'idle'
  isSubmitting.value = false
  composerExpanded.value = !isCompactPlatform.value
}
</script>

<template>
  <main class="shell">
    <header class="header">
      <button class="icon-button" type="button" aria-label="更多">☰</button>
      <strong>ALOHA</strong>
      <button class="icon-button" type="button" aria-label="新上下文" @click="newContext">
        ＋
      </button>
    </header>

    <section class="stage" aria-live="polite" :aria-busy="isWorking || isSubmitting">
      <div class="work-surface">
        <p class="status">{{ statusLabel }}</p>

        <section v-if="latestInput" class="surface-section">
          <p class="surface-label">最新输入</p>
          <p class="source-text">{{ latestInput }}</p>
        </section>

        <section
          v-if="output || surfaceErrorMessage || isWorking"
          class="surface-section"
        >
          <p class="surface-label">ALOHA</p>
          <p v-if="output" class="output-text">{{ output }}</p>
          <p v-else-if="isWorking" class="placeholder-text">等待结果…</p>
          <p v-if="surfaceErrorMessage" class="error-text" role="alert">
            {{ surfaceErrorMessage }}
          </p>
        </section>
      </div>
    </section>

    <form class="composer" @submit.prevent="submit">
      <div
        v-if="isCompactPlatform && !composerExpanded"
        class="compact-capsule"
        aria-label="输入区"
      >
        <button class="composer-icon" type="button" aria-label="拍照（即将支持）" disabled>
          ◉
        </button>
        <button class="capsule-center" type="button" @click="expandComposer">
          输入消息
        </button>
        <button class="composer-icon" type="button" aria-label="添加资源（即将支持）" disabled>
          ＋
        </button>
      </div>

      <div v-else class="expanded-composer">
        <button class="composer-icon" type="button" aria-label="添加资源（即将支持）" disabled>
          ＋
        </button>
        <textarea
          ref="editor"
          v-model="draft"
          aria-label="输入消息"
          autocomplete="off"
          placeholder="Ask ALOHA…"
          rows="2"
          @keydown="handleComposerKeydown"
          @blur="handleEditorBlur"
        />
        <button class="composer-icon" type="button" aria-label="语音输入（即将支持）" disabled>
          ◌
        </button>
        <button class="send-button" type="submit" :disabled="!canSend">
          {{ isSubmitting ? '提交中' : '发送' }}
        </button>
      </div>

      <p v-if="submissionErrorMessage" class="composer-feedback" role="alert">
        {{ submissionErrorMessage }}
      </p>
    </form>
  </main>
</template>
