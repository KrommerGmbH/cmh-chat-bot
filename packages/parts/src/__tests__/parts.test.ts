import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ChatPart, ChatPartType } from '@cmh/chat-core'
import LinkPart from '../LinkPart.vue'
import PartRenderer from '../PartRenderer.vue'
import TablePart from '../TablePart.vue'
import { createFakeContext, flush } from './helpers'

const parts: Record<ChatPartType, Record<string, any>> = {
  text: { md: 'Hello **world**' },
  steps: { items: [{ tool: 'search', state: 'done', ms: 12 }] },
  callout: { tone: 'warn', text: 'Careful' },
  table: { columns: ['id', 'name'], rows: [['1', 'A']] },
  stats: { items: [{ label: 'Orders', value: 3 }] },
  code: { lang: 'ts', body: 'const a = 1' },
  link: { route: 'sw.order.detail', params: { id: '1' }, label: 'Open' },
  product_card: { productId: 'p1' },
  order_card: { orderId: 'o1' },
  customer_card: { customerId: 'c1' },
  approval: { approvalId: 'ap-1', choices: ['approve', 'reject'] },
  draft_reply: { text: 'Hi', approvalId: 'ap-2' },
  choices: { items: ['One', 'Two'] },
}

describe('PartRenderer', () => {
  for (const type of Object.keys(parts) as ChatPartType[]) {
    it(`renders type ${type} without throwing`, async () => {
      const ctx = createFakeContext()
      const part: ChatPart = { type, props: parts[type]! }
      const wrapper = mount(PartRenderer, {
        props: { part, isRunAnswered: true },
        global: ctx.global,
      })
      await flush()
      const container = wrapper.find('.part-container')
      expect(container.exists()).toBe(true)
      expect(container.element.children.length).toBeGreaterThan(0)
    })
  }
})

describe('host navigation', () => {
  it('LinkPart click calls host.navigate with { name, params }', async () => {
    const ctx = createFakeContext()
    const wrapper = mount(LinkPart, {
      props: { route: 'sw.order.detail', params: { id: '42' }, label: 'Open' },
      global: ctx.global,
    })
    await wrapper.get('button').trigger('click')
    expect(ctx.navigate).toHaveBeenCalledWith({ name: 'sw.order.detail', params: { id: '42' } })
  })

  it('TablePart row click navigates to the row link route', async () => {
    const ctx = createFakeContext()
    const wrapper = mount(TablePart, {
      props: { columns: ['id'], rows: [['77']], rowLink: 'product' },
      global: ctx.global,
    })
    await wrapper.get('tbody tr').trigger('click')
    expect(ctx.navigate).toHaveBeenCalledWith({ name: 'sw.product.detail', params: { id: '77' } })
  })
})
