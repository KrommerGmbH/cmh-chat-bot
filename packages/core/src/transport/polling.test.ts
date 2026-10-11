import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PollEventsResponse } from '../types/chat'
import { PollingTransport } from './polling'

function makeClient(responses: Array<PollEventsResponse | Promise<PollEventsResponse>>) {
  const pollConversationEvents = vi.fn(async () => {
    const next = responses.shift()
    return next ?? { success: true }
  })
  return { pollConversationEvents }
}

describe('PollingTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('carries lastEventSeq, lastMessageSeq and lastRunId into the next poll', async () => {
    const client = makeClient([
      { success: true, lastEventSeq: 5, lastMessageSeq: 3, run: { id: 'run-1', status: 'running' } },
      { success: true },
    ])
    const transport = new PollingTransport({ client })
    transport.start('conv-1')

    await transport.pollNow()
    await transport.pollNow()

    expect(client.pollConversationEvents).toHaveBeenNthCalledWith(1, 'conv-1', 0, 0, null, expect.any(AbortSignal))
    expect(client.pollConversationEvents).toHaveBeenNthCalledWith(2, 'conv-1', 5, 3, 'run-1', expect.any(AbortSignal))
    transport.stop()
  })

  it('reports isFirstPoll only while no message seq is known', async () => {
    const client = makeClient([{ success: true, lastMessageSeq: 2 }, { success: true }])
    const transport = new PollingTransport({ client })
    const flags: boolean[] = []
    transport.onEvents((_r, meta) => flags.push(meta.isFirstPoll))
    transport.start('conv-1')
    await transport.pollNow()
    await transport.pollNow()
    expect(flags).toEqual([true, false])
    transport.stop()
  })

  it('drops the response when the conversation changed while the request was in flight', async () => {
    let release: (r: PollEventsResponse) => void = () => {}
    const slow = new Promise<PollEventsResponse>((resolve) => {
      release = resolve
    })
    const client = makeClient([slow, { success: true }])
    const transport = new PollingTransport({ client })
    const received: PollEventsResponse[] = []
    transport.onEvents(r => received.push(r))

    transport.start('conv-1')
    const inFlight = transport.pollNow()
    transport.start('conv-2')
    release({ success: true, lastEventSeq: 9, lastMessageSeq: 9 })
    await inFlight

    expect(received).toHaveLength(0)

    await transport.pollNow()
    // Seq numbers of the dropped response were not carried over.
    expect(client.pollConversationEvents).toHaveBeenLastCalledWith('conv-2', 0, 0, null, expect.any(AbortSignal))
    transport.stop()
  })

  it('does not poll on timer ticks while the document is hidden', async () => {
    const client = makeClient([])
    const transport = new PollingTransport({ client, intervalMs: 1000 })
    let hidden = true
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)

    transport.start('conv-1')
    await vi.advanceTimersByTimeAsync(3000)
    expect(client.pollConversationEvents).not.toHaveBeenCalled()

    hidden = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.pollConversationEvents).toHaveBeenCalledTimes(1)
    transport.stop()
  })

  function deferred() {
    let release: (r: PollEventsResponse) => void = () => {}
    const promise = new Promise<PollEventsResponse>((resolve) => {
      release = resolve
    })
    return { promise, release }
  }

  it('drops a response that arrives after stop()', async () => {
    const d = deferred()
    const client = makeClient([d.promise])
    const transport = new PollingTransport({ client })
    const received: PollEventsResponse[] = []
    transport.onEvents(r => received.push(r))

    transport.start('conv-1')
    const inFlight = transport.pollNow()
    transport.stop()
    d.release({ success: true, lastEventSeq: 7, lastMessageSeq: 7 })
    await inFlight

    expect(received).toHaveLength(0)
    transport.start('conv-1')
    await transport.pollNow()
    expect(client.pollConversationEvents).toHaveBeenLastCalledWith('conv-1', 0, 0, null, expect.any(AbortSignal))
    transport.stop()
  })

  it('drops a response that arrives after reset()', async () => {
    const d = deferred()
    const client = makeClient([d.promise, { success: true }])
    const transport = new PollingTransport({ client })
    const received: PollEventsResponse[] = []
    transport.onEvents(r => received.push(r))

    transport.start('conv-1')
    const inFlight = transport.pollNow()
    transport.reset()
    d.release({ success: true, lastEventSeq: 7, lastMessageSeq: 7 })
    await inFlight

    expect(received).toHaveLength(0)
    await transport.pollNow()
    expect(client.pollConversationEvents).toHaveBeenLastCalledWith('conv-1', 0, 0, null, expect.any(AbortSignal))
    transport.stop()
  })

  it('drops a response of conversation A after switching A -> B -> A quickly', async () => {
    const d = deferred()
    const client = makeClient([d.promise, { success: true }])
    const transport = new PollingTransport({ client })
    const received: PollEventsResponse[] = []
    transport.onEvents(r => received.push(r))

    transport.start('A')
    const inFlight = transport.pollNow()
    transport.start('B')
    transport.start('A')
    d.release({ success: true, lastEventSeq: 9, lastMessageSeq: 9 })
    await inFlight

    expect(received).toHaveLength(0)
    await transport.pollNow()
    expect(client.pollConversationEvents).toHaveBeenLastCalledWith('A', 0, 0, null, expect.any(AbortSignal))
    transport.stop()
  })

  it('does not start a second request while one is in flight (manual pollNow and timer)', async () => {
    const d = deferred()
    const client = makeClient([d.promise, { success: true }])
    const transport = new PollingTransport({ client, intervalMs: 1000 })

    transport.start('conv-1')
    const first = transport.pollNow()
    await transport.pollNow()
    await vi.advanceTimersByTimeAsync(3000)
    expect(client.pollConversationEvents).toHaveBeenCalledTimes(1)

    d.release({ success: true })
    await first
    await transport.pollNow()
    expect(client.pollConversationEvents).toHaveBeenCalledTimes(2)
    transport.stop()
  })

  it('clears the in-flight flag when the request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const pollConversationEvents = vi
      .fn<() => Promise<PollEventsResponse>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ success: true })
    const transport = new PollingTransport({ client: { pollConversationEvents } })
    transport.start('conv-1')
    await transport.pollNow()
    await transport.pollNow()
    expect(pollConversationEvents).toHaveBeenCalledTimes(2)
    transport.stop()
  })

  it('lets the next poll start after a generation change dropped the previous response', async () => {
    const d = deferred()
    const client = makeClient([d.promise, { success: true }])
    const transport = new PollingTransport({ client })
    transport.start('conv-1')
    const inFlight = transport.pollNow()
    transport.stop()
    d.release({ success: true })
    await inFlight
    transport.start('conv-1')
    await transport.pollNow()
    expect(client.pollConversationEvents).toHaveBeenCalledTimes(2)
    transport.stop()
  })
  it('aborts the hanging request on a conversation switch and polls the new conversation immediately', async () => {
    const signals: AbortSignal[] = []
    const pollConversationEvents = vi.fn((_id: string, _e?: number, _m?: number, _r?: string | null, signal?: AbortSignal) => {
      if (signal) signals.push(signal)
      return new Promise<PollEventsResponse>(() => {}) // never settles: simulates a hanging request
    })
    const transport = new PollingTransport({ client: { pollConversationEvents } })
    transport.start('conv-1')
    void transport.pollNow()
    expect(signals[0]!.aborted).toBe(false)

    transport.start('conv-2')
    expect(signals[0]!.aborted).toBe(true)
    void transport.pollNow()
    expect(pollConversationEvents).toHaveBeenCalledTimes(2)
    expect(pollConversationEvents.mock.calls[1]![0]).toBe('conv-2')
    transport.stop()
    expect(signals[1]!.aborted).toBe(true)
  })

  it('an aborted request calls no listener and logs no error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pollConversationEvents = vi.fn((_id: string, _e?: number, _m?: number, _r?: string | null, signal?: AbortSignal) => {
      return new Promise<PollEventsResponse>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    const transport = new PollingTransport({ client: { pollConversationEvents } })
    const received: PollEventsResponse[] = []
    transport.onEvents(r => received.push(r))
    transport.start('conv-1')
    const inFlight = transport.pollNow()
    transport.reset()
    await inFlight

    expect(received).toHaveLength(0)
    expect(errorSpy).not.toHaveBeenCalled()
    transport.stop()
  })
})
