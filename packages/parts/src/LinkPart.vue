<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Button } from '@cmh/chat-primitives/ui/button'
import {
  type LinkPartProps,
  useLinkPart,
} from './LinkPart'

const props = defineProps<LinkPartProps>()
const { handleClick } = useLinkPart(props)
</script>

<template>
  <div class="my-2">
    <Button
      variant="outline"
      size="sm"
      class="gap-1.5 font-medium text-xs shadow-2xs"
      @click="handleClick"
    >
      <ChatIcon name="link" class="size-3.5 text-primary" />
      <span>{{ label }}</span>
    </Button>
  </div>
</template>
