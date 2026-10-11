import { describe, expect, it } from 'vitest'
import {
  buildBootConfig,
  isAcceptableSendText,
  MAX_SEND_TEXT_LENGTH,
  parseAllowedParents,
  parseApiBaseUrl,
  parseChannel,
  resolveApiBase,
  resolveTrustedParent,
} from './bootConfig'

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

describe('parseApiBaseUrl', () => {
  it('accepts http and https, drops query, hash and a trailing slash, keeps a path prefix', () => {
    expect(parseApiBaseUrl('https://shop.example')).toBe('https://shop.example')
    expect(parseApiBaseUrl(' https://shop.example/ ')).toBe('https://shop.example')
    expect(parseApiBaseUrl('http://10.0.0.5:8000/sub/?a=1#x')).toBe('http://10.0.0.5:8000/sub')
  })

  it.each([
    ['javascript:alert(1)'], ['file:///etc/passwd'], ['capacitor://localhost'], ['data:text/plain,x'],
    ['//shop.example'], ['/api'], [''], ['not a url'], ['https://user:pw@shop.example'],
    [null], [undefined], [42], [{}],
  ])('ignores %j', (value) => {
    expect(parseApiBaseUrl(value)).toBeNull()
  })
})

describe('resolveApiBase', () => {
  it('VITE_API_BASE wins over the message', () => {
    expect(resolveApiBase('mobile', 'https://env.example', 'https://msg.example')).toBe('https://env.example')
  })

  it('mobile takes the validated message value', () => {
    expect(resolveApiBase('mobile', '', 'https://msg.example/')).toBe('https://msg.example')
    expect(resolveApiBase('mobile', '', 'ftp://msg.example')).toBe('')
    expect(resolveApiBase('mobile', '', undefined)).toBe('')
  })

  it('admin and canvas ignore the message value', () => {
    expect(resolveApiBase('admin', '', 'https://msg.example')).toBe('')
    expect(resolveApiBase('canvas', '', 'https://msg.example')).toBe('')
  })
})

describe('isAcceptableSendText', () => {
  it('accepts normal text up to the limit', () => {
    expect(isAcceptableSendText('4006381333931')).toBe(true)
    expect(isAcceptableSendText('x'.repeat(MAX_SEND_TEXT_LENGTH))).toBe(true)
  })

  it('rejects empty, blank, too long and non-string values', () => {
    expect(isAcceptableSendText('')).toBe(false)
    expect(isAcceptableSendText('  \n ')).toBe(false)
    expect(isAcceptableSendText('x'.repeat(MAX_SEND_TEXT_LENGTH + 1))).toBe(false)
    expect(isAcceptableSendText(undefined)).toBe(false)
    expect(isAcceptableSendText(123)).toBe(false)
  })
})
