<script setup lang="ts">
import {
  Suggestion,
  Suggestions,
} from '@cmh/chat-primitives/ai-elements/suggestion'
import {
  type ChoicesPartEmit,
  type ChoicesPartProps,
  useChoicesPart,
} from './ChoicesPart'

const props = withDefaults(defineProps<ChoicesPartProps>(), {
  items: () => [],
  disabled: false,
})

const emit = defineEmits<ChoicesPartEmit>()
const { handleSelect } = useChoicesPart(props, emit)
</script>

<template>
  <div v-if="items && items.length > 0" class="my-[18px]">
    <Suggestions>
      <Suggestion
        v-for="(item, idx) in items"
        :key="idx"
        :suggestion="item"
        :disabled="disabled"
        @click="handleSelect(item)"
      />
    </Suggestions>
  </div>
</template>
