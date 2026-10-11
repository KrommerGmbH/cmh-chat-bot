import type { ToolUIPart } from 'ai'
import { chatSession, useChatContext, useI18n } from '@cmh/chat-core'
import { computed, onMounted, ref, watch } from 'vue'
import { formatApprovalTime } from './approvalTime'
import { readChanges } from './ApprovalChangesTable'
import { assertDecideOk, readDispatchWarning } from './decideResult'

/**
 * Same shape as `ToolUIPartApproval` of the confirmation primitive. That type lives in a deep file
 * (`confirmation/context`) that the primitives export map does not expose, so it is mirrored here.
 */
type ApprovalPayload = { id: string, approved?: never, reason?: never } | { id: string, approved: boolean, reason?: string } | undefined

/** Choice keys the server treats as a rejection (same list as the old admin card). */
const REJECT_CHOICE_KEYS = ['reject', 'rejected', 'skip', 'cancel']

export type ApprovalChoice = { key: string, label: string, multi?: boolean } | string

export interface ApprovalPartProps {
  approvalId: string
  reason?: string
  /** ISO creation time of the approval; shown as hour:minute next to the reason. */
  createdAt?: string
  summary?: string
  choices?: ApprovalChoice[]
  form?: Record<string, any> | null
  decision?: string
  isRunAnswered?: boolean
}

export type ApprovalPartEmit = {
  (e: 'decided', result: { id: string, chosen: string, warning?: string }): void
}

