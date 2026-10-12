<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@cmh/chat-primitives/ui/card'
import {
  type OrderCardPartProps,
  useOrderCardPart,
} from './OrderCardPart'

const props = defineProps<OrderCardPartProps>()
const {
  t,
  loading,
  failed,
  orderData,
  isMarketplaceOrder,
} = useOrderCardPart(props)
</script>

<template>
  <div v-if="loading" class="my-2 rounded border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
    불러오는 중...
  </div>
  <div v-else-if="failed || !orderData" class="my-2 rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
    불러오지 못했습니다
  </div>
  <Card v-else class="my-2 w-full border shadow-2xs">
    <CardHeader class="p-5 pb-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
          <ChatIcon name="marketHub" class="size-3.5 text-primary" />
          <span>{{ t('orderCardTitle') }}</span>
        </div>
        <Badge v-if="isMarketplaceOrder" variant="secondary" class="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
          <ChatIcon name="store" class="size-2.5" />
          <span>{{ t('marketOrderBadge') }}</span>
        </Badge>
      </div>
      <CardTitle class="mt-1 font-mono font-semibold text-sm">
        {{ orderData.orderNumber }}
      </CardTitle>
    </CardHeader>
    <CardContent class="grid grid-cols-2 gap-2 p-5 pt-0 text-xs">
      <div class="flex flex-col gap-0.5 rounded bg-muted/40 p-2">
        <span class="text-muted-foreground text-[10px]">{{ t('orderAmount') }}</span>
        <span class="font-bold text-foreground">
          € {{ orderData.amountTotal.toFixed(2) }}
        </span>
      </div>
      <div class="flex flex-col gap-0.5 rounded bg-muted/40 p-2">
        <span class="text-muted-foreground text-[10px]">{{ t('orderStatus') }}</span>
        <span class="font-medium text-foreground">
          {{ orderData.status }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
