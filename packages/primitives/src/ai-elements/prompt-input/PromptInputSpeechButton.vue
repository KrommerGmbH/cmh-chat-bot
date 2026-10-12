<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import ChatIcon from '../../ui/icon/ChatIcon.vue'
import { cn } from '../../lib/utils'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePromptInput } from './context'
import PromptInputButton from './PromptInputButton.vue'
import { useI18n } from '@cmh/chat-core'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip'

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  item: (index: number) => SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  item: (index: number) => SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

type PromptInputSpeechButtonProps = InstanceType<typeof PromptInputButton>['$props']

interface Props extends /* @vue-ignore */ PromptInputSpeechButtonProps {
  class?: HTMLAttributes['class']
  lang?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'recording-change', isRecording: boolean): void
}>()

const { t } = useI18n()
const { textInput, setTextInput } = usePromptInput()
const isListening = ref(false)
const recognition = ref<SpeechRecognition | null>(null)
const baseText = ref<string>('')
const isStopping = ref(false)
const elapsedSeconds = ref(0)
let timerId: ReturnType<typeof setInterval> | null = null

function startTimer() {
  elapsedSeconds.value = 0
  timerId = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

const formattedDuration = computed(() => {
  const m = Math.floor(elapsedSeconds.value / 60)
  const s = elapsedSeconds.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

onMounted(() => {
  const Win = window as any
  const SpeechRecognition = Win.SpeechRecognition || Win.webkitSpeechRecognition

  if (SpeechRecognition) {
    const sr = new SpeechRecognition()
    sr.continuous = true
    sr.interimResults = true
    sr.lang = props.lang || 'en-US'

    sr.onstart = () => {
      isListening.value = true
      isStopping.value = false
      baseText.value = textInput.value
      startTimer()
      emit('recording-change', true)
    }

    sr.onend = () => {
      isListening.value = false
      isStopping.value = false
      baseText.value = ''
      stopTimer()
      emit('recording-change', false)
    }

    sr.onresult = (event: SpeechRecognitionEvent) => {
      if (isStopping.value) return

      let accumulatedFinal = ''
      let currentInterim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          accumulatedFinal += result[0]?.transcript ?? ''
        } else {
          currentInterim += result[0]?.transcript ?? ''
        }
      }

      const speechText = [accumulatedFinal, currentInterim].filter(Boolean).join(' ').trim()
      const combined = baseText.value ? `${baseText.value} ${speechText}` : speechText
      setTextInput(combined)
    }

    sr.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      isListening.value = false
      isStopping.value = false
      baseText.value = ''
      stopTimer()
      emit('recording-change', false)
    }

    recognition.value = sr
  }
})

watch(
  () => props.lang,
  (newLang) => {
    if (recognition.value && newLang) {
      recognition.value.lang = newLang
    }
  },
)

onUnmounted(() => {
  stopTimer()
  if (recognition.value) {
    recognition.value.onstart = null
    recognition.value.onend = null
    recognition.value.onresult = null
    recognition.value.onerror = null
    try {
      recognition.value.abort?.()
    } catch {
      // Ignore abort error on unmount
    }
  }
})

function toggleListening() {
  if (!recognition.value) return
  if (isListening.value) {
    recognition.value.stop()
  } else {
    recognition.value.lang = props.lang || 'en-US'
    recognition.value.start()
  }
}

function stopListening() {
  if (recognition.value && isListening.value) {
    isStopping.value = true
    try {
      recognition.value.stop()
    } catch {
      // Ignore
    }
  }
}

function resetBaseText() {
  baseText.value = ''
}

defineExpose({
  isListening,
  stopListening,
  resetBaseText,
})
</script>

<template>
  <!-- 1. Listening State (Pulsing timer badge & stop button) -->
  <div
    v-if="isListening"
    class="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
  >
    <span class="size-2 rounded-full bg-destructive animate-pulse" />
    <span class="font-mono text-xs">{{ formattedDuration }}</span>
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-destructive/20 cursor-pointer"
      :title="t('micStop')"
      :aria-label="t('micStop')"
      @click.stop="toggleListening"
    >
      <ChatIcon name="stop" class="size-(--chat-input-icon) fill-current" />
      <span>{{ t('micStop') }}</span>
    </button>
  </div>

  <!-- 2. Unsupported Browser State (Tooltip with mic unsupported) -->
  <TooltipProvider v-else-if="!recognition">
    <Tooltip>
      <TooltipTrigger as-child>
        <div>
          <PromptInputButton
            disabled
            :class="cn('opacity-40 cursor-not-allowed', props.class)"
            v-bind="props"
          >
            <ChatIcon name="mic" class="size-(--chat-input-icon)" />
          </PromptInputButton>
        </div>
      </TooltipTrigger>
      <TooltipContent class="text-xs">
        {{ t('micUnsupported') }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  <!-- 3. Normal Idle State -->
  <PromptInputButton
    v-else
    :class="cn('relative transition-all duration-200', props.class)"
    v-bind="props"
    :title="t('startSpeechInput')"
    :aria-label="t('startSpeechInput')"
    @click="toggleListening"
  >
    <ChatIcon name="mic" class="size-(--chat-input-icon)" />
  </PromptInputButton>
</template>
