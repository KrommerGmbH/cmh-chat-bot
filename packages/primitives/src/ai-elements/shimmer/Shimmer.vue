<script setup lang="ts">
import type { CSSProperties, HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'
import { computed, useSlots } from 'vue'

export interface TextShimmerProps {
  as?: keyof HTMLElementTagNameMap
  class?: HTMLAttributes['class']
  duration?: number
  spread?: number
}

const props = withDefaults(defineProps<TextShimmerProps>(), {
  as: 'p',
  duration: 2,
  spread: 2,
})

const slots = useSlots()

const textContent = computed(() => {
  const defaultSlot = slots.default?.()
  if (!defaultSlot || defaultSlot.length === 0)
    return ''

  return defaultSlot
    .map((vnode) => {
      if (typeof vnode.children === 'string') {
        return vnode.children
      }
      return ''
    })
    .join('')
})

const dynamicSpread = computed(() => {
  return (textContent.value?.length ?? 0) * props.spread
})

const componentClasses = computed(() => cn('chat-shimmer relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent', '[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]', props.class))

const componentStyle = computed((): CSSProperties => ({
  '--spread': `${dynamicSpread.value}px`,
  'backgroundImage':
    'var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))',
  'animationDuration': `${props.duration}s`,
}))
</script>

<template>
  <component
    :is="props.as"
    :class="componentClasses"
    :style="componentStyle"
  >
    <slot />
  </component>
</template>

<style>
/* JS 애니메이션 라이브러리 대신 CSS keyframes: 배경 위치를 100% → 0% 로 선형 무한 반복(원본과 같은 움직임). */
.chat-shimmer {
  animation-name: chat-shimmer-sweep;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes chat-shimmer-sweep {
  from { background-position: 100% center; }
  to { background-position: 0% center; }
}
@media (prefers-reduced-motion: reduce) {
  .chat-shimmer { animation: none; }
}
</style>
