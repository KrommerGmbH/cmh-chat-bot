import { inject, provide, type App, type InjectionKey } from 'vue'
import type { ChatClient } from './api/client'
import type { HostBridge } from './host/bridge'

/** What every chat component needs from its host: the API client and the host bridge. */
export interface ChatContext {
  client: ChatClient
  host: HostBridge
}

export const CHAT_CONTEXT_KEY: InjectionKey<ChatContext> = Symbol('cmh-chat-context')

/** Call in the setup of the root chat component, or pass the app to provide app-wide. */
export function provideChatContext(context: ChatContext, app?: App): void {
  if (app) {
    app.provide(CHAT_CONTEXT_KEY, context)
    return
  }
  provide(CHAT_CONTEXT_KEY, context)
}

export function useChatContext(): ChatContext {
  const context = inject(CHAT_CONTEXT_KEY, null)
  if (!context) {
    throw new Error('Chat context is missing. Call provideChatContext({ client, host }) in a parent component.')
  }
  return context
}
