<script setup lang="ts">
import { Badge } from '@cmh/chat-primitives/ui/badge'
import ChatMainView from './ChatMainView.vue'
import type { ChatMainViewProps } from './chatViewProps'

// Thin wrapper for the flow canvas: channel is always 'canvas', the flow id is shown in a badge above the chat.
const props = withDefaults(
  defineProps<Omit<ChatMainViewProps, 'flowId' | 'channel'> & {
    flowId: string
    /** Text before the flow id in the badge. */
    flowLabel?: string
  }>(),
  { transport: undefined, ownsDocument: false, showToaster: undefined, forceNarrow: false, flowLabel: 'Flow' },
)
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
      <Badge variant="secondary" class="max-w-full truncate" :title="`${props.flowLabel}: ${props.flowId}`">
        {{ props.flowLabel }}: {{ props.flowId }}
      </Badge>
    </div>
    <ChatMainView
      class="min-h-0 flex-1"
      :client="props.client"
      :host="props.host"
      :transport="props.transport"
      channel="canvas"
      :flow-id="props.flowId"
      :owns-document="props.ownsDocument"
      :show-toaster="props.showToaster"
      :force-narrow="props.forceNarrow"
    />
  </div>
</template>
