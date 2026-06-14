import fs from 'fs/promises'
import path from 'path'
import { chromium, type Page } from 'playwright'
import { assertSafePublicUrl, resolveSafeRedirectUrl } from '../../utils/safe-url'

const VIDEO_DIR = process.env.VIDEO_DIR ?? '/data/videos'

export interface ScreenshotAsset {
  url: string
  role: 'home' | 'features' | 'pricing' | 'customers' | 'about' | 'product'
  localPath: string
  publicUrl: string
}

type ScreenshotRole = ScreenshotAsset['role']
type ScreenshotReadinessPage = Pick<Page, 'waitForLoadState' | 'waitForFunction' | 'evaluate' | 'waitForTimeout'>

export interface ScreenshotDensityMetrics {
  textLength: number
  imageCount: number
}

function roleForUrl(url: string, index: number): ScreenshotRole {
  if (index === 0) return 'home'

  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.includes('pricing') || pathname.includes('plans')) return 'pricing'
    if (pathname.includes('customer') || pathname.includes('case-stud')) return 'customers'
    if (pathname.includes('about') || pathname.includes('company')) return 'about'
    if (pathname.includes('feature') || pathname.includes('solution')) return 'features'
    return 'product'
  } catch {
    return index === 0 ? 'home' : 'product'
  }
}

function filenameForUrl(url: string, role: ScreenshotRole, index: number): string {
  let slug: string = role
  try {
    const parsed = new URL(url)
    const pathSlug = parsed.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    if (pathSlug) slug = `${role}-${pathSlug}`.slice(0, 80)
  } catch {}

  return `${String(index + 1).padStart(2, '0')}-${slug}.png`
}

export function shouldRetrySparseScreenshot(metrics: ScreenshotDensityMetrics): boolean {
  return metrics.textLength < 120 && metrics.imageCount === 0
}

export async function preparePageForScreenshot(page: ScreenshotReadinessPage): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

  await page.waitForFunction(() => {
    const bodyText = document.body?.innerText?.replace(/\s+/g, ' ').trim() ?? ''
    return bodyText.length > 80 || document.images.length > 0
  }, undefined, { timeout: 8000 }).catch(() => {})

  await page.waitForFunction(() => {
    const selectors = [
      '[aria-busy="true"]',
      '.skeleton',
      '[class*="skeleton"]',
      '.spinner',
      '[class*="spinner"]',
      '.loading',
      '[class*="loading"]',
    ]

    return !selectors.some(selector => Array.from(document.querySelectorAll(selector)).some(element => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 8 && rect.height > 8 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0
    }))
  }, undefined, { timeout: 4000 }).catch(() => {})

  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined)
    }

    const visibleImages = Array.from(document.images)
      .filter(image => {
        const rect = image.getBoundingClientRect()
        return rect.width > 24 && rect.height > 24
      })
      .slice(0, 16)

    await Promise.all(visibleImages.map(image => {
      if (image.complete) return Promise.resolve()
      if (image.decode) return image.decode().catch(() => undefined)
      return new Promise<void>(resolve => {
        image.onload = () => resolve()
        image.onerror = () => resolve()
      })
    }))

    window.scrollTo(0, 0)
  }).catch(() => {})

  await page.waitForTimeout(300)
}

export async function getPageDensityMetrics(page: Pick<Page, 'evaluate'>): Promise<ScreenshotDensityMetrics> {
  return await page.evaluate(() => {
    const textLength = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().length
    const imageCount = Array.from(document.images).filter(image => {
      const rect = image.getBoundingClientRect()
      return rect.width > 24 && rect.height > 24
    }).length

    return { textLength, imageCount }
  }).catch(() => ({ textLength: 0, imageCount: 0 }))
}

export async function captureWebsiteScreenshots(demoId: string, urls: string[]): Promise<ScreenshotAsset[]> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean))).slice(0, 5)
  if (!uniqueUrls.length) return []

  const assetDir = path.join(VIDEO_DIR, demoId, 'assets')
  await fs.mkdir(assetDir, { recursive: true })

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
  const browser = await chromium.launch(executablePath ? { executablePath } : {})

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
    const assets: ScreenshotAsset[] = []

    for (const [index, url] of uniqueUrls.entries()) {
      const role = roleForUrl(url, index)
      const filename = filenameForUrl(url, role, index)
      const localPath = path.join(assetDir, filename)

      try {
        const safeUrl = await resolveSafeRedirectUrl(url)
        await page.goto(safeUrl.toString(), { waitUntil: 'networkidle', timeout: 20000 })
        await assertSafePublicUrl(page.url())
        await preparePageForScreenshot(page)
        const metrics = await getPageDensityMetrics(page)
        if (shouldRetrySparseScreenshot(metrics)) {
          await page.waitForTimeout(1500)
          await preparePageForScreenshot(page)
        }
        await page.screenshot({ path: localPath, fullPage: true })
        assets.push({
          url: safeUrl.toString(),
          role,
          localPath,
          publicUrl: `/videos/${demoId}/assets/${filename}`,
        })
      } catch (err) {
        console.warn(`[parser] screenshot failed for ${url}: ${(err as Error).message}`)
      }
    }

    return assets
  } finally {
    await browser.close()
  }
}
