import type { ChatUploadedFile } from '@cmh/chat-core'
import { useChatContext } from '@cmh/chat-core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** Types that are safe to show inline in a new tab. Everything else (html, svg, ...) is downloaded. */
const INLINE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
])

export function shouldOpenInline(mimeType: string): boolean {
  const base = String(mimeType || '').split(';')[0]!.trim().toLowerCase()
  return INLINE_MIME_TYPES.has(base)
}

export interface ChatFileChipProps {
  file: ChatUploadedFile
}

export function useChatFileChip(props: ChatFileChipProps) {
  const { client } = useChatContext()
  const blobUrl = ref<string | null>(null)
  const isLoading = ref<boolean>(false)
  const openInline = ref<boolean>(false)

  function formatFileSize(bytes?: number): string {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Each load gets a token; a result of an older load (or after unmount) is discarded and its blob URL revoked.
  let requestToken = 0
  let isUnmounted = false

  async function loadBlob() {
    const token = ++requestToken
    if (blobUrl.value) {
      URL.revokeObjectURL(blobUrl.value)
      blobUrl.value = null
    }
    if (!props.file.url) {
      isLoading.value = false
      return
    }
    isLoading.value = true
    try {
      const blob = await client.fetchChatFileBlob(props.file.url)
      if (isUnmounted || token !== requestToken) return
      openInline.value = shouldOpenInline(blob.type)
      blobUrl.value = URL.createObjectURL(blob)
    } catch (err) {
      if (!isUnmounted && token === requestToken) console.error('Failed to load file blob:', err)
    } finally {
      if (token === requestToken) isLoading.value = false
    }
  }

  onMounted(() => {
    void loadBlob()
  })

  watch(() => props.file.url, () => {
    void loadBlob()
  })

  onBeforeUnmount(() => {
    isUnmounted = true
    requestToken++
    if (blobUrl.value) {
      URL.revokeObjectURL(blobUrl.value)
      blobUrl.value = null
    }
  })

  return {
    blobUrl,
    isLoading,
    openInline,
    formatFileSize,
  }
}
