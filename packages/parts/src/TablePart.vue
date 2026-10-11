<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cmh/chat-primitives/ui/table'
import {
  type TablePartProps,
  useTablePart,
} from './TablePart'

const props = defineProps<TablePartProps>()
const { handleRowClick } = useTablePart(props)
</script>

<template>
  <div class="my-2 max-w-full overflow-hidden rounded-lg border bg-card text-xs">
    <div class="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="(col, cIdx) in (columns || [])"
              :key="cIdx"
              class="h-8 font-semibold text-xs"
            >
              {{ col }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(row, rIdx) in (rows || [])"
            :key="rIdx"
            :class="[
              'h-8',
              rowLink ? 'cursor-pointer hover:bg-muted/70' : 'hover:bg-muted/50',
            ]"
            @click="handleRowClick(row)"
          >
            <TableCell
              v-for="(cell, cIdx) in row"
              :key="cIdx"
              class="py-1.5 text-xs"
            >
              {{ cell }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
