import type { PollEventsResponse } from '../types/chat'
import type { Transport, TransportEventMeta } from './types'

export type MockScript =
  | PollEventsResponse[]
  | ((conversationId: string, tick: number) => PollEventsResponse | null)

export interface MockTransportOptions {
  script: MockScript
  intervalMs?: number
}

/** Replays scripted responses on a timer. For the playground and for tests without a server. */
export class MockTransport implements Transport {
  private readonly script: MockScript
  private readonly intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private conversationId: string | null = null
  private tick = 0
  private localSeq = 0
  private readonly listeners = new Set<(response: PollEventsResponse, meta: TransportEventMeta) => void>()

  constructor(options: MockTransportOptions) {
    this.script = options.script
    this.intervalMs = options.intervalMs ?? 1000
  }

  start(conversationId: string): void {
    this.stop()
    if (this.conversationId !== conversationId) {
      this.reset()
    }
    this.conversationId = conversationId
    this.timer = setInterval(() => {
      void this.pollNow()
    }, this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  reset(): void {
    this.tick = 0
  }

  /**
   * Returns a monotonically increasing number. It is not kept consistent with the seq values of the
   * scripted responses: the mock replays by tick, so the number only has to be unique per call.
   */
  incrementMessageSeq(): number {
    return ++this.localSeq
  }

  onEvents(callback: (response: PollEventsResponse, meta: TransportEventMeta) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  async pollNow(): Promise<void> {
    if (!this.conversationId) return
    const currentTick = this.tick++
    const response = typeof this.script === 'function'
      ? this.script(this.conversationId, currentTick)
      : (this.script[currentTick] ?? null)
    if (!response) return
    for (const callback of this.listeners) {
      callback(response, { isFirstPoll: currentTick === 0 })
    }
  }
}
