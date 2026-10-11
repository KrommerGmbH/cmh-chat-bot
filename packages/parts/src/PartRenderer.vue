<script setup lang="ts">
import type { ChatPart } from '@cmh/chat-core'
import ApprovalPart from './ApprovalPart.vue'
import CalloutPart from './CalloutPart.vue'
import ChoicesPart from './ChoicesPart.vue'
import CodePart from './CodePart.vue'
import CustomerCardPart from './CustomerCardPart.vue'
import DraftReplyPart from './DraftReplyPart.vue'
import LinkPart from './LinkPart.vue'
import OrderCardPart from './OrderCardPart.vue'
import ProductCardPart from './ProductCardPart.vue'
import StatsPart from './StatsPart.vue'
import StepsPart from './StepsPart.vue'
import TablePart from './TablePart.vue'
import TextPart from './TextPart.vue'

defineProps<{
  part: ChatPart
  /** Live decision of the approval (overrides `part.props.decision`). */
  decision?: string
  harnessCount?: number
  isRunAnswered?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-choice', choice: string): void
  (e: 'decided', result: { id: string, chosen: string, warning?: string }): void
}>()
</script>

<template>
  <div class="part-container w-full">
    <!-- 1. text: md -->
    <TextPart
      v-if="part.type === 'text'"
      :md="part.props?.md"
    />

    <!-- 2. steps: items -->
    <StepsPart
      v-else-if="part.type === 'steps'"
      :items="part.props?.items"
    />

    <!-- 3. callout: tone, text -->
    <CalloutPart
      v-else-if="part.type === 'callout'"
      :tone="part.props?.tone"
      :text="part.props?.text"
    />

    <!-- 4. table: columns, rows, rowLink? -->
    <TablePart
      v-else-if="part.type === 'table'"
      :columns="part.props?.columns"
      :rows="part.props?.rows"
      :row-link="part.props?.rowLink"
    />

    <!-- 5. stats: items -->
    <StatsPart
      v-else-if="part.type === 'stats'"
      :items="part.props?.items"
    />

    <!-- 6. code: lang, body -->
    <CodePart
      v-else-if="part.type === 'code'"
      :lang="part.props?.lang"
      :body="part.props?.body"
    />

    <!-- 7. link: route, params?, label -->
    <LinkPart
      v-else-if="part.type === 'link'"
      :route="part.props?.route"
      :params="part.props?.params"
      :label="part.props?.label"
    />

    <!-- 8. product_card: productId -->
    <ProductCardPart
      v-else-if="part.type === 'product_card'"
      :product-id="part.props?.productId"
    />

    <!-- 9. order_card: orderId, source? -->
    <OrderCardPart
      v-else-if="part.type === 'order_card'"
      :order-id="part.props?.orderId"
      :source="part.props?.source"
    />

    <!-- 10. customer_card: customerId -->
    <CustomerCardPart
      v-else-if="part.type === 'customer_card'"
      :customer-id="part.props?.customerId"
    />

    <!-- 11. approval: approvalId -->
    <ApprovalPart
      v-else-if="part.type === 'approval'"
      :approval-id="part.props?.approvalId"
      :form="part.props?.form"
      :summary="part.props?.summary"
      :reason="part.props?.reason"
      :created-at="part.props?.createdAt"
      :choices="part.props?.choices"
      :decision="decision ?? part.props?.decision"
      :is-run-answered="isRunAnswered"
      @decided="emit('decided', $event)"
    />

    <!-- 12. draft_reply: text, approvalId, evidence?, threadId? -->
    <DraftReplyPart
      v-else-if="part.type === 'draft_reply'"
      :text="part.props?.text"
      :approval-id="part.props?.approvalId"
      :thread-id="part.props?.threadId"
      :evidence="part.props?.evidence"
      :is-run-answered="isRunAnswered"
      @decided="emit('decided', $event)"
    />

    <!-- 13. choices: items -->
    <ChoicesPart
      v-else-if="part.type === 'choices'"
      :items="part.props?.items"
      :disabled="harnessCount === 0"
      @select="emit('select-choice', $event)"
    />
  </div>
</template>
