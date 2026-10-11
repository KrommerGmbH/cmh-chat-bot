import { ref } from 'vue'
import type { ChatChannel, ChatViewMode, LocaleCode, ThemeMode } from '../types/chat'
import { getElectronBridge } from '../host/bridge'

/** Module-level singleton: the one chat session of this page. */
export const chatSession = {
  token: ref<string>(''),
  locale: ref<LocaleCode>('ko-KR'),
  theme: ref<ThemeMode>('dark'),
  mode: ref<ChatViewMode>('split'),
  channel: ref<ChatChannel | null>(null),
  isReady: ref<boolean>(false),
}

export function normalizeLocale(rawLocale?: string): LocaleCode {
  if (!rawLocale) return 'ko-KR'
  if (rawLocale.startsWith('de')) return 'de-DE'
  if (rawLocale.startsWith('en')) return 'en-GB'
  return 'ko-KR'
}

export function normalizeTheme(rawTheme?: string): ThemeMode {
  if (rawTheme === 'light' || rawTheme === 'dim' || rawTheme === 'dark') {
    return rawTheme
  }
  return 'dark'
}

export function setSessionToken(newToken: string): void {
  chatSession.token.value = newToken
}

export function setSessionLocale(newLocale: LocaleCode): void {
  chatSession.locale.value = newLocale
}

/** The desktop app owns the appearance (bridge has getAppearance): ignore unless `force`. */
export function setSessionTheme(newTheme: ThemeMode, force = false): void {
  if (!force && getElectronBridge()?.getAppearance) {
    return
  }
  chatSession.theme.value = newTheme
}

export function setSessionMode(newMode: ChatViewMode): void {
  chatSession.mode.value = newMode
}
