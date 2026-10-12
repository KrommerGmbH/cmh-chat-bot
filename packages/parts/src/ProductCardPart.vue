<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@cmh/chat-primitives/ui/card'
import {
  type ProductCardPartProps,
  useProductCardPart,
} from './ProductCardPart'

const props = defineProps<ProductCardPartProps>()
const {
  t,
  loading,
  failed,
  productData,
} = useProductCardPart(props)
</script>

<template>
  <div v-if="loading" class="my-2 rounded border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
    불러오는 중...
  </div>
  <div v-else-if="failed || !productData" class="my-2 rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
    불러오지 못했습니다
  </div>
  <Card v-else class="my-2 w-full border shadow-2xs">
    <CardHeader class="p-5 pb-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
          <ChatIcon name="box" class="size-3.5 text-primary" />
          <span>{{ t('productCardTitle') }}</span>
        </div>
        <Badge v-if="productData.productNumber" variant="outline" class="font-mono text-[10px]">
          {{ productData.productNumber }}
        </Badge>
      </div>
      <CardTitle class="mt-1 font-semibold text-sm leading-snug">
        {{ productData.name }}
      </CardTitle>
    </CardHeader>
    <CardContent class="grid grid-cols-2 gap-2 p-5 pt-0 text-xs">
      <div class="flex flex-col gap-0.5 rounded bg-muted/40 p-2">
        <span class="text-muted-foreground text-[10px]">{{ t('productStock') }}</span>
        <div class="flex items-center gap-1 font-medium">
          <ChatIcon name="box" class="size-3 text-muted-foreground" />
          <span>{{ productData.stock }}</span>
        </div>
      </div>
      <div v-if="productData.price !== undefined" class="flex flex-col gap-0.5 rounded bg-muted/40 p-2">
        <span class="text-muted-foreground text-[10px]">{{ t('productPrice') }}</span>
        <span class="font-bold text-foreground">€ {{ Number(productData.price).toFixed(2) }}</span>
      </div>
    </CardContent>
  </Card>
</template>
