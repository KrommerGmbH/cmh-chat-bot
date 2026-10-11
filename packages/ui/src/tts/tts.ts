import type { ChatClient, TtsEngineType, TtsManifestData, TtsVoicesData } from '@cmh/chat-core'
import { toast } from 'vue-sonner'

export type { TtsEngineType }

export interface TtsVoiceItem {
  id: string
  name: string
  lang: string
  isDefault: boolean
}

export interface TtsHandlers {
  onPreparing?: () => void
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: unknown) => void
  onFallback?: (reason: string) => void
}

export interface TtsSpeakOptions {
  messageId?: string
  speaker?: string | null
  style?: string | null
  voiceId?: string | null
  locale?: string
  fallbackNotice?: string
  onFallback?: (reason: string) => void
}

export interface TtsEngine {
  isReady(): boolean
  listVoices(locale?: string): Promise<TtsVoiceItem[]>
  speak(
    text: string,
    voiceOrOptions?: string | null | TtsSpeakOptions,
    handlers?: TtsHandlers,
    locale?: string,
  ): Promise<void> | void
  stop(): void
}

export class BrowserTtsEngine implements TtsEngine {
  isReady(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  async listVoices(locale?: string): Promise<TtsVoiceItem[]> {
    if (!this.isReady()) {
      return []
    }

    const rawVoices = await this.getRawVoices()
    const targetLocale = (locale || '').toLowerCase().replace('_', '-')
    const langPrefix = targetLocale.split('-')[0] || ''

    const scored = rawVoices.map((voice) => {
      const vLang = voice.lang.toLowerCase().replace('_', '-')
      const vName = voice.name.toLowerCase()
      const isNatural = vName.includes('natural') || vName.includes('online')

      let score = 0
      if (targetLocale && vLang === targetLocale) {
        score = isNatural ? 40 : 30
      } else if (langPrefix && vLang.startsWith(langPrefix)) {
        score = isNatural ? 25 : 20
      } else if (isNatural) {
        score = 10
      } else {
        score = 0
      }

      return {
        item: {
          id: voice.voiceURI || voice.name,
          name: voice.name,
          lang: voice.lang,
          isDefault: voice.default,
        },
        score,
      }
    })

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.item.name.localeCompare(b.item.name)
    })

    return scored.map(s => s.item)
  }

  speak(
    text: string,
    voiceOrOptions?: string | null | TtsSpeakOptions,
    handlers?: TtsHandlers,
    localeParam?: string,
  ): void {
    if (!this.isReady()) {
      handlers?.onEnd?.()
      return
    }

    this.stop()

    const trimmed = text.trim()
    if (!trimmed) {
      handlers?.onEnd?.()
      return
    }

    const voiceId = typeof voiceOrOptions === 'string' ? voiceOrOptions : voiceOrOptions?.voiceId
    const locale = (typeof voiceOrOptions === 'object' && voiceOrOptions?.locale) || localeParam

    const utterance = new SpeechSynthesisUtterance(trimmed)
    if (locale) {
      utterance.lang = locale
    }
    const voices = window.speechSynthesis.getVoices()

    if (voiceId) {
      const matched = voices.find(v => (v.voiceURI || v.name) === voiceId || v.name === voiceId)
      if (matched) {
        utterance.voice = matched
      }
    } else if (locale) {
      const targetPrefix = locale.toLowerCase().split('-')[0]
      const sorted = [...voices].sort((a, b) => {
        const aLang = a.lang.toLowerCase().replace('_', '-')
        const bLang = b.lang.toLowerCase().replace('_', '-')
        const aScore = aLang === locale.toLowerCase() ? 2 : (aLang.startsWith(targetPrefix) ? 1 : 0)
        const bScore = bLang === locale.toLowerCase() ? 2 : (bLang.startsWith(targetPrefix) ? 1 : 0)
        return bScore - aScore
      })
      if (sorted.length > 0 && sorted[0].lang.toLowerCase().startsWith(targetPrefix)) {
        utterance.voice = sorted[0]
      }
    }

    utterance.onstart = () => {
      handlers?.onStart?.()
    }

    utterance.onend = () => {
      handlers?.onEnd?.()
    }

    utterance.onerror = (err) => {
      handlers?.onError?.(err)
    }

    window.speechSynthesis.speak(utterance)
  }

  stop(): void {
    if (this.isReady()) {
      window.speechSynthesis.cancel()
    }
  }

  private getRawVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        resolve(voices)
        return
      }

      let done = false
      const onVoicesChanged = () => {
        if (done) return
        done = true
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
        resolve(window.speechSynthesis.getVoices())
      }

      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
      setTimeout(() => {
        if (done) return
        done = true
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
        resolve(window.speechSynthesis.getVoices())
      }, 1000)
    })
  }
}

