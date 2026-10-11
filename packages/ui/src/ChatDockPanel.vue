<script setup lang="ts">
import { ref } from 'vue'
import ChatMainView from './ChatMainView.vue'
import { type ChatMainViewProps, chatViewPropDefaults } from './chatViewProps'

// Thin wrapper for a narrow side dock: same props, the narrow layout is always on.
const props = withDefaults(defineProps<ChatMainViewProps>(), chatViewPropDefaults)

const mainView = ref<InstanceType<typeof ChatMainView> | null>(null)
// Host entry (CMH_CHAT_SEND): forwarded to the inner chat view.
defineExpose({ sendText: (text: string) => mainView.value?.sendText(text) ?? Promise.resolve() })
</script>

<template>
  <ChatMainView
    ref="mainView"
    :client="props.client"
    :host="props.host"
    :transport="props.transport"
    :channel="props.channel"
    :flow-id="props.flowId"
    :owns-document="props.ownsDocument"
    :show-toaster="props.showToaster"
    force-narrow
  />
</template>
