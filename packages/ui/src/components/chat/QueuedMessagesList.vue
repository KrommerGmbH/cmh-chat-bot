<script setup lang="ts">
import type { QueuedMessage } from '@cmh/chat-core'
import { useI18n } from '@cmh/chat-core'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Button } from '@cmh/chat-primitives/ui/button'
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'

interface Props {
  items: QueuedMessage[]
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
})

const emit = defineEmits<{
  remove: [id: string]
  clear: []
}>()

const { t } = useI18n()

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div
    v-if="props.items.length > 0"
    class="mx-auto w-[min(100cqw,max(var(--chat-content-min),var(--chat-input-width)))] mb-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
  >
    <div
      class="rounded-xl border border-primary/20 bg-card/85 p-3 shadow-md backdrop-blur-md dark:bg-card/75 dark:border-primary/25"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 pb-2 border-b border-border/50 text-xs">
        <div class="flex items-center gap-1.5 font-medium text-foreground">
          <ChatIcon name="layers" class="size-3.5 text-primary animate-pulse" />
          <span class="font-semibold tracking-wider uppercase text-[0.75rem] text-primary">
            {{ t('queuedMessages') }}
          </span>
          <Badge
            variant="secondary"
            class="h-4 px-1.5 py-0 text-[0.85rem] font-bold bg-primary/10 text-primary border-primary/20"
          >
            {{ props.items.length }}
          </Badge>
          <span class="hidden sm:inline text-[0.85rem] text-muted-foreground ml-1">
            ({{ t('queuedMessagesDesc') }})
          </span>
        </div>

        <Button
          v-if="props.items.length > 1"
          variant="ghost"
          size="icon-xs"
          class="h-6 px-2 text-[0.85rem] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 rounded-md"
          :title="t('clearQueue')"
          :aria-label="t('clearQueue')"
          @click="emit('clear')"
        >
          <ChatIcon name="trash" class="size-3" />
          <span class="hidden sm:inline">{{ t('clearQueue') }}</span>
        </Button>
      </div>

      <!-- Messages Queue List -->
      <div class="mt-2 flex flex-col gap-2 max-h-48 overflow-y-auto pr-0.5">
        <TransitionGroup
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 -translate-y-1 scale-95"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-for="(item, index) in props.items"
            :key="item.id"
            class="group relative flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/60 p-2.5 text-xs shadow-2xs hover:border-primary/30 hover:bg-background/90 transition-colors"
          >
            <!-- Badge / Order -->
            <div class="flex items-center shrink-0 pt-0.5">
              <Badge
                v-if="index === 0"
                variant="default"
                class="h-4 px-1.5 py-0 text-[0.85rem] font-bold bg-primary text-primary-foreground shadow-2xs"
              >
                #1 Next
              </Badge>
              <Badge
                v-else
                variant="outline"
                class="h-4 px-1.5 py-0 text-[0.85rem] font-medium text-muted-foreground"
              >
                #{{ index + 1 }}
              </Badge>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p class="whitespace-pre-wrap break-words text-foreground text-[0.8125rem] leading-relaxed max-h-20 overflow-y-auto">
                {{ item.text }}
              </p>

              <!-- Attached files preview if any -->
              <div
                v-if="item.files && item.files.length > 0"
                class="mt-1.5 flex flex-wrap gap-1"
              >
                <div
                  v-for="(file, fIdx) in item.files"
                  :key="fIdx"
                  class="inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 text-[0.85rem] text-muted-foreground"
                >
                  <ChatIcon name="appDoc" class="size-2.5" />
                  <span class="max-w-28 truncate">{{ file.name }}</span>
                  <span class="text-[0.85rem]">({{ formatFileSize(file.size) }})</span>
                </div>
              </div>
            </div>

            <!-- Remove Button -->
            <Button
              variant="ghost"
              size="icon-xs"
              class="size-5 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
              :title="t('removeQueued')"
              :aria-label="t('removeQueued')"
              @click="emit('remove', item.id)"
            >
              <ChatIcon name="close" class="size-3" />
            </Button>
          </div>
        </TransitionGroup>
      </div>

      <!-- Small Footer info on mobile -->
      <div class="mt-1.5 sm:hidden text-[0.85rem] text-muted-foreground flex items-center gap-1">
        <ChatIcon name="clock" class="size-2.5 text-primary shrink-0" />
        <span class="truncate">{{ t('queuedMessagesDesc') }}</span>
      </div>
    </div>
  </div>
</template>
