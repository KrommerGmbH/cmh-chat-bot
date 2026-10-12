// Structure check: layout tokens exist in theme.css and the conversation area / input box carry no fixed px max width.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const theme = read('./theme.css')

describe('layout tokens', () => {
  it('theme.css defines the seven --chat-* variables', () => {
    for (const v of [
      '--chat-content-width', '--chat-content-min', '--chat-prose-max', '--chat-input-width',
      '--chat-input-icon', '--chat-input-control', '--chat-gap',
    ]) {
      expect(theme).toMatch(new RegExp(`${v}\s*:`))
    }
  })

  it('conversation area, input box, error line and queue list have no fixed max-width', () => {
    const files = [
      '../../ui/src/components/input/PromptInputArea.vue',
      '../../ui/src/components/chat/QueuedMessagesList.vue',
    ]
    for (const f of files) expect(read(f)).not.toMatch(/max-w-3xl/)
    const main = read('../../ui/src/ChatMainView.vue')
    expect(main).not.toMatch(/max-w-\[640px\]/)
    expect(main).not.toMatch(/max-w-3xl/)
  })

  it('answer components do not shrink their own width', () => {
    for (const f of ['ApprovalPart', 'DraftReplyPart', 'EditableApproval', 'CustomerCardPart', 'OrderCardPart', 'ProductCardPart']) {
      expect(read(`../../parts/src/${f}.vue`)).not.toMatch(/max-w-(sm|md|lg|xl)/)
    }
  })
})
