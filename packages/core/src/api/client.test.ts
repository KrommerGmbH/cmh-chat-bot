import { describe, expect, it, vi } from 'vitest'
import { createChatClient, generateUuid, parseIsoDate } from './client'

const BASE = 'https://shop.example'

function setup(responseBody: unknown = {}, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(status === 204 ? null : JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  const onError = vi.fn()
  const client = createChatClient({
    baseUrl: BASE,
    getToken: () => 'tok',
    fetch: fetchMock as unknown as typeof fetch,
    onError,
  })
  return { client, calls, onError }
}

function expectCall(
  call: { url: string; init: RequestInit },
  method: string,
  url: string,
) {
  expect(call.init.method).toBe(method)
  expect(call.url).toBe(`${BASE}${url}`)
  expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
}

describe('createChatClient routes', () => {
  it('fetchBootstrap', async () => {
    const { client, calls } = setup({ userId: 'u' })
    const result = await client.fetchBootstrap()
    expectCall(calls[0]!, 'GET', '/api/_action/cmh-ai/chat/bootstrap')
    expect(result).toEqual({ userId: 'u', locale: 'ko-KR', harnesses: [], hubOnlyHarnesses: [], models: [] })
  })

  it('fetchConversations', async () => {
    const { client, calls } = setup({ data: [{ id: 'c1', agentId: 'a' }] })
    const result = await client.fetchConversations('a')
    expectCall(calls[0]!, 'POST', '/api/search/cmh-ai-conversation')
    expect(JSON.parse(calls[0]!.init.body as string).filter).toEqual([{ type: 'equals', field: 'agentId', value: 'a' }])
    expect(result[0]).toMatchObject({ id: 'c1', title: 'Untitled', counterpartType: 'internal' })
  })

  it('createConversation', async () => {
    const { client, calls } = setup({}, 204)
    const result = await client.createConversation({ agentId: 'a' })
    expectCall(calls[0]!, 'POST', '/api/cmh-ai-conversation')
    expect(result.id).toMatch(/^[0-9a-f]{32}$/)
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ agentId: 'a', counterpartType: 'internal' })
  })

  it('uploadChatFile (no Content-Type header, FormData body)', async () => {
    const { client, calls } = setup({ success: true, file: { mediaId: 'm' } })
    const result = await client.uploadChatFile(new File(['x'], 'x.txt'))
    expectCall(calls[0]!, 'POST', '/api/_action/cmh-ai/chat/upload')
    expect((calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(calls[0]!.init.body).toBeInstanceOf(FormData)
    expect(result).toEqual({ mediaId: 'm' })
  })

  it('fetchChatFileBlob (relative gets baseUrl and the token)', async () => {
    const { client, calls } = setup({})
    await client.fetchChatFileBlob('/files/1')
    expectCall(calls[0]!, 'GET', '/files/1')
  })

  it('fetchChatFileBlob keeps Authorization for an absolute URL on the base origin', async () => {
    const { client, calls } = setup({})
    await client.fetchChatFileBlob(`${BASE}/files/2`)
    expect(calls[0]!.url).toBe(`${BASE}/files/2`)
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('fetchChatFileBlob sends no Authorization to a foreign absolute URL', async () => {
    const { client, calls } = setup({})
    await client.fetchChatFileBlob('https://cdn.example/f')
    expect(calls[0]!.url).toBe('https://cdn.example/f')
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('fetchAudioBlobUrl sends no Authorization to a foreign absolute URL, keeps it for the base origin', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }))
    URL.createObjectURL = createObjectURL
    const { client, calls } = setup({})
    await client.fetchAudioBlobUrl('https://cdn.example/a.mp3')
    await client.fetchAudioBlobUrl(`${BASE}/a.mp3`)
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect((calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    vi.unstubAllGlobals()
  })

  it('without a known page origin a scheme-relative URL gets no Authorization, a plain relative path keeps it', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response('{}', { status: 200 })
    })
    const client = createChatClient({ baseUrl: '', getToken: () => 'tok', fetch: fetchMock as unknown as typeof fetch })

    for (const origin of [undefined, { origin: 'null' }]) {
      vi.stubGlobal('location', origin)
      await client.fetchChatFileBlob('//evil.example/x')
      await client.fetchChatFileBlob(String.raw`/\evil.example/x`)
      await client.fetchChatFileBlob(String.raw`\\evil.example/x`)
      await client.fetchChatFileBlob('/api/file/1')
    }
    vi.unstubAllGlobals()

    const auth = (i: number) => (calls[i]!.init.headers as Record<string, string>).Authorization
    expect(calls).toHaveLength(8)
    for (const offset of [0, 4]) {
      expect(auth(offset)).toBeUndefined()
      expect(auth(offset + 1)).toBeUndefined()
      expect(auth(offset + 2)).toBeUndefined()
      expect(auth(offset + 3)).toBe('Bearer tok')
    }
  })

  it('with a relative baseUrl an absolute URL is compared with the page origin; unknown page origin means foreign', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response('{}', { status: 200 })
    })
    const client = createChatClient({ baseUrl: '', getToken: () => 'tok', fetch: fetchMock as unknown as typeof fetch })

    vi.stubGlobal('location', { origin: 'https://page.example' })
    await client.fetchChatFileBlob('https://page.example/f')
    await client.fetchChatFileBlob('https://other.example/f')
    vi.stubGlobal('location', undefined)
    await client.fetchChatFileBlob('https://page.example/f')
    vi.unstubAllGlobals()

    const auth = (i: number) => (calls[i]!.init.headers as Record<string, string>).Authorization
    expect(auth(0)).toBe('Bearer tok')
    expect(auth(1)).toBeUndefined()
    expect(auth(2)).toBeUndefined()
  })

  it('sendChatMessage', async () => {
    const { client, calls } = setup({ ok: true })
    await client.sendChatMessage('c1', 'hi', 'm1', [{ mediaId: 'x' }])
    expectCall(calls[0]!, 'POST', '/api/_action/cmh-ai/conversation/c1/message')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ content: 'hi', modelId: 'm1', attachments: [{ mediaId: 'x' }] })
  })

  it('pollConversationEvents', async () => {
    const { client, calls } = setup({ success: true })
    await client.pollConversationEvents('c1', 4, 2, 'run-9')
    expectCall(
      calls[0]!,
      'GET',
      '/api/_action/cmh-ai/conversation/c1/events?after=4&afterEvent=4&afterMessage=2&afterEventRun=run-9',
    )
  })

  it('pollConversationEvents passes the abort signal to fetch', async () => {
    const { client, calls } = setup({ success: true })
    const controller = new AbortController()
    await client.pollConversationEvents('c1', 0, 0, null, controller.signal)
    expect(calls[0]!.init.signal).toBe(controller.signal)
  })

  it('stopConversationRun', async () => {
    const { client, calls } = setup({})
    await client.stopConversationRun('c1')
    expectCall(calls[0]!, 'POST', '/api/_action/cmh-ai/conversation/c1/stop')
    expect(calls[0]!.init.body).toBe('{}')
  })

  it('decideApproval (string form and object form)', async () => {
    const { client, calls } = setup({})
    await client.decideApproval('ap1', 'approve', 'n')
    await client.decideApproval('ap1', { chosen: 'reject' })
    expectCall(calls[0]!, 'POST', '/api/_action/cmh-ai/approval/ap1/decide')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ chosen: 'approve', note: 'n' })
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ chosen: 'reject', note: '' })
  })

  it('decideApproval throws an error with status and code on failure', async () => {
    const { client } = setup({ message: 'nope', code: 'X' }, 409)
    await expect(client.decideApproval('ap1', 'a')).rejects.toMatchObject({ message: 'nope', status: 409, code: 'X' })
  })

  it('decideApproval uses the Shopware errors[0].detail as message', async () => {
    const { client } = setup({ errors: [{ status: '403', detail: 'Not allowed here' }] }, 403)
    await expect(client.decideApproval('ap1', 'a')).rejects.toMatchObject({ message: 'Not allowed here', status: 403 })
  })

  it('decideApproval falls back to the status text when the body has no message', async () => {
    const { client } = setup({}, 500)
    await expect(client.decideApproval('ap1', 'a')).rejects.toMatchObject({ message: 'Failed to decide approval: 500' })
  })

  it('sendTalkMessage uses the Shopware errors[0].detail as message and keeps the status', async () => {
    const { client } = setup({ errors: [{ detail: 'Already sent' }] }, 409)
    await expect(client.sendTalkMessage({ threadId: 't', text: 'x', approvalId: 'a' })).rejects.toMatchObject({ message: 'Already sent', status: 409 })
  })

  it('sendTalkMessage', async () => {
    const { client, calls } = setup({})
    await client.sendTalkMessage({ threadId: 't', text: 'x', approvalId: 'a' })
    expectCall(calls[0]!, 'POST', '/api/_action/cmh-ai/talk/send')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ threadId: 't', text: 'x', approvalId: 'a' })
  })

  it('loadUserConfig throws on a non-OK response and on a network error, returns {} for an empty config', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failed = setup({}, 500)
    await expect(failed.client.loadUserConfig()).rejects.toThrow('500')
    const client = createChatClient({
      baseUrl: BASE,
      getToken: () => 'tok',
      fetch: (async () => { throw new Error('offline') }) as unknown as typeof fetch,
    })
    await expect(client.loadUserConfig()).rejects.toThrow('offline')
    spy.mockRestore()
    const empty = setup({ data: {} })
    await expect(empty.client.loadUserConfig()).resolves.toEqual({})
  })

  it('loadUserConfig', async () => {
    const { client, calls } = setup({ data: { 'cmh-ai-chat': { fontScale: 'L', ttsEngine: 'bogus', autoRead: true } } })
    const result = await client.loadUserConfig()
    expectCall(calls[0]!, 'GET', '/api/_info/config-me?keys[]=cmh-ai-chat')
    expect(result).toMatchObject({ fontScale: 'L', ttsEngine: undefined, autoRead: true, pins: [], modelByHarness: {} })
  })

  it('saveUserConfig, and onError instead of toast on failure', async () => {
    const ok = setup({})
    await ok.client.saveUserConfig({ theme: 'dim' })
    expectCall(ok.calls[0]!, 'POST', '/api/_info/config-me')
    expect(JSON.parse(ok.calls[0]!.init.body as string)).toEqual({ 'cmh-ai-chat': { theme: 'dim' } })
    expect(ok.onError).not.toHaveBeenCalled()

    const bad = setup({}, 500)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await bad.client.saveUserConfig({})
    expect(bad.onError).toHaveBeenCalledWith('Failed to save settings', expect.any(Error))
    spy.mockRestore()
  })

  it.each([
    ['fetchDalProduct', '/api/search/product'],
    ['fetchDalOrder', '/api/search/order'],
    ['fetchDalCustomer', '/api/search/customer'],
    ['fetchDalApproval', '/api/search/cmh-ai-approval'],
  ] as const)('%s', async (method, route) => {
    const { client, calls } = setup({ data: [{ id: 'e1' }] })
    const result = await client[method]('e1')
    expectCall(calls[0]!, 'POST', route)
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ ids: ['e1'], limit: 1 })
    expect(result).toEqual({ id: 'e1' })
  })

  it('fetchTtsVoices', async () => {
    const { client, calls } = setup({ speakers: [{ id: 'A' }, 'B'], styles: ['s'] })
    const result = await client.fetchTtsVoices()
    expectCall(calls[0]!, 'GET', '/api/_action/cmh-ai/tts/voices')
    expect(result.speakers).toEqual(['A', 'B'])
    expect(result.styles).toEqual(['s'])
    expect(result.defaultSpeakers).toEqual({ ko: 'Sohee', en: 'Ryan', de: 'Ryan' })
  })

  it('requestTtsSynthesis', async () => {
    const { client, calls } = setup({ success: true })
    await client.requestTtsSynthesis('m1', 'Sohee', null, 'ko-KR')
    expectCall(calls[0]!, 'POST', '/api/_action/cmh-ai/tts/message/m1')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ speaker: 'Sohee', locale: 'ko-KR' })
  })

  it('getTtsManifest', async () => {
    const { client, calls } = setup({ success: true })
    await client.getTtsManifest('m1', 'Sohee', 'calm')
    expectCall(calls[0]!, 'GET', '/api/_action/cmh-ai/tts/message/m1?speaker=Sohee&style=calm')
  })

  it('fetchAudioBlobUrl', async () => {
    const { client, calls } = setup({})
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }))
    const result = await client.fetchAudioBlobUrl('/audio/1')
    expectCall(calls[0]!, 'GET', '/audio/1')
    expect(result).toBe('blob:x')
    vi.unstubAllGlobals()
  })

  it('sends no Authorization to look-alike foreign URLs (case, protocol-relative, leading space, subdomain)', async () => {
    vi.stubGlobal('location', { origin: 'https://page.example' })
    const calls: Array<{ url: string; init: RequestInit }> = []
    const client = createChatClient({
      baseUrl: '',
      getToken: () => 'tok',
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} })
        return new Response('{}')
      }) as unknown as typeof fetch,
    })
    const inputs = ['HTTP://evil.com/x', '//evil.com/x', ' https://evil.com/x', 'https://evil.com/x', 'http://api.example.evil.com/x']
    for (const input of inputs) await client.fetchChatFileBlob(input)
    await client.fetchChatFileBlob('https://page.example/ok')
    await client.fetchChatFileBlob('/rel')
    vi.unstubAllGlobals()
    const auth = (i: number) => (calls[i]!.init.headers as Record<string, string>).Authorization
    for (let i = 0; i < inputs.length; i++) expect(auth(i)).toBeUndefined()
    expect(calls[0]!.url).toBe('http://evil.com/x')
    expect(calls[1]!.url).toBe('https://evil.com/x')
    expect(calls[2]!.url).toBe('https://evil.com/x')
    expect(auth(5)).toBe('Bearer tok')
    expect(auth(6)).toBe('Bearer tok')
    expect(calls[6]!.url).toBe('/rel')
  })

  it('applies the origin rule to every request and keeps baseUrl + path for a base with a path prefix', async () => {
    const prefixed: Array<{ url: string; init: RequestInit }> = []
    const prefixedClient = createChatClient({
      baseUrl: 'https://shop.example/sub',
      getToken: () => 'tok',
      fetch: (async (url: string, init?: RequestInit) => {
        prefixed.push({ url: String(url), init: init ?? {} })
        return new Response('{}')
      }) as unknown as typeof fetch,
    })
    await prefixedClient.fetchBootstrap()
    expect(prefixed[0]!.url).toBe('https://shop.example/sub/api/_action/cmh-ai/chat/bootstrap')
    expect((prefixed[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    await prefixedClient.fetchChatFileBlob('https://evil.com/f')
    expect((prefixed[1]!.init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('a function baseUrl is read on every request and the origin rule follows the current value', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = []
    let base = ''
    const dynamic = createChatClient({
      baseUrl: () => base,
      getToken: () => 'tok',
      fetch: (async (url: string, init?: RequestInit) => {
        seen.push({ url: String(url), init: init ?? {} })
        return new Response('{}')
      }) as unknown as typeof fetch,
    })
    base = 'https://shop.example'
    await dynamic.fetchBootstrap()
    expect(seen[0]!.url).toBe('https://shop.example/api/_action/cmh-ai/chat/bootstrap')
    expect((seen[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    await dynamic.fetchChatFileBlob('https://evil.com/f')
    expect((seen[1]!.init.headers as Record<string, string>).Authorization).toBeUndefined()
    base = 'https://other.example/sub'
    await dynamic.fetchBootstrap()
    expect(seen[2]!.url).toBe('https://other.example/sub/api/_action/cmh-ai/chat/bootstrap')
    await dynamic.fetchChatFileBlob('https://shop.example/f')
    expect((seen[3]!.init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('sendChatMessage and uploadChatFile prefer errors[0].detail, then message, then the fallback', async () => {
    const detail = setup({ errors: [{ detail: 'Detail text' }], message: 'msg' }, 422)
    await expect(detail.client.sendChatMessage('c1', 'x')).rejects.toThrow('Detail text')
    await expect(detail.client.uploadChatFile(new File(['x'], 'x.txt'))).rejects.toThrow('Detail text')
    const msg = setup({ message: 'only message' }, 400)
    await expect(msg.client.sendChatMessage('c1', 'x')).rejects.toThrow('only message')
    const none = setup({}, 500)
    await expect(none.client.sendChatMessage('c1', 'x')).rejects.toThrow('Failed to send message: 500')
    await expect(none.client.uploadChatFile(new File(['x'], 'x.txt'))).rejects.toThrow('Failed to upload file: 500')
  })

  it('sends no Authorization header when the token is empty', async () => {
    const calls: Array<RequestInit | undefined> = []
    const client = createChatClient({
      baseUrl: '',
      getToken: () => '',
      fetch: (async (_u: unknown, init?: RequestInit) => {
        calls.push(init)
        return new Response('{}')
      }) as unknown as typeof fetch,
    })
    await client.fetchBootstrap()
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})

describe('pure helpers', () => {
  it('generateUuid returns 32 hex chars', () => {
    expect(generateUuid()).toMatch(/^[0-9a-f]{32}$/)
  })
  it('parseIsoDate treats a bare datetime as UTC and bad input as 0', () => {
    expect(parseIsoDate('2026-01-01 00:00:00')).toBe(Date.UTC(2026, 0, 1))
    expect(parseIsoDate('garbage')).toBe(0)
    expect(parseIsoDate(null)).toBe(0)
  })
})
