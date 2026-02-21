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
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })
  // 隐藏自动化标记，避免被 bot 检测拦截
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })
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

  // 监听新标签/弹窗，自动切换到新页面
  context.on('page', (newPage) => {
    newPage.waitForLoadState('domcontentloaded').then(() => {
      session.page = newPage
      console.log(`[browser-session] 切换到新页面 demo=${demoId}: ${newPage.url()}`)
    }).catch(() => {})
  })

  // 页面崩溃时自动重建
  page.on('crash', async () => {
    console.error(`[browser-session] 页面崩溃，尝试重建 demo=${demoId}`)
    try {
      const newPage = await context.newPage()
      session.page = newPage
      await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      console.log(`[browser-session] 页面已重建 demo=${demoId}`)
    } catch (e) {
      console.error(`[browser-session] 重建失败 demo=${demoId}:`, (e as Error).message)
    }
  })

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

  console.log(`[browser-session] input demo=${demoId} type=${event.type}`)

  switch (event.type) {
    case 'click': {
      // 在 click 之前注册 navigation 监听，正确捕获点击触发的页面跳转
      const navPromise = session.page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 5000,
      }).catch(() => null)
      await session.page.mouse.click(event.x, event.y)
      // 等待导航完成，或 1s 后超时（SPA 软导航无整页加载，直接等 1s 让 React 重渲染）
      await Promise.race([navPromise, new Promise(r => setTimeout(r, 1000))])
      break
    }
    case 'type':
      await session.page.keyboard.type(event.text)
      break
    case 'key': {
      await session.page.keyboard.press(event.key)
      if (event.key === 'Enter') {
        const navP = session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null)
        await Promise.race([navP, new Promise(r => setTimeout(r, 1000))])
      }
      break
    }
    case 'navigate':
      await session.page.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      break
    case 'scroll':
      // 用 try/catch 防止页面切换期间 scroll 报错污染日志
      try {
        await session.page.mouse.move(event.x, event.y)
        await session.page.mouse.wheel(0, event.deltaY)
      } catch {
        // 页面正在导航，忽略
      }
      break
  }
  // 操作后短暂等待
  await session.page.waitForTimeout(100).catch(() => {})
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
