<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { ScrollArea } from '@cmh/chat-primitives/ui/scroll-area'
import {
  type PinnedBarEmit,
  type PinnedBarProps,
  usePinnedBar,
} from './PinnedBar'

const props = defineProps<PinnedBarProps>()
const emit = defineEmits<PinnedBarEmit>()
const { t } = usePinnedBar(props, emit)
</script>

<template>
  <div
    v-if="pinnedConversations.length > 0"
    class="flex h-9 w-full shrink-0 items-center border-b bg-muted/30 px-3"
  >
    <div class="mr-2 flex items-center gap-1 text-muted-foreground text-xs font-medium">
      <ChatIcon name="pin" class="size-3 fill-current text-primary" />
    </div>

    <ScrollArea class="w-full overflow-x-auto whitespace-nowrap">
      <div class="flex items-center gap-1.5 py-1">
        <div
          v-for="item in pinnedConversations"
          :key="item.id"
          :class="[
            'group flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
            activeId === item.id
              ? 'border-primary/40 bg-primary/10 font-medium text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
          ]"
          @click="emit('select', item.id)"
        >
          <span class="max-w-36 truncate">{{ item.title || t('untitledChat') }}</span>

          <button
            type="button"
            class="rounded-full p-0.5 hover:bg-muted-foreground/20 hover:text-foreground"
            :title="t('unpin')"
            @click.stop="emit('unpin', item.id)"
          >
            <ChatIcon name="close" class="size-3" />
          </button>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
