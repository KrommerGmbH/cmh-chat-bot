/**
 * Demo data for the playground. Everything shown in the playground comes from this folder.
 * It is NOT real shop data. When a real data path exists, only these values change.
 */
import type { BootstrapData, ChatMessage, ChatPart, Conversation } from '@cmh/chat-core'

export const DEMO_IDS = {
  harnessOrder: 'demo-harness-order',
  harnessProduct: 'demo-harness-product',
  agentOrder: 'demo-agent-order',
  agentProduct: 'demo-agent-product',
  conversationParts: 'demo-conversation-parts',
  conversationApprovals: 'demo-conversation-approvals',
  conversationEmpty: 'demo-conversation-empty',
  approvalSimple: 'demo-approval-simple',
  approvalPendingSimple: 'demo-approval-pending-simple',
  approvalEditable: 'demo-approval-editable',
  approvalMulti: 'demo-approval-multi',
  approvalDraft: 'demo-approval-draft',
  product: 'demo-product-1',
  order: 'demo-order-1',
  marketOrder: 'demo-order-2',
  customer: 'demo-customer-1',
  talkThread: 'demo-talk-thread-1',
} as const

export const demoBootstrap: BootstrapData = {
  userId: 'demo-user',
  locale: 'ko-KR',
  harnesses: [
    {
      id: DEMO_IDS.harnessOrder,
      name: '고객주문 도우미 (시연)',
      agentId: DEMO_IDS.agentOrder,
      agentCode: 'demo_order',
      capabilityId: null,
      description: '고객주문 조회와 승인 흐름을 보여 주는 시연 하네스',
      modelId: 'demo-model-fast',
      modelLabel: 'Demo Fast',
    },
    {
      id: DEMO_IDS.harnessProduct,
      name: '상품 도우미 (시연)',
      agentId: DEMO_IDS.agentProduct,
      agentCode: 'demo_product',
      capabilityId: null,
      description: '상품 카드와 표를 보여 주는 시연 하네스',
      modelId: null,
      modelLabel: null,
    },
  ],
  hubOnlyHarnesses: [{ name: '마켓 작업 (시연)', agentCode: 'demo_market' }],
  models: [
    { id: 'demo-model-fast', providerCode: 'demo', providerName: 'Demo', code: 'demo-fast', label: 'Demo Fast', free: true },
    { id: 'demo-model-smart', providerCode: 'demo', providerName: 'Demo', code: 'demo-smart', label: 'Demo Smart', free: false },
  ],
}

const NOW = Date.now()
const minutesAgo = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString()

export const demoConversations: Conversation[] = [
  { id: DEMO_IDS.conversationParts, agentId: DEMO_IDS.agentOrder, userId: 'demo-user', counterpartType: 'internal', title: '파트 13종 (시연)', createdAt: minutesAgo(90), updatedAt: minutesAgo(5) },
  { id: DEMO_IDS.conversationApprovals, agentId: DEMO_IDS.agentOrder, userId: 'demo-user', counterpartType: 'internal', title: '승인 셋 (시연)', createdAt: minutesAgo(60), updatedAt: minutesAgo(10) },
  { id: DEMO_IDS.conversationEmpty, agentId: DEMO_IDS.agentProduct, userId: 'demo-user', counterpartType: 'internal', title: '빈 대화 (시연)', createdAt: minutesAgo(30), updatedAt: minutesAgo(30) },
]

