<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Button } from '@cmh/chat-primitives/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@cmh/chat-primitives/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cmh/chat-primitives/ui/tooltip'
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@cmh/chat-primitives/ai-elements/prompt-input'
import {
  type PromptInputAreaEmit,
  type PromptInputAreaProps,
  usePromptInputArea,
} from './PromptInputArea'

const props = defineProps<PromptInputAreaProps>()
const emit = defineEmits<PromptInputAreaEmit>()
const {
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
} = usePromptInputArea(props, emit)

defineExpose({
  isRecording,
  stopRecording,
})
</script>

<template>
  <div class="w-full px-[22px] pt-[15px] pb-[17px]">
    <div class="mx-auto max-w-3xl">
      <!-- Hidden File Input -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,text/plain,text/csv,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv"
        class="hidden"
        @change="handleFileChange"
      >

      <PromptInput
        class="rounded-xl border bg-card px-3 pt-3 pb-2 shadow-[0_3px_10px_#24375805] transition-shadow focus-within:shadow-md"
        @submit="handleSubmit"
      >
        <!-- Attachments Chip Area / Error Display (Inside PromptInput at top) -->
        <PromptInputHeader
          v-if="attachmentError || attachedFiles.length > 0"
          class="flex flex-wrap gap-1.5 px-1 pb-2 text-[0.75rem]"
        >
          <!-- Error Message -->
          <div
            v-if="attachmentError"
            class="flex w-full items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          >
            <ChatIcon name="alertCircle" class="size-3.5 shrink-0" />
            <span>{{ attachmentError }}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              class="ml-auto size-5 text-destructive hover:bg-destructive/20"
              :title="t('dismissError')"
              :aria-label="t('dismissError')"
              @click="attachmentError = null"
            >
              <ChatIcon name="close" class="size-3" />
            </Button>
          </div>

          <!-- Attached Files Chips -->
          <template v-else>
            <div
              v-for="file in attachedFiles"
              :key="file.id"
              class="inline-flex items-center gap-1.5 rounded-lg border bg-card/80 px-2 py-1 text-xs shadow-2xs"
            >
              <img
                v-if="file.isImage && file.previewUrl"
                :src="file.previewUrl"
                :alt="file.name"
                class="size-6 rounded object-cover"
              >
              <ChatIcon name="appDoc" v-else class="size-3.5 text-muted-foreground" />
              <span class="max-w-32 truncate text-foreground">{{ file.name }}</span>
              <span class="text-[0.8125rem] text-muted-foreground">({{ formatFileSize(file.size) }})</span>
              <button
                type="button"
                class="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                :title="t('removeFile', { name: file.name })"
                :aria-label="t('removeFile', { name: file.name })"
                @click="removeAttachedFile(file.id)"
              >
                <ChatIcon name="close" class="size-3" />
              </button>
            </div>
          </template>
        </PromptInputHeader>

        <div class="relative flex w-full items-center pr-2">
          <PromptInputTextarea
            :placeholder="props.isLoading ? t('queueInputPlaceholder') : (props.placeholder || t('composerPlaceholder'))"
            :disabled="props.disabled"
            class="min-h-[57px] text-[0.81rem] leading-[1.7] border-0 bg-transparent px-0.5 py-px focus-visible:ring-0 flex-1"
            @dragover.prevent
            @drop.prevent.stop="handleDrop"
            @paste.capture="handlePaste"
          />
          <PromptInputSpeechButton
            ref="speechButtonRef"
            :lang="chatSession.locale.value"
            :disabled="props.disabled"
            class="size-[26px] shrink-0 text-muted-foreground hover:text-foreground"
            @recording-change="handleRecordingChange"
          />
        </div>

        <PromptInputFooter class="flex flex-wrap items-center justify-between gap-0.5 p-0">
          <!-- Tools: [📎 첨부] · [하네스 select] · [모델 select] -->
          <PromptInputTools class="flex items-center gap-0.5 flex-wrap">
            <!-- 1. Attach Button (아이콘 먼저 + 툴팁) -->
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="size-[26px] text-muted-foreground hover:text-foreground"
                    :disabled="props.disabled"
                    :title="t('attachFile')"
                    :aria-label="t('attachFile')"
                    @click="triggerFileInput"
                  >
                    <ChatIcon name="paperclip" class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent class="text-xs">
                  {{ t('attachFile') }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <!-- 2. Harness Select -->
            <template v-if="harnesses.length > 0">
              <!-- Inside an iframe a reka Select closes when the window loses focus: use a native select there. -->
              <select
                v-if="host.isEmbedded"
                :value="activeHarness ? activeHarness.id : ''"
                :disabled="props.disabled || props.isLoading"
                :title="activeHarness ? activeHarness.name : t('selectHarness')"
                :aria-label="activeHarness ? activeHarness.name : t('selectHarness')"
                class="h-7 max-w-[105px] rounded-lg border border-input bg-transparent px-1 text-[0.85rem] font-normal text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                @change="handleNativeHarnessChange"
              >
                <option v-if="!activeHarness" value="" disabled>{{ t('selectHarness') }}</option>
                <option v-for="h in harnesses" :key="h.id" :value="h.id">{{ h.name }}</option>
              </select>
              <TooltipProvider v-else>
                <Tooltip>
                  <Select
                    :model-value="selectedHarnessId ?? undefined"
                    :disabled="props.disabled || props.isLoading"
                    @update:model-value="handleHarnessChange"
                  >
                    <TooltipTrigger as-child>
                      <SelectTrigger
                        class="h-7 max-w-[105px] sm:max-w-[105px] border-none bg-transparent px-1 text-[0.85rem] font-normal text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
                        :title="activeHarness ? activeHarness.name : t('selectHarness')"
                        :aria-label="activeHarness ? activeHarness.name : t('selectHarness')"
                      >
                        <div class="flex items-center gap-1.5 min-w-0">
                          <ChatIcon name="cpu" class="size-3.5 text-muted-foreground shrink-0" />
                          <span class="truncate">{{ activeHarness ? activeHarness.name : t('selectHarness') }}</span>
                        </div>
                      </SelectTrigger>
                    </TooltipTrigger>
                    <TooltipContent class="text-xs">
                      {{ activeHarness ? activeHarness.name : t('selectHarness') }}
                    </TooltipContent>
                    <SelectContent position="popper" side="top" align="end" :side-offset="6" class="max-h-72">
                      <SelectItem
                        v-for="h in harnesses"
                        :key="h.id"
                        :value="h.id"
                        class="text-xs"
                      >
                        {{ h.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Tooltip>
              </TooltipProvider>
            </template>
            <div v-else class="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-destructive text-xs">
              <ChatIcon name="warning" class="size-3.5 shrink-0" />
              <span>{{ t('noHarnessTitle') }}</span>
            </div>

            <!-- 3. Model Select -->
            <select
              v-if="host.isEmbedded"
              :value="isSelectedModelListed ? selectedModelId : ''"
              :disabled="props.disabled || props.isLoading"
              :title="selectedModelDisplayLabel"
              :aria-label="selectedModelDisplayLabel"
              class="h-7 max-w-[105px] rounded-lg border border-input bg-transparent px-1 text-[0.85rem] font-normal text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              @change="handleNativeModelChange"
            >
              <option v-if="!isSelectedModelListed" value="" disabled>{{ selectedModelDisplayLabel }}</option>
              <option value="__auto__">{{ defaultHarnessModelLabel ? t('autoModel') + ' (' + defaultHarnessModelLabel + ')' : t('autoModel') }}</option>
              <optgroup v-for="(groupModels, provider) in modelsByProvider" :key="provider" :label="String(provider)">
                <option v-for="m in groupModels" :key="m.id" :value="m.id">{{ m.free ? m.label + ' (' + t('freeBadge') + ')' : m.label }}</option>
              </optgroup>
            </select>
            <TooltipProvider v-else>
              <Tooltip>
                <Select
                  :model-value="selectedModelId"
                  :disabled="props.disabled || props.isLoading"
                  @update:model-value="handleModelChange"
                >
                  <TooltipTrigger as-child>
                    <SelectTrigger
                      class="h-7 max-w-[105px] sm:max-w-[105px] border-none bg-transparent px-1 text-[0.85rem] font-normal text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
                      :title="selectedModelDisplayLabel"
                      :aria-label="selectedModelDisplayLabel"
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <ChatIcon name="star" class="size-3.5 text-muted-foreground shrink-0" />
                        <span class="truncate">{{ selectedModelDisplayLabel }}</span>
                      </div>
                    </SelectTrigger>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    {{ selectedModelDisplayLabel }}
                  </TooltipContent>
                  <SelectContent position="popper" side="top" align="end" :side-offset="6" class="max-h-72">
                    <!-- First Item: Auto -->
                    <SelectItem value="__auto__" class="text-xs">
                      <div class="flex items-center gap-1.5">
                        <span>{{ t('autoModel') }}</span>
                        <span v-if="defaultHarnessModelLabel" class="text-muted-foreground text-[0.8125rem]">({{ defaultHarnessModelLabel }})</span>
                      </div>
                    </SelectItem>

                    <!-- Grouped by providerName -->
                    <SelectGroup v-for="(groupModels, provider) in modelsByProvider" :key="provider">
                      <SelectLabel class="px-2 py-1 text-[0.8125rem] font-semibold uppercase text-muted-foreground">
                        {{ provider }}
                      </SelectLabel>
                      <SelectItem
                        v-for="m in groupModels"
                        :key="m.id"
                        :value="m.id"
                        class="text-xs"
                      >
                        <div class="flex items-center gap-1.5">
                          <span>{{ m.label }}</span>
                          <Badge v-if="m.free" variant="secondary" class="h-4 px-1 py-0 text-[0.75rem]">
                            {{ t('freeBadge') }}
                          </Badge>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Tooltip>
            </TooltipProvider>
          </PromptInputTools>

          <!-- Right: Auto-Read Toggle & Send Button -->
          <div class="flex items-center gap-1.5 ml-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    :class="[
                      'size-[26px] rounded-lg',
                      props.autoRead ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground',
                    ]"
                    :title="props.autoRead ? t('autoReadOn') : t('autoReadOff')"
                    :aria-label="props.autoRead ? t('autoReadOn') : t('autoReadOff')"
                    @click="emit('update:autoRead', !props.autoRead)"
                  >
                    <ChatIcon name="volumeMax" v-if="props.autoRead" class="size-4" />
                    <ChatIcon name="volumeOff" v-else class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent class="text-xs">
                  {{ props.autoRead ? t('autoReadOn') : t('autoReadOff') }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <PromptInputSubmit
              :disabled="props.disabled"
              :title="props.isLoading ? t('addToQueue') : t('send')"
              :aria-label="props.isLoading ? t('addToQueue') : t('send')"
              class="size-7 rounded-lg"
            />
          </div>
        </PromptInputFooter>
      </PromptInput>

      <!-- Composer Hint -->
      <div class="mt-[9px] flex justify-between gap-[5px] text-[0.85rem] text-muted-foreground">
        <span>{{ t('composerHintCheck') }}</span>
        <span>{{ t('composerHintKeys') }}</span>
      </div>
    </div>
  </div>
</template>
