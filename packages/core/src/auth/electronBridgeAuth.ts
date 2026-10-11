import { getElectronBridge } from '../host/bridge'
import type { AuthSource } from './types'

/** Auth data comes from the AiOAi desktop preload bridge (`window.cmhChat.getAuth()`). */
export function electronBridgeAuth(): AuthSource {
  return {
    async resolve() {
      const bridge = getElectronBridge()
      if (!bridge || typeof bridge.getAuth !== 'function') {
        throw new Error('window.cmhChat.getAuth is not available')
      }
      let token = ''
      try {
        const authInfo = await bridge.getAuth()
        if (authInfo && typeof authInfo.token === 'string') {
          token = authInfo.token
        }
      } catch (err) {
        // Same as the seed: a failed getAuth still makes the chat ready (without token).
        console.warn('[auth] cmhChat.getAuth failed:', err)
      }
      // The desktop shell owns theme and locale: only the token (and channel) is provided.
      return { token, channel: 'desktop' }
    },
    // The desktop bridge has no change events.
    onTokenChanged: () => () => {},
    dispose() {},
  }
}
