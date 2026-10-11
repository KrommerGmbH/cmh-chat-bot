<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import {
  type ChatFileChipProps,
  useChatFileChip,
} from './ChatFileChip'

const props = defineProps<ChatFileChipProps>()
const {
  blobUrl,
  isLoading,
  openInline,
  formatFileSize,
} = useChatFileChip(props)
</script>

<template>
  <a
    :href="blobUrl || '#'"
    :target="openInline ? '_blank' : undefined"
    :download="blobUrl && !openInline ? file.name : undefined"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-2.5 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary-foreground/25"
    :class="{ 'opacity-70 pointer-events-none': !blobUrl && isLoading }"
  >
    <img
      v-if="file.mimeType?.startsWith('image/') && blobUrl"
      :src="blobUrl"
      :alt="file.name"
      class="size-5 rounded object-cover"
    >
    <ChatIcon name="paperclip" v-else class="size-3.5" />
    <span class="max-w-36 truncate">{{ file.name }}</span>
    <span class="text-[10px] opacity-75">({{ formatFileSize(file.size) }})</span>
  </a>
</template>
