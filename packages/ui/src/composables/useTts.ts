import type { ChatMessage, TtsEngineType } from '@cmh/chat-core'
import { chatSession, useI18n } from '@cmh/chat-core'
import type { TtsServiceManager, TtsVoiceItem } from '../tts/tts'
import { computed, type Ref, ref, watch } from 'vue'

export interface TtsOptions {
  tts: TtsServiceManager
  ttsVoice: Ref<string | null>
  ttsEngine?: Ref<TtsEngineType>
  ttsSpeaker?: Ref<string | null>
  ttsStyle?: Ref<string | null>
}

export function useTts(options: TtsOptions) {
  const { t } = useI18n()
  const ttsService = options.tts
  const activeTtsMessageId = ref<string | null>(null)
  const isTtsPreparing = ref<boolean>(false)
  const availableVoices = ref<TtsVoiceItem[]>([])
  const availableSpeakers = ref<string[]>([])
  const availableStyles = ref<string[]>([])
  const defaultSpeakers = ref<Record<string, string>>({})
  const spokenMessageIds = new Set<string>()

  const defaultSpeakerForLocale = computed(() => {
    const loc = (chatSession.locale.value || 'ko-KR').toLowerCase().split('-')[0]
    return defaultSpeakers.value[loc] || defaultSpeakers.value.en || defaultSpeakers.value.ko || ''
  })

  async function loadVoices() {
    try {
      availableVoices.value = await ttsService.listVoices(chatSession.locale.value, 'browser')
    } catch (err) {
      console.error('Failed to list browser voices:', err)
    }

    try {
      const serverVoices = await ttsService.loadServerVoices()
      if (serverVoices.speakers && serverVoices.speakers.length > 0) {
        availableSpeakers.value = serverVoices.speakers
      }
      if (serverVoices.styles && serverVoices.styles.length > 0) {
        availableStyles.value = serverVoices.styles
      }
      if (serverVoices.defaultSpeakers && Object.keys(serverVoices.defaultSpeakers).length > 0) {
        defaultSpeakers.value = serverVoices.defaultSpeakers
      }
    } catch (err) {
      console.error('Failed to load server voices:', err)
    }
  }

  function playAssistantMessageTts(msg: ChatMessage) {
    const text = msg.content || ''
    if (!text) return

    stopTts()
    activeTtsMessageId.value = msg.id

    const engineType = options.ttsEngine?.value ?? ttsService.getEngineType()
    if (engineType === 'server') {
      isTtsPreparing.value = true
    }

    ttsService.speak(
      text,
      {
        messageId: msg.id,
        speaker: options.ttsSpeaker?.value || null,
        style: options.ttsStyle?.value || 'neutral',
        voiceId: options.ttsVoice.value,
        locale: chatSession.locale.value,
        fallbackNotice: t('ttsFallbackNotice'),
      },
      {
        onPreparing: () => {
          activeTtsMessageId.value = msg.id
          isTtsPreparing.value = true
        },
        onStart: () => {
          activeTtsMessageId.value = msg.id
          isTtsPreparing.value = false
        },
        onEnd: () => {
          if (activeTtsMessageId.value === msg.id) {
            activeTtsMessageId.value = null
            isTtsPreparing.value = false
          }
        },
        onError: () => {
          if (activeTtsMessageId.value === msg.id) {
            activeTtsMessageId.value = null
            isTtsPreparing.value = false
          }
        },
        onFallback: () => {
          isTtsPreparing.value = false
        },
      },
      engineType,
      chatSession.locale.value,
    )
  }

  function toggleTts(msg: ChatMessage) {
    if (activeTtsMessageId.value === msg.id) {
      stopTts()
      return
    }
    playAssistantMessageTts(msg)
  }

  function stopTts() {
    ttsService.stop()
    activeTtsMessageId.value = null
    isTtsPreparing.value = false
  }

  watch(
    () => chatSession.locale.value,
    async (newLocale) => {
      try {
        availableVoices.value = await ttsService.listVoices(newLocale, 'browser')
      } catch {
        // ignore
      }
    },
  )

  return {
    activeTtsMessageId,
    isTtsPreparing,
    availableVoices,
    availableSpeakers,
    availableStyles,
    defaultSpeakerForLocale,
    spokenMessageIds,
    loadVoices,
    playAssistantMessageTts,
    toggleTts,
    stopTts,
  }
}
