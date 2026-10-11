import { reactive } from 'vue'
import type {
  AiModel,
  ApprovalItem,
  ChatMessage,
  Conversation,
  Harness,
  HubOnlyHarness,
  PollEventsResponse,
} from '../types/chat'
import { t } from '../i18n'

export interface ChatStoreOptions {
  /** Called for each assistant message that is new to the store (for example to read it aloud). */
  onAssistantMessage?: (message: ChatMessage, meta: { isFirstPoll: boolean }) => void
}

export interface ChatStoreState {
  bootstrapFailed: boolean
  harnesses: Harness[]
  hubOnlyHarnesses: HubOnlyHarness[]
  models: AiModel[]
  selectedHarnessId: string | null
  currentUserId: string | null
  conversations: Conversation[]
  activeConversationId: string | null
  messages: ChatMessage[]
  pendingApprovals: ApprovalItem[]
  runStatus: string | null
  runError: string | null
  currentRunId: string | null
}

export type ChatStore = ChatStoreState & {
  applyPollResponse: (response: PollEventsResponse, meta?: { isFirstPoll?: boolean }) => void
}

export function createChatStore(options: ChatStoreOptions = {}): ChatStore {
  const state: ChatStoreState = {
    bootstrapFailed: false,
    harnesses: [],
    hubOnlyHarnesses: [],
    models: [],
    selectedHarnessId: null,
    currentUserId: null,
    conversations: [],
    activeConversationId: null,
    messages: [],
    pendingApprovals: [],
    runStatus: null,
    runError: null,
    currentRunId: null,
  }

  const store = reactive({
    ...state,
    applyPollResponse(result: PollEventsResponse, meta: { isFirstPoll?: boolean } = {}) {
      const isFirstPoll = meta.isFirstPoll ?? false

      if (result.run) {
        store.runStatus = result.run.status
        store.runError = result.run.status === 'failed'
          ? (result.run.last_error ? result.run.last_error.slice(0, 500) : t('runFailed'))
          : null
        store.currentRunId = result.run.id
      }

      if (result.approvals) {
        store.pendingApprovals = result.approvals
      }

      if (result.messages && result.messages.length > 0) {
        for (const incMsg of result.messages) {
          const existingIdx = store.messages.findIndex(m => m.id === incMsg.id)
          if (existingIdx !== -1) {
            store.messages[existingIdx] = {
              ...store.messages[existingIdx],
              ...incMsg,
            }
          } else {
            // Remove the optimistic temp message if it matches.
            const tempIdx = incMsg.role === 'user'
              ? store.messages.findIndex(m => m.id.startsWith('temp_') && m.content === incMsg.content)
              : -1
            if (tempIdx !== -1) {
              store.messages.splice(tempIdx, 1)
            }
            store.messages.push(incMsg)

            if (incMsg.role === 'assistant') {
              options.onAssistantMessage?.(incMsg, { isFirstPoll })
            }
          }
        }
      }

      // Trailing parts belong to the last assistant message.
      if (result.parts && result.parts.length > 0) {
        const lastMsg = store.messages[store.messages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.parts = [...(lastMsg.parts || []), ...result.parts]
        }
      }
    },
  })

  return store as ChatStore
}
