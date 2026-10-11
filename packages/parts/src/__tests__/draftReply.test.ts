import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DraftReplyPart from '../DraftReplyPart.vue'
import { createFakeContext, flush } from './helpers'

describe('DraftReplyPart decide response', () => {
  it('ok false: error shown, no decided event, no message sent', async () => {
    const ctx = createFakeContext({
      decideApproval: vi.fn().mockResolvedValue({ ok: false, message: 'nope' }),
      fetchDalApproval: vi.fn().mockResolvedValue({ form: { threadId: 't1' }, decision: 'pending' }),
    })
    const wrapper = mount(DraftReplyPart, {
      props: { text: 'hello', approvalId: 'ap-9' },
      global: ctx.global,
    })
    await flush()
    // Pending row: [reject-reason link, reject, approve-and-send]. The approve button is the last one.
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1]!.trigger('click')
    await flush()
    expect(ctx.client.decideApproval).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('decided')).toBeUndefined()
    expect(ctx.client.sendTalkMessage).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('nope')
  })
})
