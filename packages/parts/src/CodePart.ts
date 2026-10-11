import type { BundledLanguage } from 'shiki'
import { computed } from 'vue'

export interface CodePartProps {
  lang?: string
  body: string
}

export function useCodePart(props: CodePartProps) {
  const safeLanguage = computed(() => (props.lang || 'typescript') as BundledLanguage)

  return {
    safeLanguage,
  }
}
