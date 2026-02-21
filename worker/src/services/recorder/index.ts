import { chromium, Page, Cookie, BrowserContext } from 'playwright'
import path from 'path'
import fs from 'fs'
import { Step, RecordResult } from '../../types'

const VIEWPORT          = { width: 1280, height: 720 }
const STEP_PAUSE_MS     = 2500   // 每步操作后停顿，等 JS 渲染完成
const ACTION_TIMEOUT    = 20000  // 等待元素最长 20 秒
const NAV_TIMEOUT       = 30000  // 导航超时 30 秒
const NETWORK_IDLE_MS   = 3000   // networkidle 超时（JS 重应用可能永远有后台请求）

// navigate 失败则抛出（无法继续）；其他类型失败则跳过
const HARD_FAIL_TYPES = new Set(['navigate'])

/** 等待页面稳定：先等 load，再尝试 networkidle（超时不报错） */
async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState('load', { timeout: NAV_TIMEOUT }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {})
}

async function executeStep(page: Page, step: Step): Promise<void> {
  switch (step.action_type) {
    case 'navigate':
      // 先等 load，再尝试 networkidle，确保 JS 渲染完成
      await page.goto(step.value!, { waitUntil: 'load', timeout: NAV_TIMEOUT })
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {})
      break

    case 'click': {
      const loc = page.locator(step.selector!).first()
      await loc.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
      // 滚动到元素可见区域再点击，防止被遮挡
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {})
      await loc.click({ timeout: ACTION_TIMEOUT })
      // 点击后等待可能触发的导航或 JS 重渲染
      await waitForPageStable(page)
      break
    }

    case 'fill': {
      const loc = page.locator(step.selector!).first()
      await loc.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
      await loc.fill(step.value ?? '', { timeout: ACTION_TIMEOUT })
      break
    }

    case 'wait':
      await page.waitForTimeout(parseInt(step.value ?? '2000'))
      break

    case 'assert':
      await page.locator(step.selector!).first().waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
      break
  }

  // 每步结束后额外停顿，让视频画面稳定（给观众时间看清内容）
  await page.waitForTimeout(STEP_PAUSE_MS)
}

export async function recordDemo(
  steps: Step[],
  outputDir: string,
  sessionCookiesJson?: string | null
): Promise<RecordResult> {
  fs.mkdirSync(outputDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      // 强制软件渲染，避免无 GPU 环境下的渲染问题
      '--disable-gpu',
      '--use-gl=swiftshader',
      // 提升渲染质量
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
    ],
  })

  // 解析已保存的登录状态（支持旧格式 Cookie[] 和新格式 StorageState）
  let storageState: Parameters<typeof browser.newContext>[0]['storageState'] = undefined
  let legacyCookies: Cookie[] | null = null

  if (sessionCookiesJson) {
    try {
      const parsed = JSON.parse(sessionCookiesJson)
      if (Array.isArray(parsed)) {
        legacyCookies = parsed
        console.log(`[recorder] 使用旧格式 Cookie（${parsed.length} 条）`)
      } else if (parsed && typeof parsed === 'object') {
        storageState = parsed
        console.log(`[recorder] 使用 StorageState（cookies=${parsed.cookies?.length ?? 0}，origins=${parsed.origins?.length ?? 0}）`)
      }
    } catch (e) {
      console.warn('[recorder] 登录状态解析失败，跳过:', (e as Error).message)
    }
  }

  const context: BrowserContext = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: outputDir, size: VIEWPORT },
    // 设置真实 User-Agent 避免被识别为 bot
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ...(storageState ? { storageState } : {}),
  })

  // 隐藏 webdriver 标记
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  if (legacyCookies) {
    await context.addCookies(legacyCookies)
  }

  const page = await context.newPage()
  const stepTimestamps: RecordResult['stepTimestamps'] = []
  const startTime = Date.now()

  for (const step of steps) {
    const stepStart = (Date.now() - startTime) / 1000
    console.log(`[recorder] Step ${step.position}: ${step.title} | selector=${step.selector ?? 'n/a'}`)

    try {
      await executeStep(page, step)
    } catch (err) {
      const errMsg = (err as Error).message
      // 截图帮助调试
      try {
        const screenshotPath = path.join(outputDir, `step-${step.position}-error.png`)
        await page.screenshot({ path: screenshotPath })
        console.error(`[recorder] Step ${step.position} 失败，截图: ${screenshotPath}`)
      } catch {}

      if (HARD_FAIL_TYPES.has(step.action_type)) {
        await context.close()
        await browser.close()
        throw new Error(`Step ${step.position} "${step.title}" failed: ${errMsg}`)
      }

      console.warn(`[recorder] Step ${step.position} 跳过 (${step.action_type}): ${errMsg.slice(0, 120)}`)
    }

    const stepEnd = (Date.now() - startTime) / 1000
    stepTimestamps.push({ stepId: step.id, start: stepStart, end: stepEnd })
  }

  // 关闭 context 触发 Playwright 写入视频文件
  await context.close()
  await browser.close()

  // 找到录制生成的 .webm 文件
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.webm'))
  if (files.length === 0) throw new Error('录制完成但未找到视频文件')

  const videoPath = path.join(outputDir, files[files.length - 1])
  console.log(`[recorder] 录制完成: ${videoPath}`)

  return { videoPath, stepTimestamps }
}