const FIRST_SEGMENT_TIMEOUT_MS = 60000
const NEXT_SEGMENT_TIMEOUT_MS = 60000

export class ServerTtsEngine implements TtsEngine {
  private audioElement: HTMLAudioElement | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  private stallTimer: ReturnType<typeof setTimeout> | null = null
  private stopCurrentSessionPoll: (() => void) | null = null
  private activeBlobUrls: string[] = []
  private sessionId = 0
  private currentAbortController: AbortController | null = null
  private currentPlayingIndex = 0
  private segmentsQueue: Array<{ index: number, ready: boolean, url?: string, text?: string }> = []
  private isCurrentlyPlaying = false
  private isManifestDone = false
  private hasFirstSegmentStarted = false
  private lastReadySegmentCount = 0
  private readonly fallbackEngine: BrowserTtsEngine
  private readonly client: ChatClient

  constructor(fallbackEngine: BrowserTtsEngine, client: ChatClient) {
    this.fallbackEngine = fallbackEngine
    this.client = client
  }

  isReady(): boolean {
    return true
  }

  async listVoices(_locale?: string): Promise<TtsVoiceItem[]> {
    try {
      const voicesData = await this.client.fetchTtsVoices()
      const defaultList = Object.values(voicesData.defaultSpeakers || {})
      return voicesData.speakers.map(s => ({
        id: s,
        name: s,
        lang: 'auto',
        isDefault: defaultList.includes(s),
      }))
    } catch {
      return []
    }
  }

  speak(
    text: string,
    voiceOrOptions?: string | null | TtsSpeakOptions,
    handlers?: TtsHandlers,
    localeParam?: string,
  ): void {
    this.stop()

    const trimmed = text.trim()
    if (!trimmed) {
      handlers?.onEnd?.()
      return
    }

    const session = ++this.sessionId
    const abortController = new AbortController()
    this.currentAbortController = abortController
    const signal = abortController.signal

    this.isManifestDone = false
    this.currentPlayingIndex = 0
    this.segmentsQueue = []
    this.isCurrentlyPlaying = false
    this.hasFirstSegmentStarted = false
    this.lastReadySegmentCount = 0
    this.clearStallTimer()

    const options: TtsSpeakOptions = typeof voiceOrOptions === 'object' && voiceOrOptions !== null
      ? voiceOrOptions
      : {
          speaker: typeof voiceOrOptions === 'string' ? voiceOrOptions : null,
          locale: localeParam,
        }

    const messageId = options.messageId
    const locale = options.locale || localeParam || 'ko-KR'
    const fallbackNotice = options.fallbackNotice || 'Server TTS unavailable. Playing with browser voice.'

    if (!messageId) {
      this.triggerFallback(
        text,
        options,
        handlers,
        locale,
        fallbackNotice,
        'No messageId provided for server TTS',
      )
      return
    }

    const speaker = options.speaker || undefined
    const style = options.style || 'neutral'

    handlers?.onPreparing?.()

    this.timeoutTimer = setTimeout(() => {
      if (session !== this.sessionId) return
      if (!this.isCurrentlyPlaying && this.currentPlayingIndex === 0) {
        this.triggerFallback(
          text,
          options,
          handlers,
          locale,
          fallbackNotice,
          `Server TTS timed out after ${FIRST_SEGMENT_TIMEOUT_MS / 1000} seconds`,
        )
      }
    }, FIRST_SEGMENT_TIMEOUT_MS)

    void this.executeSynthesis(session, signal, messageId, speaker, style, text, options, handlers, locale, fallbackNotice)
  }

