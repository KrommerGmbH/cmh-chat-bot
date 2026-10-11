import type { PollEventsResponse } from '../types/chat'

export interface TransportEventMeta {
  /** True when this response answers the first poll of the conversation (no message seen yet). */
  isFirstPoll: boolean
}

/** Delivers run events and messages of one conversation to the store. */
export interface Transport {
  start(conversationId: string): void
  stop(): void
  /** Forget the carried sequence numbers (call when the conversation changes). */
  reset(): void
  pollNow(): Promise<void>
  /** Reserve a local message seq for an optimistic message. Optional: transports without seq tracking omit it. */
  incrementMessageSeq?(): number
  onEvents(callback: (response: PollEventsResponse, meta: TransportEventMeta) => void): () => void
}
