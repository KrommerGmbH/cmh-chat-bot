<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import {
  Conversation as ConversationContainer,
  ConversationContent,
} from '@cmh/chat-primitives/ai-elements/conversation'
import { Loader } from '@cmh/chat-primitives/ai-elements/loader'
import {
  Message,
  MessageContent,
} from '@cmh/chat-primitives/ai-elements/message'
import { provideChatContext } from '@cmh/chat-core'
import { Toaster } from '@cmh/chat-primitives/ui/sonner'
import { ApprovalPart, PartRenderer, TextPart } from '@cmh/chat-parts'
import ChatHeader from './components/header/ChatHeader.vue'
import ChatWelcome from './components/chat/ChatWelcome.vue'
import ChatFileChip from './components/chat/ChatFileChip.vue'
import QueuedMessagesList from './components/chat/QueuedMessagesList.vue'
import PromptInputArea from './components/input/PromptInputArea.vue'
import PinnedBar from './components/pins/PinnedBar.vue'
import IconRail from './components/rail/IconRail.vue'
import ConversationList from './components/sidebar/ConversationList.vue'
import { Button } from '@cmh/chat-primitives/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cmh/chat-primitives/ui/tooltip'
import { computed, toRef } from 'vue'
import { type ChatMainViewProps, chatViewPropDefaults } from './chatViewProps'
import { useChatMain } from './useChatMain'

const props = withDefaults(defineProps<ChatMainViewProps>(), chatViewPropDefaults)

// client, host and transport are read once; swap them by remounting the view. flowId is reactive.
provideChatContext({ client: props.client, host: props.host })

const {
  t,
  channel: resolvedChannel,
  bootstrapFailed,
  harnesses,
  hubOnlyHarnesses,
  models,
  modelByHarness,
  selectedHarnessId,
  conversations,
  activeConversationId,
  pinnedIds,
  messages,
  standalonePendingApprovals,
  runError,
  sendError,
  isNarrow,
  rootElement,
  isSidebarOpen,
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
  selectedModelLabel,
  pinnedConversations,
  isRunning,
  queuedMessages,
  removeQueuedMessage,
  clearQueuedMessages,
  visibleMessages,
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
  sendText,
  handleStopRun,
  copyMessageText,
  toggleTts,
  togglePin,
  unpin,
  handleApprovalDecided,
} = useChatMain({
  client: props.client,
  host: props.host,
  transport: props.transport,
  channel: props.channel,
  flowId: toRef(props, 'flowId'),
  ownsDocument: props.ownsDocument,
  forceNarrow: props.forceNarrow,
})
const toasterEnabled = computed(() => props.showToaster ?? props.ownsDocument)

// The host (CMH_CHAT_SEND in the standalone bundle) sends text through this, like the input box would.
defineExpose({ sendText })
</script>

