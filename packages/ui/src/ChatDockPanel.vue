<script setup lang="ts">
import ChatMainView from './ChatMainView.vue'
import { type ChatMainViewProps, chatViewPropDefaults } from './chatViewProps'

// Thin wrapper for a narrow side dock: same props, the narrow layout is always on.
const props = withDefaults(defineProps<ChatMainViewProps>(), chatViewPropDefaults)
</script>

<template>
  <ChatMainView
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
