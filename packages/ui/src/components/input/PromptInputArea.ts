import type { AiModel, Harness, HubOnlyHarness } from '@cmh/chat-core'
import { chatSession, useChatContext, useI18n } from '@cmh/chat-core'
import type { AcceptableValue } from 'reka-ui'
import { computed, ref, watch } from 'vue'

export interface PromptInputAreaProps {
  harnesses: Harness[]
  selectedHarnessId: string | null
  models: AiModel[]
  modelByHarness: Record<string, string | null>
  hubOnlyHarnesses?: HubOnlyHarness[]
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  autoRead?: boolean
}

export type PromptInputAreaEmit = {
  (e: 'update:selectedHarnessId', id: string): void
  (e: 'update:modelByHarness', val: { harnessId: string, modelId: string | null }): void
  (e: 'send', payload: { text: string, files: File[], modelId: string | null }): void
  (e: 'update:autoRead', val: boolean): void
}

// File Attachments
interface AttachedFileItem {
  id: string
  rawFile: File
  name: string
  size: number
  isImage: boolean
  previewUrl: string | null
}

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
]
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.txt', '.csv']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES_COUNT = 5

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.includes(file.type)) {
    return true
  }
  const name = file.name.toLowerCase()
  return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext))
}

export function usePromptInputArea(props: PromptInputAreaProps, emit: PromptInputAreaEmit) {
  const speechButtonRef = ref<any>(null)
  const isSpeechRecording = ref(false)

  function handleRecordingChange(recording: boolean) {
    isSpeechRecording.value = recording
  }

  const isRecording = () => isSpeechRecording.value
  const stopRecording = () => speechButtonRef.value?.stopListening?.()

  const { t } = useI18n()
  const { host } = useChatContext()

  // Active Harness
  const activeHarness = computed(() => {
    return props.harnesses.find(h => h.id === props.selectedHarnessId || h.agentId === props.selectedHarnessId) || null
  })

  function handleHarnessChange(val: AcceptableValue) {
    if (typeof val === 'string') {
      emit('update:selectedHarnessId', val)
    }
  }

  // Native <select> (iframe): the same values as the reka Select, read from the DOM event.
  function handleNativeHarnessChange(event: Event) {
    handleHarnessChange((event.target as HTMLSelectElement).value)
  }

  // Model Selection
  const selectedModelId = ref<string>('__auto__')

  watch(
    [() => props.selectedHarnessId, () => props.modelByHarness],
    () => {
      const harnessKey = activeHarness.value?.id || props.selectedHarnessId
      if (harnessKey && props.modelByHarness[harnessKey]) {
        selectedModelId.value = props.modelByHarness[harnessKey] || '__auto__'
      } else {
        selectedModelId.value = '__auto__'
      }
    },
    { immediate: true },
  )

  function handleModelChange(val: AcceptableValue) {
    if (typeof val === 'string') {
      selectedModelId.value = val
      const harnessKey = activeHarness.value?.id || props.selectedHarnessId
      if (harnessKey) {
        emit('update:modelByHarness', {
          harnessId: harnessKey,
          modelId: val === '__auto__' ? null : val,
        })
      }
    }
  }

  function handleNativeModelChange(event: Event) {
    handleModelChange((event.target as HTMLSelectElement).value)
  }

  const defaultHarnessModelLabel = computed(() => {
    const modelId = activeHarness.value?.modelId
    if (!modelId) return ''
    const m = props.models.find(model => model.id === modelId)
    return m?.label ?? activeHarness.value?.modelLabel ?? ''
  })

  const modelsByProvider = computed(() => {
    const grouped: Record<string, AiModel[]> = {}
    for (const m of props.models) {
      const provider = m.providerName || m.providerCode || 'Other'
      if (!grouped[provider]) {
        grouped[provider] = []
      }
      grouped[provider].push(m)
    }
    return grouped
  })

  const selectedModelDisplayLabel = computed(() => {
    if (selectedModelId.value === '__auto__') {
      return defaultHarnessModelLabel.value
        ? `${t('autoModel')} (${defaultHarnessModelLabel.value})`
        : t('autoModel')
    }
    const m = props.models.find(item => item.id === selectedModelId.value)
    return m ? m.label : selectedModelId.value
  })

  /** False when the stored model id is not in the list: the native select then shows a placeholder. */
  const isSelectedModelListed = computed(() => {
    return selectedModelId.value === '__auto__' || props.models.some(item => item.id === selectedModelId.value)
  })

  const fileInputRef = ref<HTMLInputElement | null>(null)
  const attachedFiles = ref<AttachedFileItem[]>([])
  const attachmentError = ref<string | null>(null)

  function triggerFileInput() {
    attachmentError.value = null
    fileInputRef.value?.click()
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function addAttachedFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return

    attachmentError.value = null

    const incoming = Array.from(files)
    const filesToAdd: File[] = []
    let firstDuplicateName: string | null = null

    for (const file of incoming) {
      const isDuplicate = attachedFiles.value.some(f => f.name === file.name && f.size === file.size)
        || filesToAdd.some(f => f.name === file.name && f.size === file.size)
      if (isDuplicate) {
        if (!firstDuplicateName) {
          firstDuplicateName = file.name
        }
        continue
      }
      filesToAdd.push(file)
    }

    if (filesToAdd.length === 0) {
      if (firstDuplicateName) {
        attachmentError.value = t('fileDuplicate', { name: firstDuplicateName })
      }
      return
    }

    if (attachedFiles.value.length + filesToAdd.length > MAX_FILES_COUNT) {
      attachmentError.value = t('fileLimitExceeded')
      return
    }

    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i]
      if (!isAllowedFile(file)) {
        attachmentError.value = t('fileInvalidType')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        attachmentError.value = t('fileSizeExceeded')
        return
      }
    }

    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i]
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      const isImage = file.type.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)
      const previewUrl = isImage ? URL.createObjectURL(file) : null
      attachedFiles.value.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        rawFile: file,
        name: file.name,
        size: file.size,
        isImage,
        previewUrl,
      })
    }

    if (firstDuplicateName) {
      attachmentError.value = t('fileDuplicate', { name: firstDuplicateName })
    }
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      addAttachedFiles(input.files)
    }
    input.value = ''
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    if (props.disabled) return
    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      addAttachedFiles(files)
    }
  }

  function handlePaste(event: ClipboardEvent) {
    if (props.disabled) return
    const files = event.clipboardData?.files
    if (files && files.length > 0) {
      event.preventDefault()
      event.stopImmediatePropagation()
      addAttachedFiles(files)
    }
  }

  function removeAttachedFile(id: string) {
    const idx = attachedFiles.value.findIndex(f => f.id === id)
    if (idx !== -1) {
      const item = attachedFiles.value[idx]
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
      attachedFiles.value.splice(idx, 1)
    }
    if (attachedFiles.value.length === 0) {
      attachmentError.value = null
    }
  }

  function clearAllAttachments() {
    for (const f of attachedFiles.value) {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl)
      }
    }
    attachedFiles.value = []
    attachmentError.value = null
  }

  // Submit handling — Antigravity style: AI가 작업 중일 때도 전송하면 큐(Queued Messages)에 담긴다
  function handleSubmit(payload: { text?: string }) {
    const text = payload.text?.trim() || ''
    if ((!text && attachedFiles.value.length === 0) || props.disabled) {
      return
    }
    if (isSpeechRecording.value) {
      speechButtonRef.value?.stopListening?.()
    }
    speechButtonRef.value?.resetBaseText?.()

    const modelId = selectedModelId.value === '__auto__' ? null : selectedModelId.value
    const files = attachedFiles.value.map(f => f.rawFile)

    emit('send', { text, files, modelId })
    clearAllAttachments()
  }

  return {
    t,
    host,
    chatSession,
    handleNativeHarnessChange,
    handleNativeModelChange,
    speechButtonRef,
    handleRecordingChange,
    isRecording,
    stopRecording,
    activeHarness,
    handleHarnessChange,
    selectedModelId,
    handleModelChange,
    defaultHarnessModelLabel,
    modelsByProvider,
    selectedModelDisplayLabel,
    isSelectedModelListed,
    fileInputRef,
    attachedFiles,
    attachmentError,
    triggerFileInput,
    formatFileSize,
    handleFileChange,
    handleDrop,
    handlePaste,
    removeAttachedFile,
    handleSubmit,
  }
}