<template>
  <div
    ref="rootElement"
    class="relative flex h-full w-full overflow-hidden bg-background text-foreground"
    :data-narrow="isNarrow ? '' : undefined"
    :data-channel="resolvedChannel"
    :data-flow-id="props.flowId ?? undefined"
  >
    <Toaster v-if="toasterEnabled" position="top-center" />

    <!-- 1. Left 64px Navigation Rail -->
    <IconRail
      v-if="props.ownsDocument"
      @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
      @toggle-pins="isSidebarOpen = true"
    />

    <!-- 2. Collapsible Conversation Sidebar (좁은 창: 겹침 + 바깥 누르면 닫힘) -->
    <div
      v-if="isSidebarOpen && isNarrow"
      class="absolute inset-0 z-30 bg-black/40"
      @click="isSidebarOpen = false"
    />
    <ConversationList
      v-if="isSidebarOpen"
      :class="isNarrow ? 'absolute inset-y-0 left-16 z-40 shadow-xl' : ''"
      :conversations="conversations"
      :active-id="activeConversationId"
      :pinned-ids="pinnedIds"
      @select-conversation="selectConversation"
      @new-conversation="handleNewConversation"
      @toggle-pin="togglePin"
    />

    <!-- 3. Main Chat View -->
    <div class="@container flex flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <ChatHeader
        :selected-harness-id="selectedHarnessId"
        :harnesses="harnesses"
        :is-sidebar-open="isSidebarOpen"
        :bootstrap-failed="bootstrapFailed"
        :selected-model-label="selectedModelLabel"
        :font-scale="fontScale"
        :tts-engine="ttsEngine"
        :tts-voice="ttsVoice"
        :tts-speaker="ttsSpeaker"
        :tts-style="ttsStyle"
        :auto-read="autoRead"
        :available-voices="availableVoices"
        :available-speakers="availableSpeakers"
        :available-styles="availableStyles"
        :default-speaker-for-locale="defaultSpeakerForLocale"
        @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
        @new-chat="handleNewConversation"
        @update:font-scale="handleFontScaleChange"
        @update:tts-engine="handleTtsEngineChange"
        @update:tts-voice="handleTtsVoiceChange"
        @update:tts-speaker="handleTtsSpeakerChange"
        @update:tts-style="handleTtsStyleChange"
        @update:auto-read="handleAutoReadChange"
        @back-to-split="handleBackToSplit"
      />

      <!-- Pinned Bar -->
      <PinnedBar
        :pinned-conversations="pinnedConversations"
        :active-id="activeConversationId"
        @select="selectConversation"
        @unpin="unpin"
      />

      <!-- Chat Messages Body -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Active Conversation View (대화가 골라져 있을 때) -->
        <template v-if="activeConversationId">
          <!-- Empty Messages in Active Conversation -->
          <ChatWelcome
            v-if="messages.length === 0 && !isRunning"
            @select-suggestion="handleSendMessage"
          />

          <!-- Conversation Scroll Area -->
          <ConversationContainer v-else class="flex-1 overflow-y-auto">
          <ConversationContent class="mx-auto flex w-[min(100cqw,max(var(--chat-content-min),var(--chat-content-width)))] flex-col gap-0 px-0 py-10">
            <div
              v-for="msg in visibleMessages"
              :key="msg.id"
              class="flex flex-col py-[calc(var(--chat-gap)/2)] text-[0.95rem] leading-[1.7]"
            >
              <!-- User Message -->
              <Message v-if="msg.role === 'user'" from="user" class="w-full max-w-full flex-col gap-0">
                <div class="mb-2 text-[0.78rem] font-bold text-primary">{{ t('messageLabelUser') }}</div>
                <MessageContent class="w-full max-w-full rounded-xl bg-muted p-5 mb-[18px] text-foreground text-[0.95rem] leading-[1.7] shadow-none [&_p]:max-w-(--chat-prose-max)">
                  <p class="whitespace-pre-wrap">{{ msg.content }}</p>

                  <!-- Attached Files Chips -->
                  <div v-if="msg.files && msg.files.length > 0" class="mt-2 flex flex-wrap gap-1.5">
                    <ChatFileChip
                      v-for="file in msg.files"
                      :key="file.mediaId"
                      :file="file"
                    />
                  </div>
                </MessageContent>
              </Message>

              <!-- Assistant Message -->
              <Message v-else-if="msg.role === 'assistant'" from="assistant" class="w-full max-w-full flex-col gap-0 justify-start">
                <div class="mb-2 text-[0.78rem] font-bold text-primary">AiOAi</div>
                <MessageContent class="w-full">
                  <!-- Parts list if available -->
                  <template v-if="msg.parts && msg.parts.length > 0">
                    <PartRenderer
                      v-for="(part, pIdx) in msg.parts"
                      :key="pIdx"
                      :part="part"
                      :harness-count="harnesses.length"
                      :decision="(part.type === 'approval') ? (getApprovalPropsForPart(part) as any).decision : undefined"
                      :is-run-answered="(part.type === 'approval' || part.type === 'draft_reply') ? checkIsRunAnswered(getApprovalPropsForPart(part)) : true"
                      @select-choice="handleSendMessage"
                      @decided="handleApprovalDecided"
                    />
                  </template>

                  <!-- Markdown text content -->
                  <TextPart v-if="msg.content" :md="msg.content" />

                  <!-- Bottom Toolbar -->
                  <div class="mt-3 flex items-center justify-between gap-1 pt-2 text-[0.85rem] text-muted-foreground">
                    <div class="flex items-center gap-1">
                      <!-- Reading now indicator / badge -->
                      <span
                        v-if="activeTtsMessageId === msg.id"
                        class="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium mr-1"
                      >
                        <span class="size-1.5 rounded-full bg-primary animate-pulse" />
                        <span>{{ isTtsPreparing ? t('generatingVoice') : t('readingNow') }}</span>
                      </span>

                      <!-- Read aloud (TTS) - Hidden when autoRead is active -->
                      <Button
                        v-if="!autoRead"
                        variant="ghost"
                        size="icon-xs"
                        :title="activeTtsMessageId === msg.id ? t('stop') : t('readAloud')"
                        :aria-label="activeTtsMessageId === msg.id ? t('stop') : t('readAloud')"
                        class="size-6 rounded"
                        @click="toggleTts(msg)"
                      >
                        <ChatIcon name="stop" v-if="activeTtsMessageId === msg.id" class="size-3.5 fill-current text-primary" />
                        <ChatIcon name="play" v-else class="size-3.5 fill-current" />
                      </Button>

                      <!-- Copy -->
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        :title="t('copy')"
                        :aria-label="t('copy')"
                        class="size-6 rounded"
                        @click="copyMessageText(msg)"
                      >
                        <ChatIcon name="check" v-if="copiedMessageId === msg.id" class="size-3.5 text-emerald-500" />
                        <ChatIcon name="copy" v-else class="size-3.5" />
                      </Button>
                    </div>

                    <!-- Usage Metrics -->
                    <div v-if="hasVisibleUsage(msg.usage)" class="flex items-center text-[0.85rem] text-muted-foreground/80">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <div class="inline-flex items-center gap-1.5 cursor-help">
                              <span v-if="msg.usage?.modelLabel || msg.usage?.model" class="inline-flex items-center gap-1 font-mono">
                                <ChatIcon name="cpu" class="size-3 text-primary/70" />
                                <span>{{ msg.usage.modelLabel || msg.usage.model }}</span>
                              </span>
                              <template v-if="formatUsageTokens(msg.usage)">
                                <span>·</span>
                                <span class="inline-flex items-center gap-1">
                                  <ChatIcon name="finance" class="size-3 text-amber-500/70" />
                                  <span>{{ formatUsageTokens(msg.usage) }}</span>
                                </span>
                              </template>
                              <template v-if="msg.usage?.durationMs != null">
                                <span>·</span>
                                <span class="inline-flex items-center gap-1">
                                  <ChatIcon name="clock" class="size-3 text-blue-500/70" />
                                  <span>{{ (msg.usage.durationMs / 1000).toFixed(1) }}s</span>
                                </span>
                              </template>
                              <template v-if="msg.usage?.cost !== null && msg.usage?.cost !== undefined">
                                <span>·</span>
                                <span class="inline-flex items-center gap-1">
                                  <ChatIcon name="finance" class="size-3 text-emerald-500/70" />
                                  <span>{{ msg.usage.cost === 0 ? t('freeBadge') : formatCost(msg.usage.cost, msg.usage.currency) }}</span>
                                </span>
                              </template>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent class="text-xs">
                            <div class="flex flex-col gap-0.5">
                              <div><strong>{{ t('provider') }}:</strong> {{ msg.usage?.provider || 'unknown' }}</div>
                              <div><strong>{{ t('modelCode') }}:</strong> {{ msg.usage?.model || 'unknown' }}</div>
                              <div v-if="msg.usage?.totalTokens != null">
                                <strong>{{ t('totalTokens') }}:</strong> {{ formatNumber(msg.usage.totalTokens) }}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </MessageContent>
              </Message>
            </div>

            <!-- Pending Approvals list -->
            <div v-if="standalonePendingApprovals.length > 0" class="flex flex-col gap-2">
              <ApprovalPart
                v-for="appr in standalonePendingApprovals"
                :key="appr.id"
                :approval-id="appr.id"
                :reason="appr.reason"
                :created-at="appr.createdAt"
                :summary="appr.summary"
                :choices="appr.choices"
                :form="appr.form"
                :decision="appr.decision"
                :is-run-answered="checkIsRunAnswered(appr)"
                @decided="handleApprovalDecided"
              />
            </div>

            <!-- Running / Thinking Indicator & Stop Action -->
            <div v-if="isRunning" class="flex items-center justify-between rounded-lg bg-ai-soft px-3 py-2 text-xs text-ai">
              <div class="flex items-center gap-2">
                <Loader :size="14" class="text-ai" />
                <span>{{ t('running') }}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                class="h-6 gap-1 border-ai/40 px-2 text-[11px] text-ai hover:bg-ai/10"
                @click="handleStopRun"
              >
                <ChatIcon name="stop" class="size-3 fill-current" />
                <span>{{ t('stop') }}</span>
              </Button>
            </div>
          </ConversationContent>
        </ConversationContainer>
      </template>

      <!-- No Conversation Selected View (!activeConversationId) -->
      <template v-else>
        <!-- Bootstrap Failed State -->
        <div
          v-if="bootstrapFailed"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <div class="flex size-14 items-center justify-center rounded-[17px] bg-destructive/10 text-destructive">
            <ChatIcon name="warning" class="size-8" />
          </div>
          <h2 class="font-semibold text-base">{{ t('bootstrapFailedTitle') }}</h2>
          <p class="max-w-md text-muted-foreground text-xs leading-relaxed">
            {{ t('bootstrapFailedDescription') }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5 text-xs shadow-2xs"
            @click="initializeApp"
          >
            <ChatIcon name="reload" class="size-3.5" />
            <span>{{ t('retry') }}</span>
          </Button>
        </div>

        <!-- Empty Harness State (하네스 0개) -->
        <div
          v-else-if="harnesses.length === 0"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <!-- hubOnlyHarnesses 가 있을 때 -->
          <template v-if="hubOnlyHarnesses.length > 0">
            <div class="flex size-14 items-center justify-center rounded-[17px] bg-muted text-muted-foreground">
              <ChatIcon name="cpu" class="size-8" />
            </div>
            <h2 class="font-semibold text-base">{{ t('hubOnlyTitle') }}</h2>
            <p class="max-w-md text-muted-foreground text-xs leading-relaxed">
              {{ t('hubOnlyDescription') }}
            </p>
            <div class="mt-2 flex flex-wrap justify-center gap-2 max-w-md">
              <div
                v-for="item in hubOnlyHarnesses"
                :key="item.agentCode"
                class="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs shadow-2xs"
              >
                <span class="font-medium text-foreground">{{ item.name }}</span>
                <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {{ t('hubOnlyBadge') }}
                </span>
              </div>
            </div>
          </template>

          <!-- 없을 때: 기존 빈 상태 그대로 -->
          <template v-else>
            <div class="flex size-14 items-center justify-center rounded-[17px] bg-muted text-muted-foreground">
              <ChatIcon name="cpu" class="size-8" />
            </div>
            <h2 class="font-semibold text-base">{{ t('noHarnessTitle') }}</h2>
            <p class="max-w-md text-muted-foreground text-xs leading-relaxed">
              {{ t('noHarnessDescription') }}
            </p>
          </template>
        </div>

        <!-- Empty Conversation State (하네스 있음, 대화 미선택) -->
        <ChatWelcome
          v-else
          @select-suggestion="handleSendMessage"
        />
      </template>

      <!-- Queued Messages Component (Antigravity IDE Style) -->
      <QueuedMessagesList
        :items="queuedMessages"
        @remove="removeQueuedMessage"
        @clear="clearQueuedMessages"
      />

      <!-- Prompt Input Area -->
      <div
        v-if="runError"
        role="alert"
        class="mx-auto w-[min(100cqw,max(var(--chat-content-min),var(--chat-input-width)))] pt-2 text-xs text-destructive whitespace-pre-wrap break-words"
      >
        {{ t('runFailed') }} — {{ runError }}
      </div>
      <div
        v-else-if="sendError"
        role="alert"
        class="mx-auto w-[min(100cqw,max(var(--chat-content-min),var(--chat-input-width)))] pt-2 text-xs text-destructive whitespace-pre-wrap break-words"
      >
        {{ t('runFailed') }} — {{ sendError }}
      </div>
      <PromptInputArea
        ref="promptInputRef"
        v-model:selected-harness-id="selectedHarnessId"
        :harnesses="harnesses"
        :models="models"
        :model-by-harness="modelByHarness"
        :hub-only-harnesses="hubOnlyHarnesses"
        :disabled="harnesses.length === 0"
        :placeholder="harnesses.length === 0 ? t('noHarnessTitle') : undefined"
        :is-loading="isRunning"
        :auto-read="autoRead"
        @update:model-by-harness="handleModelChange"
        @update:auto-read="handleAutoReadChange"
        @send="handleSendMessage"
      />
      </div>
    </div>
  </div>
</template>
