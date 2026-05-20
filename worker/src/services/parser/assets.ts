import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

const VIDEO_DIR = process.env.VIDEO_DIR ?? '/data/videos'

export interface ScreenshotAsset {
  url: string
  role: 'home' | 'features' | 'pricing' | 'customers' | 'about' | 'product'
  localPath: string
  publicUrl: string
}

type ScreenshotRole = ScreenshotAsset['role']

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
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
        await page.screenshot({ path: localPath, fullPage: true })
        assets.push({
          url,
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
