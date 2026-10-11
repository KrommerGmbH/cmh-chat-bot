<script setup lang="ts">
import {
  chatSession,
  connectAuth,
  createChatClient,
  provideChatContext,
  staticAuth,
  type ChatPart,
  type HostBridge,
  type LocaleCode,
  type ThemeMode,
} from '@cmh/chat-core'
import { PartRenderer } from '@cmh/chat-parts'
import { ChatCanvasDrawer, ChatDockPanel, ChatMainView } from '@cmh/chat-ui'
import { reactive, ref, watch } from 'vue'
import { demoAllParts, DEMO_IDS } from './demo/data'
import { createDemoServer, type DemoServer } from './demo/server'

type ViewName = 'main' | 'dock' | 'canvas' | 'parts'
const VIEW_NAMES: ViewName[] = ['main', 'dock', 'canvas', 'parts']

const requestLog = reactive<DemoServer['log']>([])
const server = createDemoServer(requestLog)
const hostLog = reactive<string[]>([])

// The playground has no host page: host calls are written to the log panel.
const host: HostBridge = {
  isEmbedded: false,
  navigate(route) {
    hostLog.push(`navigate ${JSON.stringify(route)}`)
  },
  backToSplit() {
    hostLog.push('backToSplit')
  },
  ready() {
    hostLog.push('ready')
  },
}

const client = createChatClient({
  baseUrl: '',
  getToken: () => chatSession.token.value,
  fetch: server.fetch,
  onError: message => hostLog.push(`error ${message}`),
})
provideChatContext({ client, host })

const view = ref<ViewName>('main')
const theme = ref<ThemeMode>('dark')
const locale = ref<LocaleCode>('ko-KR')
const partGroups: Array<{ title: string, parts: ChatPart[] }> = [
  { title: 'parts (13 types)', parts: demoAllParts },
  {
    title: 'approvals (editable / multi + change table)',
    parts: [
      { type: 'approval', props: { approvalId: DEMO_IDS.approvalEditable } },
      { type: 'approval', props: { approvalId: DEMO_IDS.approvalMulti } },
    ],
  },
]

void connectAuth(staticAuth({ token: 'demo-token', locale: locale.value, theme: theme.value, mode: 'page' }))

// The playground is its own page, so it owns the document theme.
watch(theme, (value) => {
  const resolved = value === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = resolved
  document.body.classList.toggle('dark', resolved === 'dark')
  chatSession.theme.value = value
}, { immediate: true })
watch(locale, (value) => {
  chatSession.locale.value = value
})

function logSelectChoice(choice: string) {
  hostLog.push(`select-choice ${choice}`)
}

function logDecided(result: { id: string, chosen: string }) {
  hostLog.push(`decided ${JSON.stringify(result)}`)
}
</script>

<template>
  <div class="flex h-full flex-col bg-background text-foreground">
    <header class="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm">
      <span
        data-testid="demo-badge"
        class="rounded-md bg-warning px-2 py-0.5 text-xs font-semibold text-background"
      >시연 · DEMO DATA</span>
      <strong>cmh-chat-bot playground</strong>
      <nav class="ml-4 flex gap-1">
        <button
          v-for="name in VIEW_NAMES"
          :key="name"
          type="button"
          :data-testid="`view-${name}`"
          class="rounded-md border border-border px-2 py-0.5"
          :class="view === name ? 'bg-primary text-primary-foreground' : 'bg-background'"
          @click="view = name"
        >
          {{ name }}
        </button>
      </nav>
      <label class="ml-auto flex items-center gap-1">theme
        <select
          v-model="theme"
          data-testid="theme-select"
          class="rounded-md border border-border bg-background px-1 py-0.5"
        >
          <option value="dark">dark</option>
          <option value="light">light</option>
        </select>
      </label>
      <label class="flex items-center gap-1">locale
        <select
          v-model="locale"
          data-testid="locale-select"
          class="rounded-md border border-border bg-background px-1 py-0.5"
        >
          <option value="ko-KR">ko-KR</option>
          <option value="de-DE">de-DE</option>
          <option value="en-GB">en-GB</option>
        </select>
      </label>
    </header>

    <main class="flex min-h-0 flex-1">
      <section class="min-h-0 min-w-0 flex-1">
        <ChatMainView
          v-if="view === 'main'"
          :client="client"
          :host="host"
          channel="admin"
          show-toaster
        />
        <div
          v-else-if="view === 'dock'"
          class="ml-auto h-full w-[380px] border-l border-border"
        >
          <ChatDockPanel
            :client="client"
            :host="host"
            channel="desktop"
            show-toaster
          />
        </div>
        <div
          v-else-if="view === 'canvas'"
          class="ml-auto h-full w-[460px] border-l border-border"
        >
          <ChatCanvasDrawer
            :client="client"
            :host="host"
            flow-id="demo-flow-1"
            show-toaster
          />
        </div>
        <div
          v-else
          class="h-full overflow-auto p-4"
          data-testid="parts-gallery"
        >
          <div
            v-for="group in partGroups"
            :key="group.title"
            class="mx-auto mb-8 max-w-3xl"
          >
            <h2 class="mb-3 text-base font-semibold">
              {{ group.title }}
            </h2>
            <div
              v-for="(part, index) in group.parts"
              :key="`${group.title}-${index}`"
              class="mb-4"
              :data-testid="`part-${part.type}`"
            >
              <div class="mb-1 text-xs text-muted-foreground">
                {{ part.type }}
              </div>
              <PartRenderer
                :part="part"
                :harness-count="1"
                :is-run-answered="true"
                @select-choice="logSelectChoice"
                @decided="logDecided"
              />
            </div>
          </div>
        </div>
      </section>

      <aside
        class="hidden w-72 shrink-0 flex-col border-l border-border text-xs lg:flex"
        data-testid="log-panel"
      >
        <div class="border-b border-border px-2 py-1 font-semibold">
          host calls
        </div>
        <ol
          class="max-h-40 overflow-auto px-2 py-1"
          data-testid="host-log"
        >
          <li
            v-for="(line, index) in hostLog"
            :key="index"
            class="break-all"
          >
            {{ line }}
          </li>
        </ol>
        <div class="border-y border-border px-2 py-1 font-semibold">
          requests (demo server)
        </div>
        <ol
          class="min-h-0 flex-1 overflow-auto px-2 py-1"
          data-testid="request-log"
        >
          <li
            v-for="(entry, index) in requestLog"
            :key="index"
            class="break-all"
          >
            {{ entry.method }} {{ entry.path }} {{ entry.body ? JSON.stringify(entry.body) : '' }}
          </li>
        </ol>
      </aside>
    </main>
  </div>
</template>
