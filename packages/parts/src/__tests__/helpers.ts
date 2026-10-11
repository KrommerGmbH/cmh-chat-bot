import { vi } from 'vitest'
import { CHAT_CONTEXT_KEY, type ChatClient, type ChatContext, type HostBridge } from '@cmh/chat-core'

/** Fake client: only the methods the parts call. Every call resolves with a harmless default. */
export function createFakeContext(overrides: Partial<Record<string, any>> = {}) {
  const client = {
    decideApproval: vi.fn().mockResolvedValue({ ok: true }),
    fetchDalApproval: vi.fn().mockResolvedValue(null),
    fetchDalProduct: vi.fn().mockResolvedValue(null),
    fetchDalOrder: vi.fn().mockResolvedValue(null),
    fetchDalCustomer: vi.fn().mockResolvedValue(null),
    sendTalkMessage: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
  const navigate = vi.fn()
  const host: HostBridge = {
    navigate,
    backToSplit: vi.fn(),
    ready: vi.fn(),
    isEmbedded: true,
  }
  const context = { client: client as unknown as ChatClient, host } satisfies ChatContext
  return {
    client,
    host,
    navigate,
    global: { provide: { [CHAT_CONTEXT_KEY as symbol]: context } },
  }
}

export async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0))
}
