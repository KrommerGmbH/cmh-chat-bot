import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { chatSession } from '@cmh/chat-core'
import ApprovalPart from '../ApprovalPart.vue'
import { formatChangeValue } from '../ApprovalChangesTable'
import { formatApprovalTime } from '../approvalTime'
import { createFakeContext, flush } from './helpers'

describe('formatApprovalTime', () => {
  it('returns hour and minute for a valid date', () => {
    const label = formatApprovalTime('2026-10-11T08:05:00Z', 'en-GB')
    expect(label).toMatch(/\d{2}:\d{2}/)
  })

  it.each([[undefined], [null], [''], ['not a date']])('returns an empty string for %j', (value) => {
    expect(formatApprovalTime(value as string | null | undefined, 'en-GB')).toBe('')
  })
})

describe('ApprovalPart creation time', () => {
  it('renders the time from props.createdAt next to the reason', async () => {
    chatSession.locale.value = 'en-GB'
    const ctx = createFakeContext()
    const wrapper = mount(ApprovalPart, {
      props: { approvalId: 'ap-1', reason: 'Because', createdAt: '2026-10-11T08:05:00Z', choices: ['approve', 'reject'] },
      global: ctx.global,
    })
    await flush()
    expect(wrapper.get('[data-testid="approval-time"]').text()).toMatch(/\d{2}:\d{2}/)
  })

  it('fills the time from the fetched approval row', async () => {
    const ctx = createFakeContext({
      fetchDalApproval: async () => ({ reason: 'R', createdAt: '2026-10-11T08:05:00Z', choices: ['approve', 'reject'] }),
    })
    const wrapper = mount(ApprovalPart, { props: { approvalId: 'ap-1' }, global: ctx.global })
    await flush()
    expect(wrapper.find('[data-testid="approval-time"]').exists()).toBe(true)
  })

  it('renders nothing for a missing or invalid date', async () => {
    const ctx = createFakeContext()
    const wrapper = mount(ApprovalPart, {
      props: { approvalId: 'ap-1', reason: 'Because', createdAt: 'garbage', choices: ['approve', 'reject'] },
      global: ctx.global,
    })
    await flush()
    expect(wrapper.find('[data-testid="approval-time"]').exists()).toBe(false)
  })
})

describe('formatChangeValue', () => {
  it('shows objects and arrays as compact JSON', () => {
    expect(formatChangeValue({ a: 1, b: [2] })).toBe('{"a":1,"b":[2]}')
    expect(formatChangeValue(['x', 'y'])).toBe('["x","y"]')
  })

  it('keeps scalars and the placeholder behaviour', () => {
    expect(formatChangeValue(10)).toBe('10')
    expect(formatChangeValue(false)).toBe('false')
    expect(formatChangeValue(null)).toBe('—')
    expect(formatChangeValue(undefined)).toBe('—')
  })
})
