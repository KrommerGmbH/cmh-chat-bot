import { useI18n } from '@cmh/chat-core'
import { computed, ref, watch } from 'vue'

import type { IconName } from '@cmh/chat-primitives/icons'
import type { ApprovalChange } from './ApprovalChangesTable'

export interface EditableApprovalProps {
  approvalId: string
  initialText: string
  summary?: string
  reason?: string
  /** Preformatted creation time (hour:minute); empty renders nothing. */
  createdAtLabel?: string
  /** Prefix of the stable data-testid attributes of the buttons. */
  testIdPrefix?: string
  decision?: string | null
  approveLabel?: string
  rejectLabel?: string
  approveIcon?: IconName | null
  isSubmitting?: boolean
  errorMessage?: string
  retryLabel?: string
  gateTool?: string | null
  isRunAnswered?: boolean
  /** Before/after rows (`form.changes`), shown above the text in pending and decided state. */
  changes?: ApprovalChange[]
  /** Warning shown when the approval was saved but follow-up tasks were not (all) created. */
  dispatchWarning?: string
}

export type EditableApprovalEmit = {
  (e: 'approve', payload: { id: string, editedText: string }): void
  (e: 'reject', payload: { id: string, note?: string, editedText: string }): void
  (e: 'retry'): void
}

export function useEditableApproval(props: EditableApprovalProps, emit: EditableApprovalEmit) {
  const { t } = useI18n()

  const currentText = ref<string>(props.initialText || '')
  const rejectNote = ref<string>('')
  const showRejectReasonInput = ref<boolean>(false)
  const localDecision = ref<string | null>(props.decision === 'pending' ? null : (props.decision || null))

  watch(
    () => props.initialText,
    (newVal) => {
      if (!isDecided.value && currentText.value === '') {
        currentText.value = newVal || ''
      }
    },
  )

  watch(
    () => props.decision,
    (newVal) => {
      localDecision.value = newVal === 'pending' ? null : (newVal || null)
    },
  )

  const isEdited = computed<boolean>(() => {
    return currentText.value !== (props.initialText || '')
  })

  const isDecided = computed<boolean>(() => {
    return Boolean(localDecision.value && localDecision.value !== 'pending')
  })

  const isApproved = computed<boolean>(() => {
    if (!localDecision.value) return false
    const dec = localDecision.value.toLowerCase()
    return dec !== 'reject' && dec !== 'rejected' && dec !== 'skip' && dec !== 'cancelled'
  })

  function confirmApprove() {
    if (props.isRunAnswered === false) return
    if (currentText.value.trim() === '') return
    if (isDecided.value || props.isSubmitting) return
    emit('approve', {
      id: props.approvalId,
      editedText: currentText.value,
    })
  }

  function confirmReject() {
    if (props.isRunAnswered === false) return
    if (isDecided.value || props.isSubmitting) return
    emit('reject', {
      id: props.approvalId,
      note: rejectNote.value.trim() !== '' ? rejectNote.value.trim() : undefined,
      editedText: currentText.value,
    })
  }

  return {
    t,
    currentText,
    rejectNote,
    showRejectReasonInput,
    localDecision,
    isEdited,
    isDecided,
    isApproved,
    confirmApprove,
    confirmReject,
  }
}
