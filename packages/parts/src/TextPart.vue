<script setup lang="ts">
import { MessageResponse } from '@cmh/chat-primitives/ai-elements/message'

defineProps<{
  md?: string
}>()
</script>

<template>
  <div class="prose prose-sm dark:prose-invert max-w-none text-[0.9375rem] leading-relaxed">
    <MessageResponse :content="md || ''" />
  </div>
</template>
