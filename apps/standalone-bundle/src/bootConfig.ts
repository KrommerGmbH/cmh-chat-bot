import type { ChatChannel } from '@cmh/chat-core'

/** Channels the bundle accepts from the `mode` URL parameter. */
export const BOOT_CHANNELS: readonly ChatChannel[] = ['admin', 'canvas', 'mobile']

/** Normalised origin of a URL string, or null when it cannot be parsed or is opaque ('null'). */
export function usableOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const origin = new URL(value).origin
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

/** `mode` URL parameter -> channel. Unknown or missing values give 'admin'. */
export function parseChannel(search: string): ChatChannel {
  const requested = new URLSearchParams(search).get('mode') as ChatChannel | null
  return requested && BOOT_CHANNELS.includes(requested) ? requested : 'admin'
}

/** Build-time list VITE_ALLOWED_PARENT_ORIGINS -> normalised usable origins (invalid and opaque entries dropped). */
export function parseAllowedParents(allowedParentsEnv: string): string[] {
  return allowedParentsEnv
    .split(',')
    .map(entry => usableOrigin(entry.trim()))
    .filter((origin): origin is string => origin !== null)
}

/** The `parent` URL parameter counts only when its origin is in the build-time list; otherwise null. */
export function resolveTrustedParent(search: string, allowedParentsEnv: string): string | null {
  const requested = usableOrigin(new URLSearchParams(search).get('parent'))
  return requested && parseAllowedParents(allowedParentsEnv).includes(requested) ? requested : null
}

export interface BootConfig {
  channel: ChatChannel
  /** Listed parent origin requested through the URL, or null. */
  trustedParent: string | null
  /** Origin used as postMessage target. Empty string when no usable origin exists. */
  hostOrigin: string
  /** Origins whose messages are accepted. Never contains 'null'. */
  allowedOrigins: string[]
  /** False when the page has an opaque origin and no listed parent: embedded auth cannot work. */
  hasUsableOrigin: boolean
}

/** Pure boot decisions of main.ts. `pageOrigin` is `window.location.origin` (may be the string 'null'). */
export function buildBootConfig(search: string, pageOrigin: string, allowedParentsEnv: string): BootConfig {
  const trustedParent = resolveTrustedParent(search, allowedParentsEnv)
  const ownOrigin = usableOrigin(pageOrigin)
  const allowedOrigins = [...new Set([...(ownOrigin ? [ownOrigin] : []), ...(trustedParent ? [trustedParent] : [])])]
  return {
    channel: parseChannel(search),
    trustedParent,
    hostOrigin: trustedParent ?? ownOrigin ?? '',
    allowedOrigins,
    hasUsableOrigin: allowedOrigins.length > 0,
  }
}

/**
 * Validate the `apiBaseUrl` of CMH_CHAT_INIT: an absolute http(s) URL without credentials.
 * Query and hash are dropped and a trailing slash is removed (the client builds `base + path`). Anything else gives null.
 */
export function parseApiBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  url.search = ''
  url.hash = ''
  return url.href.replace(/\/+$/, '')
}

/**
 * Base URL of the API client: VITE_API_BASE if set, else (mobile channel only) the `apiBaseUrl` of a trusted
 * CMH_CHAT_INIT, else '' (same origin). For admin and canvas the message value is ignored.
 */
export function resolveApiBase(channel: ChatChannel, envBase: string, initApiBaseUrl: unknown): string {
  if (envBase) return envBase
  if (channel !== 'mobile') return ''
  return parseApiBaseUrl(initApiBaseUrl) ?? ''
}

/** Longest text a CMH_CHAT_SEND message may carry. */
export const MAX_SEND_TEXT_LENGTH = 2000

/** CMH_CHAT_SEND guard: a string with visible content and at most MAX_SEND_TEXT_LENGTH characters. */
export function isAcceptableSendText(text: unknown): text is string {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_SEND_TEXT_LENGTH
}