/** One part of every type the renderer knows (13). */
export const demoAllParts: ChatPart[] = [
  { type: 'text', props: { md: '**시연 자료입니다.** 아래에 파트 13종이 차례로 나옵니다.\n\n- `text` 는 마크다운을 그립니다.\n- 진짜 상점 자료가 아닙니다.' } },
  { type: 'steps', props: { items: [{ tool: 'order_list', state: 'done', ms: 420 }, { tool: 'product_get', state: 'done', ms: 180 }, { tool: 'render_part', state: 'running' }] } },
  { type: 'callout', props: { tone: 'info', text: '정보 안내 (시연)' } },
  { type: 'callout', props: { tone: 'warn', text: '주의 안내 (시연)' } },
  { type: 'callout', props: { tone: 'danger', text: '위험 안내 (시연)' } },
  { type: 'table', props: { columns: ['고객주문 번호', '상태', '금액'], rows: [[DEMO_IDS.order, '진행 중', 129.9], [DEMO_IDS.marketOrder, '완료', 54]], rowLink: 'order' } },
  { type: 'stats', props: { items: [{ label: '오늘 고객주문', value: 12 }, { label: '승인 대기', value: 3 }, { label: '재고 부족', value: '2개' }] } },
  { type: 'code', props: { lang: 'json', body: '{\n  "type": "order_card",\n  "props": { "orderId": "demo-order-1" }\n}' } },
  { type: 'link', props: { route: 'sw.order.detail', params: { id: DEMO_IDS.order }, label: '고객주문 상세 열기 (시연)' } },
  { type: 'product_card', props: { productId: DEMO_IDS.product } },
  { type: 'order_card', props: { orderId: DEMO_IDS.order } },
  { type: 'order_card', props: { orderId: DEMO_IDS.marketOrder, source: 'naver' } },
  { type: 'customer_card', props: { customerId: DEMO_IDS.customer } },
  { type: 'approval', props: { approvalId: DEMO_IDS.approvalSimple } },
  { type: 'draft_reply', props: { text: '안녕하세요. 문의하신 상품은 내일 출고됩니다. (시연)', approvalId: DEMO_IDS.approvalDraft, threadId: DEMO_IDS.talkThread, evidence: ['출고 예정일: 내일', '재고 12개'] } },
  { type: 'choices', props: { items: ['발송 처리', '보류', '고객에게 문의'] } },
]

export interface DemoApprovalRow {
  id: string
  runId: string
  /** Conversation whose poll lists this approval as pending. null = reachable only through a message part. */
  conversationId: string | null
  reason: string
  summary: string
  choices: Array<{ key: string, label: string, multi?: boolean } | string>
  form: Record<string, unknown> | null
  decision: string
  createdAt: string
}

export function createDemoApprovals(): DemoApprovalRow[] {
  return [
    {
      id: DEMO_IDS.approvalSimple,
      runId: 'demo-run-0',
      conversationId: null,
      reason: '상태 변경',
      summary: '고객주문 1건을 «발송 완료»로 바꿉니다 (시연 · 단순 승인)',
      choices: [{ key: 'approve', label: '승인' }, 'reject'],
      form: null,
      decision: 'pending',
      createdAt: minutesAgo(12),
    },
    {
      id: DEMO_IDS.approvalPendingSimple,
      runId: 'demo-run-0',
      conversationId: DEMO_IDS.conversationApprovals,
      reason: '상태 변경',
      summary: '고객주문 1건을 «보류»로 바꿉니다 (시연 · 단순 승인)',
      choices: [{ key: 'approve', label: '승인' }, { key: 'reject', label: '거절' }],
      form: null,
      decision: 'pending',
      createdAt: minutesAgo(12),
    },
    {
      id: DEMO_IDS.approvalEditable,
      runId: 'demo-run-0',
      conversationId: DEMO_IDS.conversationApprovals,
      reason: '답변 보내기',
      summary: '고객 문의에 답변을 보냅니다 (시연 · 글 고쳐서 승인)',
      choices: [{ key: 'approve', label: '보내기' }, { key: 'reject', label: '거절' }],
      form: { editableText: '안녕하세요. 주문하신 상품은 오늘 출고되었습니다. 감사합니다.' },
      decision: 'pending',
      createdAt: minutesAgo(11),
    },
    {
      id: DEMO_IDS.approvalMulti,
      runId: 'demo-run-0',
      conversationId: DEMO_IDS.conversationApprovals,
      reason: '상품 값 변경',
      summary: '상품 3개의 값을 바꿉니다 (시연 · 여러 개 고르기 + 변경표)',
      choices: [
        { key: 'price', label: '판매가', multi: true },
        { key: 'stock', label: '재고', multi: true },
        { key: 'name', label: '상품명', multi: true },
        { key: 'reject', label: '전체 거절' },
      ],
      form: {
        changes: [
          { key: 'price', label: '판매가', before: 100, after: 90 },
          { key: 'stock', label: '재고', before: 3, after: 12 },
          { key: 'name', label: '상품명', before: null, after: '시연 상품 (새 이름)' },
        ],
      },
      decision: 'pending',
      createdAt: minutesAgo(10),
    },
    {
      id: DEMO_IDS.approvalDraft,
      runId: 'demo-run-0',
      conversationId: null,
      reason: '답변 초안',
      summary: '답변 초안을 보냅니다 (시연)',
      choices: [{ key: 'approve', label: '보내기' }, { key: 'reject', label: '거절' }],
      form: { editableText: '안녕하세요. 문의하신 상품은 내일 출고됩니다. (시연)' },
      decision: 'pending',
      createdAt: minutesAgo(9),
    },
  ]
}

