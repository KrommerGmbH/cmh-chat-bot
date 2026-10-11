import type { FontScale, ThemeMode } from '@cmh/chat-core'

/**
 * The only code of this package that writes to `document.documentElement` / `document.body`.
 * Call it only when the view owns the document (`ownsDocument`, standalone iframe bundle).
 * Seed: services/appearance.ts `applyTheme` and composables/useUserConfig.ts `applyFontScale`.
 */
export function applyTheme(themeMode: ThemeMode | string): void {
  if (typeof document === 'undefined') return
  const resolved = themeMode === 'dark' || themeMode === 'dim' ? 'dark' : 'light'
  document.documentElement.dataset.theme = resolved
  document.body.classList.toggle('dark', resolved === 'dark')
}

const FONT_SIZES: Record<FontScale, string> = {
  S: '14px',
  M: '16px',
  L: '18px',
  XL: '20px',
}

/** Same default as the seed's `applyDefault`: palette `aurora` and base root font size 13px (13 * scale 1). */
export const DEFAULT_PALETTE = 'aurora'
export const BASE_ROOT_FONT_SIZE_PX = 13

/**
 * Default appearance of a view that owns the document, applied before a user font scale is known.
 * Seed: services/appearance.ts `apply` / `applyDefault`.
 */
export function applyDefaultAppearance(): void {
  if (typeof document === 'undefined') return
  const docEl = document.documentElement
  docEl.dataset.palette = docEl.dataset.palette || DEFAULT_PALETTE
  docEl.style.fontSize = `${BASE_ROOT_FONT_SIZE_PX}px`
}

export function applyFontScale(scale: FontScale): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = FONT_SIZES[scale] || '16px'
}
