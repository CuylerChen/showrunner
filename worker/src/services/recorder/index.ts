import { chromium, Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import { Step, RecordResult } from '../../types'

const VIEWPORT = { width: 1280, height: 720 }
const STEP_PAUSE_MS = 800   // 每步操作后停顿，让画面稳定
const ACTION_TIMEOUT = 15000 // 等待元素最长 15 秒

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
  outputDir: string
): Promise<RecordResult> {
  fs.mkdirSync(outputDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: outputDir,
      size: VIEWPORT,
    },
  })

  const page = await context.newPage()
  const stepTimestamps: RecordResult['stepTimestamps'] = []
  const startTime = Date.now()

  for (const step of steps) {
    const stepStart = (Date.now() - startTime) / 1000

    try {
      console.log(`[recorder] Step ${step.position}: ${step.title}`)
      await executeStep(page, step)
    } catch (err) {
      // 关闭浏览器确保视频文件写入
      await context.close()
      await browser.close()
      throw new Error(
        `Step ${step.position} "${step.title}" failed: ${(err as Error).message}`
      )
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
