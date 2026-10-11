<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@cmh/chat-primitives/ui/card'

defineProps<{
  items?: Array<{
    label: string
    value: string | number
  }>
}>()
</script>

<template>
  <div class="my-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
    <Card
      v-for="(item, idx) in (items || [])"
      :key="idx"
      class="border shadow-2xs"
    >
      <CardHeader class="p-3 pb-1">
        <CardTitle class="font-normal text-muted-foreground text-xs">
          {{ item.label }}
        </CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-0">
        <span class="font-bold text-lg tracking-tight">{{ item.value }}</span>
      </CardContent>
    </Card>
  </div>
</template>
