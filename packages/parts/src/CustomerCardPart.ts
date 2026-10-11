import { useChatContext, useI18n } from '@cmh/chat-core'
import { onMounted, ref } from 'vue'

export interface CustomerCardPartProps {
  customerId: string
}

export function useCustomerCardPart(props: CustomerCardPartProps) {
  const { t } = useI18n()
  const { client } = useChatContext()

  const loading = ref(true)
  const failed = ref(false)
  const customerData = ref<{
    customerNumber: string
    name: string
    email?: string
  } | null>(null)

  onMounted(async () => {
    if (!props.customerId) {
      failed.value = true
      loading.value = false
      return
    }

    try {
      const data = await client.fetchDalCustomer(props.customerId)
      if (!data) {
        failed.value = true
        return
      }

      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ')
      customerData.value = {
        customerNumber: data.customerNumber || '',
        name: fullName,
        email: data.email,
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
    customerData,
  }
}
