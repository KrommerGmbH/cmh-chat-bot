import { describe, expect, it } from 'vitest'
import { MockTransport } from './mock'

describe('MockTransport', () => {
  it('incrementMessageSeq returns a monotonically increasing number', () => {
    const transport = new MockTransport({ script: [] })
    expect(transport.incrementMessageSeq()).toBe(1)
    expect(transport.incrementMessageSeq()).toBe(2)
    expect(transport.incrementMessageSeq()).toBe(3)
  })
})
