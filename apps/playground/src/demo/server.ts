/**
 * In-memory stand-in for the chat server routes. It is passed to createChatClient as `fetch`,
 * so the playground runs the real client, transport and UI without any server.
 */
import type { ChatMessage, PollEventsResponse } from '@cmh/chat-core'
import {
  buildDemoReply,
  createDemoApprovals,
  createDemoMessages,
  demoBootstrap,
  demoConversations,
  demoDalRows,
  type DemoApprovalRow,
} from './data'

interface DemoRun {
  id: string
  status: 'running' | 'done' | 'stopped'
  pollsLeft: number
  replyTo: string
  startedAt: string
  finishedAt: string | null
}

/** How many polls a demo run stays in «running» before the answer arrives. */
const POLLS_BEFORE_REPLY = 2
const REJECT_KEYS = ['reject', 'rejected', 'skip', 'cancel']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export interface DemoServer {
  fetch: typeof fetch
  /** Every request the playground made, newest last (shown in the request log panel). */
  log: Array<{ method: string, path: string, body: unknown }>
}

/** Pass a reactive array as `log` to show the requests on screen. */
export function createDemoServer(log: DemoServer['log'] = []): DemoServer {
  const conversations = [...demoConversations]
  const messages = createDemoMessages()
  const approvals: DemoApprovalRow[] = createDemoApprovals()
  const runs = new Map<string, DemoRun>()
  const userConfig: Record<string, unknown> = {}
  const sentTalkApprovals = new Set<string>()
  let counter = 0

  const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${++counter}`
  const listOf = (conversationId: string): ChatMessage[] => (messages[conversationId] ??= [])
  const nextSeq = (conversationId: string): number => listOf(conversationId).reduce((max, m) => Math.max(max, m.seq), 0) + 1

  function poll(conversationId: string, afterMessageSeq: number): PollEventsResponse {
    const run = runs.get(conversationId) ?? null
    if (run && run.status === 'running') {
      run.pollsLeft -= 1
      if (run.pollsLeft <= 0) {
        listOf(conversationId).push({
          id: nextId('demo-msg'),
          seq: nextSeq(conversationId),
          role: 'assistant',
          kind: 'text',
          content: '',
          status: 'done',
          createdAt: new Date().toISOString(),
          runId: run.id,
          parts: buildDemoReply(run.replyTo),
          usage: { provider: 'Demo', model: 'demo-fast', modelLabel: 'Demo Fast', inputTokens: 100, outputTokens: 50, totalTokens: 150, durationMs: POLLS_BEFORE_REPLY * 1000 },
        })
        run.status = 'done'
        run.finishedAt = new Date().toISOString()
      }
    }

    const list = listOf(conversationId)
    const fresh = list.filter(m => m.seq > afterMessageSeq)
    return {
      success: true,
      run: run
        ? { id: run.id, status: run.status, last_error: null, token_total: null, started_at: run.startedAt, finished_at: run.finishedAt, stop_requested_at: null }
        : null,
      events: [],
      messages: fresh,
      approvals: approvals
        .filter(a => a.conversationId === conversationId && a.decision === 'pending')
        .map(({ conversationId: _conversationId, ...rest }) => rest),
      parts: [],
      lastEventSeq: 0,
      lastMessageSeq: list.reduce((max, m) => Math.max(max, m.seq), 0),
    }
  }

  async function handle(method: string, url: URL, body: any): Promise<Response> {
    const path = url.pathname

    if (path === '/api/_action/cmh-ai/chat/bootstrap') return json(demoBootstrap)

    if (path === '/api/search/cmh-ai-conversation') {
      const agentId = body?.filter?.[0]?.value
      return json({ data: agentId ? conversations.filter(c => c.agentId === agentId) : conversations })
    }

    if (path === '/api/cmh-ai-conversation' && method === 'POST') {
      const now = new Date().toISOString()
      conversations.unshift({ id: body.id, agentId: body.agentId, userId: body.userId ?? null, counterpartType: 'internal', title: body.title, createdAt: now, updatedAt: now })
      return new Response(null, { status: 204 })
    }

    if (path === '/api/_action/cmh-ai/chat/upload') {
      return json({ success: true, file: { mediaId: nextId('demo-media'), name: 'demo-file', mimeType: 'application/octet-stream', size: 0 } })
    }

    const conversationRoute = path.match(/^\/api\/_action\/cmh-ai\/conversation\/([^/]+)\/(message|events|stop)$/)
    if (conversationRoute) {
      const conversationId = conversationRoute[1]!
      const action = conversationRoute[2]
      if (action === 'message') {
        const runId = nextId('demo-run')
        listOf(conversationId).push({ id: nextId('demo-msg'), seq: nextSeq(conversationId), role: 'user', kind: 'text', content: String(body?.content ?? ''), status: 'done', createdAt: new Date().toISOString(), runId })
        runs.set(conversationId, { id: runId, status: 'running', pollsLeft: POLLS_BEFORE_REPLY, replyTo: String(body?.content ?? ''), startedAt: new Date().toISOString(), finishedAt: null })
        return json({ success: true, runId })
      }
      if (action === 'events') {
        return json(poll(conversationId, Number(url.searchParams.get('afterMessage') ?? 0)))
      }
      const run = runs.get(conversationId)
      if (run && run.status === 'running') {
        run.status = 'stopped'
        run.finishedAt = new Date().toISOString()
      }
      return json({ success: true })
    }

    const decideRoute = path.match(/^\/api\/_action\/cmh-ai\/approval\/([^/]+)\/decide$/)
    if (decideRoute) {
      const approval = approvals.find(a => a.id === decideRoute[1])
      if (!approval) return json({ success: false, message: 'Approval not found (demo)' }, 404)
      if (approval.decision !== 'pending') return json({ success: false, message: 'Already decided (demo)' }, 409)
      approval.decision = REJECT_KEYS.includes(String(body?.chosen)) ? 'rejected' : String(body?.chosen)
      return json({ success: true, ok: true, decision: approval.decision, chosenKeys: body?.chosenKeys ?? null })
    }

    if (path === '/api/_action/cmh-ai/talk/send') {
      if (sentTalkApprovals.has(body?.approvalId)) return json({ success: false, message: 'Already sent (demo)' }, 409)
      sentTalkApprovals.add(body?.approvalId)
      return json({ success: true })
    }

    if (path === '/api/_info/config-me') {
      if (method === 'GET') return json({ data: { 'cmh-ai-chat': userConfig } })
      Object.assign(userConfig, body?.['cmh-ai-chat'] ?? {})
      return new Response(null, { status: 204 })
    }

    const searchRoute = path.match(/^\/api\/search\/(product|order|customer|cmh-ai-approval)$/)
    if (searchRoute) {
      const id = body?.ids?.[0]
      if (searchRoute[1] === 'cmh-ai-approval') {
        const approval = approvals.find(a => a.id === id)
        return json({ data: approval ? [approval] : [] })
      }
      const row = demoDalRows[searchRoute[1]!]?.[id]
      return json({ data: row ? [row] : [] })
    }

    // TTS and file routes are not part of the demo: the client falls back on a non-OK answer.
    return json({ success: false, message: `No demo route for ${method} ${path}` }, 404)
  }

  const demoFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(rawUrl, 'http://demo.invalid')
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown = null
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }
    if (!url.pathname.endsWith('/events')) {
      log.push({ method, path: url.pathname, body })
    }
    return handle(method, url, body)
  }

  return { fetch: demoFetch, log }
}
