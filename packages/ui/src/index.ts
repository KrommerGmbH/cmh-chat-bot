export { default as ChatMainView } from './ChatMainView.vue'
export { default as ChatDockPanel } from './ChatDockPanel.vue'
export { default as ChatCanvasDrawer } from './ChatCanvasDrawer.vue'
export type { ChatMainViewProps } from './chatViewProps'
export { useChatMain, type UseChatMainOptions } from './useChatMain'
export { applyDefaultAppearance, applyFontScale, applyTheme } from './appearance'
export {
  BrowserTtsEngine,
  DeviceTtsEngine,
  ServerTtsEngine,
  TtsServiceManager,
  type TtsEngine,
  type TtsHandlers,
  type TtsSpeakOptions,
  type TtsVoiceItem,
} from './tts/tts'
