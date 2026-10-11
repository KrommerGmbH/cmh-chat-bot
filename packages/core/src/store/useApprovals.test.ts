import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { ApprovalItem, ChatMessage } from '../types/chat'
import { useApprovals } from './useApprovals'

describe('useApprovals', () => {
  it('uses the given pendingApprovals ref instead of creating its own', () => {
    const shared = ref<ApprovalItem[]>([{ id: 'a1' } as ApprovalItem, { id: 'a2' } as ApprovalItem])
    const api = useApprovals({
      messages: ref<ChatMessage[]>([]),
      runStatus: ref<string | null>(null),
      pendingApprovals: shared,
    })
    expect(api.pendingApprovals).toBe(shared)
    api.handleApprovalDecided({ id: 'a1', chosen: 'approve' })
    expect(shared.value.map(a => a.id)).toEqual(['a2'])
  })

  it('creates an own ref when none is given', () => {
    const api = useApprovals({ messages: ref<ChatMessage[]>([]), runStatus: ref<string | null>(null) })
    expect(api.pendingApprovals.value).toEqual([])
  })
})
