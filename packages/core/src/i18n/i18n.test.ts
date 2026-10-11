import { describe, expect, it } from 'vitest'
import { chatSession } from '../auth/session'
import deDE from './de-DE.json'
import enGB from './en-GB.json'
import koKR from './ko-KR.json'
import { t } from './index'

describe('i18n', () => {
  it('has identical key sets in all three locales', () => {
    const ko = Object.keys(koKR).sort()
    expect(Object.keys(deDE).sort()).toEqual(ko)
    expect(Object.keys(enGB).sort()).toEqual(ko)
    expect(ko.length).toBe(147)
  })

  it('t() follows chatSession.locale and replaces {params}', () => {
    chatSession.locale.value = 'en-GB'
    expect(t('removeFile', { name: 'a.png' })).toBe('Remove a.png')
    chatSession.locale.value = 'ko-KR'
    expect(t('retry')).toBe('다시 시도')
  })
})
