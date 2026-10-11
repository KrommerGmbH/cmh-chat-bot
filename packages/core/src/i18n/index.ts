import type { LocaleCode } from '../types/chat'
import { chatSession } from '../auth/session'
import deDE from './de-DE.json'
import enGB from './en-GB.json'
import koKR from './ko-KR.json'

export const dictionaries = {
  'ko-KR': koKR,
  'de-DE': deDE,
  'en-GB': enGB,
}

export type TranslationKey = keyof typeof koKR

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const currentLocale = chatSession.locale.value as LocaleCode
  const dict = dictionaries[currentLocale] || dictionaries['ko-KR']
  let text = (dict as Record<string, string>)[key] || dictionaries['ko-KR'][key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), () => String(v))
    }
  }
  return text
}

export function useI18n() {
  return { t, locale: chatSession.locale }
}
