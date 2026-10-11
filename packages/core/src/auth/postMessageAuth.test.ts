import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectAuth } from './connectAuth'
import { postMessageAuth } from './postMessageAuth'
import { chatSession } from './session'

const ALLOWED = 'https://host.example'

function send(data: unknown, origin: string) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }))
}

describe('postMessageAuth', () => {
  afterEach(() => {
    chatSession.isReady.value = false
  })

  it('resolves on CMH_CHAT_INIT from an allowed origin', async () => {
    const auth = postMessageAuth({ allowedOrigins: [ALLOWED] })
    send({ type: 'CMH_CHAT_INIT', token: 'abc', locale: 'de', theme: 'light', mode: 'solo', channel: 'canvas' }, ALLOWED)
    await expect(auth.resolve()).resolves.toEqual({
      token: 'abc',
      locale: 'de-DE',
      theme: 'light',
      mode: 'solo',
      channel: 'canvas',
    })
    auth.dispose()
  })

  it('ignores messages from a foreign origin', async () => {
    const auth = postMessageAuth({ allowedOrigins: [ALLOWED] })
    const onToken = vi.fn()
    auth.onTokenChanged(onToken)
    let resolved = false
    void auth.resolve().then(() => {
      resolved = true
    })

    send({ type: 'CMH_CHAT_INIT', token: 'evil' }, 'https://evil.example')
    send({ type: 'CMH_TOKEN_CHANGED', token: 'evil' }, 'https://evil.example')
    await Promise.resolve()

    expect(resolved).toBe(false)
    expect(onToken).not.toHaveBeenCalled()
    auth.dispose()
  })

  it('fires the token callback for TOKEN_REFRESHED and CMH_TOKEN_CHANGED, and stops after unsubscribe', () => {
    const auth = postMessageAuth({ allowedOrigins: [ALLOWED] })
    const onToken = vi.fn()
    const off = auth.onTokenChanged(onToken)

    send({ type: 'TOKEN_REFRESHED', token: 't1' }, ALLOWED)
    send({ type: 'CMH_TOKEN_CHANGED', token: 't2' }, ALLOWED)
    expect(onToken.mock.calls).toEqual([['t1'], ['t2']])

    off()
    send({ type: 'CMH_TOKEN_CHANGED', token: 't3' }, ALLOWED)
    expect(onToken).toHaveBeenCalledTimes(2)
    auth.dispose()
  })

  it('connectAuth writes chatSession and follows locale and theme changes', async () => {
    const auth = postMessageAuth({ allowedOrigins: [ALLOWED] })
    send({ type: 'CMH_CHAT_INIT', token: 'abc', locale: 'en', theme: 'dim', mode: 'page' }, ALLOWED)
    await connectAuth(auth)

    expect(chatSession.token.value).toBe('abc')
    expect(chatSession.locale.value).toBe('en-GB')
    expect(chatSession.theme.value).toBe('dim')
    expect(chatSession.mode.value).toBe('page')
    expect(chatSession.isReady.value).toBe(true)

    send({ type: 'CMH_LOCALE_CHANGED', locale: 'ko' }, ALLOWED)
    send({ type: 'CMH_THEME_CHANGED', theme: 'light' }, ALLOWED)
    send({ type: 'CMH_TOKEN_CHANGED', token: 'next' }, ALLOWED)
    expect(chatSession.locale.value).toBe('ko-KR')
    expect(chatSession.theme.value).toBe('light')
    expect(chatSession.token.value).toBe('next')
    auth.dispose()
  })

  it('normalises allowed origins (trailing slash) so they still match', async () => {
    const auth = postMessageAuth({ allowedOrigins: [`${ALLOWED}/`] })
    send({ type: 'CMH_CHAT_INIT', token: 'abc' }, ALLOWED)
    await expect(auth.resolve()).resolves.toMatchObject({ token: 'abc' })
    auth.dispose()
  })

  it.each([['null'], ['*'], ['not a url'], ['']])('throws at creation for the allowed origin %j', (value) => {
    expect(() => postMessageAuth({ allowedOrigins: [value] })).toThrow(/postMessageAuth/)
  })

  it('throws at creation for an empty allowedOrigins list', () => {
    expect(() => postMessageAuth({ allowedOrigins: [] })).toThrow(/at least one/)
  })

  describe('expectedSource', () => {
    function sendFrom(data: unknown, source: MessageEventSource | null) {
      window.dispatchEvent(new MessageEvent('message', { data, origin: ALLOWED, source }))
    }

    it('ignores messages whose source is not the expected window', async () => {
      const parent = {} as Window
      const other = {} as Window
      const auth = postMessageAuth({ allowedOrigins: [ALLOWED], expectedSource: parent })
      const onToken = vi.fn()
      auth.onTokenChanged(onToken)
      sendFrom({ type: 'CMH_TOKEN_CHANGED', token: 'evil' }, other)
      sendFrom({ type: 'CMH_TOKEN_CHANGED', token: 'null-source' }, null)
      expect(onToken).not.toHaveBeenCalled()
      sendFrom({ type: 'CMH_TOKEN_CHANGED', token: 'ok' }, parent as unknown as MessageEventSource)
      expect(onToken.mock.calls).toEqual([['ok']])
      auth.dispose()
    })

    it('accepts any source when expectedSource is not given', () => {
      const auth = postMessageAuth({ allowedOrigins: [ALLOWED] })
      const onToken = vi.fn()
      auth.onTokenChanged(onToken)
      sendFrom({ type: 'CMH_TOKEN_CHANGED', token: 'any' }, null)
      expect(onToken).toHaveBeenCalledWith('any')
      auth.dispose()
    })
  })
})
