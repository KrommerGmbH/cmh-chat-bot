<script setup lang="ts">
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@cmh/chat-primitives/ai-elements/code-block'
import {
  type CodePartProps,
  useCodePart,
} from './CodePart'

const props = withDefaults(defineProps<CodePartProps>(), {
  lang: 'typescript',
})
const { safeLanguage } = useCodePart(props)
</script>

<template>
  <div class="my-2 overflow-hidden rounded-lg border">
    <CodeBlock :code="props.body" :language="safeLanguage">
      <CodeBlockHeader>
        <CodeBlockTitle>{{ props.lang || 'code' }}</CodeBlockTitle>
        <CodeBlockCopyButton />
      </CodeBlockHeader>
    </CodeBlock>
  </div>
</template>
