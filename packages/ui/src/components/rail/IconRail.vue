<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Button } from '@cmh/chat-primitives/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cmh/chat-primitives/ui/tooltip'
import {
  type IconRailEmit,
  type IconRailProps,
  useIconRail,
} from './IconRail'

const props = defineProps<IconRailProps>()
const emit = defineEmits<IconRailEmit>()
const {
  t,
  currentThemeLabel,
  cycleTheme,
  chatSession,
} = useIconRail(props, emit)
</script>

<template>
  <TooltipProvider>
    <aside class="flex h-full w-16 shrink-0 flex-col items-center justify-between border-r bg-muted/20 py-3">
      <!-- Top Actions -->
      <div class="flex flex-col items-center gap-3">
        <!-- Logo / App Icon -->
        <div class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ChatIcon name="cpu" class="size-6" />
        </div>

        <div class="my-1 h-px w-8 bg-border" />

        <!-- Conversations Sidebar Toggle -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-10 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              :title="t('conversations')"
              :aria-label="t('conversations')"
              @click="emit('toggle-sidebar')"
            >
              <ChatIcon name="chat" class="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{{ t('conversations') }}</span>
          </TooltipContent>
        </Tooltip>

        <!-- Pinned Items Toggle -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-10 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              :title="t('pinned')"
              :aria-label="t('pinned')"
              @click="emit('toggle-pins')"
            >
              <ChatIcon name="pin" class="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{{ t('pinned') }}</span>
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- Bottom Actions -->
      <div class="flex flex-col items-center gap-2">
        <!-- Theme Switcher -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-10 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              :title="currentThemeLabel"
              :aria-label="currentThemeLabel"
              @click="cycleTheme"
            >
              <ChatIcon name="sun" v-if="chatSession.theme.value === 'light'" class="size-5" />
              <ChatIcon name="system" v-else-if="chatSession.theme.value === 'dim'" class="size-5" />
              <ChatIcon name="moon" v-else class="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{{ currentThemeLabel }}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  </TooltipProvider>
</template>