export function createDemoMessages(): Record<string, ChatMessage[]> {
  return {
    [DEMO_IDS.conversationParts]: [
      { id: 'demo-msg-1', seq: 1, role: 'user', kind: 'text', content: '파트 전부 보여 줘', status: 'done', createdAt: minutesAgo(6), runId: 'demo-run-0' },
      { id: 'demo-msg-2', seq: 2, role: 'assistant', kind: 'text', content: '', status: 'done', createdAt: minutesAgo(5), runId: 'demo-run-0', parts: demoAllParts, usage: { provider: 'Demo', model: 'demo-fast', modelLabel: 'Demo Fast', inputTokens: 1200, outputTokens: 340, totalTokens: 1540, durationMs: 2100 } },
    ],
    [DEMO_IDS.conversationApprovals]: [
      { id: 'demo-msg-3', seq: 1, role: 'user', kind: 'text', content: '승인 셋 보여 줘', status: 'done', createdAt: minutesAgo(12), runId: 'demo-run-0' },
      {
        id: 'demo-msg-4', seq: 2, role: 'assistant', kind: 'text', content: '', status: 'done', createdAt: minutesAgo(10), runId: 'demo-run-0',
        parts: [
          { type: 'text', props: { md: '승인이 필요한 일이 셋 있습니다 (시연). 아래 대기 목록에서 정하십시오.' } },
        ],
      },
    ],
    [DEMO_IDS.conversationEmpty]: [],
  }
}

/** Shopware DAL rows the card parts read (only the fields they use). */
export const demoDalRows: Record<string, Record<string, Record<string, unknown>>> = {
  product: {
    [DEMO_IDS.product]: { id: DEMO_IDS.product, name: '시연 상품 A', productNumber: 'DEMO-1001', stock: 12, price: [{ gross: 19.9, net: 16.72, linked: true }] },
  },
  order: {
    [DEMO_IDS.order]: { id: DEMO_IDS.order, orderNumber: '10042', amountTotal: 129.9, orderDateTime: minutesAgo(600), stateMachineState: { name: 'In Progress' } },
    [DEMO_IDS.marketOrder]: { id: DEMO_IDS.marketOrder, orderNumber: 'NV-2026101100001', amountTotal: 54, orderDateTime: minutesAgo(1200), stateMachineState: { name: 'Done' } },
  },
  customer: {
    [DEMO_IDS.customer]: { id: DEMO_IDS.customer, customerNumber: 'DEMO-C-1', firstName: 'Demo', lastName: 'Customer', email: 'demo.customer@example.com' },
  },
}

/** What the demo assistant answers to a typed message (keyword → parts). */
export function buildDemoReply(userText: string): ChatPart[] {
  const text = userText.toLowerCase()
  if (text.includes('승인') || text.includes('approval')) {
    return [{ type: 'text', props: { md: '승인 카드입니다 (시연).' } }, { type: 'approval', props: { approvalId: DEMO_IDS.approvalSimple } }]
  }
  if (text.includes('상품') || text.includes('product')) {
    return [{ type: 'text', props: { md: '상품 카드입니다 (시연).' } }, { type: 'product_card', props: { productId: DEMO_IDS.product } }]
  }
  if (text.includes('주문') || text.includes('order')) {
    return [{ type: 'text', props: { md: '고객주문 카드입니다 (시연).' } }, { type: 'order_card', props: { orderId: DEMO_IDS.order } }]
  }
  if (text.includes('전부') || text.includes('all')) {
    return demoAllParts
  }
  return [
    { type: 'text', props: { md: `"${userText}" 를 받았습니다 (시연 응답 · 서버 없음).\n\n«승인» · «상품» · «주문» · «전부» 를 넣어 보십시오.` } },
    { type: 'choices', props: { items: ['승인 보여 줘', '상품 보여 줘', '전부 보여 줘'] } },
  ]
}
