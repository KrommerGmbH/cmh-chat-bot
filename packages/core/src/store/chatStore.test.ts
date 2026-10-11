import { describe, expect, it, vi } from 'vitest'
import { chatSession } from '../auth/session'
import type { ChatMessage } from '../types/chat'
import { createChatStore } from './chatStore'

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role'>): ChatMessage {
  return { seq: 1, kind: 'text', content: '', ...partial }
}

describe('createChatStore.applyPollResponse', () => {
  it('replaces the optimistic temp_ message with the server copy', () => {
    const store = createChatStore()
    store.messages.push(msg({ id: 'temp_1', role: 'user', content: 'hello' }))

    store.applyPollResponse({
      success: true,
      messages: [msg({ id: 'srv-1', role: 'user', content: 'hello', seq: 1 })],
    })

    expect(store.messages.map(m => m.id)).toEqual(['srv-1'])
  })

  it('merges a message with a known id instead of duplicating it', () => {
    const store = createChatStore()
    store.applyPollResponse({
      success: true,
      messages: [msg({ id: 'a1', role: 'assistant', content: 'par', status: 'streaming' })],
    })
    store.applyPollResponse({
      success: true,
      messages: [msg({ id: 'a1', role: 'assistant', content: 'partial done', status: 'done' })],
    })

    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]).toMatchObject({ content: 'partial done', status: 'done' })
  })

  it('calls onAssistantMessage only for new assistant messages and passes isFirstPoll', () => {
    const onAssistantMessage = vi.fn()
    const store = createChatStore({ onAssistantMessage })
    store.applyPollResponse(
      { success: true, messages: [msg({ id: 'a1', role: 'assistant', content: 'x' })] },
      { isFirstPoll: true },
    )
    store.applyPollResponse({ success: true, messages: [msg({ id: 'a1', role: 'assistant', content: 'y' })] })
    expect(onAssistantMessage).toHaveBeenCalledTimes(1)
    expect(onAssistantMessage.mock.calls[0]![1]).toEqual({ isFirstPoll: true })
  })

  it('sets run status, run error text (server text cut to 500, else i18n runFailed), approvals and trailing parts', () => {
    chatSession.locale.value = 'ko-KR'
    const store = createChatStore()
    store.applyPollResponse({
      success: true,
      run: { id: 'r1', status: 'failed', last_error: 'e'.repeat(600) },
      approvals: [{ id: 'ap1' }],
    })
    expect(store.runStatus).toBe('failed')
    expect(store.runError).toBe('e'.repeat(500))
    expect(store.currentRunId).toBe('r1')
    expect(store.pendingApprovals).toEqual([{ id: 'ap1' }])

    store.applyPollResponse({ success: true, run: { id: 'r2', status: 'failed' } })
    expect(store.runError).toBe('답을 만들지 못했습니다')

    store.applyPollResponse({ success: true, run: { id: 'r3', status: 'done' } })
    expect(store.runError).toBeNull()

    store.applyPollResponse({ success: true, messages: [msg({ id: 'a2', role: 'assistant' })] })
    store.applyPollResponse({ success: true, parts: [{ type: 'text', props: { text: 'p' } }] })
    expect(store.messages[0]!.parts).toHaveLength(1)
  })
})
