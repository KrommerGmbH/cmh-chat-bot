import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TtsServiceManager } from '../tts/tts'
import { useUserConfig } from './useUserConfig'

function setup() {
  const saveUserConfig = vi.fn().mockResolvedValue(undefined)
  const tts = { setEngine: vi.fn() } as unknown as TtsServiceManager
  const config = useUserConfig({ client: { saveUserConfig }, tts })
  return { config, saveUserConfig }
}

describe('useUserConfig load guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves nothing before the initial load settled', () => {
    const { config, saveUserConfig } = setup()
    config.persistUserConfig()
    config.flushPersistUserConfig()
    vi.advanceTimersByTime(1000)
    expect(saveUserConfig).not.toHaveBeenCalled()
    expect(config.hasPersistTimer()).toBe(false)
  })

  it('does not save after load when nothing changed before it', () => {
    const { config, saveUserConfig } = setup()
    config.markConfigLoaded()
    vi.advanceTimersByTime(1000)
    expect(saveUserConfig).not.toHaveBeenCalled()
  })

  it('persists once after load when the user changed something before it', () => {
    const { config, saveUserConfig } = setup()
    config.handleAutoReadChange(true)
    config.handleTtsVoiceChange('v')
    expect(saveUserConfig).not.toHaveBeenCalled()
    config.markConfigLoaded()
    config.markConfigLoaded()
    vi.advanceTimersByTime(1000)
    expect(saveUserConfig).toHaveBeenCalledTimes(1)
    expect(saveUserConfig.mock.calls[0]![0]).toMatchObject({ autoRead: true, ttsVoice: 'v' })
  })

  it('saves nothing after a failed load (markConfigLoaded never called)', () => {
    const { config, saveUserConfig } = setup()
    config.handleAutoReadChange(true)
    config.handleTtsVoiceChange('v')
    config.flushPersistUserConfig()
    vi.advanceTimersByTime(2000)
    expect(saveUserConfig).not.toHaveBeenCalled()
  })

  it('saves with the debounce once loaded', () => {
    const { config, saveUserConfig } = setup()
    config.markConfigLoaded()
    config.handleTtsStyleChange('warm')
    expect(saveUserConfig).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(saveUserConfig).toHaveBeenCalledTimes(1)
  })
})
