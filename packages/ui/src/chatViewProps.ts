import type { ChatChannel, ChatClient, HostBridge, Transport } from '@cmh/chat-core'

export interface ChatMainViewProps {
  client: ChatClient
  host: HostBridge
  /** Default: `new PollingTransport({ client })`. */
  transport?: Transport
  /** Default: the channel of the chat session, else 'admin'. */
  channel?: ChatChannel
  /** Reactive: the view follows changes. `client`, `host` and `transport` are read once. */
  flowId?: string | null
  /** True in the standalone iframe bundle: the view writes theme and font scale to <html>/<body>. */
  ownsDocument?: boolean
  /** Mount the toast host once inside the view. Default: the value of `ownsDocument`. */
  showToaster?: boolean
  /** Always use the narrow layout (side dock). */
  forceNarrow?: boolean
}

export const chatViewPropDefaults = {
  transport: undefined,
  channel: undefined,
  flowId: null,
  ownsDocument: false,
  showToaster: undefined,
  forceNarrow: false,
} as const
