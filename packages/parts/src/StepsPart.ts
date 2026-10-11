import type { StepItem } from '@cmh/chat-core'

export interface StepsPartProps {
  items?: StepItem[]
}

export function useStepsPart(props: StepsPartProps) {
  void props

  function mapState(state?: 'done' | 'running' | 'error'): 'input-available' | 'output-available' | 'output-error' {
    if (state === 'running') return 'input-available'
    if (state === 'error') return 'output-error'
    return 'output-available'
  }

  return {
    mapState,
  }
}