  private async executeSynthesis(
    session: number,
    signal: AbortSignal,
    messageId: string,
    speaker: string | undefined,
    style: string,
    text: string,
    options: TtsSpeakOptions,
    handlers?: TtsHandlers,
    locale?: string,
    fallbackNotice?: string,
  ) {
    let manifest: TtsManifestData

    try {
      manifest = await this.client.requestTtsSynthesis(messageId, speaker, style, locale, signal)
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError' || session !== this.sessionId) return
      this.clearTimeoutTimer()
      const status = (err as { status?: number })?.status ?? 500
      if (status >= 400 && status < 500) {
        this.stop()
        handlers?.onError?.(err)
        return
      }
      this.triggerFallback(
        text,
        options,
        handlers,
        locale,
        fallbackNotice,
        `Server synthesis failed with HTTP ${status}`,
      )
      return
    }

    if (session !== this.sessionId) return

    const pollSpeaker = manifest.speaker ?? speaker

    this.processManifestSegments(session, signal, manifest, text, options, handlers, locale, fallbackNotice)

    // 캐시 적중: POST 응답이 이미 done 이면 GET 을 보내지 않는다(그 GET 의 5xx 가 재생을 끊지 않게)
    if (manifest.status === 'done') {
      this.isManifestDone = true
      this.clearStallTimer()
      return
    }

    let pollTimeoutHandle: ReturnType<typeof setTimeout> | null = null
    let isPollStopped = false

    const clearLocalPoll = () => {
      isPollStopped = true
      if (pollTimeoutHandle !== null) {
        clearTimeout(pollTimeoutHandle)
        pollTimeoutHandle = null
      }
    }
    this.stopCurrentSessionPoll = clearLocalPoll

    const poll = async () => {
      if (isPollStopped || session !== this.sessionId) {
        clearLocalPoll()
        return
      }

      try {
        const updated = await this.client.getTtsManifest(messageId, pollSpeaker, style, locale, signal)
        if (isPollStopped || session !== this.sessionId) {
          clearLocalPoll()
          return
        }

        this.processManifestSegments(session, signal, updated, text, options, handlers, locale, fallbackNotice)

        if (updated.status === 'failed') {
          clearLocalPoll()
          this.clearStallTimer()
          this.triggerFallback(
            text,
            options,
            handlers,
            locale,
            fallbackNotice,
            updated.error || 'Server TTS synthesis failed',
          )
          return
        }

        if (updated.status === 'done') {
          this.isManifestDone = true
          clearLocalPoll()
          this.clearStallTimer()
          const allSegmentsDone = this.currentPlayingIndex >= (updated.segments?.length || 0) && !this.isCurrentlyPlaying
          if (allSegmentsDone) {
            this.clearTimeoutTimer()
            handlers?.onEnd?.()
          }
          return
        }

        if (!isPollStopped && session === this.sessionId) {
          pollTimeoutHandle = setTimeout(poll, 1000)
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError' || session !== this.sessionId || isPollStopped) {
          clearLocalPoll()
          return
        }
        const status = (err as { status?: number })?.status ?? 500
        if (status >= 400 && status < 500) {
          this.stop()
          handlers?.onError?.(err)
          return
        }
        if (status >= 500 || status === 0) {
          clearLocalPoll()
          this.clearStallTimer()
          this.triggerFallback(
            text,
            options,
            handlers,
            locale,
            fallbackNotice,
            `Polling manifest failed with HTTP ${status}`,
          )
        }
      }
    }

    pollTimeoutHandle = setTimeout(poll, 1000)
  }

  private processManifestSegments(
    session: number,
    signal: AbortSignal,
    manifest: TtsManifestData,
    text: string,
    options: TtsSpeakOptions,
    handlers?: TtsHandlers,
    locale?: string,
    fallbackNotice?: string,
  ) {
    if (!manifest.segments || manifest.segments.length === 0) return

    this.segmentsQueue = manifest.segments.map(s => ({
      index: s.index,
      text: s.text,
      ready: Boolean(s.ready),
      url: s.url,
    }))

    const readyCount = manifest.segments.filter(s => s.ready).length
    if (manifest.status === 'done') {
      this.clearStallTimer()
    } else if ((manifest.status === 'queued' || manifest.status === 'running') && this.hasFirstSegmentStarted) {
      if (readyCount > this.lastReadySegmentCount) {
        this.resetStallTimer(session, text, options, handlers, locale, fallbackNotice)
      }
    }
    this.lastReadySegmentCount = readyCount

    if (!this.isCurrentlyPlaying && session === this.sessionId) {
      void this.playNextSegmentIfReady(session, signal, text, options, handlers, locale, fallbackNotice)
    }
  }

