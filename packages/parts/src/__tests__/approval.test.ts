import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ApprovalPart from '../ApprovalPart.vue'
import { createFakeContext, flush } from './helpers'

const multiChoices = [
  { key: 'a', label: 'Item A', multi: true },
  { key: 'b', label: 'Item B', multi: true },
  { key: 'c', label: 'Item C', multi: true },
  { key: 'reject', label: 'Reject' },
]

function mountApproval(props: Record<string, any>, overrides: Record<string, any> = {}) {
  const ctx = createFakeContext(overrides)
  const wrapper = mount(ApprovalPart, {
    props: { approvalId: 'ap-1', ...props },
    global: ctx.global,
  })
  return { wrapper, ...ctx }
}

describe('ApprovalPart multi mode', () => {
  it('renders one pre-checked box per selectable choice (reject key excluded)', async () => {
    const { wrapper } = mountApproval({ choices: multiChoices })
    await flush()
    const boxes = wrapper.findAll('[data-testid^="approval-check-"]')
    expect(boxes.map(b => b.attributes('data-testid'))).toEqual([
      'approval-check-a',
      'approval-check-b',
      'approval-check-c',
    ])
    expect(boxes.every(b => b.attributes('aria-checked') === 'true')).toBe(true)
  })

  it('approve selected sends chosen + chosenKeys without the unchecked box', async () => {
    const { wrapper, client } = mountApproval({ choices: multiChoices })
    await flush()
    await wrapper.get('[data-testid="approval-check-b"]').trigger('click')
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    expect(client.decideApproval).toHaveBeenCalledTimes(1)
    expect(client.decideApproval).toHaveBeenCalledWith('ap-1', { chosen: 'a', note: '', chosenKeys: ['a', 'c'] })
    expect(wrapper.emitted('decided')?.[0]).toEqual([{ id: 'ap-1', chosen: 'a' }])
  })

  it('reject all sends chosen reject', async () => {
    const { wrapper, client } = mountApproval({ choices: multiChoices })
    await flush()
    await wrapper.get('[data-testid="approval-reject-all"]').trigger('click')
    await flush()
    expect(client.decideApproval).toHaveBeenCalledWith('ap-1', { chosen: 'reject', note: '' })
  })

  it('disables approve selected when nothing is checked', async () => {
    const { wrapper, client } = mountApproval({ choices: multiChoices.slice(0, 2) })
    await flush()
    await wrapper.get('[data-testid="approval-check-a"]').trigger('click')
    await wrapper.get('[data-testid="approval-check-b"]').trigger('click')
    const approve = wrapper.get('[data-testid="approval-approve-selected"]')
    expect(approve.attributes('disabled')).toBeDefined()
    await approve.trigger('click')
    expect(client.decideApproval).not.toHaveBeenCalled()
  })
})

describe('ApprovalPart dispatch warning', () => {
  it('is absent when the response has no dispatch problem', async () => {
    const { wrapper } = mountApproval({ choices: multiChoices })
    await flush()
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="approval-dispatch-warning"]').exists()).toBe(false)
  })

  it('appears when the response has dispatch.skipped', async () => {
    const decideApproval = vi.fn().mockResolvedValue({
      ok: true,
      dispatch: { created: 1, skipped: ['x', 'y'], error: null },
    })
    const { wrapper } = mountApproval({ choices: multiChoices }, { decideApproval })
    await flush()
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    const warning = wrapper.get('[data-testid="approval-dispatch-warning"]')
    expect(warning.text()).toContain('x, y')
    expect(warning.text()).toContain('1')
  })

  it('appears when the response has dispatch.error', async () => {
    const decideApproval = vi.fn().mockResolvedValue({ ok: true, dispatch: { error: 'boom' } })
    const { wrapper } = mountApproval({ choices: multiChoices }, { decideApproval })
    await flush()
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    expect(wrapper.get('[data-testid="approval-dispatch-warning"]').text()).toContain('boom')
  })
})

