import { describe, expect, it } from 'vitest'
import { postMessageHost } from './bridge'

describe('postMessageHost', () => {
  it.each(['*', '', 'null'])('throws at creation for targetOrigin "%s"', (targetOrigin) => {
    expect(() => postMessageHost({ targetOrigin })).toThrow(/targetOrigin/)
  })

  it('accepts a concrete origin and posts to it', () => {
    const calls: Array<[unknown, string]> = []
    const target = { postMessage: (m: unknown, o: string) => { calls.push([m, o]) } } as unknown as Window
    const host = postMessageHost({ targetOrigin: 'https://host.example', target })
    host.ready()
    expect(calls).toHaveLength(1)
    expect(calls[0]![1]).toBe('https://host.example')
  })
})
