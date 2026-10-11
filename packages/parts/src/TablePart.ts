import { useChatContext } from '@cmh/chat-core'

export interface TablePartProps {
  columns: string[]
  rows: (string | number)[][]
  rowLink?: 'order' | 'product' | 'customer'
}

export function useTablePart(props: TablePartProps) {
  const { host } = useChatContext()

  function handleRowClick(row: (string | number)[]) {
    if (!props.rowLink || row.length === 0) return
    const id = String(row[0])
    const routeMap: Record<string, string> = {
      order: 'sw.order.detail',
      product: 'sw.product.detail',
      customer: 'sw.customer.detail',
    }
    const routeName = routeMap[props.rowLink]
    if (routeName) {
      host.navigate({ name: routeName, params: { id } })
    }
  }

  return {
    handleRowClick,
  }
}
