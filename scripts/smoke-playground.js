/**
 * Playground smoke run (Playwright). Start the playground first:
 *   pnpm --filter @cmh/chat-playground build && pnpm --filter @cmh/chat-playground preview --port 4317
 *
 * This file is ONE function expression that takes a Playwright `page` (the form the Playwright MCP
 * tool `browser_run_code` loads by file name; in a Playwright script: `await eval(source)(page)`).
 * It opens every view, takes one screenshot per part type, clicks the approval buttons, and returns
 * a result object. A second pass reloads the page (the demo server state resets on reload) and presses
 * the buttons the first pass leaves out (see `result.secondPassRequests`, `result.buttonsPressed`). Screenshots go to OUT_DIR — set it to an absolute folder outside git, or keep the
 * default smoke-out/ (git-ignored, relative to the Playwright process).
 */
async (page) => {
  const DEMO_EDITABLE_ID = 'demo-approval-editable'
  const PART_TYPES = ['text', 'steps', 'callout', 'table', 'stats', 'code', 'link', 'product_card', 'order_card', 'customer_card', 'approval', 'draft_reply', 'choices']
  const baseUrl = 'http://[::1]:4317/'
  const outDir = 'smoke-out'
  const errors = []
  const clicks = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 300))
  })
  page.on('pageerror', error => errors.push(`PAGEERROR ${String(error).slice(0, 300)}`))

  const requestLog = () => page.getByTestId('request-log').innerText()
  const hostLog = () => page.getByTestId('host-log').innerText()
  const decideLines = async () => (await requestLog()).split(/\r?\n/).filter(line => line.includes('/decide') || line.includes('/talk/send'))
  // Approval + draft card buttons: found = the button exists, pressed = it was enabled and clicked.
  let buttonsFound = 0
  let buttonsPressed = 0
  const pressedByTestId = {}
  const press = async (testId, scope) => {
    const button = scope.getByTestId(testId).first()
    if (await button.count() === 0) return false
    buttonsFound += 1
    if (!(await button.isEnabled())) return false
    await click(testId, button)
    buttonsPressed += 1
    pressedByTestId[testId] = (pressedByTestId[testId] || 0) + 1
    return true
  }
  const click = async (label, locator) => {
    await locator.click()
    clicks.push(label)
    await page.waitForTimeout(400)
  }

  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const result = { partScreenshots: [], missingParts: [], checks: {}, clicks, errors }
  result.checks.demoBadge = await page.getByTestId('demo-badge').isVisible()

  // 1. Parts gallery: one screenshot per part type.
  await click('view-parts', page.getByTestId('view-parts'))
  await page.waitForTimeout(2500)
  for (const type of PART_TYPES) {
    const part = page.getByTestId(`part-${type}`).first()
    if (await part.count() === 0) {
      result.missingParts.push(type)
      continue
    }
    await part.scrollIntoViewIfNeeded()
    await part.screenshot({ path: `${outDir}/part-${type}.png` })
    result.partScreenshots.push(type)
  }

  // 2. Link part and table row link → host.navigate.
  await click('link part', page.getByTestId('part-link').first().locator('button, a').first())
  await click('table row', page.getByTestId('part-table').first().locator('tbody tr').first())
  result.checks.navigateCalls = ((await hostLog()).match(/navigate /g) || []).length

  // 3. Choices part → select-choice.
  await click('choice', page.getByTestId('part-choices').first().locator('button').first())
  result.checks.selectChoice = (await hostLog()).includes('select-choice')

  // 4. Approvals in the gallery. Order on the page: simple (inside the 13 parts), editable, multi.
  const approvals = page.getByTestId('part-approval')
  result.checks.approvalCount = await approvals.count()

  // 4a. Multi + change table: uncheck the first box, approve the selected ones.
  const multi = approvals.nth(2)
  await multi.scrollIntoViewIfNeeded()
  result.checks.changeTableRows = await multi.locator('table tbody tr').count()
  await multi.screenshot({ path: `${outDir}/approval-multi-before.png` })
  await click('multi: uncheck first', multi.locator('[role="checkbox"]').first())
  await press('approval-approve-selected', multi)
  await page.waitForTimeout(800)
  await multi.screenshot({ path: `${outDir}/approval-multi-after.png` })

  // 4b. Editable: change the text, approve.
  const editable = approvals.nth(1)
  await editable.scrollIntoViewIfNeeded()
  await editable.locator('textarea').first().fill('고쳐 쓴 답변 (smoke)')
  await editable.screenshot({ path: `${outDir}/approval-editable-before.png` })
  await press('editable-approve', editable)
  await page.waitForTimeout(800)
  await editable.screenshot({ path: `${outDir}/approval-editable-after.png` })

  // 4c. Simple: reject.
  const simple = approvals.nth(0)
  await simple.scrollIntoViewIfNeeded()
  await press('approval-reject', simple)
  await page.waitForTimeout(800)
  await simple.screenshot({ path: `${outDir}/approval-simple-after.png` })

  // 4d. Draft reply: every button inside it, in order.
  const draft = page.getByTestId('part-draft_reply').first()
  await draft.scrollIntoViewIfNeeded()
  const draftButtons = await draft.locator('button:not([disabled])').count()
  result.checks.draftButtons = draftButtons
  await press('draft-approve', draft)
  await page.waitForTimeout(1200)
  await press('draft-retry', draft)
  await draft.screenshot({ path: `${outDir}/draft-reply-after.png` })

  result.decideRequests = await decideLines()

  // 5. Main view: send a message, wait for the demo answer, then decide the pending approvals.
  await click('view-main', page.getByTestId('view-main'))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outDir}/view-main.png` })
  const input = page.locator('textarea').last()
  await input.fill('상품 보여 줘')
  await input.press('Enter')
  clicks.push('send message (Enter)')
  await page.waitForTimeout(5000)
  result.checks.demoReplyShown = (await page.locator('body').innerText()).includes('상품 카드입니다')
  await page.screenshot({ path: `${outDir}/view-main-after-send.png` })

  // 6. Dock and canvas wrappers, light theme, German locale.
  await click('view-dock', page.getByTestId('view-dock'))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/view-dock.png` })
  await click('view-canvas', page.getByTestId('view-canvas'))
  await page.waitForTimeout(1200)
  result.checks.canvasFlowBadge = (await page.locator('body').innerText()).includes('demo-flow-1')
  await page.screenshot({ path: `${outDir}/view-canvas.png` })
  await page.getByTestId('theme-select').selectOption('light')
  await page.getByTestId('locale-select').selectOption('de-DE')
  await click('view-main (light, de-DE)', page.getByTestId('view-main'))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outDir}/view-main-light-de.png` })
  result.checks.themeAttribute = await page.evaluate(() => document.documentElement.dataset.theme)

  // 7. Second pass: reload (demo state resets) and press the buttons the first pass did not press.
  const secondPassStart = (await decideLines()).length
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await click('view-parts (second pass)', page.getByTestId('view-parts'))
  await page.waitForTimeout(2500)
  const cards = page.getByTestId('part-approval')
  result.checks.secondPassApprovalCount = await cards.count()
  // The request log lives in the page: after the reload it starts empty, so count from zero.
  const secondPassBase = (await decideLines()).length

  // 7a. Simple approval: approve.
  const simple2 = cards.nth(0)
  await simple2.scrollIntoViewIfNeeded()
  await press('approval-approve', simple2)

  // 7b. Editable approval: reject. Press through (open the reason input, then confirm) until a reject request appears.
  const editable2 = cards.nth(1)
  await editable2.scrollIntoViewIfNeeded()
  let rejectSeen = false
  for (const testId of ['editable-reject-reason', 'editable-reject-confirm', 'editable-reject']) {
    await press(testId, editable2)
    await page.waitForTimeout(400)
    const lines = (await decideLines()).slice(secondPassBase)
    if (lines.some(line => line.includes('/decide') && line.includes('"chosen":"reject"') && line.includes(DEMO_EDITABLE_ID))) {
      rejectSeen = true
      break
    }
  }
  result.checks.editableRejectSeen = rejectSeen

  // 7c. Multi approval: type a note, reject all.
  const multi2 = cards.nth(2)
  await multi2.scrollIntoViewIfNeeded()
  const note = multi2.getByTestId('approval-multi-note')
  if (await note.count() > 0) await note.fill('smoke: reject all (second pass)')
  await press('approval-reject-all', multi2)

  // 7d. Draft reply: reject.
  const draft2 = page.getByTestId('part-draft_reply').first()
  await draft2.scrollIntoViewIfNeeded()
  await press('draft-reject', draft2)
  await page.waitForTimeout(1200)
  result.secondPassRequests = (await decideLines()).slice(secondPassBase)
  result.secondPassStartedAfter = secondPassStart

  result.buttonsFound = buttonsFound
  result.buttonsPressed = buttonsPressed
  result.buttonsPressedByTestId = pressedByTestId

  return result
}
