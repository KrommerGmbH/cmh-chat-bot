<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Button } from '@cmh/chat-primitives/ui/button'
import { Textarea } from '@cmh/chat-primitives/ui/textarea'
import ApprovalChangesTable from './ApprovalChangesTable.vue'
import {
  type EditableApprovalEmit,
  type EditableApprovalProps,
  useEditableApproval,
} from './EditableApproval'

const props = withDefaults(
  defineProps<EditableApprovalProps>(),
  {
    summary: '',
    reason: '',
    createdAtLabel: '',
    testIdPrefix: 'editable',
    decision: null,
    approveLabel: '',
    rejectLabel: '',
    approveIcon: null,
    isSubmitting: false,
    errorMessage: '',
    retryLabel: '',
    gateTool: null,
    isRunAnswered: true,
    changes: () => [],
    dispatchWarning: '',
  },
)

const emit = defineEmits<EditableApprovalEmit>()
const {
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
} = useEditableApproval(props, emit)
</script>

<template>
  <div class="my-3 w-full min-w-0 max-w-lg rounded-xl border border-primary/20 bg-card p-3 shadow-2xs">
    <!-- Header -->
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ChatIcon name="fileEdit" class="size-4 text-primary shrink-0" />
        <span>{{ summary || t('approvalTitle') }}</span>
      </div>
      <Badge
        v-if="isEdited"
        variant="secondary"
        class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[0.8125rem]"
      >
        {{ t('edited') }}
      </Badge>
    </div>

    <!-- Reason if present -->
    <div v-if="reason" class="mb-2 text-[0.8125rem] text-muted-foreground">
      <span class="font-medium text-foreground">{{ t('approvalReason') }}:</span> {{ reason }}
      <time v-if="createdAtLabel" data-testid="approval-time" class="ml-1.5 text-[0.6875rem] text-muted-foreground">{{ createdAtLabel }}</time>
    </div>

    <!-- Gate tool if present -->
    <div v-if="gateTool" class="mb-2 text-[0.8125rem] text-muted-foreground">
      <span class="font-medium text-foreground">{{ t('willRun') }}:</span> {{ gateTool }}
    </div>

    <!-- Before / after table (pending and decided) -->
    <div v-if="changes.length > 0" class="mb-2">
      <ApprovalChangesTable :changes="changes" />
    </div>

    <!-- Editable Textarea -->
    <div class="flex flex-col gap-1">
      <Textarea
        v-model="currentText"
        :disabled="isDecided || isSubmitting"
        :readonly="isDecided"
        :maxlength="10000"
        class="min-h-24 resize-y text-xs leading-relaxed"
      />
      <div class="flex items-center justify-between text-[0.8125rem] text-muted-foreground">
        <span />
        <span>{{ currentText.length }} / 10000</span>
      </div>
    </div>

    <!-- Actions (Pending State) -->
    <div v-if="!isDecided" class="mt-3 flex flex-col gap-2 border-t pt-2.5">
      <div
        v-if="props.isRunAnswered === false"
        class="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400 font-medium"
      >
        {{ t('waitingForAnswer') }}
      </div>

      <!-- Reject Reason Input (Optional expansion) -->
      <div v-if="showRejectReasonInput" class="flex items-center gap-1.5">
        <input
          v-model="rejectNote"
          type="text"
          :placeholder="t('rejectReason')"
          class="h-7 min-w-0 flex-1 rounded border border-input bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
        />
        <Button
          variant="destructive"
          size="sm"
          class="h-7 text-xs"
          :data-testid="`${testIdPrefix}-reject-confirm`"
          :disabled="isSubmitting || props.isRunAnswered === false"
          @click="confirmReject"
        >
          {{ rejectLabel || t('reject') }}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          class="size-7"
          @click="showRejectReasonInput = false"
        >
          <ChatIcon name="close" class="size-3.5" />
        </Button>
      </div>

      <!-- Action Buttons Row -->
      <div v-else class="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          :data-testid="`${testIdPrefix}-reject-reason`"
          :disabled="props.isRunAnswered === false"
          @click="showRejectReasonInput = true"
        >
          {{ t('rejectReason') }}
        </Button>

        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="destructive"
            size="sm"
            class="h-7 gap-1 text-xs"
            :data-testid="`${testIdPrefix}-reject`"
            :disabled="isSubmitting || props.isRunAnswered === false"
            @click="confirmReject"
          >
            <ChatIcon name="close" class="size-3" />
            <span>{{ rejectLabel || t('reject') }}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            class="h-7 gap-1 text-xs"
            :data-testid="`${testIdPrefix}-approve`"
            :disabled="isSubmitting || currentText.trim() === '' || props.isRunAnswered === false"
            @click="confirmApprove"
          >
            <ChatIcon :name="approveIcon || 'check'" class="size-3" />
            <span>{{ approveLabel || t('approve') }}</span>
          </Button>
        </div>
      </div>

      <div
        v-if="errorMessage"
        role="alert"
        class="text-xs text-destructive"
      >
        {{ errorMessage }}
      </div>
    </div>

    <!-- Already Decided Section -->
    <div v-else class="mt-3 border-t pt-2.5 text-xs">
      <div
        v-if="dispatchWarning"
        role="status"
        data-testid="approval-dispatch-warning"
        class="mb-1.5 rounded bg-warning/10 px-2 py-1 font-medium text-warning"
      >
        {{ dispatchWarning }}
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <ChatIcon name="checkCircle" v-if="isApproved" class="size-4 text-emerald-500" />
          <ChatIcon name="closeCircle" v-else class="size-4 text-rose-500" />
          <span class="font-medium text-foreground">
            {{ isApproved ? t('approved') : t('rejected') }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="retryLabel"
            variant="outline"
            size="sm"
            class="h-7 text-xs text-destructive hover:text-destructive"
            :data-testid="`${testIdPrefix}-retry`"
            :disabled="isSubmitting"
            @click="emit('retry')"
          >
            {{ retryLabel }}
          </Button>
          <Badge
            :variant="isApproved ? 'outline' : 'destructive'"
            class="text-[0.8125rem]"
          >
            {{ localDecision }}
          </Badge>
        </div>
      </div>
      <div
        v-if="errorMessage"
        role="alert"
        class="mt-1.5 text-xs text-destructive"
      >
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>
