import { useChatContext, useI18n } from '@cmh/chat-core'
import { computed, onMounted, ref } from 'vue'
import { assertDecideOk, readDispatchWarning } from './decideResult'

export interface DraftReplyPartProps {
  text: string
  approvalId: string
  threadId?: string
  evidence?: string[]
  isRunAnswered?: boolean
}

export type DraftReplyPartEmit = {
  (e: 'decided', result: { id: string, chosen: string, warning?: string }): void
}

export function useDraftReplyPart(props: DraftReplyPartProps, emit: DraftReplyPartEmit) {
  const { t } = useI18n()
  const { client } = useChatContext()

  const REJECT_KEYS = ['reject', 'rejected', 'skip', 'cancel']

  const isSubmitting = ref(false)
  const decision = ref<string | null>(null)
  const loadedApproval = ref<any>(null)
  const errorMessage = ref<string>('')
  const dispatchWarning = ref<string>('')
  const sendFailed = ref<boolean>(false)
  const lastApprovedText = ref<string>('')

  onMounted(async () => {
    if (props.approvalId) {
      try {
        const data = await client.fetchDalApproval(props.approvalId)
        if (data) {
          loadedApproval.value = data
          if (data.decision && data.decision !== 'pending') {
            decision.value = data.decision
          }
        }
      } catch (err) {
        console.warn('[DraftReplyPart] approval load failed', err)
      }
    }
  })

  const effectiveThreadId = computed<string>(() => {
    if (props.threadId) return props.threadId
    const appr = loadedApproval.value
    if (!appr) return ''
    if (appr.form?.threadId) return String(appr.form.threadId)
    if (appr.task?.payload) {
      let p: any = {}
      if (typeof appr.task.payload === 'string') {
        try {
          p = JSON.parse(appr.task.payload) || {}
        } catch (err) {
          console.warn('[DraftReplyPart] JSON.parse payload failed', err)
          p = {}
        }
      } else {
        p = appr.task.payload || {}
      }
      if (p.threadId) return String(p.threadId)
    }
    return ''
  })

  const approveKey = computed<string>(() => {
    const choices = loadedApproval.value?.choices
    if (Array.isArray(choices) && choices.length > 0) {
      for (const c of choices) {
        const key = typeof c === 'string' ? c : c.key
        if (!REJECT_KEYS.includes(key.toLowerCase())) {
          return key
        }
      }
    }
    return 'approve'
  })

  const rejectKey = computed<string>(() => 'reject')

  async function handleApprove(payload: { id: string, editedText: string }) {
    if (props.isRunAnswered === false) return
    if (!props.approvalId || isSubmitting.value) return
    errorMessage.value = ''
    sendFailed.value = false

    const thread = effectiveThreadId.value
    if (!thread) {
      errorMessage.value = t('noThread')
      return
    }

    isSubmitting.value = true
    lastApprovedText.value = payload.editedText
    const key = approveKey.value

    let warning = ''
    try {
      const result = await client.decideApproval(props.approvalId, {
        chosen: key,
        editedText: payload.editedText,
      })
      assertDecideOk(result, t('decideFailed'))
      warning = readDispatchWarning(result, t)
      dispatchWarning.value = warning
    } catch (err: any) {
      if (err?.code === 'run_still_answering' || err?.response?.data?.code === 'run_still_answering') {
        errorMessage.value = t('runStillAnswering')
      } else {
        const serverMsg = err?.response?.data?.message || err?.message
        errorMessage.value = serverMsg || t('decideFailed')
      }
      console.warn('[DraftReplyPart] decideApproval failed', err)
      isSubmitting.value = false
      return
    }

    decision.value = key
    emit('decided', { id: props.approvalId, chosen: key, warning: warning || undefined })

    try {
      await client.sendTalkMessage({
        threadId: thread,
        text: payload.editedText,
        approvalId: props.approvalId,
      })
      sendFailed.value = false
      errorMessage.value = ''
    } catch (err: any) {
      if (err?.status === 409) {
        // 이미 이 승인으로 보냈다 — 실패가 아니다
        sendFailed.value = false
        errorMessage.value = ''
        return
      }
      sendFailed.value = true
      errorMessage.value = t('sendFailed')
      console.warn('[DraftReplyPart] sendTalkMessage failed', err)
    } finally {
      isSubmitting.value = false
    }
  }

  async function handleRetrySend() {
    if (!props.approvalId || isSubmitting.value) return
    const thread = effectiveThreadId.value
    if (!thread) {
      errorMessage.value = t('noThread')
      return
    }

    isSubmitting.value = true
    errorMessage.value = ''

    try {
      await client.sendTalkMessage({
        threadId: thread,
        text: lastApprovedText.value || loadedApproval.value?.form?.editedText || props.text,
        approvalId: props.approvalId,
      })
      sendFailed.value = false
      errorMessage.value = ''
    } catch (err: any) {
      if (err?.status === 409) {
        // 이미 이 승인으로 보냈다 — 실패가 아니다
        sendFailed.value = false
        errorMessage.value = ''
        return
      }
      sendFailed.value = true
      errorMessage.value = t('sendFailed')
      console.warn('[DraftReplyPart] retry sendTalkMessage failed', err)
    } finally {
      isSubmitting.value = false
    }
  }

  async function handleReject(payload: { id: string, note?: string, editedText: string }) {
    if (props.isRunAnswered === false) return
    if (!props.approvalId || isSubmitting.value) return
    errorMessage.value = ''
    isSubmitting.value = true

    const key = 'reject'
    try {
      const result = await client.decideApproval(props.approvalId, {
        chosen: key,
        note: payload.note,
        editedText: payload.editedText,
      })
      assertDecideOk(result, t('decideFailed'))
      const warning = readDispatchWarning(result, t)
      dispatchWarning.value = warning

      decision.value = key
      emit('decided', { id: props.approvalId, chosen: key, warning: warning || undefined })
    } catch (err: any) {
      if (err?.code === 'run_still_answering' || err?.response?.data?.code === 'run_still_answering') {
        errorMessage.value = t('runStillAnswering')
      } else {
        const serverMsg = err?.response?.data?.message || err?.message
        errorMessage.value = serverMsg || t('decideFailed')
      }
      console.warn('[DraftReplyPart] handleReject failed', err)
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    t,
    isSubmitting,
    decision,
    loadedApproval,
    errorMessage,
    dispatchWarning,
    sendFailed,
    lastApprovedText,
    effectiveThreadId,
    approveKey,
    rejectKey,
    handleApprove,
    handleRetrySend,
    handleReject,
  }
}
