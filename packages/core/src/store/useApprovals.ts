import type { ApprovalItem, ChatMessage } from '../types/chat'
import { parseIsoDate } from '../api/client'
import { type Ref, ref } from 'vue'

export interface ApprovalsOptions {
  messages: Ref<ChatMessage[]>
  runStatus: Ref<string | null>
  onPollOnce?: () => void
  /** Use this ref as the list of pending approvals (e.g. the store's) instead of creating an own one. */
  pendingApprovals?: Ref<ApprovalItem[]>
}

export function useApprovals(options: ApprovalsOptions) {
  const pendingApprovals = options.pendingApprovals ?? ref<ApprovalItem[]>([])

  function checkIsRunAnswered(appr: { runId?: string, createdAt?: string }): boolean {
    if (!appr.runId) {
      return true
    }
    if (options.runStatus.value && options.runStatus.value !== 'running' && options.runStatus.value !== 'waiting_user') {
      return true
    }
    const apprTime = parseIsoDate(appr.createdAt)
    if (apprTime > 0 && Date.now() - apprTime >= 120_000) {
      return true
    }
    return options.messages.value.some((m) => {
      if (m.role !== 'assistant') return false
      if (m.runId && m.runId !== appr.runId) return false
      const msgTime = parseIsoDate(m.createdAt)
      return msgTime >= apprTime
    })
  }

  function getApprovalPropsForPart(part: any) {
    const approvalId = part.props?.approvalId || part.props?.id
    if (approvalId) {
      const found = pendingApprovals.value.find(a => a.id === approvalId)
      if (found) {
        return found
      }
    }
    return part.props || {}
  }

  function handleApprovalDecided(result: { id: string, chosen: string, warning?: string }) {
    const idx = pendingApprovals.value.findIndex(a => a.id === result.id)
    if (idx !== -1) {
      pendingApprovals.value.splice(idx, 1)
    }
    void options.onPollOnce?.()
  }

  return {
    pendingApprovals,
    checkIsRunAnswered,
    getApprovalPropsForPart,
    handleApprovalDecided,
  }
}
