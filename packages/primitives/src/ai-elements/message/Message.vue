<script setup lang="ts">
import type { UIMessage } from 'ai'
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'

interface Props {
  from: UIMessage['role']
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="
      cn(
        'group flex w-full gap-2',
        props.from === 'user' ? 'is-user ml-auto justify-end max-w-[85%]' : 'is-assistant w-full max-w-full',
        props.class,
      )
    "
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
