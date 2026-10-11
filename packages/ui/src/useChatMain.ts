import type {
  ChatChannel,
  ChatClient,
  ChatMessage,
  ChatUploadedFile,
  ChatUsage,
  Conversation,
  Harness,
  HostBridge,
  AiModel,
  PollEventsResponse,
  QueuedMessage,
  Transport,
  TransportEventMeta,
} from '@cmh/chat-core'
import {
  chatSession,
  createChatStore,
  PollingTransport,
  setSessionTheme,
  useApprovals,
  useI18n,
} from '@cmh/chat-core'
import { toast } from 'vue-sonner'
import {
  computed,
  type MaybeRefOrGetter,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRefs,
  toValue,
  watch,
} from 'vue'
import { applyDefaultAppearance, applyTheme } from './appearance'
import { useTts } from './composables/useTts'
import { useUserConfig } from './composables/useUserConfig'
import { generateLocalSmartReply } from './local/localSmartReply'
import { TtsServiceManager } from './tts/tts'

export interface UseChatMainOptions {
  client: ChatClient
  host: HostBridge
  /** Defaults to `new PollingTransport({ client })`. */
  transport?: Transport
  channel?: ChatChannel
  /** Reactive: pass `toRef(props, 'flowId')` (or a getter) so changes are followed. */
  flowId?: MaybeRefOrGetter<string | null | undefined>
  /** True in the standalone iframe bundle: theme and font scale are written to <html>/<body>. */
  ownsDocument?: boolean
  /** Always use the narrow layout (sidebar overlays the chat), for example in a side dock. */
  forceNarrow?: boolean
}

