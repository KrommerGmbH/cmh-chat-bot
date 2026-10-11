import { afterEach, describe, expect, it } from 'vitest'
import { applyDefaultAppearance, applyFontScale, applyTheme } from './appearance'

afterEach(() => {
  delete document.documentElement.dataset.palette
  delete document.documentElement.dataset.theme
  document.documentElement.style.fontSize = ''
})

// These helpers are only called by the view when `ownsDocument` is true (useChatMain.ts and
// useUserConfig.ts guard every call), so a host that owns the document never gets them.
describe('appearance helpers', () => {
  it('applyDefaultAppearance sets palette aurora and the 13px base size', () => {
    applyDefaultAppearance()
    expect(document.documentElement.dataset.palette).toBe('aurora')
    expect(document.documentElement.style.fontSize).toBe('13px')
  })

  it('keeps a palette that is already set', () => {
    document.documentElement.dataset.palette = 'ocean'
    applyDefaultAppearance()
    expect(document.documentElement.dataset.palette).toBe('ocean')
  })

  it('keeps the seed S/M/L/XL table', () => {
    const sizes = { S: '14px', M: '16px', L: '18px', XL: '20px' } as const
    for (const [scale, px] of Object.entries(sizes)) {
      applyFontScale(scale as keyof typeof sizes)
      expect(document.documentElement.style.fontSize).toBe(px)
    }
  })

  it('applyTheme maps dim to dark', () => {
    applyTheme('dim')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