describe('ApprovalPart change table', () => {
  const form = {
    changes: [
      { key: 'price', label: 'Price', before: 10, after: 12 },
      { key: 'stock', before: null },
    ],
  }

  it('renders rows with label fallback to key and the dash placeholder', async () => {
    const { wrapper } = mountApproval({ form, choices: ['approve', 'reject'] })
    await flush()
    const rows = wrapper.findAll('[data-testid="approval-changes"] tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.findAll('td').map(td => td.text())).toEqual(['Price', '10', '12'])
    expect(rows[1]!.findAll('td').map(td => td.text())).toEqual(['stock', '—', '—'])
    expect(wrapper.findAll('[data-testid="approval-changes"] thead th')).toHaveLength(3)
  })

  it('stays visible after the decision', async () => {
    const { wrapper } = mountApproval({ form, choices: ['approve', 'reject'], decision: 'approve' })
    await flush()
    expect(wrapper.find('[data-testid="approval-changes"]').exists()).toBe(true)
  })

  it('is rendered on the editable-text path too', async () => {
    const { wrapper } = mountApproval({ form: { ...form, editableText: 'hello' } })
    await flush()
    expect(wrapper.find('[data-testid="approval-changes"]').exists()).toBe(true)
  })

  it('is absent when changes is empty', async () => {
    const { wrapper } = mountApproval({ form: { changes: [] } })
    await flush()
    expect(wrapper.find('[data-testid="approval-changes"]').exists()).toBe(false)
  })
})

describe('ApprovalPart single mode', () => {
  it('still calls decideApproval(id, { chosen })', async () => {
    const { wrapper, client } = mountApproval({ choices: ['approve', 'reject'] })
    await flush()
    expect(wrapper.find('[data-testid="approval-multi"]').exists()).toBe(false)
    await wrapper.findAll('button')[0]!.trigger('click')
    await flush()
    expect(client.decideApproval).toHaveBeenCalledWith('ap-1', { chosen: 'approve' })
  })

  it('does not decide while the run is still answering', async () => {
    const { wrapper, client } = mountApproval({ choices: ['approve', 'reject'], isRunAnswered: false })
    await flush()
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(client.decideApproval).not.toHaveBeenCalled()
  })
})

describe('ApprovalPart decided payload', () => {
  it('carries the dispatch warning in the decided event', async () => {
    const decideApproval = vi.fn().mockResolvedValue({ ok: true, dispatch: { created: 0, skipped: ['x'], error: null } })
    const { wrapper } = mountApproval({ choices: multiChoices }, { decideApproval })
    await flush()
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    const payload = wrapper.emitted('decided')?.[0]?.[0] as { warning?: string }
    expect(payload.warning).toContain('x')
  })

  it('has no warning when the dispatch is fine', async () => {
    const { wrapper } = mountApproval({ choices: multiChoices })
    await flush()
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    expect((wrapper.emitted('decided')?.[0]?.[0] as { warning?: string }).warning).toBeUndefined()
  })
})

describe('ApprovalPart live decision prop', () => {
  it('follows a later change of the decision prop', async () => {
    const { wrapper } = mountApproval({ choices: ['approve', 'reject'] })
    await flush()
    expect(wrapper.text()).not.toContain('Decision')
    await wrapper.setProps({ decision: 'approve' })
    expect(wrapper.find('.text-emerald-500').exists()).toBe(true)
    await wrapper.setProps({ decision: 'pending' })
    expect(wrapper.find('.text-emerald-500').exists()).toBe(false)
  })
})

describe('ApprovalPart multi choices with editable text', () => {
  const form = { editableText: 'draft text' }

  it('renders the multi UI plus a textarea with the editable text', async () => {
    const { wrapper } = mountApproval({ choices: multiChoices, form })
    await flush()
    expect(wrapper.find('[data-testid="approval-multi"]').exists()).toBe(true)
    const area = wrapper.get('[data-testid="approval-multi-edited-text"]')
    expect((area.element as HTMLTextAreaElement).value).toBe('draft text')
  })

  it('sends chosenKeys and the edited text', async () => {
    const { wrapper, client } = mountApproval({ choices: multiChoices, form })
    await flush()
    await wrapper.get('[data-testid="approval-multi-edited-text"]').setValue('changed')
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    expect(client.decideApproval).toHaveBeenCalledWith('ap-1', {
      chosen: 'a',
      note: '',
      chosenKeys: ['a', 'b', 'c'],
      editedText: 'changed',
    })
  })
})

describe('ApprovalPart initial load', () => {
  it('disables the decision buttons until fetchDalApproval resolved', async () => {
    let release: (v: any) => void = () => {}
    const fetchDalApproval = vi.fn(() => new Promise((resolve) => { release = resolve }))
    const { wrapper } = mountApproval({}, { fetchDalApproval })
    await flush()
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every(b => b.attributes('disabled') !== undefined)).toBe(true)

    release({ choices: ['approve', 'reject'] })
    await flush()
    expect(wrapper.findAll('button').every(b => b.attributes('disabled') === undefined)).toBe(true)
  })

  it('does not decide while loading', async () => {
    const fetchDalApproval = vi.fn(() => new Promise(() => {}))
    const { wrapper, client } = mountApproval({}, { fetchDalApproval })
    await flush()
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(client.decideApproval).not.toHaveBeenCalled()
  })
})

describe('ApprovalPart single mode note', () => {
  it('sends the note with the choice', async () => {
    const { wrapper, client } = mountApproval({ choices: ['approve', 'reject'] })
    await flush()
    await wrapper.get('[data-testid="approval-note"]').setValue('  looks fine ')
    await wrapper.findAll('button')[0]!.trigger('click')
    await flush()
    expect(client.decideApproval).toHaveBeenCalledWith('ap-1', { chosen: 'approve', note: 'looks fine' })
  })
})

describe('ApprovalPart decide response with ok false', () => {
  it('shows the server message, stays undecided and emits nothing (single)', async () => {
    const decideApproval = vi.fn().mockResolvedValue({ ok: false, message: 'Already decided elsewhere' })
    const { wrapper } = mountApproval({ choices: ['approve', 'reject'] }, { decideApproval })
    await flush()
    await wrapper.findAll('button')[0]!.trigger('click')
    await flush()
    expect(wrapper.text()).toContain('Already decided elsewhere')
    expect(wrapper.emitted('decided')).toBeUndefined()
    expect(wrapper.find('.text-emerald-500').exists()).toBe(false)
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeUndefined()
  })

  it('treats success false in the multi path as an error', async () => {
    const decideApproval = vi.fn().mockResolvedValue({ success: false })
    const { wrapper } = mountApproval({ choices: multiChoices }, { decideApproval })
    await flush()
    await wrapper.get('[data-testid="approval-approve-selected"]').trigger('click')
    await flush()
    expect(wrapper.text()).toContain('결정을 저장하지 못했습니다')
    expect(wrapper.emitted('decided')).toBeUndefined()
  })
})

describe('ApprovalPart decision prop', () => {
  it('keeps a local decision when the decision prop falls back to undefined', async () => {
    const { wrapper } = mountApproval({ choices: multiChoices, decision: 'pending' })
    await flush()
    await wrapper.get('[data-testid="approval-reject-all"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="approval-reject-all"]').exists()).toBe(false)
    await wrapper.setProps({ decision: 'reject' })
    await wrapper.setProps({ decision: undefined })
    expect(wrapper.find('[data-testid="approval-reject-all"]').exists()).toBe(false)
  })
})
