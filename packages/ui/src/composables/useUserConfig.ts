import type { FontScale, TtsEngineType } from '@cmh/chat-core'
import { chatSession, type ChatClient } from '@cmh/chat-core'
import { applyFontScale as writeFontScale } from '../appearance'
import type { TtsServiceManager } from '../tts/tts'
import { ref } from 'vue'

export interface UserConfigOptions {
  client: Pick<ChatClient, 'saveUserConfig'>
  tts: TtsServiceManager
  /** True when this view owns the document (standalone iframe bundle): only then the font scale is written to <html>. */
  ownsDocument?: boolean
  onStopTts?: () => void
  onLoadVoices?: () => void
  onAutoReadEnabled?: () => void
}

export function useUserConfig(options: UserConfigOptions) {
  const ttsService = options.tts
  const pinnedIds = ref<string[]>([])
  const modelByHarness = ref<Record<string, string | null>>({})
  const fontScale = ref<FontScale>('M')
  const ttsEngine = ref<TtsEngineType>('server')
  const ttsVoice = ref<string | null>(null)
  const ttsSpeaker = ref<string | null>(null)
  const ttsStyle = ref<string | null>(null)
  const autoRead = ref<boolean>(false)

  function applyFontScale(scale: FontScale) {
    // The host owns the font size unless this view owns the document.
    if (!options.ownsDocument) return
    writeFontScale(scale)
  }

  function handleFontScaleChange(scale: FontScale) {
    fontScale.value = scale
    applyFontScale(scale)
    void persistUserConfig()
  }

  function handleTtsEngineChange(engine: TtsEngineType) {
    options.onStopTts?.()
    ttsEngine.value = engine
    ttsService.setEngine(engine)
    options.onLoadVoices?.()
    persistUserConfig()
  }

  function handleTtsVoiceChange(voice: string | null) {
    ttsVoice.value = voice
    persistUserConfig()
  }

  function handleTtsSpeakerChange(speaker: string | null) {
    ttsSpeaker.value = speaker
    persistUserConfig()
  }

  function handleTtsStyleChange(style: string | null) {
    ttsStyle.value = style
    persistUserConfig()
  }

  function handleAutoReadChange(val: boolean) {
    autoRead.value = val
    if (val) {
      options.onAutoReadEnabled?.()
    } else {
      options.onStopTts?.()
    }
    persistUserConfig()
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  // Nothing may be saved before the initial loadUserConfig() has settled: a save with default values
  // would overwrite the stored config of the user (race with the theme watcher and early clicks).
  const isConfigLoaded = ref(false)
  let hasChangeBeforeLoad = false

  /** Call once the initial load succeeded (never after a failed load: defaults would overwrite the stored config). Persists once when the user changed something before. */
  function markConfigLoaded() {
    if (isConfigLoaded.value) return
    isConfigLoaded.value = true
    if (hasChangeBeforeLoad) {
      hasChangeBeforeLoad = false
      persistUserConfig()
    }
  }

  function flushPersistUserConfig() {
    if (!isConfigLoaded.value) return
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    void options.client.saveUserConfig({
      theme: chatSession.theme.value,
      pins: pinnedIds.value,
      modelByHarness: modelByHarness.value,
      fontScale: fontScale.value,
      ttsEngine: ttsEngine.value,
      ttsVoice: ttsVoice.value,
      ttsSpeaker: ttsSpeaker.value,
      ttsStyle: ttsStyle.value,
      autoRead: autoRead.value,
    })
  }

  function persistUserConfig() {
    if (!isConfigLoaded.value) {
      hasChangeBeforeLoad = true
      return
    }
    if (persistTimer) {
      clearTimeout(persistTimer)
    }
    persistTimer = setTimeout(() => {
      persistTimer = null
      flushPersistUserConfig()
    }, 400)
  }

  async function togglePin(id: string) {
    const index = pinnedIds.value.indexOf(id)
    if (index === -1) {
      pinnedIds.value.push(id)
    } else {
      pinnedIds.value.splice(index, 1)
    }
    persistUserConfig()
  }

  async function unpin(id: string) {
    const index = pinnedIds.value.indexOf(id)
    if (index !== -1) {
      pinnedIds.value.splice(index, 1)
      persistUserConfig()
    }
  }

  return {
    pinnedIds,
    modelByHarness,
    fontScale,
    ttsEngine,
    ttsVoice,
    ttsSpeaker,
    ttsStyle,
    autoRead,
    applyFontScale,
    handleFontScaleChange,
    handleTtsEngineChange,
    handleTtsVoiceChange,
    handleTtsSpeakerChange,
    handleTtsStyleChange,
    handleAutoReadChange,
    flushPersistUserConfig,
    persistUserConfig,
    isConfigLoaded,
    markConfigLoaded,
    togglePin,
    unpin,
    hasPersistTimer: () => Boolean(persistTimer),
  }
}