export function useChatMain(options: UseChatMainOptions) {
  const { client, host } = options
  // The local harness, local conversation and local smart reply exist only for a host with local capabilities.
  const hasLocalBridge = Boolean(host.infer || host.browserAct || host.getTabsContext)
  // Conversations with this id prefix live in the browser only: they are never polled against the server.
  const LOCAL_SESSION_PREFIX = 'local_session_'
  const isLocalSession = (id: string | null) => Boolean(id && id.startsWith(LOCAL_SESSION_PREFIX))
  const { t } = useI18n()
  const transport: Transport = options.transport ?? new PollingTransport({ client })
  const tts = new TtsServiceManager(client)
  const channel = computed<ChatChannel>(() => options.channel ?? chatSession.channel.value ?? 'admin')

  // spokenMessageIds lives in useTts (created below); the store callback runs only after setup.
  const store = createChatStore({
    onAssistantMessage: (msg, meta) => {
      if (meta.isFirstPoll) {
        spokenMessageIds.add(msg.id)
      } else if (autoRead.value && msg.content && !spokenMessageIds.has(msg.id)) {
        spokenMessageIds.add(msg.id)
        playAssistantMessageTts(msg)
      }
    },
  })

  // App State — the chat store is the single source of truth for everything, pending approvals included.
  const {
    bootstrapFailed,
    harnesses,
    hubOnlyHarnesses,
    models,
    selectedHarnessId,
    currentUserId,
    conversations,
    activeConversationId,
    messages,
    pendingApprovals,
    runStatus,
    // 실행이 실패하면 그 까닭을 입력칸 위에 보인다 — 안 보이면 사람은 답을 하염없이 기다린다(2026-10-06 실측: 429 로 0.4초 만에 실패했는데 화면은 3분 넘게 빈칸)
    runError,
    currentRunId,
  } = toRefs(store)
  // 좁은 창(어드민 오른쪽 패널 · 모바일)에서는 대화 목록이 채팅 칸을 밀지 않고 위에 겹친다 — 처음엔 닫힘
  const NARROW_QUERY = '(max-width: 767px)'
  const NARROW_MAX_WIDTH = 767
  const forceNarrow = options.forceNarrow === true
  // The width of the view itself decides (not the window): the chat also runs inside a dock, a drawer or a split pane.
  const rootElement = ref<HTMLElement | null>(null)
  const hasResizeObserver = typeof ResizeObserver !== 'undefined'
  // Fallback for environments without ResizeObserver: the window width, as before.
  const narrowMedia = !hasResizeObserver && typeof window !== 'undefined' ? window.matchMedia(NARROW_QUERY) : null
  const isNarrow = ref<boolean>(forceNarrow || (narrowMedia?.matches ?? false))
  const isSidebarOpen = ref<boolean>(!isNarrow.value)
  function setNarrow(matches: boolean) {
    const next = forceNarrow || matches
    if (next === isNarrow.value) return
    isNarrow.value = next
    isSidebarOpen.value = !next
  }
  function handleNarrowChange(event: MediaQueryListEvent) {
    setNarrow(event.matches)
  }
  let rootResizeObserver: ResizeObserver | null = null
  const isSubmitting = ref<boolean>(false)
  const copiedMessageId = ref<string | null>(null)
  const promptInputRef = ref<any>(null)
  const queuedMessages = ref<QueuedMessage[]>([])

  const isSoloMode = computed(() => chatSession.mode.value === 'solo')

  // Composables
  const {
    pinnedIds,
    modelByHarness,
    fontScale,
    ttsEngine,
    ttsVoice,
    ttsSpeaker,
    ttsStyle,
    autoRead,
    applyFontScale,
    handleFontScaleChange,
    handleTtsEngineChange,
    handleTtsVoiceChange,
    handleTtsSpeakerChange,
    handleTtsStyleChange,
    handleAutoReadChange,
    flushPersistUserConfig,
    persistUserConfig,
    isConfigLoaded,
    markConfigLoaded,
    togglePin,
    unpin,
    hasPersistTimer,
  } = useUserConfig({
    client,
    tts,
    ownsDocument: options.ownsDocument,
    onStopTts: () => stopTts(),
    onLoadVoices: () => { void loadVoices() },
    onAutoReadEnabled: () => {
      for (const m of messages.value) {
        if (m.role === 'assistant') {
          spokenMessageIds.add(m.id)
        }
      }
    },
  })

  const {
    activeTtsMessageId,
    isTtsPreparing,
    availableVoices,
    availableSpeakers,
    availableStyles,
    defaultSpeakerForLocale,
    spokenMessageIds,
    loadVoices,
    playAssistantMessageTts,
    toggleTts,
    stopTts,
  } = useTts({ tts, ttsVoice, ttsEngine, ttsSpeaker, ttsStyle })

  // Pending approvals: the store's `pendingApprovals` ref is the single source of truth.
  const {
    checkIsRunAnswered,
    getApprovalPropsForPart,
    handleApprovalDecided: removeDecidedApproval,
  } = useApprovals({
    messages,
    runStatus,
    pendingApprovals,
    onPollOnce: () => { if (!isLocalSession(activeConversationId.value)) void transport.pollNow() },
  })

  // A dispatch warning must outlive the card: the card is removed from the pending list right after `decided`.
  function handleApprovalDecided(result: { id: string, chosen: string, warning?: string }) {
    if (result.warning) toast.warning(result.warning)
    removeDecidedApproval(result)
  }

  // Pending approvals that no loaded message already renders as an `approval` / `draft_reply` part.
  const standalonePendingApprovals = computed(() => {
    const renderedIds = new Set<string>()
    for (const m of messages.value) {
      for (const part of m.parts ?? []) {
        if (part.type === 'approval' || part.type === 'draft_reply') {
          const id = part.props?.approvalId
          if (id) renderedIds.add(String(id))
        }
      }
    }
    return pendingApprovals.value.filter(a => !renderedIds.has(a.id))
  })

  // Poll answer → store (messages, run status, approvals). Seed: composables/usePolling.ts pollOnce.
  const offTransportEvents = transport.onEvents((response: PollEventsResponse, meta: TransportEventMeta) => {
    store.applyPollResponse(response, meta)
  })

  /** Reserve a local seq for an optimistic message (seed: usePolling.incrementMessageSeq). */
  function nextLocalSeq(): number {
    const withSeq = transport as Transport & { incrementMessageSeq?: () => number }
    if (typeof withSeq.incrementMessageSeq === 'function') {
      return withSeq.incrementMessageSeq()
    }
    return messages.value.reduce((max, m) => Math.max(max, m.seq), 0) + 1
  }

  function handleVisibilityChange() {
    if (typeof document !== 'undefined' && !document.hidden && activeConversationId.value && !isLocalSession(activeConversationId.value)) {
      void transport.pollNow()
    }
  }

  const activeHarness = computed(() => {
    return (
      harnesses.value.find(
        h => h.id === selectedHarnessId.value || h.agentId === selectedHarnessId.value,
      ) || null
    )
  })

  const selectedModelLabel = computed(() => {
    const harnessKey = activeHarness.value?.id || selectedHarnessId.value
    const mId = harnessKey ? modelByHarness.value[harnessKey] : null
    if (!mId) return null
    const found = models.value.find(m => m.id === mId)
    return found?.label || null
  })

  function handleBackToSplit() {
    host.backToSplit()
  }

  function handleGlobalKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return

    if (promptInputRef.value?.isRecording?.()) {
      promptInputRef.value.stopRecording()
      event.preventDefault()
      return
    }

    if (event.defaultPrevented) return
    if (typeof document !== 'undefined' && document.querySelector('[data-dismissable-layer]')) {
      return
    }

    const isHubApp = typeof navigator !== 'undefined' && Boolean(navigator.userAgent?.includes('CmhHubApp/'))
    if (isSoloMode.value && !isHubApp) {
      handleBackToSplit()
    }
  }

  const pinnedConversations = computed(() => {
    return conversations.value.filter(c => pinnedIds.value.includes(c.id))
  })

  const isRunning = computed(() => {
    return runStatus.value === 'running' || runStatus.value === 'queued' || isSubmitting.value
  })

  function enqueueMessage(payload: { text: string; files?: File[]; modelId?: string | null }) {
    queuedMessages.value.push({
      id: `qm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: payload.text,
      files: payload.files || [],
      modelId: payload.modelId || null,
      createdAt: Date.now(),
    })
  }

  function removeQueuedMessage(id: string) {
    queuedMessages.value = queuedMessages.value.filter(m => m.id !== id)
  }

  function clearQueuedMessages() {
    queuedMessages.value = []
  }

  async function dispatchNextQueuedMessage() {
    if (isRunning.value || queuedMessages.value.length === 0 || !activeConversationId.value) {
      return
    }
    const next = queuedMessages.value.shift()
    if (!next) return
    await nextTick()
    void handleSendMessage({
      text: next.text,
      files: next.files,
      modelId: next.modelId,
    })
  }

  // AI 가 작업(run)을 완료하여 isRunning 이 false 가 되면 대기열(Queued Messages)의 다음 프롬프트를 자동 전송한다
  watch(isRunning, (nowRunning, wasRunning) => {
    if (wasRunning && !nowRunning) {
      void dispatchNextQueuedMessage()
    }
  })

  /** Failure of creating a conversation or sending a message. Own ref: the next poll overwrites `runError`. */
  const sendError = ref<string | null>(null)

  let hasSignalledReady = false

  async function initializeApp() {
    bootstrapFailed.value = false
    // The host handshake (CMH_CHAT_READY) starts before the wait: the parent sends the init data in answer.
    if (!hasSignalledReady) {
      hasSignalledReady = true
      host.ready()
    }

    if (!chatSession.isReady.value) {
      await new Promise<void>((resolve) => {
        const unwatch = watch(
          () => chatSession.isReady.value,
          (ready) => {
            if (ready) {
              unwatch()
              resolve()
            }
          },
        )
      })
    }

    try {
      const config = await client.loadUserConfig()
      if (config.theme) {
        setSessionTheme(config.theme)
      }
      if (config.pins && Array.isArray(config.pins)) {
        pinnedIds.value = config.pins
      }
      if (config.modelByHarness && typeof config.modelByHarness === 'object') {
        modelByHarness.value = config.modelByHarness
      }
      if (config.fontScale) {
        fontScale.value = config.fontScale
        applyFontScale(config.fontScale)
      }
      const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
      if (config.ttsEngine === 'device') {
        ttsEngine.value = 'server'
        tts.setEngine('server')
      } else if (config.ttsEngine === 'browser' && !hasSpeechSynthesis) {
        ttsEngine.value = 'server'
        tts.setEngine('server')
      } else if (config.ttsEngine) {
        ttsEngine.value = config.ttsEngine
        tts.setEngine(config.ttsEngine)
      } else {
        ttsEngine.value = 'server'
        tts.setEngine('server')
      }
      if (config.ttsVoice !== undefined) {
        ttsVoice.value = config.ttsVoice
      }
      if (config.ttsSpeaker !== undefined) {
        ttsSpeaker.value = config.ttsSpeaker
      }
      if (config.ttsStyle !== undefined) {
        ttsStyle.value = config.ttsStyle
      }
      if (typeof config.autoRead === 'boolean') {
        autoRead.value = config.autoRead
      }
      // Saving is allowed only after a successful load. After a failure nothing is persisted in this
      // session (the stored config would be overwritten with defaults) until a retry of the load succeeds.
      markConfigLoaded()
    } catch {
      // Config loading failed: keep defaults, do not call markConfigLoaded().
    }

    const DEFAULT_LOCAL_HARNESS: Harness = {
      id: 'router_default',
      name: 'Smart Router',
      agentId: 'router',
      agentCode: 'Router',
      description: '로컬 모델 및 자동 라우팅 엔진',
      modelId: 'gemma4',
      modelLabel: 'Gemma 4 (Local)',
    }

    const DEFAULT_LOCAL_MODELS: AiModel[] = [
      { id: 'gemma4', providerCode: 'local', providerName: 'Local Engine', code: 'gemma4', label: 'Gemma 4 (Local)', free: true },
      { id: 'laya', providerCode: 'local', providerName: 'Local Engine', code: 'laya', label: 'Laya 8B (Local)', free: true },
      { id: 'router', providerCode: 'local', providerName: 'Local Engine', code: 'router', label: 'Smart Router (Auto)', free: true },
    ]

    try {
      const bootstrap = await client.fetchBootstrap()
      currentUserId.value = bootstrap.userId
      // Without local capabilities an empty server answer stays empty (the view shows its own empty-harness state).
      harnesses.value = Array.isArray(bootstrap.harnesses) && bootstrap.harnesses.length > 0
        ? bootstrap.harnesses
        : (hasLocalBridge ? [DEFAULT_LOCAL_HARNESS] : [])
      hubOnlyHarnesses.value = bootstrap.hubOnlyHarnesses || []
      models.value = Array.isArray(bootstrap.models) && bootstrap.models.length > 0
        ? bootstrap.models
        : (hasLocalBridge ? DEFAULT_LOCAL_MODELS : [])

      if (!selectedHarnessId.value && harnesses.value.length > 0) {
        selectedHarnessId.value = harnesses.value[0].id
      }
      bootstrapFailed.value = false
    } catch (err) {
      if (!hasLocalBridge) {
        // No local capabilities: show the error state (with retry), create no fake harness or conversation, do not poll.
        console.warn('Remote bootstrap failed:', err)
        bootstrapFailed.value = true
        return
      }
      console.warn('Remote bootstrap unavailable. Falling back to Local Router and Models:', err)
      // 서버 연결 실패 시에도 에러로 멈추지 않고 로컬 스마트 라우터 및 로컬 모델(Laya, Gemma4)로 즉시 활성화
      harnesses.value = [DEFAULT_LOCAL_HARNESS]
      models.value = DEFAULT_LOCAL_MODELS
      selectedHarnessId.value = DEFAULT_LOCAL_HARNESS.id
      bootstrapFailed.value = false
    }

    await loadConversationsList()
  }

  // Only the newest list request may write: a slow answer for a previous harness must not replace the current list.
  let conversationListRequest = 0
  async function loadConversationsList() {
    const requestId = ++conversationListRequest
    const activeIdAtStart = activeConversationId.value
    try {
      const agentId = activeHarness.value?.agentId
      const list = await client.fetchConversations(agentId)
      if (requestId !== conversationListRequest) return
      const activeId = activeConversationId.value
      const createdMeanwhile = activeId && activeId !== activeIdAtStart && !list.some(c => c.id === activeId)
        ? conversations.value.find(c => c.id === activeId)
        : undefined
      conversations.value = createdMeanwhile ? [createdMeanwhile, ...list] : list

      // A conversation the user opened or created while the list was loading is not in this list yet: keep it.
      const activeChangedMeanwhile = activeId !== activeIdAtStart
      if (activeId && !activeChangedMeanwhile && !isLocalSession(activeId) && !list.some(c => c.id === activeId)) {
        // The active conversation belongs to the previous harness: the next message must not go to it.
        transport.stop()
        stopTts()
        spokenMessageIds.clear()
        activeConversationId.value = null
        messages.value = []
        clearQueuedMessages()
        pendingApprovals.value = []
        runStatus.value = null
        runError.value = null
        sendError.value = null
        currentRunId.value = null
      }

      if (!activeConversationId.value && list.length > 0) {
        selectConversation(list[0].id)
      }
    } catch (err) {
      console.warn('Failed to load conversations from server. Using local session:', err)
    }

    // 대화방이 없으면 즉시 기본 로컬 대화방 생성하여 활성화 (입력창 잠김 방지) — 로컬 기능이 있는 호스트만
    if (hasLocalBridge && conversations.value.length === 0) {
      const localId = `local_session_${Date.now()}`
      const fallbackConv: Conversation = {
        id: localId,
        agentId: activeHarness.value?.agentId || 'router',
        title: '로컬 테스트 대화',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      conversations.value = [fallbackConv]
      selectConversation(localId)
    }
  }

  function selectConversation(id: string) {
    if (isNarrow.value) isSidebarOpen.value = false
    if (activeConversationId.value === id) return

    stopTts()
    spokenMessageIds.clear()
    activeConversationId.value = id
    messages.value = []
    clearQueuedMessages()
    pendingApprovals.value = []
    transport.reset()
    runStatus.value = null
    runError.value = null
    sendError.value = null
    currentRunId.value = null

    if (isLocalSession(id)) {
      // A local session has no server run: stop the timer still polling the previous server conversation.
      transport.stop()
      return
    }
    transport.start(id)
    void transport.pollNow()
  }

  async function handleNewConversation() {
    if (!activeHarness.value) {
      transport.stop()
      stopTts()
      spokenMessageIds.clear()
      activeConversationId.value = null
      messages.value = []
      clearQueuedMessages()
      pendingApprovals.value = []
      runError.value = null
      sendError.value = null
      return
    }

    try {
      const created = await client.createConversation({
        agentId: activeHarness.value.agentId,
        userId: currentUserId.value,
        capabilityId: activeHarness.value.capabilityId,
        title: t('newChat'),
      })

      conversations.value.unshift(created)
      selectConversation(created.id)
    } catch (err) {
      console.error('Failed to create new conversation:', err)
      const message = err instanceof Error && err.message ? err.message : t('runFailed')
      sendError.value = message
      toast.error(message)
    }
  }

  function handleModelChange(payload: { harnessId: string, modelId: string | null }) {
    modelByHarness.value[payload.harnessId] = payload.modelId
    persistUserConfig()
  }

  const visibleMessages = computed(() => {
    return messages.value.filter(m => !m.hidden)
  })

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function hasVisibleUsage(usage?: ChatUsage | null): boolean {
    if (!usage) return false
    return Boolean(
      (usage.inputTokens != null && usage.outputTokens != null) ||
      usage.totalTokens != null ||
      usage.durationMs != null ||
      (usage.cost !== null && usage.cost !== undefined),
    )
  }

  function formatUsageTokens(usage?: ChatUsage | null): string {
    if (!usage) return ''
    const locale = chatSession.locale.value || 'ko-KR'
    const formatter = new Intl.NumberFormat(locale)
    if (usage.inputTokens != null && usage.outputTokens != null) {
      return `${t('inputTokens')} ${formatter.format(usage.inputTokens)} · ${t('outputTokens')} ${formatter.format(usage.outputTokens)}`
    }
    if (usage.totalTokens != null) {
      return `${formatter.format(usage.totalTokens)} ${t('tokenUsage')}`
    }
    return ''
  }

  function formatCost(cost: number, currency?: string | null): string {
    const curr = currency || 'USD'
    return `${cost} ${curr}`
  }

  function formatNumber(num?: number | null): string {
    if (num == null) return '0'
    const locale = chatSession.locale.value || 'ko-KR'
    return new Intl.NumberFormat(locale).format(num)
  }

  async function handleSendMessage(payloadOrText: string | { text: string, files: File[], modelId: string | null }) {
    stopTts()
    let content = ''
    let files: File[] = []
    let modelId: string | null = null

    if (typeof payloadOrText === 'string') {
      content = payloadOrText
      const harnessKey = activeHarness.value?.id || selectedHarnessId.value
      modelId = harnessKey ? (modelByHarness.value[harnessKey] || null) : null
    } else {
      content = payloadOrText.text
      files = payloadOrText.files || []
      modelId = payloadOrText.modelId
    }

    // Antigravity style: AI가 작업 중일 때는 즉시 전송하지 않고 QUEUED MESSAGES에 담는다
    if (isRunning.value) {
      enqueueMessage({ text: content, files, modelId })
      return
    }

    sendError.value = null
    if (!activeConversationId.value && activeHarness.value) {
      await handleNewConversation()
    }

    if (!activeConversationId.value) return

    // 1. Upload files first
    let uploadedFiles: ChatUploadedFile[] = []
    if (files.length > 0) {
      isSubmitting.value = true
      try {
        for (const file of files) {
          const uploaded = await client.uploadChatFile(file)
          uploadedFiles.push(uploaded)
        }
      } catch (err) {
        console.error('File upload failed:', err)
        toast.error(t('fileUploadFailed'))
        isSubmitting.value = false
        return
      }
    }

    const userMsgId = `temp_${Date.now()}`
    messages.value.push({
      id: userMsgId,
      seq: nextLocalSeq(),
      role: 'user',
      kind: 'text',
      content,
      files: uploadedFiles,
      createdAt: new Date().toISOString(),
    })

    isSubmitting.value = true
    runStatus.value = 'running'
    runError.value = null

    try {
      const attachments = uploadedFiles.map(f => ({ mediaId: f.mediaId }))
      await client.sendChatMessage(activeConversationId.value, content, modelId, attachments)
      if (!isLocalSession(activeConversationId.value)) void transport.pollNow()
    } catch (err) {
      if (!hasLocalBridge) {
        // Never fabricate an answer: drop the optimistic message and show the real error.
        console.error('Message dispatch failed:', err)
        messages.value = messages.value.filter(m => m.id !== userMsgId)
        runStatus.value = 'failed'
        const message = err instanceof Error && err.message ? err.message : t('runFailed')
        sendError.value = message
        toast.error(message)
        return
      }
      console.warn('Server message dispatch failed. Generating local router response:', err)
      const replyContent = await generateLocalSmartReply(host, models.value, content, modelId)
      messages.value.push({
        id: `local_reply_${Date.now()}`,
        seq: nextLocalSeq(),
        role: 'assistant',
        kind: 'text',
        content: replyContent,
        createdAt: new Date().toISOString(),
      })
      runStatus.value = 'idle'
    } finally {
      isSubmitting.value = false
    }
  }

  async function handleStopRun() {
    if (!activeConversationId.value) return
    try {
      await client.stopConversationRun(activeConversationId.value)
      runStatus.value = 'stopped'
    } catch (err) {
      console.error('Failed to stop run:', err)
    }
  }

  function copyMessageText(msg: ChatMessage) {
    const text = msg.content || ''
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return

    navigator.clipboard.writeText(text).then(() => {
      copiedMessageId.value = msg.id
      setTimeout(() => {
        copiedMessageId.value = null
      }, 2000)
    })
  }

  watch(selectedHarnessId, () => {
    void loadConversationsList()
  })

  watch(
    () => chatSession.theme.value,
    () => {
      // The theme set by the host init before the config load is not a user change.
      if (isConfigLoaded.value) persistUserConfig()
    },
  )

  // Only a view that owns the document (standalone iframe bundle) writes the theme to <html>/<body>.
  if (options.ownsDocument) {
    applyDefaultAppearance()
    watch(() => chatSession.theme.value, theme => applyTheme(theme), { immediate: true })
  }

  onMounted(() => {
    narrowMedia?.addEventListener('change', handleNarrowChange)
    if (hasResizeObserver && rootElement.value) {
      setNarrow(rootElement.value.clientWidth <= NARROW_MAX_WIDTH)
      rootResizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width
        // A hidden view reports width 0: keep the layout it had.
        if (typeof width === 'number' && width > 0) setNarrow(width <= NARROW_MAX_WIDTH)
      })
      rootResizeObserver.observe(rootElement.value)
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    void initializeApp()
    void loadVoices()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  onBeforeUnmount(() => {
    narrowMedia?.removeEventListener('change', handleNarrowChange)
    rootResizeObserver?.disconnect()
    rootResizeObserver = null
    window.removeEventListener('keydown', handleGlobalKeyDown)
    offTransportEvents()
    transport.stop()
    stopTts()
    if (hasPersistTimer()) {
      flushPersistUserConfig()
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  return {
    t,
    chatSession,
    channel,
    flowId: computed(() => toValue(options.flowId) ?? null),
    host,
    bootstrapFailed,
    harnesses,
    hubOnlyHarnesses,
    models,
    modelByHarness,
    selectedHarnessId,
    currentUserId,
    conversations,
    activeConversationId,
    pinnedIds,
    messages,
    pendingApprovals,
    standalonePendingApprovals,
    runStatus,
    runError,
    sendError,
    currentRunId,
    isNarrow,
    rootElement,
    isSidebarOpen,
    isSubmitting,
    copiedMessageId,
    activeTtsMessageId,
    isTtsPreparing,
    fontScale,
    ttsEngine,
    ttsVoice,
    ttsSpeaker,
    ttsStyle,
    autoRead,
    availableVoices,
    availableSpeakers,
    availableStyles,
    defaultSpeakerForLocale,
    promptInputRef,
    isSoloMode,
    selectedModelLabel,
    activeHarness,
    pinnedConversations,
    isRunning,
    queuedMessages,
    removeQueuedMessage,
    clearQueuedMessages,
    visibleMessages,
    formatFileSize,
    hasVisibleUsage,
    formatUsageTokens,
    formatCost,
    formatNumber,
    handleFontScaleChange,
    handleTtsEngineChange,
    handleTtsVoiceChange,
    handleTtsSpeakerChange,
    handleTtsStyleChange,
    handleAutoReadChange,
    handleBackToSplit,
    checkIsRunAnswered,
    getApprovalPropsForPart,
    initializeApp,
    selectConversation,
    handleNewConversation,
    handleModelChange,
    handleSendMessage,
    handleStopRun,
    copyMessageText,
    toggleTts,
    togglePin,
    unpin,
    handleApprovalDecided,
  }
}
