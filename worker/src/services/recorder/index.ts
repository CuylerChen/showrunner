import { chromium, Page, Cookie } from 'playwright'
import path from 'path'
import fs from 'fs'
import { Step, RecordResult } from '../../types'

const VIEWPORT = { width: 1280, height: 720 }
const STEP_PAUSE_MS = 800    // 每步操作后停顿，让画面稳定
const ACTION_TIMEOUT = 15000  // 等待元素最长 15 秒

// navigate 失败则抛出（无法继续）；click/fill/assert 失败则跳过
const HARD_FAIL_TYPES = new Set(['navigate'])

async function executeStep(page: Page, step: Step): Promise<void> {
  switch (step.action_type) {
    case 'navigate':
      await page.goto(step.value!, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT })
      break

    case 'click':
      await page.locator(step.selector!).first().click({ timeout: ACTION_TIMEOUT })
      break

    case 'fill':
      await page.locator(step.selector!).first().fill(step.value ?? '', { timeout: ACTION_TIMEOUT })
      break

    case 'wait':
      await page.waitForTimeout(parseInt(step.value ?? '1000'))
      break

    case 'assert':
      await page.locator(step.selector!).first().waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
      break
  }

  // 操作完成后等待画面稳定
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
  })
  // 解析已保存的登录状态（支持旧格式 Cookie[] 和新格式 StorageState）
  let storageState: Parameters<typeof browser.newContext>[0]['storageState'] = undefined
  let legacyCookies: Cookie[] | null = null

  if (sessionCookiesJson) {
    try {
      const parsed = JSON.parse(sessionCookiesJson)
      if (Array.isArray(parsed)) {
        // 旧格式：Cookie[]，兼容处理
        legacyCookies = parsed
        console.log(`[recorder] 使用旧格式 Cookie（${parsed.length} 条）`)
      } else if (parsed && typeof parsed === 'object') {
        // 新格式：Playwright StorageState（含 cookies + localStorage）
        storageState = parsed
        console.log(`[recorder] 使用 StorageState（cookies=${parsed.cookies?.length ?? 0}，origins=${parsed.origins?.length ?? 0}）`)
      }
    } catch (e) {
      console.warn('[recorder] 登录状态解析失败，跳过:', (e as Error).message)
    }
  }

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: outputDir, size: VIEWPORT },
    ...(storageState ? { storageState } : {}),
  })

  if (legacyCookies) {
    await context.addCookies(legacyCookies)
  }

  const page = await context.newPage()
  const stepTimestamps: RecordResult['stepTimestamps'] = []
  const startTime = Date.now()

  for (const step of steps) {
    const stepStart = (Date.now() - startTime) / 1000

    try {
      console.log(`[recorder] Step ${step.position}: ${step.title} | selector=${step.selector ?? 'n/a'}`)
      await executeStep(page, step)
    } catch (err) {
      const errMsg = (err as Error).message
      // 截图帮助调试选择器问题
      try {
        const screenshotPath = path.join(outputDir, `step-${step.position}-error.png`)
        await page.screenshot({ path: screenshotPath, fullPage: false })
        console.error(`[recorder] Step ${step.position} 失败截图: ${screenshotPath}`)
      } catch {}

      if (HARD_FAIL_TYPES.has(step.action_type)) {
        // navigate 失败无法继续，关闭并抛出
        await context.close()
        await browser.close()
        throw new Error(`Step ${step.position} "${step.title}" failed: ${errMsg}`)
      }

      // click / fill / assert 失败 → 跳过此步，继续录制
      console.warn(`[recorder] Step ${step.position} 跳过 (${step.action_type}): ${errMsg.slice(0, 120)}`)
    }

    const stepEnd = (Date.now() - startTime) / 1000
    stepTimestamps.push({ stepId: step.id, start: stepStart, end: stepEnd })
  }

  // 关闭 context 会触发 Playwright 写入视频文件
  await context.close()
  await browser.close()

  // Playwright 录制的文件在 outputDir 下，找到最新生成的 .webm
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.webm'))
  if (files.length === 0) throw new Error('录制完成但未找到视频文件')

  const videoPath = path.join(outputDir, files[files.length - 1])
  console.log(`[recorder] 录制完成: ${videoPath}`)

  return { videoPath, stepTimestamps }
}