  private async playNextSegmentIfReady(
    session: number,
    signal: AbortSignal,
    text: string,
    options: TtsSpeakOptions,
    handlers?: TtsHandlers,
    locale?: string,
    fallbackNotice?: string,
  ) {
    if (session !== this.sessionId || this.isCurrentlyPlaying) return

    const nextSegment = this.segmentsQueue.find(s => s.index === this.currentPlayingIndex && s.ready && s.url)
    if (!nextSegment || !nextSegment.url) return

    this.clearTimeoutTimer()
    this.isCurrentlyPlaying = true

    if (this.currentPlayingIndex === 0) {
      this.hasFirstSegmentStarted = true
      handlers?.onStart?.()
      if (!this.isManifestDone) {
        this.resetStallTimer(session, text, options, handlers, locale, fallbackNotice)
      }
    }

    let blobUrl: string | null = null

    try {
      blobUrl = await this.client.fetchAudioBlobUrl(nextSegment.url, signal)
    } catch (fetchErr: unknown) {
      if ((fetchErr as { name?: string })?.name === 'AbortError' || session !== this.sessionId) return
      this.isCurrentlyPlaying = false
      this.triggerFallback(
        text,
        options,
        handlers,
        locale,
        fallbackNotice,
        'Audio segment fetch failed',
      )
      return
    }

    if (session !== this.sessionId) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      return
    }

    this.activeBlobUrls.push(blobUrl)

    if (!this.audioElement) {
      this.audioElement = new Audio()
    }

    const audio = this.audioElement
    audio.src = blobUrl

    audio.onended = () => {
      if (session !== this.sessionId) return
      this.isCurrentlyPlaying = false
      this.currentPlayingIndex += 1
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        this.activeBlobUrls = this.activeBlobUrls.filter(u => u !== blobUrl)
      }

      if (session === this.sessionId) {
        const hasMore = this.segmentsQueue.some(s => s.index === this.currentPlayingIndex && s.ready && s.url)
        if (hasMore) {
          void this.playNextSegmentIfReady(session, signal, text, options, handlers, locale, fallbackNotice)
        } else if (this.isManifestDone && this.currentPlayingIndex >= this.segmentsQueue.length) {
          this.clearTimeoutTimer()
          this.clearStallTimer()
          handlers?.onEnd?.()
        }
      }
    }

    audio.onerror = () => {
      if (session !== this.sessionId) return
      this.isCurrentlyPlaying = false
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        this.activeBlobUrls = this.activeBlobUrls.filter(u => u !== blobUrl)
      }
      this.triggerFallback(
        text,
        options,
        handlers,
        locale,
        fallbackNotice,
        'Audio element error',
      )
    }

    try {
      await audio.play()
    } catch (playErr: unknown) {
      if ((playErr as { name?: string })?.name === 'AbortError' || session !== this.sessionId) return
      this.isCurrentlyPlaying = false
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        this.activeBlobUrls = this.activeBlobUrls.filter(u => u !== blobUrl)
      }
      this.triggerFallback(
        text,
        options,
        handlers,
        locale,
        fallbackNotice,
        'Audio play error',
      )
    }
  }

  private triggerFallback(
    text: string,
    options: TtsSpeakOptions,
    handlers?: TtsHandlers,
    locale?: string,
    fallbackNotice?: string,
    reason?: string,
  ) {
    const remainingSegments = this.segmentsQueue.filter(s => s.index >= this.currentPlayingIndex)
    const remainingTexts = remainingSegments
      .map(s => s.text)
      .filter((t): t is string => Boolean(t && t.trim()))
    const fallbackText = remainingTexts.length > 0 ? remainingTexts.join(' ') : text

    this.stop()
    console.warn(`Falling back to browser TTS: ${reason}`)

    if (fallbackNotice) {
      toast.info(fallbackNotice)
    }

    handlers?.onFallback?.(reason || 'Server TTS error')
    options.onFallback?.(reason || 'Server TTS error')

    this.fallbackEngine.speak(fallbackText, options.voiceId, handlers, locale)
  }

  private clearTimeoutTimer() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }

  private clearStallTimer() {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer)
      this.stallTimer = null
    }
  }

  private resetStallTimer(
    session: number,
    text: string,
    options: TtsSpeakOptions,
    handlers?: TtsHandlers,
    locale?: string,
    fallbackNotice?: string,
  ) {
    this.clearStallTimer()
    this.stallTimer = setTimeout(() => {
      if (session !== this.sessionId) return
      if (!this.isManifestDone) {
        this.triggerFallback(
          text,
          options,
          handlers,
          locale,
          fallbackNotice,
          `Next TTS segment timed out after ${NEXT_SEGMENT_TIMEOUT_MS / 1000} seconds`,
        )
      }
    }, NEXT_SEGMENT_TIMEOUT_MS)
  }

  stop(): void {
    this.sessionId += 1
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
    }

    if (this.stopCurrentSessionPoll) {
      this.stopCurrentSessionPoll()
      this.stopCurrentSessionPoll = null
    }

    this.fallbackEngine.stop()

    this.isCurrentlyPlaying = false
    this.isManifestDone = false
    this.hasFirstSegmentStarted = false
    this.lastReadySegmentCount = 0
    this.clearTimeoutTimer()
    this.clearStallTimer()

    if (this.audioElement) {
      this.audioElement.onended = null
      this.audioElement.onerror = null
      this.audioElement.pause()
      this.audioElement.removeAttribute('src')
      this.audioElement.load()
    }

    for (const url of this.activeBlobUrls) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    }
    this.activeBlobUrls = []
  }
}

