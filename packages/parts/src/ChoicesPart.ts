export interface ChoicesPartProps {
  items?: string[]
  disabled?: boolean
}

export type ChoicesPartEmit = {
  (e: 'select', value: string): void
}

export function useChoicesPart(props: ChoicesPartProps, emit: ChoicesPartEmit) {
  function handleSelect(val: string) {
    if (props.disabled) return
    emit('select', val)
  }

  return {
    handleSelect,
  }
}
