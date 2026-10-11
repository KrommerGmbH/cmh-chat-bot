import type { ChatChannel, ChatViewMode, LocaleCode, ThemeMode } from '../types/chat'
import {
  CMH_CHAT_INIT,
  CMH_LOCALE_CHANGED,
  CMH_THEME_CHANGED,
  CMH_TOKEN_CHANGED,
  TOKEN_REFRESHED,
} from '../host/messages'
import { normalizeLocale, normalizeTheme } from './session'
import type { AuthInit, AuthSource } from './types'

const VIEW_MODES: readonly string[] = ['solo', 'split', 'page']
const CHANNELS: readonly string[] = ['admin', 'desktop', 'canvas', 'mobile']

/** Auth data comes from the embedding page via window.postMessage. Only `allowedOrigins` are trusted. */
export function postMessageAuth(options: { allowedOrigins: string[]; target?: Window; expectedSource?: Window | null }): AuthSource {
  const allowedOrigins = options.allowedOrigins.map((value) => {
    if (value === 'null' || value === '*') {
      throw new Error(`postMessageAuth: "${value}" is not a valid allowed origin`)
    }
    try {
      const origin = new URL(value).origin
      // Opaque origins (data:, file: …) serialise to 'null'.
      if (origin === 'null') throw new Error('opaque origin')
      return origin
    } catch {
      throw new Error(`postMessageAuth: cannot parse allowed origin "${value}"`)
    }
  })
  if (allowedOrigins.length === 0) {
    throw new Error('postMessageAuth: allowedOrigins must contain at least one origin')
  }
  const target: Window | undefined = options.target ?? (typeof window !== 'undefined' ? window : undefined)

  const tokenListeners = new Set<(token: string) => void>()
  const localeListeners = new Set<(locale: LocaleCode) => void>()
  const themeListeners = new Set<(theme: ThemeMode) => void>()

  let isResolved = false
  let resolveInit: (init: AuthInit) => void = () => {}
  const initPromise = new Promise<AuthInit>((resolve) => {
    resolveInit = resolve
  })

  function emitToken(token: string) {
    for (const cb of tokenListeners) cb(token)
  }
  function emitLocale(locale: LocaleCode) {
    for (const cb of localeListeners) cb(locale)
  }
  function emitTheme(theme: ThemeMode) {
    for (const cb of themeListeners) cb(theme)
  }

  function handleMessage(event: MessageEvent) {
    // When a source window is expected (the embedding parent), messages from any other window are ignored.
    if (options.expectedSource && event.source !== options.expectedSource) {
      return
    }
    if (!allowedOrigins.includes(event.origin)) {
      return
    }

    const data = event.data
    if (!data || typeof data !== 'object') {
      return
    }

    switch (data.type) {
      case CMH_CHAT_INIT: {
        const init: AuthInit & Required<Pick<AuthInit, 'locale' | 'theme' | 'mode'>> = {
          token: typeof data.token === 'string' ? data.token : '',
          locale: normalizeLocale(typeof data.locale === 'string' ? data.locale : undefined),
          theme: normalizeTheme(typeof data.theme === 'string' ? data.theme : undefined),
          mode: VIEW_MODES.includes(data.mode) ? (data.mode as ChatViewMode) : 'split',
        }
        if (CHANNELS.includes(data.channel)) {
          init.channel = data.channel as ChatChannel
        }
        if (!isResolved) {
          isResolved = true
          resolveInit(init)
        } else {
          // A repeated init is handled like the matching change messages.
          if (typeof data.token === 'string') emitToken(init.token)
          if (typeof data.locale === 'string') emitLocale(init.locale)
          if (typeof data.theme === 'string') emitTheme(init.theme)
        }
        break
      }
      case TOKEN_REFRESHED:
      case CMH_TOKEN_CHANGED: {
        if (typeof data.token === 'string') {
          emitToken(data.token)
        }
        break
      }
      case CMH_LOCALE_CHANGED: {
        if (typeof data.locale === 'string') {
          emitLocale(normalizeLocale(data.locale))
        }
        break
      }
      case CMH_THEME_CHANGED: {
        if (typeof data.theme === 'string') {
          emitTheme(normalizeTheme(data.theme))
        }
        break
      }
    }
  }

  target?.addEventListener('message', handleMessage as EventListener)

  function subscribe<T>(set: Set<(value: T) => void>, callback: (value: T) => void): () => void {
    set.add(callback)
    return () => {
      set.delete(callback)
    }
  }

  return {
    resolve: () => initPromise,
    onTokenChanged: callback => subscribe(tokenListeners, callback),
    onLocaleChanged: callback => subscribe(localeListeners, callback),
    onThemeChanged: callback => subscribe(themeListeners, callback),
    dispose() {
      target?.removeEventListener('message', handleMessage as EventListener)
      tokenListeners.clear()
      localeListeners.clear()
      themeListeners.clear()
    },
  }
}
