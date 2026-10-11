import {
  CMH_CHAT_BACK_TO_SPLIT,
  CMH_CHAT_READY,
  CMH_CHAT_ROUTE_NAVIGATE,
  type ChatToHostMessage,
} from './messages'

export interface HostRoute {
  name: string
  params?: Record<string, unknown>
}

/** Payload of the desktop bridge `browserAct` call (seed App.ts: action 'search' / 'get-content'). */
export interface BrowserActPayload {
  action: string
  text?: string
  paneIndex?: number
  tabIndex?: number
  [key: string]: unknown
}

export interface BrowserActResult {
  ok?: boolean
  error?: string
  query?: string
  tabTitle?: string
  tabUrl?: string
  results?: Array<{ title: string; url: string; snippet?: string }>
  [key: string]: unknown
}

/** One split-view pane of the desktop app with its tabs (desktop bridge `getTabsContext`). */
export interface TabsContextPane {
  paneIndex: number
  paneId: string
  activeTabId?: string
  tabs: Array<{ tabId: string; kind: string; title: string; url: string; active: boolean }>
}

export interface TabsContextResult {
  ok?: boolean
  panes?: TabsContextPane[]
}

export interface LocalInferPayload {
  prompt: string
  modelId?: string
  maxTokens?: number
}

export interface LocalInferResult {
  ok?: boolean
  answer?: string
  error?: string
}

export interface LocalModelStatusResult {
  status?: { state: string; message: string }
}

/** How the chat talks to the page or app that embeds it. */
export interface HostBridge {
  navigate(route: HostRoute): void
  backToSplit(): void
  ready(): void
  isEmbedded: boolean
  browserAct?(payload: BrowserActPayload): Promise<BrowserActResult>
  getTabsContext?(): Promise<TabsContextResult>
  infer?(payload: LocalInferPayload): Promise<LocalInferResult>
  getModelStatus?(): Promise<LocalModelStatusResult>
}

/** The object the AiOAi desktop preload script exposes as `window.cmhChat`. */
export interface CmhChatBridge {
  getAuth?: () => Promise<{ token?: unknown } | null | undefined>
  getAppearance?: unknown
  browserAct?: (payload: BrowserActPayload) => Promise<BrowserActResult>
  getTabsContext?: () => Promise<TabsContextResult>
  infer?: (payload: LocalInferPayload) => Promise<LocalInferResult>
  getModelStatus?: () => Promise<LocalModelStatusResult>
}

export function getElectronBridge(): CmhChatBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = (window as unknown as { cmhChat?: CmhChatBridge }).cmhChat
  return bridge ?? null
}

/** Host is the parent window of an iframe; messages go out with window.postMessage. */
export function postMessageHost(options: { targetOrigin: string; target?: Window }): HostBridge {
  // A wildcard or opaque target origin would hand the messages to any page that sits in the parent window.
  if (!options.targetOrigin || options.targetOrigin === '*' || options.targetOrigin === 'null') {
    throw new Error(`postMessageHost: targetOrigin must be a concrete origin, got "${options.targetOrigin}"`)
  }
  const resolveTarget = (): Window | null => {
    if (options.target) return options.target
    if (typeof window !== 'undefined' && window.parent !== window) return window.parent
    return null
  }

  function post(message: ChatToHostMessage): void {
    const target = resolveTarget()
    if (!target) return
    try {
      target.postMessage(message, options.targetOrigin)
    } catch {
      // Ignored if cross-window access fails
    }
  }

  return {
    get isEmbedded() {
      return resolveTarget() !== null
    },
    navigate(route) {
      post({
        type: CMH_CHAT_ROUTE_NAVIGATE,
        route: { name: route.name, params: route.params ?? {} },
      })
    },
    backToSplit() {
      post({ type: CMH_CHAT_BACK_TO_SPLIT })
    },
    ready() {
      post({ type: CMH_CHAT_READY })
    },
  }
}

/** Host is the AiOAi desktop app; the preload bridge `window.cmhChat` is the channel. */
export function electronHost(): HostBridge {
  const bridge = getElectronBridge()
  const host: HostBridge = {
    isEmbedded: false,
    navigate() {},
    backToSplit() {},
    ready() {},
  }
  // Only the calls the preload script really exposes are set, so callers can feature-test them.
  if (bridge?.browserAct) host.browserAct = payload => bridge.browserAct!(payload)
  if (bridge?.getTabsContext) host.getTabsContext = () => bridge.getTabsContext!()
  if (bridge?.infer) host.infer = payload => bridge.infer!(payload)
  if (bridge?.getModelStatus) host.getModelStatus = () => bridge.getModelStatus!()
  return host
}

/** Standalone page without a host (playground, tests). */
export function noopHost(): HostBridge {
  return {
    isEmbedded: false,
    navigate() {},
    backToSplit() {},
    ready() {},
  }
}
