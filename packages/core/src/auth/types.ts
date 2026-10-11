import type { ChatChannel, ChatViewMode, LocaleCode, ThemeMode } from '../types/chat'

export interface AuthInit {
  token: string
  /** Optional: a source that does not own locale, theme or mode leaves them out and the session keeps its value. */
  locale?: LocaleCode
  theme?: ThemeMode
  mode?: ChatViewMode
  channel?: ChatChannel
}

/** Where the chat gets its token, locale and theme from. */
export interface AuthSource {
  /** Resolves once the first valid init data is available. */
  resolve(): Promise<AuthInit>
  onTokenChanged(callback: (token: string) => void): () => void
  onLocaleChanged?(callback: (locale: LocaleCode) => void): () => void
  onThemeChanged?(callback: (theme: ThemeMode) => void): () => void
  dispose(): void
}
