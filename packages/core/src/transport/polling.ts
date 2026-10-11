import type { ChatClient } from '../api/client'
import type { PollEventsResponse } from '../types/chat'
import type { Transport, TransportEventMeta } from './types'

export interface PollingTransportOptions {
  client: Pick<ChatClient, 'pollConversationEvents'>
  intervalMs?: number
}

/** Polls `GET .../conversation/{id}/events` on a timer and carries the sequence numbers between polls. */
export class PollingTransport implements Transport {
  private readonly client: Pick<ChatClient, 'pollConversationEvents'>
  private readonly intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private conversationId: string | null = null
  private lastEventSeq = 0
  private lastMessageSeq = 0
  private lastRunId: string | null = null
  /** Incremented by start(), stop() and reset(): a response from an older generation is stale and dropped. */
  private generation = 0
  /** True while a request is in flight: timer ticks and manual polls do not start a second one. */
  private isPolling = false
  /** Aborts the in-flight request when the conversation changes or the transport stops/resets. */
  private inFlight: AbortController | null = null
  private readonly listeners = new Set<(response: PollEventsResponse, meta: TransportEventMeta) => void>()

  constructor(options: PollingTransportOptions) {
    this.client = options.client
    this.intervalMs = options.intervalMs ?? 1000
  }

  start(conversationId: string): void {
    this.stop()
    if (this.conversationId !== conversationId) {
      this.reset()
    }
    this.conversationId = conversationId
    this.generation++
    this.timer = setInterval(() => {
      // Resource saving: no polling while the page is hidden.
      if (typeof document !== 'undefined' && document.hidden) {
        return
      }
      void this.pollNow()
    }, this.intervalMs)
  }

  stop(): void {
    this.generation++
    this.abortInFlight()
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  reset(): void {
    this.generation++
    this.abortInFlight()
    this.lastEventSeq = 0
    this.lastMessageSeq = 0
    this.lastRunId = null
  }

  /** Aborts the running request and frees the in-flight guard so the next poll starts immediately. */
  private abortInFlight(): void {
    this.inFlight?.abort()
    this.inFlight = null
    this.isPolling = false
  }

  /** Reserve a local message seq (optimistic user message) so the next poll does not skip the server's copy. */
  incrementMessageSeq(): number {
    return ++this.lastMessageSeq
  }

  onEvents(callback: (response: PollEventsResponse, meta: TransportEventMeta) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  async pollNow(): Promise<void> {
    const conversationId = this.conversationId
    if (!conversationId || this.isPolling) return
    const generation = this.generation
    this.isPolling = true
    const controller = new AbortController()
    this.inFlight = controller
    const isFirstPoll = this.lastMessageSeq === 0

    try {
      const result = await this.client.pollConversationEvents(
        conversationId,
        this.lastEventSeq,
        this.lastMessageSeq,
        this.lastRunId,
        controller.signal,
      )

      // start(), stop() or reset() ran while the request was in flight: drop the stale answer.
      if (controller.signal.aborted || this.generation !== generation || this.conversationId !== conversationId) {
        return
      }

      if (result.run) {
        this.lastRunId = result.run.id
      }
      if (typeof result.lastEventSeq === 'number') {
        this.lastEventSeq = result.lastEventSeq
      }
      if (typeof result.lastMessageSeq === 'number') {
        this.lastMessageSeq = result.lastMessageSeq
      }

      for (const callback of this.listeners) {
        callback(result, { isFirstPoll })
      }
    } catch (err) {
      // An aborted request is expected (conversation switch, stop, reset): no listener call, no error log.
      if (!controller.signal.aborted) {
        console.error('Polling error:', err)
      }
    } finally {
      // A newer request may own the guard already: only the current request releases it.
      if (this.inFlight === controller) {
        this.inFlight = null
        this.isPolling = false
      }
    }
  }
}
