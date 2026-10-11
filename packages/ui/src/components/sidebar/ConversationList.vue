<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Button } from '@cmh/chat-primitives/ui/button'
import { Input } from '@cmh/chat-primitives/ui/input'
import { ScrollArea } from '@cmh/chat-primitives/ui/scroll-area'
import {
  type ConversationListEmit,
  type ConversationListProps,
  useConversationList,
} from './ConversationList'

const props = defineProps<ConversationListProps>()
const emit = defineEmits<ConversationListEmit>()
const {
  t,
  searchQuery,
  filteredConversations,
  pinnedList,
  unpinnedList,
  isPinned,
} = useConversationList(props, emit)
</script>

<template>
  <aside class="flex h-full w-64 shrink-0 flex-col border-r bg-card/60 backdrop-blur-sm">
    <!-- Header with New Chat Button -->
    <div class="flex flex-col gap-2 p-3 pb-2">
      <Button
        variant="default"
        class="w-full justify-start gap-2 shadow-xs"
        @click="emit('new-conversation')"
      >
        <ChatIcon name="plus" class="size-4" />
        <span class="font-medium text-sm">{{ t('newChat') }}</span>
      </Button>

      <!-- Search Input -->
      <div class="relative w-full">
        <ChatIcon name="search" class="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="text"
          :placeholder="t('searchConversations')"
          class="h-8 pl-8 text-xs"
        />
      </div>
    </div>

    <!-- Conversations List -->
    <ScrollArea class="flex-1 px-2">
      <div class="flex flex-col gap-4 py-2">
        <!-- Pinned Section -->
        <div v-if="pinnedList.length > 0" class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            <ChatIcon name="pin" class="size-3" />
            <span>{{ t('pinned') }}</span>
          </div>

          <div
            v-for="item in pinnedList"
            :key="item.id"
            :class="[
              'group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors',
              activeId === item.id
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-foreground hover:bg-muted/70',
            ]"
            @click="emit('select-conversation', item.id)"
          >
            <div class="flex min-w-0 items-center gap-2">
              <ChatIcon name="chat" class="size-3.5 shrink-0 opacity-70" />
              <span class="truncate">{{ item.title || t('untitledChat') }}</span>
            </div>

            <button
              type="button"
              class="shrink-0 p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
              :title="t('unpin')"
              @click.stop="emit('toggle-pin', item.id)"
            >
              <ChatIcon name="pin" class="size-3 fill-current text-primary" />
            </button>
          </div>
        </div>

        <!-- All / Unpinned Section -->
        <div class="flex flex-col gap-1">
          <div class="px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            <span>{{ t('conversations') }}</span>
          </div>

          <div v-if="unpinnedList.length === 0 && pinnedList.length === 0" class="px-2 py-6 text-center text-muted-foreground text-xs">
            {{ t('noConversations') }}
          </div>

          <div
            v-for="item in unpinnedList"
            :key="item.id"
            :class="[
              'group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors',
              activeId === item.id
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-foreground hover:bg-muted/70',
            ]"
            @click="emit('select-conversation', item.id)"
          >
            <div class="flex min-w-0 items-center gap-2">
              <ChatIcon name="chat" class="size-3.5 shrink-0 opacity-70" />
              <span class="truncate">{{ item.title || t('untitledChat') }}</span>
            </div>

            <button
              type="button"
              class="shrink-0 p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
              :title="isPinned(item.id) ? t('unpin') : t('pin')"
              @click.stop="emit('toggle-pin', item.id)"
            >
              <ChatIcon name="pin" class="size-3" />
            </button>
          </div>
        </div>
      </div>
    </ScrollArea>
  </aside>
</template>
