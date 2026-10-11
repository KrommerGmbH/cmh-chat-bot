<script setup lang="ts">
import ChatIcon from '../../ui/icon/ChatIcon.vue'
import { Button } from '../../ui/button'
import { useMessageBranchContext } from './context'

const { goToNext, totalBranches } = useMessageBranchContext()
</script>

<template>
  <Button
    aria-label="Next branch"
    :disabled="totalBranches <= 1"
    size="icon-sm"
    type="button"
    variant="ghost"
    v-bind="$attrs"
    @click="goToNext"
  >
    <slot>
      <ChatIcon name="chevron" :size="14" />
    </slot>
  </Button>
</template>
