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
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import {
  type ChatHeaderEmit,
  type ChatHeaderProps,
  useChatHeader,
} from './ChatHeader'

const props = defineProps<ChatHeaderProps>()
const emit = defineEmits<ChatHeaderEmit>()
const {
  t,
  isSettingsOpen,
  isHubApp,
  activeHarness,
  chatSession,
  getSpeakerDisplayLabel,
  getStyleLabel,
} = useChatHeader(props, emit)
</script>

<template>
  <header class="flex h-12 w-full shrink-0 items-center justify-between border-b bg-card px-3">
    <!-- Left: Sidebar Toggle & Active Harness Info -->
    <div class="flex items-center gap-2 min-w-0">
      <Button
        variant="ghost"
        size="icon-sm"
        class="size-8 text-muted-foreground hover:text-foreground shrink-0"
        :aria-label="t('toggleSidebar')"
        :title="t('toggleSidebar')"
        @click="emit('toggle-sidebar')"
      >
        <ChatIcon name="menu" class="size-4" />
      </Button>

      <!-- Active Harness Indicator or Empty Warning -->
      <div v-if="harnesses.length > 0 && activeHarness" class="flex items-center gap-2 truncate">
        <div class="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <ChatIcon name="cpu" class="size-4" />
        </div>
        <div class="flex flex-col truncate">
          <span class="text-base font-semibold leading-tight text-foreground truncate">{{ activeHarness.name }}</span>
          <span class="text-[0.8125rem] text-muted-foreground truncate">
            {{ activeHarness.agentCode || 'AI' }} · {{ selectedModelLabel || activeHarness.modelLabel || t('defaultLabel') }}
          </span>
        </div>
      </div>

      <div v-else-if="harnesses.length === 0" class="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-destructive text-xs shrink-0">
        <ChatIcon name="warning" class="size-3.5 shrink-0" />
        <span class="font-medium">{{ bootstrapFailed ? t('bootstrapFailedTitle') : t('noHarnessTitle') }}</span>
      </div>
    </div>

    <!-- Right Action Buttons -->
    <div class="flex items-center gap-1 shrink-0">
      <!-- 1. New Chat -->
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="size-8 text-muted-foreground hover:text-foreground"
              :aria-label="t('newChat')"
              :title="t('newChat')"
              @click="emit('new-chat')"
            >
              <ChatIcon name="plus" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ t('newChat') }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <!-- 2. Conversations Toggle -->
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="size-8 text-muted-foreground hover:text-foreground"
              :aria-label="t('conversations')"
              :title="t('conversations')"
              @click="emit('toggle-sidebar')"
            >
              <ChatIcon name="clock" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ t('conversations') }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <!-- 3. Settings Popover -->
      <PopoverRoot v-model:open="isSettingsOpen">
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="size-8 text-muted-foreground hover:text-foreground"
            :aria-label="t('settings')"
            :title="t('settings')"
          >
            <ChatIcon name="settings" class="size-4" />
          </Button>
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverContent
            side="bottom"
            align="end"
            :side-offset="8"
            class="z-50 w-80 rounded-xl border bg-card p-4 text-card-foreground shadow-xl outline-none"
          >
            <div class="flex flex-col gap-4">
              <div class="border-b pb-2">
                <h4 class="font-semibold text-sm">{{ t('settings') }}</h4>
              </div>

              <!-- Font Size -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label id="label-font-size" class="text-xs font-semibold">{{ t('fontSize') }}</label>
                  <span class="text-[0.8125rem] text-muted-foreground">{{ props.fontScale }}</span>
                </div>
                <p class="text-[0.75rem] text-muted-foreground leading-relaxed">{{ t('fontSizeDesc') }}</p>
                <div class="grid grid-cols-4 gap-1 rounded-lg border bg-muted/40 p-1" role="group" aria-labelledby="label-font-size">
                  <button
                    v-for="scale in (['S', 'M', 'L', 'XL'] as const)"
                    :key="scale"
                    type="button"
                    :aria-label="scale"
                    :title="scale"
                    :aria-pressed="props.fontScale === scale"
                    :class="[
                      'rounded-md py-1 text-xs font-medium transition-colors cursor-pointer',
                      props.fontScale === scale
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    ]"
                    @click="emit('update:fontScale', scale)"
                  >
                    {{ scale }}
                  </button>
                </div>
              </div>

              <!-- TTS Engine -->
              <div class="flex flex-col gap-1.5">
                <label id="label-tts-engine" class="text-xs font-semibold">{{ t('ttsEngine') }}</label>
                <div class="flex flex-col gap-1 text-xs" role="group" aria-labelledby="label-tts-engine">
                  <button
                    type="button"
                    :aria-label="`${t('engineServer')} (${t('serverTtsModel')})`"
                    :title="`${t('engineServer')} (${t('serverTtsModel')})`"
                    :class="[
                      'flex items-center justify-between rounded-md border p-2 text-left cursor-pointer transition-colors',
                      props.ttsEngine === 'server' ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground',
                    ]"
                    @click="emit('update:ttsEngine', 'server')"
                  >
                    <span class="font-medium">{{ t('engineServer') }}</span>
                    <span class="text-[0.75rem] text-muted-foreground">{{ t('serverTtsModel') }}</span>
                  </button>
                  <button
                    type="button"
                    :aria-label="`${t('engineBrowser')} (${t('webSpeech')})`"
                    :title="`${t('engineBrowser')} (${t('webSpeech')})`"
                    :class="[
                      'flex items-center justify-between rounded-md border p-2 text-left cursor-pointer transition-colors',
                      props.ttsEngine === 'browser' ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground',
                    ]"
                    @click="emit('update:ttsEngine', 'browser')"
                  >
                    <span class="font-medium">{{ t('engineBrowser') }}</span>
                    <span class="text-[0.75rem] text-muted-foreground">{{ t('webSpeech') }}</span>
                  </button>
                  <div
                    class="flex items-center justify-between rounded-md border border-dashed border-border/60 p-2 text-muted-foreground/60 cursor-not-allowed opacity-60"
                  >
                    <span>{{ t('engineDevice') }}</span>
                    <span class="text-[0.75rem]">{{ t('onDeviceSmallModel') }}</span>
                  </div>
                </div>
              </div>

              <!-- Server Voice (Speaker) & Style Selection -->
              <template v-if="props.ttsEngine === 'server'">
                <div class="flex flex-col gap-1.5">
                  <label for="tts-speaker-select" class="text-xs font-semibold">{{ t('ttsSpeaker') }}</label>
                  <select
                    id="tts-speaker-select"
                    :value="props.ttsSpeaker || ''"
                    class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                    :aria-label="t('ttsSpeaker')"
                    @change="(e) => emit('update:ttsSpeaker', (e.target as HTMLSelectElement).value || null)"
                  >
                    <option value="">{{ t('autoModel') }} ({{ getSpeakerDisplayLabel(props.defaultSpeakerForLocale) }})</option>
                    <option
                      v-for="speaker in (props.availableSpeakers || [])"
                      :key="speaker"
                      :value="speaker"
                    >
                      {{ getSpeakerDisplayLabel(speaker) }}
                    </option>
                  </select>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="tts-style-select" class="text-xs font-semibold">{{ t('ttsStyle') }}</label>
                  <select
                    id="tts-style-select"
                    :value="props.ttsStyle || 'neutral'"
                    class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                    :aria-label="t('ttsStyle')"
                    @change="(e) => emit('update:ttsStyle', (e.target as HTMLSelectElement).value || null)"
                  >
                    <option
                      v-for="style in props.availableStyles"
                      :key="style"
                      :value="style"
                    >
                      {{ getStyleLabel(style) }}
                    </option>
                  </select>
                </div>
              </template>

              <!-- Browser Voice Selection -->
              <div v-else-if="props.ttsEngine === 'browser'" class="flex flex-col gap-1.5">
                <label for="tts-voice-select" class="text-xs font-semibold">{{ t('voiceSelect') }}</label>
                <select
                  id="tts-voice-select"
                  :value="props.ttsVoice || ''"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                  :aria-label="t('voiceSelect')"
                  @change="(e) => emit('update:ttsVoice', (e.target as HTMLSelectElement).value || null)"
                >
                  <option value="">{{ t('autoModel') }} ({{ t('defaultLabel') }})</option>
                  <option
                    v-for="voice in props.availableVoices"
                    :key="voice.id"
                    :value="voice.id"
                  >
                    {{ voice.name }} ({{ voice.lang }})
                  </option>
                </select>
              </div>

              <!-- Auto-Read Toggle -->
              <div class="flex items-center justify-between border-t pt-3">
                <div class="flex flex-col">
                  <label for="auto-read-switch" class="text-xs font-semibold cursor-pointer">{{ t('autoRead') }}</label>
                  <span class="text-[0.75rem] text-muted-foreground">{{ t('autoReadTitle') }}</span>
                </div>
                <button
                  id="auto-read-switch"
                  type="button"
                  role="switch"
                  :aria-label="t('autoRead')"
                  :title="t('autoRead')"
                  :aria-checked="props.autoRead"
                  :class="[
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    props.autoRead ? 'bg-primary' : 'bg-muted',
                  ]"
                  @click="emit('update:autoRead', !props.autoRead)"
                >
                  <span
                    :class="[
                      'pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                      props.autoRead ? 'translate-x-4' : 'translate-x-0',
                    ]"
                  />
                </button>
              </div>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <!-- 4. Split Toggle (solo mode only, hidden in hub-app) -->
      <TooltipProvider v-if="chatSession.mode.value === 'solo' && !isHubApp">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              :aria-label="`${t('splitView')} (Esc)`"
              :title="`${t('splitView')} (Esc)`"
              @click="emit('back-to-split')"
            >
              <ChatIcon name="layoutTwo" class="size-4" />
              <span class="hidden sm:inline">{{ t('splitView') }} (Esc)</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ t('splitView') }} (Esc)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </header>
</template>
