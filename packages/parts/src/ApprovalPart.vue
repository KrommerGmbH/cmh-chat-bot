<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
} from '@cmh/chat-primitives/ai-elements/confirmation'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Button } from '@cmh/chat-primitives/ui/button'
import { Checkbox } from '@cmh/chat-primitives/ui/checkbox'
import { Textarea } from '@cmh/chat-primitives/ui/textarea'
import ApprovalChangesTable from './ApprovalChangesTable.vue'
import EditableApproval from './EditableApproval.vue'
import {
  type ApprovalPartEmit,
  type ApprovalPartProps,
  useApprovalPart,
} from './ApprovalPart'

const props = withDefaults(
  defineProps<ApprovalPartProps>(),
  {
    isRunAnswered: true,
  },
)

const emit = defineEmits<ApprovalPartEmit>()
const {
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
  effectiveForm,
  editableText,
  confirmationState,
  approvalPayload,
  normalizedChoices,
  handleDecide,
  handleEditableApprove,
  handleEditableReject,
} = useApprovalPart(props, emit)
</script>

<template>
  <div class="my-3 max-w-lg">
    <EditableApproval
      v-if="editableText !== null && !isMulti"
      :approval-id="effectiveId"
      :initial-text="editableText"
      :summary="effectiveSummary"
      :reason="effectiveReason"
      :created-at-label="createdAtLabel"
      :decision="currentDecision"
      :gate-tool="effectiveForm?.gateTool"
      :is-submitting="isSubmitting || isLoading"
      :error-message="errorMessage"
      :is-run-answered="props.isRunAnswered"
      :changes="changes"
      :dispatch-warning="dispatchWarning"
      @approve="handleEditableApprove"
      @reject="handleEditableReject"
    />

    <Confirmation
      v-else
      :approval="approvalPayload"
      :state="confirmationState"
      class="border-warning/30 bg-warning/5 shadow-2xs"
    >
      <!-- Before / after table (pending and decided) -->
      <ApprovalChangesTable v-if="changes.length > 0" :changes="changes" />

      <!-- Request Section -->
      <ConfirmationRequest>
        <div class="flex items-start gap-2.5">
          <ChatIcon name="warning" class="size-4 shrink-0 text-warning" />
          <div class="flex flex-col gap-1 text-xs">
            <span class="font-semibold text-foreground">{{ t('approvalTitle') }}</span>
            <p v-if="effectiveReason" class="text-muted-foreground">
              <strong class="font-medium text-foreground">{{ t('approvalReason') }}:</strong> {{ effectiveReason }}
              <time v-if="createdAtLabel" data-testid="approval-time" class="ml-1.5 text-[0.6875rem] text-muted-foreground">{{ createdAtLabel }}</time>
            </p>
            <p v-if="effectiveSummary" class="text-foreground/90">
              <strong class="font-medium text-foreground">{{ t('approvalSummary') }}:</strong> {{ effectiveSummary }}
            </p>
            <p v-if="effectiveForm?.gateTool" class="text-muted-foreground">
              <strong class="font-medium text-foreground">{{ t('willRun') }}:</strong> {{ effectiveForm.gateTool }}
            </p>
          </div>
        </div>

        <div
          v-if="props.isRunAnswered === false"
          class="mt-2.5 rounded bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
        >
          {{ t('waitingForAnswer') }}
        </div>

        <!-- Multi mode: one checkbox per selectable choice -->
        <div v-if="isMulti" class="mt-3 flex flex-col gap-2" data-testid="approval-multi">
          <label
            v-for="choice in selectableChoices"
            :key="choice.key"
            class="flex items-center gap-2 text-xs text-foreground"
          >
            <Checkbox
              :model-value="Boolean(checkedKeys[choice.key])"
              :disabled="isSubmitting || isLoading || props.isRunAnswered === false"
              :data-testid="'approval-check-' + choice.key"
              @update:model-value="setChecked(choice.key, $event === true)"
            />
            <span>{{ choice.label }}</span>
          </label>

          <Textarea
            v-if="editableText !== null"
            :model-value="editedText"
            :disabled="isSubmitting || isLoading || props.isRunAnswered === false"
            :maxlength="10000"
            data-testid="approval-multi-edited-text"
            class="min-h-24 resize-y text-xs leading-relaxed"
            @update:model-value="setEditedText(String($event ?? ''))"
          />

          <Textarea
            v-model="note"
            :disabled="isSubmitting || isLoading || props.isRunAnswered === false"
            :placeholder="t('approvalNotePlaceholder')"
            :aria-label="t('approvalNote')"
            data-testid="approval-multi-note"
            class="min-h-16 resize-y text-xs"
          />

          <div class="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              class="h-8 px-3 text-sm"
              data-testid="approval-approve-selected"
              :disabled="isSubmitting || isLoading || props.isRunAnswered === false || selectedKeys.length === 0"
              @click="handleDecideMulti(true)"
            >
              {{ t('approveSelected') }}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              class="h-8 px-3 text-sm"
              data-testid="approval-reject-all"
              :disabled="isSubmitting || isLoading || props.isRunAnswered === false"
              @click="handleDecideMulti(false)"
            >
              {{ t('rejectAll') }}
            </Button>
          </div>
        </div>

        <Textarea
          v-else-if="!currentDecision"
          v-model="note"
          :disabled="isSubmitting || isLoading || props.isRunAnswered === false"
          :placeholder="t('approvalNotePlaceholder')"
          :aria-label="t('approvalNote')"
          data-testid="approval-note"
          class="mt-3 min-h-12 resize-y text-xs"
        />

        <ConfirmationActions v-if="!isMulti" class="mt-3">
          <ConfirmationAction
            v-for="choice in normalizedChoices"
            :key="choice.key"
            :variant="choice.variant === 'destructive' ? 'destructive' : 'default'"
            :data-testid="choice.variant === 'destructive' ? 'approval-reject' : 'approval-approve'"
            :disabled="isSubmitting || isLoading || props.isRunAnswered === false"
            @click="handleDecide(choice.key)"
          >
            {{ choice.label }}
          </ConfirmationAction>
        </ConfirmationActions>

        <div
          v-if="errorMessage"
          role="alert"
          class="mt-2 text-xs text-destructive"
        >
          {{ errorMessage }}
        </div>
      </ConfirmationRequest>

      <div
        v-if="dispatchWarning"
        role="status"
        data-testid="approval-dispatch-warning"
        class="rounded bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
      >
        {{ dispatchWarning }}
      </div>

      <!-- Already Responded Section -->
      <div v-if="currentDecision" class="flex items-center justify-between p-1 text-xs">
        <div class="flex items-center gap-2">
          <ChatIcon name="checkCircle" v-if="currentDecision !== 'reject' && currentDecision !== 'rejected'" class="size-4 text-emerald-500" />
          <ChatIcon name="closeCircle" v-else class="size-4 text-rose-500" />
          <span class="font-medium text-foreground">{{ t('decisionDone') }}: {{ currentDecision }}</span>
        </div>
        <Badge variant="outline" class="text-[10px]">
          {{ currentDecision }}
        </Badge>
      </div>
    </Confirmation>
  </div>
</template>
