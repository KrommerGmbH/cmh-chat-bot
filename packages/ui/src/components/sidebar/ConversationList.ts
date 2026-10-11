import type { Conversation } from '@cmh/chat-core'
import { useI18n } from '@cmh/chat-core'
import { computed, ref } from 'vue'

export interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  pinnedIds: string[]
  isLoading?: boolean
}

export type ConversationListEmit = {
  (e: 'select-conversation', id: string): void
  (e: 'new-conversation'): void
  (e: 'toggle-pin', id: string): void
}

export function useConversationList(props: ConversationListProps, emit: ConversationListEmit) {
  void emit
  const { t } = useI18n()
  const searchQuery = ref('')

  const filteredConversations = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return props.conversations
    return props.conversations.filter(c => c.title.toLowerCase().includes(q))
  })

  const pinnedList = computed(() => {
    return filteredConversations.value.filter(c => props.pinnedIds.includes(c.id))
  })

  const unpinnedList = computed(() => {
    return filteredConversations.value.filter(c => !props.pinnedIds.includes(c.id))
  })

  function isPinned(id: string): boolean {
    return props.pinnedIds.includes(id)
  }

  return {
    t,
    searchQuery,
    filteredConversations,
    pinnedList,
    unpinnedList,
    isPinned,
  }
}