export function useApprovalPart(props: ApprovalPartProps, emit: ApprovalPartEmit) {
  const { t } = useI18n()
  const { client } = useChatContext()

  const effectiveId = computed(() => props.approvalId || '')
  const normalizeDecision = (value: string | undefined | null) => (value === 'pending' ? null : (value || null))
  const currentDecision = ref<string | null>(normalizeDecision(props.decision))
  // True once this component itself recorded a decision (not one that came in through the prop).
  let decidedLocally = false
  // Keep the live decision in sync when the same approval is also rendered elsewhere (pending list).
  watch(() => props.decision, (value) => {
    const next = normalizeDecision(value)
    // A prop that falls back to pending/undefined must not undo a decision made here (buttons would re-enable).
    if (next === null && decidedLocally) return
    currentDecision.value = next
  })
  // True while the initial approval fetch runs and choices were not passed by props: decisions stay disabled.
  const isLoading = ref(Boolean(props.approvalId) && !props.choices)
  const isSubmitting = ref(false)
  const loadedSummary = ref<string | null>(props.summary || null)
  const loadedReason = ref<string | null>(props.reason || null)
  const loadedCreatedAt = ref<string | null>(props.createdAt || null)
  const loadedChoices = ref<ApprovalChoice[] | null>(props.choices || null)
  const loadedForm = ref<Record<string, any> | null>(props.form || null)

  onMounted(async () => {
    if (props.approvalId) {
      try {
        const data = await client.fetchDalApproval(props.approvalId)
        if (data) {
          if (!loadedSummary.value && data.summary) {
            loadedSummary.value = data.summary
          }
          if (!loadedReason.value && data.reason) {
            loadedReason.value = data.reason
          }
          if (!loadedCreatedAt.value && data.createdAt) {
            loadedCreatedAt.value = data.createdAt
          }
          if (data.form) {
            loadedForm.value = data.form
          }
          if (Array.isArray(data.choices)) {
            loadedChoices.value = data.choices
          }
          if (data.decision && data.decision !== 'pending') {
            currentDecision.value = data.decision
          }
        }
      } catch (err) {
        console.warn('[ApprovalPart] fetch approval failed', err)
      } finally {
        isLoading.value = false
      }
    }
  })

  const errorMessage = ref<string>('')
  const dispatchWarning = ref<string>('')
  const note = ref<string>('')
  const checkedKeys = ref<Record<string, boolean>>({})

  const effectiveSummary = computed(() => loadedSummary.value || props.summary || '')
  const effectiveReason = computed(() => loadedReason.value || props.reason || '')
  const createdAtLabel = computed(() => formatApprovalTime(loadedCreatedAt.value || props.createdAt, chatSession.locale.value))
  const effectiveChoices = computed(() => loadedChoices.value || props.choices || [])
  const effectiveForm = computed(() => loadedForm.value || props.form || null)

  const editableText = computed<string | null>(() => {
    const f = effectiveForm.value
    if (!f) return null
    if (typeof f.editableText === 'string') return f.editableText
    if (typeof f.editable_text === 'string') return f.editable_text
    return null
  })

  // Text shown next to the multi-select (when the form also carries editable text).
  const editedText = ref<string>('')
  const editedTouched = ref(false)
  watch(editableText, (value) => {
    if (!editedTouched.value) editedText.value = value ?? ''
  }, { immediate: true })
  function setEditedText(value: string) {
    editedTouched.value = true
    editedText.value = value
  }

  const changes = computed(() => readChanges(effectiveForm.value))

  // Multi mode: any choice with `multi: true` switches the card to one checkbox per selectable choice.
  const isMulti = computed(() => effectiveChoices.value.some(c => typeof c !== 'string' && Boolean(c.multi)))

  // Reject keys are not selectable: they are sent only by the "reject all" button.
  const selectableChoices = computed(() => {
    return effectiveChoices.value
      .map(c => (typeof c === 'string' ? { key: c, label: c } : { key: c.key, label: c.label || c.key }))
      .filter(c => !REJECT_CHOICE_KEYS.includes(c.key.toLowerCase()))
  })

  // All boxes start checked. Choices that arrive later (loaded from the server) are checked too,
  // but boxes the user already toggled keep their state.
  watch(
    selectableChoices,
    (list) => {
      const next = { ...checkedKeys.value }
      for (const choice of list) {
        if (!(choice.key in next)) next[choice.key] = true
      }
      checkedKeys.value = next
    },
    { immediate: true },
  )

  const selectedKeys = computed(() => {
    return selectableChoices.value.filter(c => checkedKeys.value[c.key]).map(c => c.key)
  })

  function setChecked(key: string, value: boolean) {
    checkedKeys.value = { ...checkedKeys.value, [key]: value }
  }

  /** Shows a warning when the approval was saved but the follow-up tasks were not (all) created. */
  function applyDispatchWarning(result: any): string {
    const warning = readDispatchWarning(result, t)
    if (warning) dispatchWarning.value = warning
    return warning
  }

  const approveChoiceKey = computed(() => {
    const cList = effectiveChoices.value
    if (Array.isArray(cList) && cList.length > 0) {
      for (const c of cList) {
        const key = typeof c === 'string' ? c : c.key
        if (!['reject', 'rejected', 'skip', 'cancel'].includes(key.toLowerCase())) {
          return key
        }
      }
    }
    return 'approve'
  })

  const confirmationState = computed<ToolUIPart['state']>(() => {
    if (currentDecision.value) {
      return 'approval-responded'
    }
    return 'approval-requested'
  })

  const approvalPayload = computed<ApprovalPayload>(() => {
    if (currentDecision.value) {
      return {
        id: effectiveId.value,
        approved: currentDecision.value !== 'reject' && currentDecision.value !== 'rejected',
      }
    }
    return {
      id: effectiveId.value,
    }
  })

  const normalizedChoices = computed(() => {
    const cList = effectiveChoices.value
    if (!cList || cList.length === 0) {
      return [
        { key: 'approve', label: t('approve'), variant: 'default' },
        { key: 'reject', label: t('reject'), variant: 'destructive' },
      ]
    }

    return cList.map((c) => {
      if (typeof c === 'string') {
        const isReject = ['reject', 'rejected', 'skip', 'cancel'].includes(c.toLowerCase())
        return {
          key: isReject ? 'reject' : c,
          label: isReject ? t('reject') : (c === 'approve' ? t('approve') : c),
          variant: isReject ? 'destructive' : 'default',
        }
      }
      const isReject = ['reject', 'rejected', 'skip', 'cancel'].includes(c.key.toLowerCase())
      return {
        key: isReject ? 'reject' : c.key,
        label: c.label,
        variant: isReject ? 'destructive' : 'default',
      }
    })
  })

  async function handleDecide(key: string) {
    if (props.isRunAnswered === false) return
    if (!effectiveId.value || isSubmitting.value || isLoading.value) return
    errorMessage.value = ''
    dispatchWarning.value = ''
    isSubmitting.value = true

    const isReject = ['reject', 'rejected', 'skip', 'cancel'].includes(key.toLowerCase())
    const sendKey = isReject ? 'reject' : key

    try {
      const trimmedNote = note.value.trim()
      const result = await client.decideApproval(
        effectiveId.value,
        trimmedNote ? { chosen: sendKey, note: trimmedNote } : { chosen: sendKey },
      )
      assertDecideOk(result, t('decideFailed'))
      const warning = applyDispatchWarning(result)
      currentDecision.value = sendKey
      decidedLocally = true
      emit('decided', { id: effectiveId.value, chosen: sendKey, warning: warning || undefined })
    } catch (err: any) {
      if (err?.code === 'run_still_answering' || err?.response?.data?.code === 'run_still_answering') {
        errorMessage.value = t('runStillAnswering')
      } else {
        console.error('Failed to submit approval decision:', err)
        errorMessage.value = err?.message || t('decideFailed')
      }
    } finally {
      isSubmitting.value = false
    }
  }

  /** Multi mode: approve the checked choices, or reject all of them. */
  async function handleDecideMulti(isApproval: boolean) {
    if (props.isRunAnswered === false) return
    if (!effectiveId.value || isSubmitting.value || isLoading.value) return
    if (isApproval && selectedKeys.value.length === 0) return
    errorMessage.value = ''
    dispatchWarning.value = ''
    isSubmitting.value = true

    const selected = [...selectedKeys.value]
    const chosen = isApproval ? selected[0] : 'reject'
    const trimmedNote = note.value.trim()
    const payload: { chosen: string, note: string, chosenKeys?: string[], editedText?: string } = { chosen, note: trimmedNote }
    if (isApproval) {
      payload.chosenKeys = selected
      if (editableText.value !== null) payload.editedText = editedText.value
    }

    try {
      const result = await client.decideApproval(effectiveId.value, payload)
      assertDecideOk(result, t('decideFailed'))
      const warning = applyDispatchWarning(result)
      currentDecision.value = chosen
      decidedLocally = true
      emit('decided', { id: effectiveId.value, chosen, warning: warning || undefined })
    } catch (err: any) {
      if (err?.code === 'run_still_answering' || err?.response?.data?.code === 'run_still_answering') {
        errorMessage.value = t('runStillAnswering')
      } else {
        const serverMsg = err?.response?.data?.message || err?.message
        errorMessage.value = serverMsg || t('decideFailed')
        console.warn('[ApprovalPart] handleDecideMulti failed', err)
      }
    } finally {
      isSubmitting.value = false
    }
  }

  async function handleEditableApprove(payload: { id: string, editedText: string }) {
    if (props.isRunAnswered === false) return
    if (!effectiveId.value || isSubmitting.value || isLoading.value) return
    errorMessage.value = ''
    dispatchWarning.value = ''
    isSubmitting.value = true

    const key = approveChoiceKey.value
    try {
      const result = await client.decideApproval(effectiveId.value, key, '', undefined, payload.editedText)
      assertDecideOk(result, t('decideFailed'))
      const warning = applyDispatchWarning(result)
      currentDecision.value = key
      decidedLocally = true
      emit('decided', { id: effectiveId.value, chosen: key, warning: warning || undefined })
    } catch (err: any) {
      if (err?.code === 'run_still_answering' || err?.response?.data?.code === 'run_still_answering') {
        errorMessage.value = t('runStillAnswering')
      } else {
        const serverMsg = err?.response?.data?.message || err?.message
        errorMessage.value = serverMsg || t('decideFailed')
        console.warn('[ApprovalPart] decideApproval failed', err)
      }
    } finally {
      isSubmitting.value = false
    }
  }

  async function handleEditableReject(payload: { id: string, note?: string, editedText: string }) {
    if (props.isRunAnswered === false) return
    if (!effectiveId.value || isSubmitting.value || isLoading.value) return
    errorMessage.value = ''
    dispatchWarning.value = ''
    isSubmitting.value = true

    const key = 'reject'
    try {
      const result = await client.decideApproval(effectiveId.value, key, payload.note || '', undefined, payload.editedText)
      assertDecideOk(result, t('decideFailed'))
      const warning = applyDispatchWarning(result)
      currentDecision.value = key
      decidedLocally = true
      emit('decided', { id: effectiveId.value, chosen: key, warning: warning || undefined })
    } catch (err: any) {
      if (err?.code === 'run_still_answering' || err?.response?.data?.code === 'run_still_answering') {
        errorMessage.value = t('runStillAnswering')
      } else {
        const serverMsg = err?.response?.data?.message || err?.message
        errorMessage.value = serverMsg || t('decideFailed')
        console.warn('[ApprovalPart] handleEditableReject failed', err)
      }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    t,
    effectiveId,
    currentDecision,
    isSubmitting,
    isLoading,
    errorMessage,
    dispatchWarning,
    note,
    editedText,
    setEditedText,
    changes,
    isMulti,
    selectableChoices,
    checkedKeys,
    selectedKeys,
    setChecked,
    handleDecideMulti,
    effectiveSummary,
    effectiveReason,
    createdAtLabel,
    effectiveChoices,
    effectiveForm,
    editableText,
    approveChoiceKey,
    confirmationState,
    approvalPayload,
    normalizedChoices,
    handleDecide,
    handleEditableApprove,
    handleEditableReject,
  }
}
