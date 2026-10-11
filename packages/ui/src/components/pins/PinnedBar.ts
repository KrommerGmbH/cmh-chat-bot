import type { Conversation } from '@cmh/chat-core'
import { useI18n } from '@cmh/chat-core'

export interface PinnedBarProps {
  pinnedConversations: Conversation[]
  activeId: string | null
}

export type PinnedBarEmit = {
  (e: 'select', id: string): void
  (e: 'unpin', id: string): void
}

export function usePinnedBar(props: PinnedBarProps, emit: PinnedBarEmit) {
  void props
  void emit
  const { t } = useI18n()

  return {
    t,
  }
}
