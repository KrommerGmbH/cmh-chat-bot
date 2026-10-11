import type { AuthInit, AuthSource } from './types'

/** Fixed auth data: dev token, playground, tests. Resolves immediately. */
export function staticAuth(init: AuthInit): AuthSource {
  const tokenListeners = new Set<(token: string) => void>()
  return {
    resolve: () => Promise.resolve(init),
    onTokenChanged(callback) {
      tokenListeners.add(callback)
      return () => {
        tokenListeners.delete(callback)
      }
    },
    dispose() {
      tokenListeners.clear()
    },
  }
}
