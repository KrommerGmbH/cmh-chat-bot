<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="
      cn(
        'is-user:dark flex w-fit flex-col gap-2 overflow-hidden text-sm',
        'group-[.is-user]:rounded-xl group-[.is-user]:bg-secondary group-[.is-user]:p-[15px] group-[.is-user]:text-foreground',
        'group-[.is-assistant]:text-foreground',
        props.class,
      )
    "
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
