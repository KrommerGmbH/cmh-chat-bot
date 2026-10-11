import {
  CMH_CHAT_FLOW_CONTEXT,
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
import { buildBootConfig } from './bootConfig'
import './style.css'

/**
 * Standalone chat page. A host page embeds it in an iframe and sends CMH_CHAT_INIT.
 *
 * URL parameters:
 *   mode    admin | canvas | mobile   (default admin)
 *   parent  origin of the embedding page when it is not the same origin
 *   flowId  canvas only: the flow this chat belongs to
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

const client = createChatClient({
  baseUrl: String(import.meta.env.VITE_API_BASE ?? ''),
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
    if (event.data?.type === CMH_CHAT_FLOW_CONTEXT && typeof event.data.flowId === 'string') {
      flowId.value = event.data.flowId
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
    render: () => (channel === 'canvas' && flowId.value
      ? h(ChatCanvasDrawer, { client, host, flowId: flowId.value, ownsDocument: true })
      : h(ChatMainView, { client, host, channel, flowId: flowId.value, ownsDocument: true })),
  }).mount('#app')
}
