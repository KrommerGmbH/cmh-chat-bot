<script setup lang="ts">
import {
  Tool,
  ToolHeader,
} from '@cmh/chat-primitives/ai-elements/tool'
import {
  type StepsPartProps,
  useStepsPart,
} from './StepsPart'

const props = defineProps<StepsPartProps>()
const { mapState } = useStepsPart(props)
</script>

<template>
  <div class="my-2 flex flex-col gap-2">
    <div v-for="(step, idx) in (items || [])" :key="idx" class="w-full">
      <Tool>
        <ToolHeader
          type="dynamic-tool"
          :tool-name="step.tool"
          :title="step.ms !== undefined ? `${step.tool} (${step.ms}ms)` : step.tool"
          :state="mapState(step.state)"
        />
      </Tool>
    </div>
  </div>
</template>
