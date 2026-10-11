import { useChatContext, useI18n } from '@cmh/chat-core'
import { computed, onMounted, ref } from 'vue'

export interface OrderCardPartProps {
  orderId: string
  source?: 'shopware' | 'naver'
}

export function useOrderCardPart(props: OrderCardPartProps) {
  const { t } = useI18n()
  const { client } = useChatContext()

  const loading = ref(true)
  const failed = ref(false)
  const orderData = ref<{
    orderNumber: string
    amountTotal: number
    orderDateTime?: string
    status: string
  } | null>(null)

  const isMarketplaceOrder = computed(() => {
    if (props.source === 'naver') return true
    return orderData.value?.orderNumber?.startsWith('NV-') ?? false
  })

  onMounted(async () => {
    if (!props.orderId) {
      failed.value = true
      loading.value = false
      return
    }

    try {
      const data = await client.fetchDalOrder(props.orderId)
      if (!data) {
        failed.value = true
        return
      }

      orderData.value = {
        orderNumber: data.orderNumber || '',
        amountTotal: Number(data.amountTotal ?? 0),
        orderDateTime: data.orderDateTime,
        status: data.stateMachineState?.name || 'Open',
      }
    } catch {
      failed.value = true
    } finally {
      loading.value = false
    }
  })

  return {
    t,
    loading,
    failed,
    orderData,
    isMarketplaceOrder,
  }
}
