<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import EditableApproval from './EditableApproval.vue'
import {
  type DraftReplyPartEmit,
  type DraftReplyPartProps,
  useDraftReplyPart,
} from './DraftReplyPart'

const props = withDefaults(
  defineProps<DraftReplyPartProps>(),
  {
    isRunAnswered: true,
  },
)

const emit = defineEmits<DraftReplyPartEmit>()
const {
  t,
  isSubmitting,
  decision,
  loadedApproval,
  errorMessage,
  dispatchWarning,
  sendFailed,
  handleApprove,
  handleRetrySend,
  handleReject,
} = useDraftReplyPart(props, emit)
</script>

<template>
  <div class="my-3 max-w-lg">
    <EditableApproval
      :approval-id="approvalId"
      :initial-text="text"
      test-id-prefix="draft"
      :summary="t('draftReplyTitle')"
      :decision="decision"
      :gate-tool="loadedApproval?.form?.gateTool"
      :approve-label="t('approveAndSend')"
      :reject-label="t('reject')"
      approve-icon="send"
      :is-submitting="isSubmitting"
      :error-message="errorMessage"
      :dispatch-warning="dispatchWarning"
      :retry-label="sendFailed ? t('retrySend') : undefined"
      :is-run-answered="isRunAnswered"
      @approve="handleApprove"
      @reject="handleReject"
      @retry="handleRetrySend"
    />

    <!-- Optional Evidence list -->
    <div
      v-if="evidence && evidence.length > 0"
      class="mt-2 flex flex-col gap-1 rounded-lg border bg-muted/20 p-2.5 text-[11px] text-muted-foreground"
    >
      <div class="flex items-center gap-1 font-medium text-foreground">
        <ChatIcon name="appDoc" class="size-3.5 text-primary" />
        <span>Evidence</span>
      </div>
      <ul class="list-disc pl-4 space-y-0.5">
        <li v-for="(item, idx) in evidence" :key="idx">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>
