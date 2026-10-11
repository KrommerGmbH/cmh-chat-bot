import type { ChatChannel, ChatViewMode, LocaleCode, ThemeMode } from '../types/chat'

/** Message `type` strings exchanged between the host page and the chat iframe (window.postMessage). */
export const CMH_CHAT_INIT = 'CMH_CHAT_INIT'
export const CMH_CHAT_FLOW_CONTEXT = 'CMH_CHAT_FLOW_CONTEXT'
export const CMH_CHAT_READY = 'CMH_CHAT_READY'
export const CMH_CHAT_ROUTE_NAVIGATE = 'CMH_CHAT_ROUTE_NAVIGATE'
export const CMH_CHAT_BACK_TO_SPLIT = 'CMH_CHAT_BACK_TO_SPLIT'
export const CMH_CHAT_SEND = 'CMH_CHAT_SEND'

export const TOKEN_REFRESHED = 'TOKEN_REFRESHED'
export const CMH_TOKEN_CHANGED = 'CMH_TOKEN_CHANGED'
export const CMH_LOCALE_CHANGED = 'CMH_LOCALE_CHANGED'
export const CMH_THEME_CHANGED = 'CMH_THEME_CHANGED'

/** Host -> chat. Sent once after the chat posted CMH_CHAT_READY. */
export interface ChatInitMessage {
  type: typeof CMH_CHAT_INIT
  token?: string
  locale?: string
  theme?: string
  mode?: ChatViewMode
  channel?: ChatChannel
  /** Mobile channel only: absolute http(s) URL of the API server. Ignored for admin and canvas. */
  apiBaseUrl?: string
}

/** Host -> chat. The flow canvas tells the chat which flow is open. */
export interface ChatFlowContextMessage {
  type: typeof CMH_CHAT_FLOW_CONTEXT
  flowId: string
}

/** Chat -> host. The chat finished loading and waits for CMH_CHAT_INIT. */
export interface ChatReadyMessage {
  type: typeof CMH_CHAT_READY
}

/** Chat -> host. Open a host route (for example a link or table row in a message). */
export interface ChatRouteNavigateMessage {
  type: typeof CMH_CHAT_ROUTE_NAVIGATE
  route: { name: string; params: Record<string, unknown> }
}

/** Chat -> host. Leave full-screen mode and return to the split view. */
export interface ChatBackToSplitMessage {
  type: typeof CMH_CHAT_BACK_TO_SPLIT
}

/** Host -> chat. Send a user message as if it was typed. */
export interface ChatSendMessage {
  type: typeof CMH_CHAT_SEND
  text: string
}

export interface TokenChangedMessage {
  type: typeof TOKEN_REFRESHED | typeof CMH_TOKEN_CHANGED
  token: string
}

export interface LocaleChangedMessage {
  type: typeof CMH_LOCALE_CHANGED
  locale: LocaleCode | string
}

export interface ThemeChangedMessage {
  type: typeof CMH_THEME_CHANGED
  theme: ThemeMode | string
}

export type HostToChatMessage =
  | ChatInitMessage
  | ChatFlowContextMessage
  | ChatSendMessage
  | TokenChangedMessage
  | LocaleChangedMessage
  | ThemeChangedMessage

export type ChatToHostMessage =
  | ChatReadyMessage
  | ChatRouteNavigateMessage
  | ChatBackToSplitMessage
