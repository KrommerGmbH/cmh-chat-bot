import { useChatContext, useI18n } from '@cmh/chat-core'
import { onMounted, ref } from 'vue'

export interface ProductCardPartProps {
  productId: string
}

export function useProductCardPart(props: ProductCardPartProps) {
  const { t } = useI18n()
  const { client } = useChatContext()

  const loading = ref(true)
  const failed = ref(false)
  const productData = ref<{
    name: string
    productNumber: string
    stock: number
    price?: number
  } | null>(null)

  onMounted(async () => {
    if (!props.productId) {
      failed.value = true
      loading.value = false
      return
    }

    try {
      const data = await client.fetchDalProduct(props.productId)
      if (!data) {
        failed.value = true
        return
      }

      let extractedPrice: number | undefined
      if (Array.isArray(data.price) && data.price.length > 0) {
        extractedPrice = data.price[0].gross
      }

      const name = data.name || data.translated?.name
      if (!name && !data.productNumber) {
        failed.value = true
        return
      }

      productData.value = {
        name: name || '',
        productNumber: data.productNumber || '',
        stock: Math.max(0, data.stock ?? 0),
        price: extractedPrice,
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
    productData,
  }
}
