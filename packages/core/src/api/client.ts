import type {
  BootstrapData,
  ChatUploadedFile,
  Conversation,
  PollEventsResponse,
  UserConfigData,
} from '../types/chat'

export interface ChatClientOptions {
  /** Prefix for relative URLs. Use '' for same-origin. */
  baseUrl: string
  /** Returns the current bearer token ('' = send no Authorization header). */
  getToken: () => string
  /** Custom fetch (tests, Electron). Defaults to the global fetch. */
  fetch?: typeof fetch
  /** Called where the UI used to show a toast. */
  onError?: (message: string, error?: unknown) => void
}

export interface TtsVoicesData {
  speakers: string[]
  styles: string[]
  defaultSpeakers: Record<string, string>
}

export interface TtsSegmentItem {
  index: number
  text?: string
  ready: boolean
  url?: string
}

export interface TtsManifestData {
  success: boolean
  key: string
  speaker?: string
  status: 'queued' | 'running' | 'done' | 'failed'
  segments: TtsSegmentItem[]
  error?: string
}

export interface ApprovalDecisionPayload {
  chosen: string
  note?: string
  chosenKeys?: string[]
  editedText?: string
}

const ALLOWED_FONT_SCALES = ['S', 'M', 'L', 'XL'] as const
const ALLOWED_TTS_ENGINES = ['server', 'browser', 'device'] as const

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function parseIsoDate(dateStr?: string | null): number {
  if (!dateStr) return 0
  const normalized = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr.replace(' ', 'T')}Z`
  const t = new Date(normalized).getTime()
  return Number.isNaN(t) ? 0 : t
}

export interface ChatClient {
  fetchBootstrap(): Promise<BootstrapData>
  fetchConversations(agentId?: string): Promise<Conversation[]>
  createConversation(payload: {
    agentId: string
    title?: string
    userId?: string | null
    capabilityId?: string | null
  }): Promise<Conversation>
  uploadChatFile(file: File): Promise<ChatUploadedFile>
  fetchChatFileBlob(url: string): Promise<Blob>
  sendChatMessage(
    conversationId: string,
    content: string,
    modelId?: string | null,
    attachments?: Array<{ mediaId: string }>,
  ): Promise<any>
  pollConversationEvents(
    conversationId: string,
    afterEventSeq?: number,
    afterMessageSeq?: number,
    afterEventRunId?: string | null,
    signal?: AbortSignal,
  ): Promise<PollEventsResponse>
  stopConversationRun(conversationId: string): Promise<any>
  decideApproval(
    approvalId: string,
    payloadOrChosen: ApprovalDecisionPayload | string,
    note?: string,
    chosenKeys?: string[],
    editedText?: string,
  ): Promise<any>
  sendTalkMessage(payload: { threadId: string, text: string, approvalId: string }): Promise<any>
  loadUserConfig(): Promise<UserConfigData>
  saveUserConfig(config: UserConfigData): Promise<void>
  fetchDalProduct(id: string): Promise<any>
  fetchDalOrder(id: string): Promise<any>
  fetchDalCustomer(id: string): Promise<any>
  fetchDalApproval(id: string): Promise<any>
  fetchTtsVoices(): Promise<TtsVoicesData>
  requestTtsSynthesis(
    messageId: string,
    speaker?: string | null,
    style?: string | null,
    locale?: string | null,
    signal?: AbortSignal,
  ): Promise<TtsManifestData>
  getTtsManifest(
    messageId: string,
    speaker?: string | null,
    style?: string | null,
    locale?: string | null,
    signal?: AbortSignal,
  ): Promise<TtsManifestData>
  fetchAudioBlobUrl(url: string, signal?: AbortSignal): Promise<string>
}

/** Origin of a URL string, or null when it cannot be parsed. */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Origin of the page the client runs in. Only here `globalThis.location` is read (`api/` never touches `window`). */
function getPageOrigin(): string | null {
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin
  return origin && origin !== 'null' ? origin : null
}

export function createChatClient(options: ChatClientOptions): ChatClient {
  const { baseUrl, getToken, onError } = options

  /**
   * Resolve a request URL exactly once. Relative paths keep today's rule `baseUrl + path`;
   * an input that parses as an absolute URL is used as is. The result is compared with the own origin
   * (origin of an absolute `baseUrl`, else the page origin): `sameOrigin` is true only on an exact match.
   * Without a known own origin a relative path stays a plain string and counts as same-origin.
   */
  function resolveRequestUrl(input: string): { url: string, sameOrigin: boolean } {
    const trimmed = input.trim()
    const joined = originOf(trimmed) !== null ? trimmed : `${baseUrl}${input}`
    const joinedIsAbsolute = originOf(joined.trim()) !== null
    const baseIsAbsolute = originOf(baseUrl) !== null
    const ownOrigin = (baseIsAbsolute ? originOf(baseUrl) : null) ?? getPageOrigin()
    let resolved: URL | null = null
    try {
      resolved = new URL(joined, joinedIsAbsolute ? undefined : (ownOrigin ?? undefined))
    } catch {
      resolved = null
    }
    if (!resolved) {
      // No page origin is known (sandboxed frame, file://, Node). A browser still resolves a
      // scheme-relative string such as `//host/x` (or with backslashes) to ANOTHER host, so it gets no token.
      if (/^[/\\]{2}/.test(joined.trim())) {
        return { url: joined, sameOrigin: false }
      }
      // A plain relative path: concatenation as before, same-origin by definition.
      return { url: joined, sameOrigin: true }
    }
    const sameOrigin = ownOrigin !== null && resolved.origin === ownOrigin
    if (!joinedIsAbsolute && sameOrigin) {
      // Relative path on the own origin: the string resolves to the same URL, keep it as written.
      return { url: joined, sameOrigin: true }
    }
    return { url: resolved.href, sameOrigin }
  }

  function apiFetch(input: string, init?: RequestInit): Promise<Response> {
    const { url, sameOrigin } = resolveRequestUrl(input)
    let finalInit = init
    if (!sameOrigin && init?.headers) {
      // The token must not leave our API: strip Authorization for any other origin.
      const headers = new Headers(init.headers)
      headers.delete('Authorization')
      const plain: Record<string, string> = {}
      headers.forEach((value, key) => {
        plain[key.toLowerCase() === 'content-type' ? 'Content-Type' : key.toLowerCase() === 'accept' ? 'Accept' : key] = value
      })
      finalInit = { ...init, headers: plain }
    }
    const doFetch = options.fetch ?? globalThis.fetch
    return doFetch(url, finalInit)
  }

  function getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  async function fetchBootstrap(): Promise<BootstrapData> {
    const response = await apiFetch('/api/_action/cmh-ai/chat/bootstrap', {
      method: 'GET',
      headers: getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to load bootstrap data: ${response.status}`)
    }

    const json = await response.json()
    return {
      userId: json.userId ?? null,
      locale: json.locale ?? 'ko-KR',
      harnesses: Array.isArray(json.harnesses) ? json.harnesses : [],
      hubOnlyHarnesses: Array.isArray(json.hubOnlyHarnesses) ? json.hubOnlyHarnesses : [],
      models: Array.isArray(json.models) ? json.models : [],
    }
  }

  async function fetchConversations(agentId?: string): Promise<Conversation[]> {
    const body: Record<string, any> = {
      page: 1,
      limit: 100,
      sort: [{ field: 'updatedAt', order: 'DESC' }],
    }

    if (agentId) {
      body.filter = [{ type: 'equals', field: 'agentId', value: agentId }]
    }

    const response = await apiFetch('/api/search/cmh-ai-conversation', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return []
    }

    const json = await response.json()
    const data = Array.isArray(json.data) ? json.data : []
    return data.map((item: any) => ({
      id: item.id,
      agentId: item.agentId,
      userId: item.userId ?? null,
      counterpartType: item.counterpartType ?? 'internal',
      title: item.title || 'Untitled',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
  }

  async function createConversation(payload: {
    agentId: string
    title?: string
    userId?: string | null
    capabilityId?: string | null
  }): Promise<Conversation> {
    const newId = generateUuid()
    const record = {
      id: newId,
      agentId: payload.agentId,
      userId: payload.userId ?? null,
      capabilityId: payload.capabilityId ?? null,
      title: payload.title || '새 대화',
      counterpartType: 'internal',
    }

    const response = await apiFetch('/api/cmh-ai-conversation', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(record),
    })

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to create conversation: ${response.status}`)
    }

    return {
      id: newId,
      agentId: payload.agentId,
      userId: payload.userId ?? null,
      counterpartType: 'internal',
      title: payload.title || '새 대화',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  async function uploadChatFile(file: File): Promise<ChatUploadedFile> {
    const headers = getHeaders() as Record<string, string>
    delete headers['Content-Type']

    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetch('/api/_action/cmh-ai/chat/upload', {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}))
      throw new Error(errorJson.errors?.[0]?.detail ?? errorJson.message ?? `Failed to upload file: ${response.status}`)
    }

    const json = await response.json()
    if (!json.success || !json.file) {
      throw new Error(json.message || 'File upload failed')
    }
    return json.file
  }

  async function fetchChatFileBlob(url: string): Promise<Blob> {
    const headers = getHeaders()
    const response = await apiFetch(url, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    return response.blob()
  }

  async function sendChatMessage(
    conversationId: string,
    content: string,
    modelId?: string | null,
    attachments?: Array<{ mediaId: string }>,
  ): Promise<any> {
    const body: Record<string, any> = { content }
    if (modelId) {
      body.modelId = modelId
    }
    if (attachments && attachments.length > 0) {
      body.attachments = attachments
    }

    const response = await apiFetch(`/api/_action/cmh-ai/conversation/${conversationId}/message`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}))
      throw new Error(errorJson.errors?.[0]?.detail ?? errorJson.message ?? `Failed to send message: ${response.status}`)
    }

    return response.json()
  }

  async function pollConversationEvents(
    conversationId: string,
    afterEventSeq = 0,
    afterMessageSeq = 0,
    afterEventRunId: string | null = null,
    signal?: AbortSignal,
  ): Promise<PollEventsResponse> {
    const query = new URLSearchParams({
      after: String(afterEventSeq),
      afterEvent: String(afterEventSeq),
      afterMessage: String(afterMessageSeq),
    })

    if (afterEventRunId) {
      query.set('afterEventRun', afterEventRunId)
    }

    const response = await apiFetch(
      `/api/_action/cmh-ai/conversation/${conversationId}/events?${query.toString()}`,
      {
        method: 'GET',
        headers: getHeaders(),
        signal,
      },
    )

    if (!response.ok) {
      return { success: false, ok: false }
    }

    return response.json()
  }

  async function stopConversationRun(conversationId: string): Promise<any> {
    const response = await apiFetch(`/api/_action/cmh-ai/conversation/${conversationId}/stop`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    })

    return response.json()
  }

  async function decideApproval(
    approvalId: string,
    payloadOrChosen: ApprovalDecisionPayload | string,
    note?: string,
    chosenKeys?: string[],
    editedText?: string,
  ): Promise<any> {
    let body: ApprovalDecisionPayload
    if (typeof payloadOrChosen === 'string') {
      body = {
        chosen: payloadOrChosen,
        note: note || '',
        chosenKeys,
        editedText,
      }
    } else {
      body = {
        chosen: payloadOrChosen.chosen,
        note: payloadOrChosen.note || '',
        chosenKeys: payloadOrChosen.chosenKeys,
        editedText: payloadOrChosen.editedText,
      }
    }

    const response = await apiFetch(`/api/_action/cmh-ai/approval/${approvalId}/decide`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw Object.assign(
        new Error(err.errors?.[0]?.detail ?? err.message ?? `Failed to decide approval: ${response.status}`),
        {
          status: response.status,
          code: err.code,
          response: { status: response.status, data: err },
        },
      )
    }

    return response.json()
  }

  async function sendTalkMessage(payload: {
    threadId: string
    text: string
    approvalId: string
  }): Promise<any> {
    const response = await apiFetch('/api/_action/cmh-ai/talk/send', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      // Attach the status: 409 = already sent with this approval (server talk/send). The UI tells it apart from a failure.
      throw Object.assign(new Error(err.errors?.[0]?.detail ?? err.message ?? `Failed to send talk message: ${response.status}`), { status: response.status })
    }

    return response.json()
  }

  async function loadUserConfig(): Promise<UserConfigData> {
    try {
      const response = await apiFetch('/api/_info/config-me?keys[]=cmh-ai-chat', {
        method: 'GET',
        headers: getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Failed to load user config: ${response.status}`)
      }

      const json = await response.json()
      const configData = json.data?.['cmh-ai-chat']
      if (configData && typeof configData === 'object') {
        const fontScale = ALLOWED_FONT_SCALES.includes(configData.fontScale) ? configData.fontScale : undefined
        const ttsEngine = ALLOWED_TTS_ENGINES.includes(configData.ttsEngine) ? configData.ttsEngine : undefined

        return {
          theme: configData.theme,
          pins: Array.isArray(configData.pins) ? configData.pins : [],
          modelByHarness: (configData.modelByHarness && typeof configData.modelByHarness === 'object') ? configData.modelByHarness : {},
          fontScale,
          ttsEngine,
          ttsVoice: configData.ttsVoice,
          ttsSpeaker: typeof configData.ttsSpeaker === 'string' ? configData.ttsSpeaker : undefined,
          ttsStyle: typeof configData.ttsStyle === 'string' ? configData.ttsStyle : undefined,
          autoRead: typeof configData.autoRead === 'boolean' ? configData.autoRead : undefined,
        }
      }
    } catch (err) {
      console.error('Failed to load user config:', err)
      throw err
    }
    return {}
  }

  async function saveUserConfig(config: UserConfigData): Promise<void> {
    try {
      const response = await apiFetch('/api/_info/config-me', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          'cmh-ai-chat': config,
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to save user config: ${response.status}`)
      }
    } catch (err) {
      console.error('Failed to save user config:', err)
      onError?.('Failed to save settings', err)
    }
  }

  async function searchDalById(route: string, id: string): Promise<any> {
    const response = await apiFetch(route, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids: [id], limit: 1 }),
    })
    if (!response.ok) return null
    const json = await response.json()
    return json.data?.[0] || null
  }

  function fetchDalProduct(id: string): Promise<any> {
    return searchDalById('/api/search/product', id)
  }

  function fetchDalOrder(id: string): Promise<any> {
    return searchDalById('/api/search/order', id)
  }

  function fetchDalCustomer(id: string): Promise<any> {
    return searchDalById('/api/search/customer', id)
  }

  function fetchDalApproval(id: string): Promise<any> {
    return searchDalById('/api/search/cmh-ai-approval', id)
  }

  async function fetchTtsVoices(): Promise<TtsVoicesData> {
    const fallbackSpeakers = ['Sohee', 'Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna']
    const fallbackStyles = ['neutral', 'warm', 'bright', 'calm']
    const fallbackDefaults = { ko: 'Sohee', en: 'Ryan', de: 'Ryan' }

    try {
      const response = await apiFetch('/api/_action/cmh-ai/tts/voices', {
        method: 'GET',
        headers: getHeaders(),
      })
      if (!response.ok) {
        return { speakers: fallbackSpeakers, styles: fallbackStyles, defaultSpeakers: fallbackDefaults }
      }
      const json = (await response.json()) as {
        speakers?: unknown
        styles?: unknown
        defaultSpeakers?: Record<string, string> | null
      }
      const extractName = (s: unknown): string => {
        if (typeof s === 'string') return s
        if (s && typeof s === 'object') {
          const item = s as { id?: unknown; name?: unknown }
          if (typeof item.id === 'string' && item.id) return item.id
          if (typeof item.name === 'string' && item.name) return item.name
        }
        return ''
      }

      const speakers = Array.isArray(json.speakers)
        ? json.speakers.map((s: unknown) => extractName(s)).filter(Boolean)
        : fallbackSpeakers

      const styles = Array.isArray(json.styles)
        ? json.styles.map((s: unknown) => extractName(s)).filter(Boolean)
        : fallbackStyles

      const defaultSpeakers = (json.defaultSpeakers && typeof json.defaultSpeakers === 'object')
        ? json.defaultSpeakers
        : fallbackDefaults

      return { speakers, styles, defaultSpeakers }
    } catch (err) {
      console.error('Failed to fetch TTS voices:', err)
      return { speakers: fallbackSpeakers, styles: fallbackStyles, defaultSpeakers: fallbackDefaults }
    }
  }

  async function requestTtsSynthesis(
    messageId: string,
    speaker?: string | null,
    style?: string | null,
    locale?: string | null,
    signal?: AbortSignal,
  ): Promise<TtsManifestData> {
    const body: Record<string, string> = {}
    if (speaker) body.speaker = speaker
    if (style) body.style = style
    if (locale) body.locale = locale

    const response = await apiFetch(`/api/_action/cmh-ai/tts/message/${messageId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw Object.assign(
        new Error(err.message || `TTS synthesis request failed: ${response.status}`),
        { status: response.status },
      )
    }

    return response.json()
  }

  async function getTtsManifest(
    messageId: string,
    speaker?: string | null,
    style?: string | null,
    locale?: string | null,
    signal?: AbortSignal,
  ): Promise<TtsManifestData> {
    const query = new URLSearchParams()
    if (speaker) query.set('speaker', speaker)
    if (style) query.set('style', style)
    if (locale) query.set('locale', locale)
    const queryStr = query.toString() ? `?${query.toString()}` : ''

    const response = await apiFetch(`/api/_action/cmh-ai/tts/message/${messageId}${queryStr}`, {
      method: 'GET',
      headers: getHeaders(),
      signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw Object.assign(
        new Error(err.message || `TTS manifest fetch failed: ${response.status}`),
        { status: response.status },
      )
    }

    return response.json()
  }

  async function fetchAudioBlobUrl(url: string, signal?: AbortSignal): Promise<string> {
    const response = await apiFetch(url, {
      method: 'GET',
      headers: getHeaders(),
      signal,
    })

    if (!response.ok) {
      throw Object.assign(
        new Error(`Failed to load audio stream: ${response.status}`),
        { status: response.status },
      )
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  return {
    fetchBootstrap,
    fetchConversations,
    createConversation,
    uploadChatFile,
    fetchChatFileBlob,
    sendChatMessage,
    pollConversationEvents,
    stopConversationRun,
    decideApproval,
    sendTalkMessage,
    loadUserConfig,
    saveUserConfig,
    fetchDalProduct,
    fetchDalOrder,
    fetchDalCustomer,
    fetchDalApproval,
    fetchTtsVoices,
    requestTtsSynthesis,
    getTtsManifest,
    fetchAudioBlobUrl,
  }
}

