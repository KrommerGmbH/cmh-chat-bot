import type { FontScale, TtsEngineType, UserConfigData } from '@cmh/chat-core'
import { chatSession, setSessionTheme, type ChatClient } from '@cmh/chat-core'
import { applyFontScale as writeFontScale } from '../appearance'
import type { TtsServiceManager } from '../tts/tts'
import { ref } from 'vue'

/** Config keys the user can change; used to protect values changed while the initial load was still in flight. */
export type UserConfigKey = 'theme' | 'pins' | 'modelByHarness' | 'fontScale' | 'ttsEngine' | 'ttsVoice' | 'ttsSpeaker' | 'ttsStyle' | 'autoRead'

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
    void persistUserConfig('fontScale')
  }

  function handleTtsEngineChange(engine: TtsEngineType) {
    options.onStopTts?.()
    ttsEngine.value = engine
    ttsService.setEngine(engine)
    options.onLoadVoices?.()
    persistUserConfig('ttsEngine')
  }

  function handleTtsVoiceChange(voice: string | null) {
    ttsVoice.value = voice
    persistUserConfig('ttsVoice')
  }

  function handleTtsSpeakerChange(speaker: string | null) {
    ttsSpeaker.value = speaker
    persistUserConfig('ttsSpeaker')
  }

  function handleTtsStyleChange(style: string | null) {
    ttsStyle.value = style
    persistUserConfig('ttsStyle')
  }

  function handleAutoReadChange(val: boolean) {
    autoRead.value = val
    if (val) {
      options.onAutoReadEnabled?.()
    } else {
      options.onStopTts?.()
    }
    persistUserConfig('autoRead')
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  // Nothing may be saved before the initial loadUserConfig() has settled: a save with default values
  // would overwrite the stored config of the user (race with the theme watcher and early clicks).
  const isConfigLoaded = ref(false)
  /** Keys the user changed before the load settled: the server value must not overwrite them. */
  const changedBeforeLoad = new Set<UserConfigKey>()

  /** Call once the initial load succeeded (never after a failed load: defaults would overwrite the stored config). Persists once when the user changed something before. */
  function markConfigLoaded() {
    if (isConfigLoaded.value) return
    isConfigLoaded.value = true
    // Saves the merged state (server values + the user's early changes) once.
    if (changedBeforeLoad.size > 0) {
      changedBeforeLoad.clear()
      scheduleSave()
    }
  }

  /**
   * Apply the result of the initial load. Keys the user changed while the load was in flight keep the user's value;
   * markConfigLoaded() then saves the merged state once. Call only after a successful load.
   */
  function applyLoadedConfig(config: UserConfigData) {
    if (config.theme) {
      setSessionTheme(config.theme)
    }
    if (config.pins && Array.isArray(config.pins) && !changedBeforeLoad.has('pins')) {
      pinnedIds.value = config.pins
    }
    if (config.modelByHarness && typeof config.modelByHarness === 'object' && !changedBeforeLoad.has('modelByHarness')) {
      modelByHarness.value = config.modelByHarness
    }
    if (config.fontScale && !changedBeforeLoad.has('fontScale')) {
      fontScale.value = config.fontScale
      applyFontScale(config.fontScale)
    }
    if (!changedBeforeLoad.has('ttsEngine')) {
      const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
      if (config.ttsEngine === 'device') {
        ttsEngine.value = 'server'
        ttsService.setEngine('server')
      } else if (config.ttsEngine === 'browser' && !hasSpeechSynthesis) {
        ttsEngine.value = 'server'
        ttsService.setEngine('server')
      } else if (config.ttsEngine) {
        ttsEngine.value = config.ttsEngine
        ttsService.setEngine(config.ttsEngine)
      } else {
        ttsEngine.value = 'server'
        ttsService.setEngine('server')
      }
    }
    if (config.ttsVoice !== undefined && !changedBeforeLoad.has('ttsVoice')) {
      ttsVoice.value = config.ttsVoice
    }
    if (config.ttsSpeaker !== undefined && !changedBeforeLoad.has('ttsSpeaker')) {
      ttsSpeaker.value = config.ttsSpeaker
    }
    if (config.ttsStyle !== undefined && !changedBeforeLoad.has('ttsStyle')) {
      ttsStyle.value = config.ttsStyle
    }
    if (typeof config.autoRead === 'boolean' && !changedBeforeLoad.has('autoRead')) {
      autoRead.value = config.autoRead
    }
    // Saving is allowed only after a successful load (never after a failure: defaults would overwrite the stored config).
    markConfigLoaded()
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

  function persistUserConfig(key: UserConfigKey) {
    if (!isConfigLoaded.value) {
      changedBeforeLoad.add(key)
      return
    }
    scheduleSave()
  }

  function scheduleSave() {
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
    persistUserConfig('pins')
  }

  async function unpin(id: string) {
    const index = pinnedIds.value.indexOf(id)
    if (index !== -1) {
      pinnedIds.value.splice(index, 1)
      persistUserConfig('pins')
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
    applyLoadedConfig,
    togglePin,
    unpin,
    hasPersistTimer: () => Boolean(persistTimer),
  }
}
