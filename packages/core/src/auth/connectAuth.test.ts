import { afterEach, describe, expect, it } from 'vitest'
import type { LocaleCode, ThemeMode } from '../types/chat'
import { connectAuth } from './connectAuth'
import { electronBridgeAuth } from './electronBridgeAuth'
import { chatSession } from './session'
import type { AuthInit, AuthSource } from './types'

function makeSource() {
  const tokenCbs = new Set<(t: string) => void>()
  const localeCbs = new Set<(l: LocaleCode) => void>()
  const themeCbs = new Set<(t: ThemeMode) => void>()
  let resolveInit: (init: AuthInit) => void = () => {}
  const source: AuthSource = {
    resolve: () => new Promise<AuthInit>((r) => { resolveInit = r }),
    onTokenChanged: (cb) => { tokenCbs.add(cb); return () => { tokenCbs.delete(cb) } },
    onLocaleChanged: (cb) => { localeCbs.add(cb); return () => { localeCbs.delete(cb) } },
    onThemeChanged: (cb) => { themeCbs.add(cb); return () => { themeCbs.delete(cb) } },
    dispose() {},
  }
  return {
    source,
    tokenCbs,
    localeCbs,
    themeCbs,
    resolve: (init: AuthInit) => resolveInit(init),
  }
}

describe('connectAuth', () => {
  afterEach(() => {
    chatSession.isReady.value = false
    chatSession.token.value = ''
    chatSession.locale.value = 'ko-KR'
    chatSession.theme.value = 'dark'
    chatSession.mode.value = 'split'
    chatSession.channel.value = null
  })

  it('applies changes that arrive before resolve() finishes after the init values (latest wins)', async () => {
    const s = makeSource()
    const pending = connectAuth(s.source)
    // Subscribed before resolve() settles.
    expect(s.tokenCbs.size).toBe(1)
    s.tokenCbs.forEach(cb => cb('t-early-1'))
    s.tokenCbs.forEach(cb => cb('t-early-2'))
    s.localeCbs.forEach(cb => cb('de-DE'))
    s.themeCbs.forEach(cb => cb('light'))
    s.resolve({ token: 't-init', locale: 'en-GB', theme: 'dim', mode: 'page' })
    await pending

    expect(chatSession.token.value).toBe('t-early-2')
    expect(chatSession.locale.value).toBe('de-DE')
    expect(chatSession.theme.value).toBe('light')
    expect(chatSession.mode.value).toBe('page')
    expect(chatSession.isReady.value).toBe(true)
  })

  it('disconnect() unsubscribes everything; two connects leave no duplicate listeners', async () => {
    const s = makeSource()
    const first = connectAuth(s.source)
    s.resolve({ token: 'a' })
    const disconnectFirst = await first
    expect(s.tokenCbs.size).toBe(1)
    disconnectFirst()
    expect(s.tokenCbs.size).toBe(0)
    expect(s.localeCbs.size).toBe(0)
    expect(s.themeCbs.size).toBe(0)

    const second = connectAuth(s.source)
    s.resolve({ token: 'b' })
    const disconnectSecond = await second
    expect(s.tokenCbs.size).toBe(1)
    disconnectSecond()
    expect(s.tokenCbs.size).toBe(0)
  })

  it('writes only the session fields that are present in the init data', async () => {
    chatSession.locale.value = 'de-DE'
    chatSession.theme.value = 'light'
    chatSession.mode.value = 'solo'
    const s = makeSource()
    const pending = connectAuth(s.source)
    s.resolve({ token: 'only-token', channel: 'desktop' })
    await pending
    expect(chatSession.token.value).toBe('only-token')
    expect(chatSession.locale.value).toBe('de-DE')
    expect(chatSession.theme.value).toBe('light')
    expect(chatSession.mode.value).toBe('solo')
    expect(chatSession.channel.value).toBe('desktop')
  })

  it('electronBridgeAuth returns only token and channel', async () => {
    const win = window as unknown as { cmhChat?: unknown }
    win.cmhChat = { getAuth: async () => ({ token: 'desk' }) }
    const init = await electronBridgeAuth().resolve()
    delete win.cmhChat
    expect(init).toEqual({ token: 'desk', channel: 'desktop' })
  })
})
