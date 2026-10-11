<script setup lang="ts">
import ChatIcon from '../../ui/icon/ChatIcon.vue'
import { Button } from '../../ui/button'
import { useMessageBranchContext } from './context'

const { goToPrevious, totalBranches } = useMessageBranchContext()
</script>

<template>
  <Button
    aria-label="Previous branch"
    :disabled="totalBranches <= 1"
    size="icon-sm"
    type="button"
    variant="ghost"
    v-bind="$attrs"
    @click="goToPrevious"
  >
    <slot>
      <ChatIcon name="chevronLeft" :size="14" />
    </slot>
  </Button>
</template>
