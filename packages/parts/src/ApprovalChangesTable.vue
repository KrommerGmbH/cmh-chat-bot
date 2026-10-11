<script setup lang="ts">
import { useI18n } from '@cmh/chat-core'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cmh/chat-primitives/ui/table'
import type { ApprovalChange } from './ApprovalChangesTable'
import { formatChangeValue } from './ApprovalChangesTable'

defineProps<{
  changes: ApprovalChange[]
}>()

const { t } = useI18n()
</script>

<template>
  <div
    data-testid="approval-changes"
    class="max-w-full overflow-hidden rounded-lg border bg-card text-xs"
  >
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="h-8 text-xs font-semibold">
            {{ t('approvalColumnItem') }}
          </TableHead>
          <TableHead class="h-8 text-xs font-semibold">
            {{ t('approvalColumnBefore') }}
          </TableHead>
          <TableHead class="h-8 text-xs font-semibold">
            {{ t('approvalColumnAfter') }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="change in changes" :key="change.key" class="h-8">
          <TableCell class="py-1.5 text-xs font-medium">
            {{ change.label || change.key }}
          </TableCell>
          <TableCell class="py-1.5 text-xs text-muted-foreground">
            {{ formatChangeValue(change.before) }}
          </TableCell>
          <TableCell class="py-1.5 text-xs text-foreground">
            {{ formatChangeValue(change.after) }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
