export * from './types/chat'

export {
  createChatClient,
  generateUuid,
  parseIsoDate,
  type ApprovalDecisionPayload,
  type ChatClient,
  type ChatClientOptions,
  type TtsManifestData,
  type TtsSegmentItem,
  type TtsVoicesData,
} from './api/client'

export {
  chatSession,
  normalizeLocale,
  normalizeTheme,
  setSessionLocale,
  setSessionMode,
  setSessionTheme,
  setSessionToken,
} from './auth/session'
export type { AuthInit, AuthSource } from './auth/types'
export { postMessageAuth } from './auth/postMessageAuth'
export { electronBridgeAuth } from './auth/electronBridgeAuth'
export { staticAuth } from './auth/staticAuth'
export { connectAuth } from './auth/connectAuth'

export * from './host/messages'
export {
  electronHost,
  getElectronBridge,
  noopHost,
  postMessageHost,
  type BrowserActPayload,
  type BrowserActResult,
  type CmhChatBridge,
  type HostBridge,
  type HostRoute,
  type LocalInferPayload,
  type LocalInferResult,
  type LocalModelStatusResult,
  type TabsContextPane,
  type TabsContextResult,
} from './host/bridge'
export { CHAT_CONTEXT_KEY, provideChatContext, useChatContext, type ChatContext } from './context'

export type { Transport, TransportEventMeta } from './transport/types'
export { PollingTransport, type PollingTransportOptions } from './transport/polling'
export { MockTransport, type MockScript, type MockTransportOptions } from './transport/mock'

export {
  createChatStore,
  type ChatStore,
  type ChatStoreOptions,
  type ChatStoreState,
} from './store/chatStore'
export { useApprovals, type ApprovalsOptions } from './store/useApprovals'

export { dictionaries, t, useI18n, type TranslationKey } from './i18n'
