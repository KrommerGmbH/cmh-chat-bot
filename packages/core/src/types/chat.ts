export type ThemeMode = 'dark' | 'dim' | 'light'

export type LocaleCode = 'ko-KR' | 'de-DE' | 'en-GB'

export interface Harness {
  id: string
  name: string
  agentId: string
  agentCode?: string
  capabilityId?: string | null
  description?: string | null
  modelId?: string | null
  modelLabel?: string | null
}

export interface AiModel {
  id: string
  providerCode: string
  providerName: string
  code: string
  label: string
  free: boolean
}

export interface HubOnlyHarness {
  name: string
  agentCode: string
}

export interface BootstrapData {
  userId: string | null
  locale: string
  harnesses: Harness[]
  hubOnlyHarnesses?: HubOnlyHarness[]
  models?: AiModel[]
}

export interface Conversation {
  id: string
  agentId: string
  userId?: string | null
  counterpartType?: string
  title: string
  createdAt?: string
  updatedAt?: string
}

export type ChatPartType =
  | 'text'
  | 'steps'
  | 'callout'
  | 'table'
  | 'stats'
  | 'code'
  | 'link'
  | 'product_card'
  | 'order_card'
  | 'customer_card'
  | 'approval'
  | 'draft_reply'
  | 'choices'

export interface ChatPart {
  type: ChatPartType
  props: Record<string, any>
}

export interface ChatUploadedFile {
  mediaId: string
  name: string
  mimeType: string
  size: number
  url?: string
}

export interface ChatUsage {
  provider?: string | null
  model?: string | null
  modelLabel?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  durationMs?: number | null
  cost?: number | null
  currency?: string | null
}

export interface ChatMessage {
  id: string
  seq: number
  role: 'user' | 'assistant' | 'system'
  kind: 'text' | 'thinking' | 'tool_trace'
  content: string | null
  status?: string
  createdAt?: string | null
  runId?: string
  rawText?: string | null
  parts?: ChatPart[]
  files?: ChatUploadedFile[]
  usage?: ChatUsage | null
  hidden?: boolean
}

export interface StepItem {
  tool: string
  state: 'done' | 'running' | 'error'
  ms?: number
}

export interface ApprovalItem {
  id: string
  runId?: string
  reason?: string
  summary?: string
  choices?: Array<{ key: string, label: string, multi?: boolean } | string>
  form?: Record<string, any> | null
  decision?: string
  createdAt?: string
}

export interface QueuedMessage {
  id: string
  text: string
  files: File[]
  modelId: string | null
  createdAt: number
}

export type FontScale = 'S' | 'M' | 'L' | 'XL'
export type TtsEngineType = 'server' | 'browser' | 'device'

export interface UserConfigData {
  theme?: ThemeMode
  pins?: string[]
  modelByHarness?: Record<string, string | null>
  fontScale?: FontScale
  ttsEngine?: TtsEngineType
  ttsVoice?: string | null
  ttsSpeaker?: string | null
  ttsStyle?: string | null
  autoRead?: boolean
}

export interface PollEventsResponse {
  success: boolean
  ok?: boolean
  run?: {
    id: string
    status: string
    last_error?: string | null
    token_total?: number | null
    created_at?: string
    started_at?: string | null
    finished_at?: string | null
    stop_requested_at?: string | null
  } | null
  events?: Array<{
    seq: number
    type: string
    payload: any
    created_at: string
  }>
  messages?: ChatMessage[]
  approvals?: ApprovalItem[]
  parts?: ChatPart[]
  lastEventSeq?: number
  lastMessageSeq?: number
}

export type ChatViewMode = 'solo' | 'split' | 'page'

export type ChatChannel = 'admin' | 'desktop' | 'canvas' | 'mobile'
