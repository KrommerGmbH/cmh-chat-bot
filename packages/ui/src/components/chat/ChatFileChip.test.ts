import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, reactive } from 'vue'
import { CHAT_CONTEXT_KEY } from '@cmh/chat-core'
import { shouldOpenInline, useChatFileChip } from './ChatFileChip'

describe('shouldOpenInline', () => {
  it('allows only the safe types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']) {
      expect(shouldOpenInline(type)).toBe(true)
    }
  })

  it('ignores case and parameters', () => {
    expect(shouldOpenInline('Text/Plain; charset=utf-8')).toBe(true)
  })

  it('never opens html, svg, empty or unknown types inline', () => {
    for (const type of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'application/octet-stream', '']) {
      expect(shouldOpenInline(type)).toBe(false)
    }
  })
})

describe('useChatFileChip late results', () => {
  function mountChip(fetchChatFileBlob: (url: string) => Promise<Blob>, url: string) {
    const file = reactive({ url })
    const el = document.createElement('div')
    const Probe = defineComponent({
      setup() {
        const state = useChatFileChip({ file } as any)
        return () => h('div', state.blobUrl.value ?? '')
      },
    })
    const app = createApp(Probe)
    app.provide(CHAT_CONTEXT_KEY as symbol, { client: { fetchChatFileBlob }, host: {} })
    app.mount(el)
    return { app, el, file }
  }
  const tick = () => new Promise(r => setTimeout(r, 0))

  it('creates no blob URL for a fetch that finishes after unmount', async () => {
    const create = vi.fn(() => 'blob:late')
    URL.createObjectURL = create
    let resolve!: (b: Blob) => void
    const { app } = mountChip(() => new Promise<Blob>((r) => { resolve = r }), '/f')
    app.unmount()
    resolve(new Blob(['x']))
    await tick()
    expect(create).not.toHaveBeenCalled()
  })

  it('discards the result of an older url and keeps the newest', async () => {
    const create = vi.fn((b: Blob) => 'blob:' + b.size)
    URL.createObjectURL = create as any
    URL.revokeObjectURL = vi.fn()
    const resolvers: Array<(b: Blob) => void> = []
    const { el, file } = mountChip(() => new Promise<Blob>((r) => { resolvers.push(r) }), '/a')
    file.url = '/b'
    await tick()
    resolvers[1]!(new Blob(['bb']))
    await tick()
    resolvers[0]!(new Blob(['a']))
    await tick()
    expect(create).toHaveBeenCalledTimes(1)
    expect(el.textContent).toBe('blob:2')
  })
})
