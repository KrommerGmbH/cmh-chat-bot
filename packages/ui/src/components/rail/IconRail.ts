import type { ThemeMode } from '@cmh/chat-core'
import { chatSession, setSessionTheme, useI18n } from '@cmh/chat-core'
import { computed } from 'vue'

export interface IconRailProps {
  activeTab?: string
}

export type IconRailEmit = {
  (e: 'toggle-sidebar'): void
  (e: 'toggle-pins'): void
}

export function useIconRail(props: IconRailProps, emit: IconRailEmit) {
  void props
  void emit
  const { t } = useI18n()

  const currentThemeLabel = computed(() => {
    if (chatSession.theme.value === 'light') return t('themeLight')
    if (chatSession.theme.value === 'dim') return t('themeDim')
    return t('themeDark')
  })

  function cycleTheme() {
    const current = chatSession.theme.value
    let next: ThemeMode = 'dark'
    if (current === 'dark') next = 'dim'
    else if (current === 'dim') next = 'light'
    else next = 'dark'
    setSessionTheme(next)
  }

  return {
    t,
    currentThemeLabel,
    cycleTheme,
    chatSession,
  }
}
