import type { FontScale, Harness, TtsEngineType } from '@cmh/chat-core'
import type { TtsVoiceItem } from '../../tts/tts'
import { chatSession, useI18n } from '@cmh/chat-core'
import { computed, ref } from 'vue'

export interface ChatHeaderProps {
  harnesses: Harness[]
  selectedHarnessId: string | null
  isSidebarOpen: boolean
  bootstrapFailed?: boolean
  selectedModelLabel?: string | null
  fontScale: FontScale
  ttsEngine: TtsEngineType
  ttsVoice: string | null
  ttsSpeaker?: string | null
  ttsStyle?: string | null
  autoRead: boolean
  availableVoices: TtsVoiceItem[]
  availableSpeakers?: string[]
  availableStyles?: string[]
  defaultSpeakerForLocale?: string
}

export type ChatHeaderEmit = {
  (e: 'toggle-sidebar'): void
  (e: 'new-chat'): void
  (e: 'update:fontScale', val: FontScale): void
  (e: 'update:ttsEngine', val: TtsEngineType): void
  (e: 'update:ttsVoice', val: string | null): void
  (e: 'update:ttsSpeaker', val: string | null): void
  (e: 'update:ttsStyle', val: string | null): void
  (e: 'update:autoRead', val: boolean): void
  (e: 'back-to-split'): void
}

const SPEAKER_LABELS: Record<string, { ko: string, de: string, en: string }> = {
  Sohee: { ko: 'Sohee (한국어)', de: 'Sohee (Koreanisch)', en: 'Sohee (Korean)' },
  Vivian: { ko: 'Vivian (영어)', de: 'Vivian (Englisch)', en: 'Vivian (English)' },
  Serena: { ko: 'Serena (영어)', de: 'Serena (Englisch)', en: 'Serena (English)' },
  Uncle_Fu: { ko: 'Uncle Fu (중국어)', de: 'Uncle Fu (Chinesisch)', en: 'Uncle Fu (Chinese)' },
  Dylan: { ko: 'Dylan (영어)', de: 'Dylan (Englisch)', en: 'Dylan (English)' },
  Eric: { ko: 'Eric (영어)', de: 'Eric (Englisch)', en: 'Eric (English)' },
  Ryan: { ko: 'Ryan (영어/독일어 기본)', de: 'Ryan (Englisch/Deutsch)', en: 'Ryan (English/German)' },
  Aiden: { ko: 'Aiden (영어)', de: 'Aiden (Englisch)', en: 'Aiden (English)' },
  Ono_Anna: { ko: 'Anna Ono (일본어)', de: 'Anna Ono (Japanisch)', en: 'Anna Ono (Japanese)' },
}

export function useChatHeader(props: ChatHeaderProps, emit: ChatHeaderEmit) {
  void emit
  const { t } = useI18n()
  const isSettingsOpen = ref(false)

  const isHubApp = computed(() => {
    return typeof navigator !== 'undefined' && Boolean(navigator.userAgent?.includes('CmhHubApp/'))
  })

  const activeHarness = computed(() => {
    return props.harnesses.find(h => h.id === props.selectedHarnessId || h.agentId === props.selectedHarnessId) || null
  })

  function getSpeakerDisplayLabel(speaker?: string): string {
    if (!speaker) return ''
    const loc = (chatSession.locale.value || 'ko-KR').toLowerCase().split('-')[0] as 'ko' | 'de' | 'en'
    const entry = SPEAKER_LABELS[speaker]
    if (entry) {
      return entry[loc] || entry.en
    }
    return speaker
  }

  function getStyleLabel(style: string): string {
    if (style === 'warm') return t('styleWarm')
    if (style === 'bright') return t('styleBright')
    if (style === 'calm') return t('styleCalm')
    return t('styleNeutral')
  }

  return {
    t,
    isSettingsOpen,
    isHubApp,
    activeHarness,
    chatSession,
    getSpeakerDisplayLabel,
    getStyleLabel,
  }
}
