import { chromium, Browser, BrowserContext, Page } from 'playwright'

const VIEWPORT = { width: 1280, height: 720 }
const SESSION_TIMEOUT_MS = 15 * 60 * 1000  // 15 分钟无操作自动关闭

interface Session {
  browser: Browser
  context: BrowserContext
  page: Page
  demoId: string
  timer: ReturnType<typeof setTimeout>
}

const sessions = new Map<string, Session>()

function resetTimer(session: Session) {
  clearTimeout(session.timer)
  session.timer = setTimeout(async () => {
    console.log(`[browser-session] 会话超时，关闭 demo=${session.demoId}`)
    await closeSession(session.demoId)
  }, SESSION_TIMEOUT_MS)
}

export async function startSession(demoId: string, url: string): Promise<void> {
  // 如有旧会话先关闭
  await closeSession(demoId)

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()

  // 导航到目标页，忽略超时错误
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
  } catch {
    // 部分站点首次加载较慢，继续即可
  }

  const session: Session = {
    browser, context, page, demoId,
    timer: setTimeout(() => {}, 0),
  }
  sessions.set(demoId, session)
  resetTimer(session)
  console.log(`[browser-session] 会话已启动 demo=${demoId}`)
}

export async function getScreenshot(demoId: string): Promise<Buffer | null> {
  const session = sessions.get(demoId)
  if (!session) return null
  resetTimer(session)
  try {
    return await session.page.screenshot({ type: 'jpeg', quality: 75 })
  } catch {
    return null
  }
}

export async function getCurrentUrl(demoId: string): Promise<string | null> {
  const session = sessions.get(demoId)
  if (!session) return null
  try { return session.page.url() } catch { return null }
}

// ── 输入事件 ─────────────────────────────────────────────────────
type InputEvent =
  | { type: 'click';    x: number; y: number }
  | { type: 'type';     text: string }
  | { type: 'key';      key: string }
  | { type: 'navigate'; url: string }
  | { type: 'scroll';   x: number; y: number; deltaY: number }

export async function handleInput(demoId: string, event: InputEvent): Promise<void> {
  const session = sessions.get(demoId)
  if (!session) throw new Error('Session not found')
  resetTimer(session)

  switch (event.type) {
    case 'click':
      await session.page.mouse.click(event.x, event.y)
      break
    case 'type':
      await session.page.keyboard.type(event.text)
      break
    case 'key':
      await session.page.keyboard.press(event.key)
      break
    case 'navigate':
      await session.page.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      break
    case 'scroll':
      await session.page.mouse.move(event.x, event.y)
      await session.page.mouse.wheel(0, event.deltaY)
      break
  }
  // 操作后短暂等待页面响应
  await session.page.waitForTimeout(300).catch(() => {})
}

// ── 保存 storageState 并关闭会话 ─────────────────────────────────
export async function saveState(demoId: string): Promise<string> {
  const session = sessions.get(demoId)
  if (!session) throw new Error('Session not found')

  const state = await session.context.storageState()
  await closeSession(demoId)
  console.log(`[browser-session] storageState 已保存 demo=${demoId}`)
  return JSON.stringify(state)
}

export async function closeSession(demoId: string): Promise<void> {
  const session = sessions.get(demoId)
  if (!session) return
  clearTimeout(session.timer)
  await session.context.close().catch(() => {})
  await session.browser.close().catch(() => {})
  sessions.delete(demoId)
  console.log(`[browser-session] 会话已关闭 demo=${demoId}`)
}

export function hasSession(demoId: string): boolean {
  return sessions.has(demoId)
}
