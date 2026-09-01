<script setup lang="ts">
const status = 'MVP skeleton ready'
</script>

<template>
  <main class="shell">
    <header class="header">
      <button class="icon-button" type="button" aria-label="更多">☰</button>
      <strong>ALOHA</strong>
      <button class="icon-button" type="button" aria-label="清空">⌫</button>
    </header>

    <section class="stage" aria-live="polite">
      <p>{{ status }}</p>
    </section>

    <form class="composer" @submit.prevent>
      <input aria-label="输入消息" placeholder="Ask ALOHA…" />
      <button type="submit">发送</button>
    </form>
  </main>
</template>
