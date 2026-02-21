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
    // 隐藏 webdriver 标记
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    // 伪造 Chrome 特有属性（headless 下缺失）
    ;(window as unknown as Record<string, unknown>).chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
    }
    // 伪造插件列表（真实 Chrome 有插件）
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
      ],
    })
    // 伪造语言
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
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

  // 监听新标签/弹窗，强制统一 viewport 后切换到新页面
  context.on('page', (newPage) => {
    // 弹窗（如 OAuth）默认会用小 viewport，统一设为 1280×720
    newPage.setViewportSize(VIEWPORT).catch(() => {})
    newPage.waitForLoadState('domcontentloaded').then(() => {
      session.page = newPage
      console.log(`[browser-session] 切换到新页面 demo=${demoId}: ${newPage.url()}`)
    }).catch(() => {})

    // 弹窗关闭时，切回 context 中最后一个存活页面（通常是主页面）
    newPage.on('close', () => {
      const remaining = context.pages()
      if (remaining.length > 0) {
        const target = remaining[remaining.length - 1]
        session.page = target
        console.log(`[browser-session] 弹窗关闭，切回主页面 demo=${demoId}: ${target.url()}`)
      }
    })
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
    // 等待页面基本加载完成，避免截到黑屏/空白中间态
    await session.page.waitForLoadState('domcontentloaded', { timeout: 1000 }).catch(() => {})
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

    // ── scroll：直接发，不等待，不阻塞 ──────────────────────
    case 'scroll':
      try {
        await session.page.mouse.move(event.x, event.y)
        await session.page.mouse.wheel(0, event.deltaY)
      } catch { /* 页面正在导航，忽略 */ }
      return   // 直接 return，不走底部 waitForTimeout

    // ── click：按元素类型选择策略 ────────────────────────────
    case 'click': {
      const urlBefore = session.page.url()

      const elInfo = await session.page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x as number, y as number)
        if (!el) return null
        const link  = el.closest('a')
        const input = el.closest('input, textarea, select, [contenteditable="true"]')
        return {
          tag:     el.tagName,
          href:    link?.href ?? '',
          isInput: !!input,
        }
      }, [event.x, event.y]).catch(() => null)

      console.log(`[browser-session] click x=${event.x} y=${event.y} el=${JSON.stringify(elInfo)}`)

      // ① 普通链接：直接 goto，绕过 bot 点击检测
      if (elInfo?.href &&
          elInfo.href !== urlBefore &&
          !elInfo.href.startsWith('javascript') &&
          !elInfo.href.startsWith('mailto')) {
        console.log(`[browser-session] 链接导航: ${elInfo.href}`)
        await session.page.goto(elInfo.href, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
        break
      }

      // ② 输入框：只点击，立即返回，不等导航
      if (elInfo?.isInput) {
        await session.page.mouse.click(event.x, event.y)
        break
      }

      // ③ 按钮/其他：点击，等待导航或 600ms 超时
      await session.page.mouse.move(event.x, event.y)
      const navPromise = session.page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 8000,
      }).catch(() => null)
      await session.page.mouse.click(event.x, event.y)
      await Promise.race([navPromise, new Promise(r => setTimeout(r, 600))])

      const urlAfter = session.page.url()
      if (urlAfter !== urlBefore) {
        console.log(`[browser-session] 导航: ${urlBefore} → ${urlAfter}`)
      }
      break
    }

    case 'type':
      await session.page.keyboard.type(event.text)
      break

    case 'key': {
      await session.page.keyboard.press(event.key)
      if (event.key === 'Enter') {
        const navP = session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null)
        await Promise.race([navP, new Promise(r => setTimeout(r, 800))])
      }
      break
    }

    case 'navigate':
      await session.page.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      break
  }

  // click / navigate 后短暂等待，让页面稳定；type/key/scroll 无需等待
  if (event.type === 'click' || event.type === 'navigate') {
    await session.page.waitForTimeout(80).catch(() => {})
  }
}

// ── 保存 storageState 并关闭会话 ─────────────────────────────────
export async function saveState(demoId: string): Promise<string> {
  const session = sessions.get(demoId)
  if (!session) throw new Error('Session not found')

  // 等待页面导航稳定后再保存，确保 OAuth 回调 cookie 已写入
  await session.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

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
