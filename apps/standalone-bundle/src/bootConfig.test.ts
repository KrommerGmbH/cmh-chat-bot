import { describe, expect, it } from 'vitest'
import { buildBootConfig, parseAllowedParents, parseChannel, resolveTrustedParent } from './bootConfig'

const PAGE = 'https://chat.example'
const PARENT = 'https://admin.example'

describe('parseChannel', () => {
  it.each([['?mode=canvas', 'canvas'], ['?mode=mobile', 'mobile'], ['?mode=admin', 'admin']])('%s -> %s', (search, expected) => {
    expect(parseChannel(search)).toBe(expected)
  })

  it.each([['?mode=banana'], ['?mode=desktop'], [''], ['?mode=']])('unknown mode %j -> admin', (search) => {
    expect(parseChannel(search)).toBe('admin')
  })
})

describe('trusted parent', () => {
  it('ignores a parent that is not in the list', () => {
    expect(resolveTrustedParent('?parent=https://evil.example', PARENT)).toBeNull()
    const cfg = buildBootConfig('?parent=https://evil.example', PAGE, PARENT)
    expect(cfg.trustedParent).toBeNull()
    expect(cfg.allowedOrigins).toEqual([PAGE])
    expect(cfg.hostOrigin).toBe(PAGE)
  })

  it('trusts a listed parent and uses it as target origin', () => {
    const cfg = buildBootConfig(`?parent=${encodeURIComponent(PARENT)}`, PAGE, ` ${PARENT} , https://other.example`)
    expect(cfg.trustedParent).toBe(PARENT)
    expect(cfg.hostOrigin).toBe(PARENT)
    expect(cfg.allowedOrigins).toEqual([PAGE, PARENT])
  })

  it('drops invalid and opaque entries of the list', () => {
    expect(parseAllowedParents(`null, *, not a url, ,${PARENT}/`)).toEqual([PARENT])
    expect(resolveTrustedParent('?parent=null', 'null')).toBeNull()
  })
})

describe('opaque page origin', () => {
  it('a "null" page origin gives no usable origin', () => {
    const cfg = buildBootConfig('', 'null', '')
    expect(cfg.allowedOrigins).toEqual([])
    expect(cfg.hasUsableOrigin).toBe(false)
    expect(cfg.hostOrigin).toBe('')
  })

  it('a "null" page origin with a listed parent still works through the parent', () => {
    const cfg = buildBootConfig(`?parent=${encodeURIComponent(PARENT)}`, 'null', PARENT)
    expect(cfg.allowedOrigins).toEqual([PARENT])
    expect(cfg.hasUsableOrigin).toBe(true)
    expect(cfg.hostOrigin).toBe(PARENT)
  })
})
