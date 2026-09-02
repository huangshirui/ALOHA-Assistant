<script setup lang="ts">
import { computed, ref } from 'vue'

import { InteractionRequestError, runInteraction } from './lib/interaction'

type SurfaceState = 'idle' | 'submitting' | 'working' | 'completed' | 'failed'

const draft = ref('')
const latestInput = ref('')
const output = ref('')
const errorMessage = ref('')
const state = ref<SurfaceState>('idle')
const conversationId = ref<string>()
const surfaceGeneration = ref(0)

const isWorking = computed(
  () => state.value === 'submitting' || state.value === 'working',
)
const canSend = computed(
  () => draft.value.trim().length > 0 && !isWorking.value,
)
const statusLabel = computed(() => {
  switch (state.value) {
    case 'submitting':
      return '正在连接 ALOHA…'
    case 'working':
      return 'ALOHA 正在处理…'
    case 'completed':
      return '已完成'
    case 'failed':
      return '执行失败'
    default:
      return '可以开始了'
  }
})

const submit = async () => {
  const text = draft.value.trim()
  if (!text || isWorking.value) {
    return
  }

  const generation = surfaceGeneration.value
  latestInput.value = text
  output.value = ''
  errorMessage.value = ''
  state.value = 'submitting'

  try {
    await runInteraction(
      {
        conversationId: conversationId.value,
        text,
      },
      (event) => {
        if (generation !== surfaceGeneration.value) {
          return
        }

        switch (event.type) {
          case 'run.started':
            conversationId.value = event.conversationId
            if (draft.value.trim() === text) {
              draft.value = ''
            }
            state.value = 'working'
            break
          case 'output.delta':
            output.value += event.delta
            state.value = 'working'
            break
          case 'run.completed':
            state.value = 'completed'
            break
          case 'run.failed':
            errorMessage.value = event.error.message
            state.value = 'failed'
            break
        }
      },
    )
  } catch (error) {
    if (generation !== surfaceGeneration.value) {
      return
    }

    if (error instanceof InteractionRequestError) {
      errorMessage.value =
        error.code === 'runtime_backend_not_configured'
          ? 'n8n Agent 后端尚未配置。'
          : 'ALOHA 暂时无法接受这个请求。'
    } else {
      errorMessage.value = 'ALOHA 暂时无法连接。'
    }
    state.value = 'failed'
  }
}

const newContext = () => {
  if (
    draft.value.trim() &&
    !window.confirm('当前还有未发送的草稿。要丢弃草稿并创建新上下文吗？')
  ) {
    return
  }

  surfaceGeneration.value += 1
  conversationId.value = undefined
  latestInput.value = ''
  output.value = ''
  errorMessage.value = ''
  draft.value = ''
  state.value = 'idle'
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

    <section class="stage" aria-live="polite">
      <div class="work-surface">
        <p class="status">{{ statusLabel }}</p>

        <section v-if="latestInput" class="surface-section">
          <p class="surface-label">最新输入</p>
          <p class="source-text">{{ latestInput }}</p>
        </section>

        <section v-if="output || errorMessage || isWorking" class="surface-section">
          <p class="surface-label">ALOHA</p>
          <p v-if="output" class="output-text">{{ output }}</p>
          <p v-else-if="isWorking" class="placeholder-text">等待结果…</p>
          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
        </section>
      </div>
    </section>

    <form class="composer" @submit.prevent="submit">
      <input
        v-model="draft"
        aria-label="输入消息"
        autocomplete="off"
        placeholder="Ask ALOHA…"
      />
      <button type="submit" :disabled="!canSend">发送</button>
    </form>
  </main>
</template>
