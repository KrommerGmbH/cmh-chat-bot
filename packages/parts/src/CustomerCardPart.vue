<script setup lang="ts">
import { ChatIcon } from '@cmh/chat-primitives/ui/icon'
import { Badge } from '@cmh/chat-primitives/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@cmh/chat-primitives/ui/card'
import {
  type CustomerCardPartProps,
  useCustomerCardPart,
} from './CustomerCardPart'

const props = defineProps<CustomerCardPartProps>()
const {
  t,
  loading,
  failed,
  customerData,
} = useCustomerCardPart(props)
</script>

<template>
  <div v-if="loading" class="my-2 rounded border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
    불러오는 중...
  </div>
  <div v-else-if="failed || !customerData" class="my-2 rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
    불러오지 못했습니다
  </div>
  <Card v-else class="my-2 w-full border shadow-2xs">
    <CardHeader class="p-5 pb-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
          <ChatIcon name="user" class="size-3.5 text-primary" />
          <span>{{ t('customerCardTitle') }}</span>
        </div>
        <Badge v-if="customerData.customerNumber" variant="outline" class="font-mono text-[10px]">
          {{ customerData.customerNumber }}
        </Badge>
      </div>
      <CardTitle class="mt-1 font-semibold text-sm">
        {{ customerData.name || customerData.customerNumber }}
      </CardTitle>
    </CardHeader>
    <CardContent class="p-5 pt-0 text-xs">
      <div v-if="customerData.email" class="flex items-center gap-2 rounded bg-muted/40 p-2 text-muted-foreground">
        <ChatIcon name="appMail" class="size-3.5 shrink-0" />
        <span class="truncate">{{ customerData.email }}</span>
      </div>
    </CardContent>
    <!-- Note: Strictly adhering to Axiom - Zero Customer Email button -->
  </Card>
</template>
