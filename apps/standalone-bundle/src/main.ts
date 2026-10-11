import {
  CMH_CHAT_FLOW_CONTEXT,
  CMH_CHAT_INIT,
  CMH_CHAT_SEND,
  chatSession,
  connectAuth,
  createChatClient,
  noopHost,
  postMessageAuth,
  postMessageHost,
  staticAuth,
} from '@cmh/chat-core'
import { ChatCanvasDrawer, ChatMainView } from '@cmh/chat-ui'
import { createApp, h, ref } from 'vue'
import { toast } from 'vue-sonner'
import { buildBootConfig, isAcceptableSendText, MAX_SEND_TEXT_LENGTH, resolveApiBase } from './bootConfig'
import './style.css'

/**
 * Standalone chat page. A host page embeds it in an iframe and sends CMH_CHAT_INIT.
 *
 * URL parameters:
 *   mode    admin | canvas | mobile   (default admin)
 *   parent  origin of the embedding page when it is not the same origin
 *   flowId  canvas only: the flow this chat belongs to
 *
 * Messages from the host (same trust rule):
 *   CMH_CHAT_INIT  mobile channel only: `apiBaseUrl` (absolute http/https) becomes the API base unless VITE_API_BASE is set
 *   CMH_CHAT_SEND  `text` (max 2,000 characters) is sent as a user message, any channel
 *
 * Trust rule: messages are accepted from the origin of this page, and from `parent` only when that
 * origin is in the build-time list VITE_ALLOWED_PARENT_ORIGINS (comma separated). A `parent`
 * value that is not in the list is ignored, so a foreign page cannot make itself trusted through the URL.
 * Only the embedding window (`window.parent`) is accepted as message source.
 * The pure decisions live in bootConfig.ts.
 */
const params = new URLSearchParams(window.location.search)
const { channel, trustedParent, hostOrigin, allowedOrigins, hasUsableOrigin } = buildBootConfig(
  window.location.search,
  window.location.origin,
  String(import.meta.env.VITE_ALLOWED_PARENT_ORIGINS ?? ''),
)

const isEmbedded = window.parent !== window
const flowId = ref<string | null>(params.get('flowId'))

const envApiBase = String(import.meta.env.VITE_API_BASE ?? '')
// Set by a trusted CMH_CHAT_INIT (mobile channel only), read on every request.
let hostApiBase = ''
const chatView = ref<{ sendText: (text: string) => Promise<void> } | null>(null)

const client = createChatClient({
  baseUrl: () => envApiBase || hostApiBase,
  getToken: () => chatSession.token.value,
  onError: message => toast.error(message),
})

if (isEmbedded && !hasUsableOrigin) {
  // Opaque origin (file://, some app schemes) and no listed parent: postMessageAuth cannot be created.
  // Show a visible error instead of a blank page.
  const reason = 'Chat cannot start: this page has an opaque origin ("null") and no parent origin is listed in VITE_ALLOWED_PARENT_ORIGINS.'
  console.error(`[cmh-chat] ${reason}`)
  createApp({
    render: () => h(
      'div',
      { role: 'alert', class: 'flex h-full items-center justify-center bg-background p-6 text-center text-sm text-destructive' },
      reason,
    ),
  }).mount('#app')
} else {
  // The API base listener is added BEFORE postMessageAuth: both see the same CMH_CHAT_INIT, and the auth promise
  // continues (and the first request may start) right after its own listener, so the base must already be set.
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return
    if (!allowedOrigins.includes(event.origin)) return
    if (event.data?.type === CMH_CHAT_INIT) {
      hostApiBase = resolveApiBase(channel, envApiBase, event.data.apiBaseUrl)
    }
  })

  // The listener must exist before the iframe `load` event: the admin sends CMH_CHAT_INIT on load.
  const auth = isEmbedded
    ? postMessageAuth({ allowedOrigins, expectedSource: window.parent })
    : staticAuth({
        token: String(import.meta.env.VITE_DEV_TOKEN ?? ''),
        locale: 'ko-KR',
        theme: 'dark',
        mode: 'page',
      })
  const host = isEmbedded ? postMessageHost({ targetOrigin: hostOrigin }) : noopHost()

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return
    if (!allowedOrigins.includes(event.origin)) return
    const data = event.data
    if (data?.type === CMH_CHAT_FLOW_CONTEXT && typeof data.flowId === 'string') {
      flowId.value = data.flowId
    } else if (data?.type === CMH_CHAT_SEND) {
      if (isAcceptableSendText(data.text)) {
        void chatView.value?.sendText(data.text)
      } else if (typeof data.text === 'string' && data.text.length > MAX_SEND_TEXT_LENGTH) {
        console.warn(`[cmh-chat] CMH_CHAT_SEND ignored: text is longer than ${MAX_SEND_TEXT_LENGTH} characters.`)
      }
    }
  })

  chatSession.channel.value = channel
  void connectAuth(auth).then(() => {
    // The URL decides the channel of this bundle; the host message must not move it to another one.
    chatSession.channel.value = channel
  })

  if (isEmbedded) {
    // Console only, the UI stays usable. The usual cause: the parent is not same-origin and not listed.
    const initTimeout = window.setTimeout(() => {
      console.error(
        `[cmh-chat] No CMH_CHAT_INIT received from the parent window after 10 s. Likely cause: the parent origin is not the same origin as this page and is not listed in VITE_ALLOWED_PARENT_ORIGINS (accepted origins: ${allowedOrigins.join(', ')}${trustedParent ? '' : '; no valid ?parent= given'}).`,
      )
    }, 10_000)
    void auth.resolve().then(() => window.clearTimeout(initTimeout))
  }

  createApp({
    // One root component per channel: a late flow id must not remount the chat and lose its state.
    render: () => (channel === 'canvas'
      ? h(ChatCanvasDrawer, { ref: chatView, client, host, flowId: flowId.value, ownsDocument: true })
      : h(ChatMainView, { ref: chatView, client, host, channel, flowId: flowId.value, ownsDocument: true })),
  }).mount('#app')
}
