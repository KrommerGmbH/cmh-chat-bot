import type { AiModel, HostBridge, TabsContextPane } from '@cmh/chat-core'

/**
 * Hard-coded demo replies of the desktop «local» mode (seed App.ts generateLocalSmartReply).
 * Behaviour and texts are unchanged; the desktop bridge calls go through the `host` prop.
 */
export async function generateLocalSmartReply(
  host: HostBridge,
  models: AiModel[],
  userText: string,
  modelId: string | null,
): Promise<string> {
  const selectedModel = models.find(m => m.id === modelId)?.label || 'Smart Router'

  // 1. Electron 메인 프로세스에서 전체 Split View 탭 목록 조회
  let panes: TabsContextPane[] = []

  if (host.getTabsContext) {
    try {
      const ctx = await host.getTabsContext()
      if (ctx?.ok && Array.isArray(ctx.panes)) {
        panes = ctx.panes
      }
    } catch (e) {
      console.warn('Failed to get tabs context:', e)
    }
  }

  const allTabs: Array<{
    tabId: string
    kind: string
    title: string
    url: string
    active: boolean
    paneIndex: number
    tabIndex: number
  }> = []

  panes.forEach(p => {
    p.tabs.forEach((t, tIdx) => {
      allTabs.push({ ...t, paneIndex: p.paneIndex, tabIndex: tIdx + 1 })
    })
  })

  // [A. 탭 / Split View 목록 확인 질의]
  const isTabQuery = /(탭|tab|스플릿|split|화면|열린|어디|목록|정보)/i.test(userText) &&
    /(목록|현황|뭐|무슨|어떤|리스트|알려|보여|알고|있어)/i.test(userText)

  if (isTabQuery) {
    if (allTabs.length === 0) {
      return `📑 **[현재 Split View 탭 현황]**\n\n현재 열려있는 추가 브라우저 탭이 없습니다.\n상단 주소창이나 '+' 버튼으로 새 탭을 열어 구글 검색 등을 실행해 보세요.`
    }

    let reply = `📑 **[현재 열려있는 Split View 탭 목록]** (총 ${allTabs.length}개 탭 감지됨)\n\n`
    panes.forEach(p => {
      reply += `**Split View #${p.paneIndex}**:\n`
      p.tabs.forEach((t, idx) => {
        const activeMark = t.active ? ' *(활성)*' : ''
        reply += `  • [${idx + 1}번 탭] **${t.title}**${activeMark}\n    - URL: \`${t.url || '빈 페이지'}\` (종류: ${t.kind})\n`
      })
      reply += '\n'
    })
    reply += `💡 *"3번째 뷰 구글 탭에서 '최신 쇼핑몰 트렌드' 검색해줘"* 와 같이 명령하시면 해당 탭을 직접 조작하여 실시간 검색을 수행합니다.`
    return reply
  }

  // [B. 구글 검색 및 브라우저 탐색 조작]
  const isSearchQuery = /(구글|google|검색|search|찾아|조회|알아봐)/i.test(userText)
  if (isSearchQuery) {
    const paneMatch = userText.match(/(\d+)\s*(?:번째|번)?\s*(?:split\s*view|스플릿\s*뷰|뷰|pane)/i)
    const tabMatch = userText.match(/(\d+)\s*(?:번째|번)?\s*탭/i)
    const targetPaneIndex = paneMatch ? parseInt(paneMatch[1], 10) : undefined
    const targetTabIndex = tabMatch ? parseInt(tabMatch[1], 10) : undefined

    // 검색어 추출
    let query = userText
      .replace(/(\d+)\s*(?:번째|번)?\s*(?:split\s*view|스플릿\s*뷰|뷰|pane|탭)/gi, '')
      .replace(/(?:구글|google)\s*(?:검색|에서|으로)?/gi, '')
      .replace(/(?:검색(?:해서|해줘|해봐|해|하십시오|하기)?|찾아(?:줘|봐|라)?|알아봐(?:줘)?)/gi, '')
      .replace(/(?:무언가|뭔가|것좀|정보|자료)/gi, '')
      .trim()

    if (!query || query.length < 2) {
      const cleaned = userText.replace(/(?:구글|google|검색|찾아줘)/gi, '').trim()
      query = cleaned.length >= 2 ? cleaned : userText
    }

    if (host.browserAct) {
      try {
        const actRes = await host.browserAct({
          action: 'search',
          text: query,
          paneIndex: targetPaneIndex,
          tabIndex: targetTabIndex,
        })

        if (actRes?.ok && Array.isArray(actRes.results) && actRes.results.length > 0) {
          let reply = `🔍 **[Google 실시간 브라우저 검색 결과]**\n`
          reply += `- **대상 탭**: ${actRes.tabTitle || 'Google'} (${actRes.tabUrl || 'https://www.google.com'})\n`
          reply += `- **검색 키워드**: "${actRes.query || query}"\n\n`
          reply += `**실시간 상위 검색 결과 (${actRes.results.length}건):**\n\n`
          actRes.results.forEach((item: { title: string; url: string; snippet?: string }, idx: number) => {
            reply += `${idx + 1}. **[${item.title}](${item.url})**\n`
            if (item.snippet) {
              reply += `   > ${item.snippet}\n`
            }
            reply += `   🔗 \`${item.url}\`\n\n`
          })
          reply += `✨ *요청하신 검색어 "${query}"로 실제 브라우저 탭을 조작하여 실시간 검색을 완수했습니다.*`
          return reply
        } else if (actRes?.ok) {
          return `🔍 **[Google 검색 완료]**\n- 대상 탭: ${actRes.tabTitle || 'Google'}\n- 검색어: "${query}"\n\n검색을 실행했으나 즉시 추출된 검색 결과 항목이 없습니다. 화면 탭에서 직접 결과를 확인하실 수 있습니다.`
        } else {
          return `⚠️ **[브라우저 조작 실패]**\n- 오류: ${actRes?.error || '알 수 없는 오류'}\n- 대상 탭을 찾을 수 없거나 브라우저 탭이 준비되지 않았습니다. Split View에 구글 탭이 열려있는지 확인해 주세요.`
        }
      } catch (actErr) {
        console.error('Browser action failed:', actErr)
        return `⚠️ 브라우저 조작 중 오류가 발생했습니다: ${actErr instanceof Error ? actErr.message : String(actErr)}`
      }
    } else {
      return `⚠️ 현재 환경에서는 Electron \`window.cmhChat.browserAct\` 브릿지를 사용할 수 없습니다.`
    }
  }

  // [C. 화면 텍스트 요약 / 추출]
  const isContentQuery = /(요약|내용|읽어|본문|화면\s*봐|extract)/i.test(userText)
  if (isContentQuery && host.browserAct) {
    try {
      const actRes = await host.browserAct({ action: 'get-content' })
      if (actRes?.ok && actRes.text) {
        const sample = (actRes.text as string).replace(/\s+/g, ' ').slice(0, 400)
        return `📄 **[활성 브라우저 탭 화면 요약]**\n- **제목**: ${actRes.title || 'Untitled'}\n- **주소**: \`${actRes.url}\`\n\n**본문 내용 미리보기:**\n> ${sample}...\n\n💡 위 화면 내용을 기반으로 추가 질문이나 작업을 지시하실 수 있습니다.`
      }
    } catch (e) {
      console.warn('Get content failed:', e)
    }
  }

  // [D. 온디바이스 백그라운드 상주 ONNX 모델 실시간 추론 (0.1~0.3초)]
  if (host.infer) {
    try {
      const inferRes = await host.infer({
        prompt: userText,
        modelId: modelId || undefined,
        maxTokens: 200,
      })
      if (inferRes?.ok && inferRes.answer && inferRes.answer.trim().length > 0) {
        return `[${selectedModel} · CPU 상주 메모리]\n${inferRes.answer}`
      }
    } catch (inferErr) {
      console.warn('Onnx warm pool inference error:', inferErr)
    }
  }

  // [E. 일반 상식 / 질문 / 대화 스마트 라우터 응답]
  if (/(수도|capital)/i.test(userText)) {
    if (/(한국|대한민국|korea)/i.test(userText)) {
      return `대한민국의 수도는 **서울특별시(Seoul)**입니다.`
    }
    if (/(독일|germany|deutschland)/i.test(userText)) {
      return `독일의 수도는 **베를린(Berlin)**입니다.`
    }
    if (/(프랑스|france|frankreich)/i.test(userText)) {
      return `프랑스의 수도는 **파리(Paris)**입니다.`
    }
  }

  if (/(laya|gemma|모델|llm|벤치마크|bench)/i.test(userText)) {
    const statusRes = host.getModelStatus ? await host.getModelStatus().catch(() => null) : null
    const st = statusRes?.status
    const stText = st ? `\n- **백그라운드 메모리 상태**: ${st.state} (${st.message})` : ''
    return `🤖 **[로컬 온디바이스 모델 정보]**\n- **Laya 8B**: 다국어 의사결정 및 브라우저 액션(CLICK, TYPE_TEXT) 타겟팅 모델\n- **Gemma 4**: 경량 로컬 추론 모델${stText}\n\n앱 기동 즉시 백그라운드 CPU 메모리에 적재되어 매번 10분 대기 없이 0.2초 즉시 추론을 지원합니다.`
  }

  // 기본 지능형 라우터 답변
  return `[${selectedModel}] "${userText}" 요청을 정상 수신했습니다.\n\n` +
    `💡 **활용 가능한 챗봇 기능:**\n` +
    `1. **스플릿 뷰 탭 조회**: *"현재 열려있는 탭 목록 보여줘"*\n` +
    `2. **브라우저 실시간 검색**: *"3번째 뷰 구글 탭에서 'Shopware' 검색해서 찾아줘"*\n` +
    `3. **화면 내용 추출**: *"현재 탭 내용 요약해줘"*`
}
