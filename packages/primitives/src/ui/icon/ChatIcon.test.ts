// ChatIcon — 셸 icons/icon.ts 와 같은 그리기 규칙(굵기 1.5 · 종류 셋 · 모르는 이름은 타입이 막는다)
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ICON_DATA } from '../../icons/coolicons.generated'
import ChatIcon, { type ChatIconVariant } from './ChatIcon.vue'

type IconName = keyof typeof ICON_DATA
const CLOSED = (Object.keys(ICON_DATA) as IconName[]).find((n) => ICON_DATA[n].d.some((p) => /[zZ]/.test(p)))!

async function render(props: { name: IconName; variant?: ChatIconVariant }): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(ChatIcon, props) }))
}
describe('ChatIcon', () => {
  it('line 은 path 만 그리고 굵기 기본값은 1.5', async () => {
    const html = await render({ name: 'check' })
    expect(html).toContain('stroke-width="1.5"')
    expect(html).toContain('chat-icon--line')
    expect(html.match(/<path/g)).toHaveLength(ICON_DATA.check.d.length)
  })
  it('duotone 은 닫힌 도형 뒤에 옅은 채움 층(0.18)을 더 깐다', async () => {
    const html = await render({ name: CLOSED, variant: 'duotone' })
    expect(html).toContain('fill-opacity="0.18"')
    expect(html.match(/<path/g)!.length).toBeGreaterThan(ICON_DATA[CLOSED].d.length)
  })
  it('duocolor 는 --icon-2 변수를 쓴다', async () => {
    expect(await render({ name: CLOSED, variant: 'duocolor' })).toContain('var(--icon-2')
  })
})