// Qwen3-TTS 0.6B on-device (onnxruntime-web / Electron / Capacitor) — PLAN §18-4
export class DeviceTtsEngine implements TtsEngine {
  isReady(): boolean {
    return false
  }

  async listVoices(): Promise<TtsVoiceItem[]> {
    return []
  }

  speak(_text: string, _voiceOrOptions?: string | null | TtsSpeakOptions, handlers?: TtsHandlers): void {
    handlers?.onEnd?.()
  }

  stop(): void {
    // No-op
  }
}

export class TtsServiceManager {
  private currentEngineType: TtsEngineType = 'server'
  private readonly browserEngine = new BrowserTtsEngine()
  private readonly deviceEngine = new DeviceTtsEngine()
  private readonly serverEngine: ServerTtsEngine
  private readonly client: ChatClient

  /** The API client is injected, so the service never talks to a hard-coded host. */
  constructor(client: ChatClient) {
    this.client = client
    this.serverEngine = new ServerTtsEngine(this.browserEngine, client)
  }

  getEngine(type: TtsEngineType = this.currentEngineType): TtsEngine {
    if (type === 'browser') {
      return this.browserEngine
    }
    if (type === 'device') {
      return this.deviceEngine
    }
    return this.serverEngine
  }

  getEngineType(): TtsEngineType {
    return this.currentEngineType
  }

  setEngine(type: TtsEngineType) {
    this.currentEngineType = type
  }

  isReady(type?: TtsEngineType): boolean {
    return this.getEngine(type).isReady()
  }

  listVoices(locale?: string, type?: TtsEngineType): Promise<TtsVoiceItem[]> {
    return this.getEngine(type).listVoices(locale)
  }

  async loadServerVoices(): Promise<TtsVoicesData> {
    return this.client.fetchTtsVoices()
  }

  speak(
    text: string,
    voiceOrOptions?: string | null | TtsSpeakOptions,
    handlers?: TtsHandlers,
    type?: TtsEngineType,
    locale?: string,
  ) {
    return this.getEngine(type).speak(text, voiceOrOptions, handlers, locale)
  }

  stop(type?: TtsEngineType): void {
    if (type) {
      this.getEngine(type).stop()
      return
    }
    this.serverEngine.stop()
    this.browserEngine.stop()
    this.deviceEngine.stop()
  }
}
