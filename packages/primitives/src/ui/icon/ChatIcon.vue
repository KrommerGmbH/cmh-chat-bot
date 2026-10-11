<script setup lang="ts">
// Chat icon: coolicons path data, stroke width 1.5, variants line / duotone / duocolor.
import { computed } from 'vue'
import { ICON_DATA, ICON_VIEWBOX, type IconName } from '../../icons/coolicons.generated'

export type ChatIconVariant = 'line' | 'duotone' | 'duocolor'

const props = withDefaults(
  defineProps<{
    name: IconName
    variant?: ChatIconVariant
    size?: number | string
    strokeWidth?: number
  }>(),
  { variant: 'line', size: 24, strokeWidth: 1.5 },
)

const paths = computed(() => ICON_DATA[props.name].d as readonly string[])

/** 닫힌 도형(Z 가 있는 path)만 채움 층을 가진다. 없으면 같은 선을 굵고 옅게 깐다(셸 icon.ts backLayer 와 같다). */
const backLayer = computed(() => {
  if (props.variant === 'line') return null
  const paint = props.variant === 'duotone' ? 'currentColor' : 'var(--icon-2, var(--primary, currentColor))'
  const opacity = props.variant === 'duotone' ? 0.18 : 0.45
  const closed = paths.value.filter(p => /[zZ]/.test(p))
  if (closed.length > 0) return { filled: true, paint, opacity, d: closed }
  return { filled: false, paint, opacity, d: paths.value }
})
</script>

<template>
  <svg
    :class="`chat-icon chat-icon--${variant}`"
    :viewBox="ICON_VIEWBOX"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="backLayer">
      <template v-if="backLayer.filled">
        <path v-for="(d, i) in backLayer.d" :key="`b${i}`" :d="d" :fill="backLayer.paint" :fill-opacity="backLayer.opacity" stroke="none" />
      </template>
      <template v-else>
        <path v-for="(d, i) in backLayer.d" :key="`b${i}`" :d="d" :stroke="backLayer.paint" :stroke-opacity="backLayer.opacity" stroke-width="4" />
      </template>
    </template>
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
