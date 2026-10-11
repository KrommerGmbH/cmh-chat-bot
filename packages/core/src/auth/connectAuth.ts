import type { LocaleCode, ThemeMode } from '../types/chat'
import { chatSession, setSessionLocale, setSessionToken } from './session'
import type { AuthSource } from './types'

/**
 * Waits for the source's init data, writes it to `chatSession`, follows later changes, then sets `isReady`.
 * Change callbacks are subscribed BEFORE `resolve()` is awaited; values that arrive meanwhile are buffered
 * and applied after the init values (the latest value wins). Returns a function that unsubscribes everything.
 */
export async function connectAuth(source: AuthSource): Promise<() => void> {
  let isInitApplied = false
  let pendingToken: string | undefined
  let pendingLocale: LocaleCode | undefined
  let pendingTheme: ThemeMode | undefined

  const unsubscribers: Array<() => void> = []
  unsubscribers.push(
    source.onTokenChanged((token) => {
      if (isInitApplied) setSessionToken(token)
      else pendingToken = token
    }),
  )
  if (source.onLocaleChanged) {
    unsubscribers.push(
      source.onLocaleChanged((locale) => {
        if (isInitApplied) setSessionLocale(locale)
        else pendingLocale = locale
      }),
    )
  }
  if (source.onThemeChanged) {
    unsubscribers.push(
      source.onThemeChanged((theme) => {
        if (isInitApplied) chatSession.theme.value = theme
        else pendingTheme = theme
      }),
    )
  }

  const disconnect = () => {
    for (const off of unsubscribers) off()
    unsubscribers.length = 0
  }

  let init
  try {
    init = await source.resolve()
  } catch (err) {
    disconnect()
    throw err
  }

  chatSession.token.value = init.token
  if (init.locale !== undefined) chatSession.locale.value = init.locale
  if (init.theme !== undefined) chatSession.theme.value = init.theme
  if (init.mode !== undefined) chatSession.mode.value = init.mode
  if (init.channel) {
    chatSession.channel.value = init.channel
  }

  // Changes that arrived while resolve() was pending are newer than the init values.
  isInitApplied = true
  if (pendingToken !== undefined) setSessionToken(pendingToken)
  if (pendingLocale !== undefined) setSessionLocale(pendingLocale)
  if (pendingTheme !== undefined) chatSession.theme.value = pendingTheme

  chatSession.isReady.value = true
  return disconnect
}
