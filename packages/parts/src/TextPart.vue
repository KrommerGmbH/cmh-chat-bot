<script setup lang="ts">
import { MessageResponse } from '@cmh/chat-primitives/ai-elements/message'

defineProps<{
  md?: string
}>()
</script>

<template>
  <div class="prose prose-sm dark:prose-invert max-w-none text-[0.95rem] leading-[1.7] [&_:is(p,ul,ol,blockquote,h1,h2,h3,h4,h5,h6)]:max-w-(--chat-prose-max)">
    <MessageResponse :content="md || ''" />
  </div>
</template>
