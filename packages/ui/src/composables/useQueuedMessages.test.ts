import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watch } from 'vue'
import type { QueuedMessage } from '@cmh/chat-core'

describe('Queued Messages (Antigravity-style) Core Pipeline', () => {
  function setupQueueHarness() {
    const queuedMessages = ref<QueuedMessage[]>([])
    const isRunning = ref<boolean>(false)
    const activeConversationId = ref<string | null>('conv_test_123')
    const sentMessages: Array<{ text: string; files: File[]; modelId: string | null }> = []

    function enqueueMessage(payload: { text: string; files?: File[]; modelId?: string | null }) {
      queuedMessages.value.push({
        id: `qm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: payload.text,
        files: payload.files || [],
        modelId: payload.modelId || null,
        createdAt: Date.now(),
      })
    }

    function removeQueuedMessage(id: string) {
      queuedMessages.value = queuedMessages.value.filter(m => m.id !== id)
    }

    function clearQueuedMessages() {
      queuedMessages.value = []
    }

    async function handleSendMessage(payload: { text: string; files?: File[]; modelId?: string | null }) {
      if (isRunning.value) {
        enqueueMessage(payload)
        return
      }

      // Simulate sending
      sentMessages.push({
        text: payload.text,
        files: payload.files || [],
        modelId: payload.modelId || null,
      })
      isRunning.value = true
    }

    async function dispatchNextQueuedMessage() {
      if (isRunning.value || queuedMessages.value.length === 0 || !activeConversationId.value) {
        return
      }
      const next = queuedMessages.value.shift()
      if (!next) return
      await handleSendMessage({
        text: next.text,
        files: next.files,
        modelId: next.modelId,
      })
    }

    // Auto-dispatch watcher and completion hook
    watch(isRunning, (nowRunning, wasRunning) => {
      if (wasRunning && !nowRunning) {
        void dispatchNextQueuedMessage()
      }
    })

    return {
      queuedMessages,
      isRunning,
      activeConversationId,
      sentMessages,
      enqueueMessage,
      removeQueuedMessage,
      clearQueuedMessages,
      handleSendMessage,
      dispatchNextQueuedMessage,
    }
  }

  it('AI가 유휴 상태(Idle)일 때 메시지를 전송하면 큐를 거치지 않고 즉시 전송된다', async () => {
    const h = setupQueueHarness()
    expect(h.isRunning.value).toBe(false)
    expect(h.queuedMessages.value.length).toBe(0)

    await h.handleSendMessage({ text: '첫 번째 질문입니다' })

    expect(h.sentMessages.length).toBe(1)
    expect(h.sentMessages[0].text).toBe('첫 번째 질문입니다')
    expect(h.isRunning.value).toBe(true)
    expect(h.queuedMessages.value.length).toBe(0)
  })

  it('AI가 작업 중(isRunning === true)일 때 메시지를 전송하면 QUEUED MESSAGES 큐에 순서대로 적재된다', async () => {
    const h = setupQueueHarness()
    // 1번 메시지 시작
    await h.handleSendMessage({ text: '메시지 1' })
    expect(h.isRunning.value).toBe(true)

    // 작업 도중 추가 프롬프트 2개 전송 시도
    await h.handleSendMessage({ text: '대기 프롬프트 A' })
    await h.handleSendMessage({ text: '대기 프롬프트 B' })

    // 즉시 전송되지 않고 대기열에 2개 보관됨
    expect(h.sentMessages.length).toBe(1)
    expect(h.queuedMessages.value.length).toBe(2)
    expect(h.queuedMessages.value[0].text).toBe('대기 프롬프트 A')
    expect(h.queuedMessages.value[1].text).toBe('대기 프롬프트 B')
  })

  it('대기열의 특정 메시지를 개별 삭제(remove)하거나 전체 삭제(clear)할 수 있다', async () => {
    const h = setupQueueHarness()
    await h.handleSendMessage({ text: '실행 중' })

    await h.handleSendMessage({ text: '큐 1' })
    await h.handleSendMessage({ text: '큐 2' })
    await h.handleSendMessage({ text: '큐 3' })

    expect(h.queuedMessages.value.length).toBe(3)
    const targetId = h.queuedMessages.value[1].id // '큐 2' 삭제
    h.removeQueuedMessage(targetId)

    expect(h.queuedMessages.value.length).toBe(2)
    expect(h.queuedMessages.value[0].text).toBe('큐 1')
    expect(h.queuedMessages.value[1].text).toBe('큐 3')

    // 전체 삭제
    h.clearQueuedMessages()
    expect(h.queuedMessages.value.length).toBe(0)
  })

  it('AI 작업이 완료(isRunning: true -> false)되면 큐의 맨 앞 메시지(#1 Next)가 자동으로 꺼내어져 전송된다', async () => {
    const h = setupQueueHarness()
    // 실행 중 상태
    await h.handleSendMessage({ text: '메시지 1' })
    await h.handleSendMessage({ text: '대기 프롬프트 A' })
    await h.handleSendMessage({ text: '대기 프롬프트 B' })

    expect(h.sentMessages.length).toBe(1)
    expect(h.queuedMessages.value.length).toBe(2)

    // AI 작업 완료 시뮬레이션: 완료되면 dispatchNextQueuedMessage 가 큐의 첫 항목을 꺼내어 전송한다
    h.isRunning.value = false
    await h.dispatchNextQueuedMessage()

    // '대기 프롬프트 A'가 자동으로 전송되어 sentMessages에 들어가고 큐에는 '대기 프롬프트 B'만 남음
    expect(h.sentMessages.length).toBe(2)
    expect(h.sentMessages[1].text).toBe('대기 프롬프트 A')
    expect(h.queuedMessages.value.length).toBe(1)
    expect(h.queuedMessages.value[0].text).toBe('대기 프롬프트 B')
    expect(h.isRunning.value).toBe(true)

    // 대기 프롬프트 A의 작업 완료 시뮬레이션
    h.isRunning.value = false
    await h.dispatchNextQueuedMessage()

    // '대기 프롬프트 B'도 자동으로 전송되고 큐는 완전히 비워짐
    expect(h.sentMessages.length).toBe(3)
    expect(h.sentMessages[2].text).toBe('대기 프롬프트 B')
    expect(h.queuedMessages.value.length).toBe(0)
    expect(h.isRunning.value).toBe(true)
  })

  it('대화방이 바뀌면 이전 방의 큐가 클리어되어 오염을 방지한다', async () => {
    const h = setupQueueHarness()
    await h.handleSendMessage({ text: '메시지 1' })
    await h.handleSendMessage({ text: '방 A의 대기 프롬프트' })
    expect(h.queuedMessages.value.length).toBe(1)

    // 대화방 전환 시뮬레이션 (App.ts 의 selectConversation)
    h.activeConversationId.value = 'conv_test_999'
    h.clearQueuedMessages()

    expect(h.queuedMessages.value.length).toBe(0)
  })
})
