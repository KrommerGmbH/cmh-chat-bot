<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Button } from '@cmh/chat-primitives/ui/button'
import { useI18n } from '@cmh/chat-core'
import { computed } from 'vue'

const emit = defineEmits<{
  (e: 'select-suggestion', text: string): void
}>()

const { t } = useI18n()

const suggestions = computed(() => [
  {
    icon: 'box' as const,
    title: t('welcomeSuggestion1Title'),
    desc: t('welcomeSuggestion1Desc'),
  },
  {
    icon: 'bell' as const,
    title: t('welcomeSuggestion2Title'),
    desc: t('welcomeSuggestion2Desc'),
  },
  {
    icon: 'clock' as const,
    title: t('welcomeSuggestion3Title'),
    desc: t('welcomeSuggestion3Desc'),
  },
])
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-[25px]">
    <div class="w-full max-w-[560px] text-center -mt-[25px]">
      <!-- AI Emblem -->
      <div class="mx-auto mb-8 grid size-14 place-items-center rounded-[17px] bg-muted text-primary shadow-[0_4px_12px_#24375806]">
        <ChatIcon name="chat" class="size-[30px]" />
      </div>

      <!-- Overline -->
      <div class="mb-[11px] text-[0.76rem] tracking-[0.03em] text-muted-foreground">
        {{ t('welcomeOverline') }}
      </div>

      <!-- Main Title -->
      <h1 class="text-[1.85rem] font-semibold leading-[1.4] tracking-[-0.05em]">
        {{ t('welcomeTitle') }}
      </h1>

      <!-- Welcome Lead Description -->
      <p class="mt-3 text-[0.8rem] leading-[1.8] text-muted-foreground">
        {{ t('welcomeLead') }}
      </p>

      <!-- Suggestions List -->
      <div class="mx-auto mt-8 flex max-w-[420px] flex-col gap-[9px]">
        <Button
          v-for="(item, idx) in suggestions"
          :key="idx"
          variant="outline"
          class="h-auto grid grid-cols-[20px_1fr_14px] grid-rows-[auto_auto] gap-x-[11px] gap-y-1 px-[14px] py-[13px] text-left rounded-lg whitespace-normal shadow-none cursor-pointer"
          @click="emit('select-suggestion', item.title)"
        >
          <ChatIcon :name="item.icon" class="row-span-2 size-5 self-center text-primary" />
          <strong class="text-[0.95rem] font-medium text-foreground">{{ item.title }}</strong>
          <span class="col-start-2 text-[0.77rem] font-normal text-muted-foreground">{{ item.desc }}</span>
          <ChatIcon name="arrow" class="col-start-3 row-span-2 size-3.5 self-center text-muted-foreground" />
        </Button>
      </div>

      <!-- Welcome Note -->
      <div class="mt-[29px] flex items-center justify-center gap-[7px] text-[0.85rem] text-muted-foreground">
        <span class="size-1 rounded-full bg-muted-foreground/70" />
        <span>{{ t('welcomeNote') }}</span>
      </div>
    </div>
  </div>
</template>
