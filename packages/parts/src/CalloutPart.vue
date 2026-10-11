<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Alert, AlertDescription } from '@cmh/chat-primitives/ui/alert'

const props = withDefaults(defineProps<{
  tone?: 'info' | 'warn' | 'danger'
  text: string
}>(), {
  tone: 'info',
})
</script>

<template>
  <div class="my-2">
    <Alert
      :variant="props.tone === 'danger' ? 'destructive' : 'default'"
      :class="{
        'border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200': props.tone === 'warn',
      }"
    >
      <ChatIcon name="alertCircle" v-if="props.tone === 'danger'" class="size-4" />
      <ChatIcon name="warning" v-else-if="props.tone === 'warn'" class="size-4 text-amber-500" />
      <ChatIcon name="info" v-else class="size-4" />

      <AlertDescription class="text-xs font-normal">
        {{ props.text }}
      </AlertDescription>
    </Alert>
  </div>
</template>
