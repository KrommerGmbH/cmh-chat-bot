import { useChatContext } from '@cmh/chat-core'

export interface LinkPartProps {
  route: string
  params?: Record<string, any>
  label: string
}

export function useLinkPart(props: LinkPartProps) {
  const { host } = useChatContext()

  function handleClick() {
    if (!props.route) return
    host.navigate({ name: props.route, params: props.params || {} })
  }

  return {
    handleClick,
  }
}
