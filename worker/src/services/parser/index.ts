import { Step } from '../../types'
import { captureWebsiteScreenshots, type ScreenshotAsset } from './assets'
import {
  generateProductStoryScenes,
  type ProductStoryInput,
  type ProductStoryScene,
} from './scenes'

const MAX_PAGES = 6
const MAX_PAGE_TEXT = 2600

export interface PageData {
  url: string
  title: string
  description: string
  headings: string[]
  text: string
}

export interface WebsiteAnalysis {
  pages: PageData[]
  urls: string[]
  sourceSummary: string
}

export interface ParseStepsOptions {
  audience?: string
  keyPoints?: string
  brandTone?: string
  ctaText?: string
  ctaUrl?: string
}

export interface ParseProductStoryResult {
  steps: ProductStoryScene[]
  sourceSummary: string
  thumbnailUrl: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function matchMeta(html: string, names: string[]): string {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) return stripHtml(match[1]).slice(0, 400)
    }
  }
  return ''
}

function extractTitle(html: string): string {
  const ogTitle = matchMeta(html, ['og:title', 'twitter:title'])
  if (ogTitle) return ogTitle
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? stripHtml(match[1]).slice(0, 160) : ''
}

function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) && headings.length < 24) {
    const text = stripHtml(match[1]).slice(0, 180)
    if (text && !headings.includes(text)) headings.push(text)
  }
  return headings
}

function extractLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  const links = new Set<string>()
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl)
      if (url.origin !== origin) continue
      url.hash = ''
      const path = url.pathname.toLowerCase()
      const useful =
        path === '/' ||
        path.includes('feature') ||
        path.includes('product') ||
        path.includes('solution') ||
        path.includes('pricing') ||
        path.includes('customer') ||
        path.includes('about')
      if (useful) links.add(url.toString())
    } catch {}
  }
  return Array.from(links).slice(0, MAX_PAGES)
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ShowrunnerPromoBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!resp.ok) throw new Error(`网页抓取失败 ${resp.status}`)
  return await resp.text()
}

function summarizePages(pages: PageData[]): string {
  return pages.map((page, index) => [
    `PAGE ${index + 1}: ${page.url}`,
    page.title ? `Title: ${page.title}` : '',
    page.description ? `Description: ${page.description}` : '',
    page.headings.length ? `Headings: ${page.headings.join(' | ')}` : '',
    `Text: ${page.text}`,
  ].filter(Boolean).join('\n')).join('\n\n')
}

export async function analyzePublicWebsite(productUrl: string): Promise<WebsiteAnalysis> {
  const homeHtml = await fetchHtml(productUrl)
  const urls = Array.from(new Set([productUrl, ...extractLinks(homeHtml, productUrl)])).slice(0, MAX_PAGES)
  const pages: PageData[] = []

  for (const url of urls) {
    try {
      const html = url === productUrl ? homeHtml : await fetchHtml(url)
      pages.push({
        url,
        title: extractTitle(html),
        description: matchMeta(html, ['description', 'og:description', 'twitter:description']),
        headings: extractHeadings(html),
        text: stripHtml(html).slice(0, MAX_PAGE_TEXT),
      })
    } catch (err) {
      console.warn(`[parser] 跳过页面 ${url}: ${(err as Error).message}`)
    }
  }

  return {
    pages,
    urls,
    sourceSummary: summarizePages(pages),
  }
}

function toStep(scene: ProductStoryScene): Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'> {
  return {
    position: scene.position,
    title: scene.title,
    action_type: 'wait',
    selector: null,
    value: '3000',
    narration: scene.narration,
    visual_type: scene.visual_type,
    visual_asset_url: scene.visual_asset_url,
    wait_for_selector: null,
  }
}

function buildInput(
  productUrl: string,
  description: string | null,
  sourceSummary: string,
  options: ParseStepsOptions,
): ProductStoryInput {
  return {
    productUrl,
    description: description ?? '',
    audience: options.audience,
    keyPoints: options.keyPoints,
    brandTone: options.brandTone,
    ctaText: options.ctaText,
    ctaUrl: options.ctaUrl,
    sourceSummary,
  }
}

export async function parseProductStory(
  demoId: string,
  productUrl: string,
  description: string | null,
  options: ParseStepsOptions = {},
): Promise<ParseProductStoryResult> {
  console.log('[parser] 分析公开网页并生成 Product Story 场景...')

  let analysis: WebsiteAnalysis = { pages: [], urls: [productUrl], sourceSummary: '' }
  try {
    analysis = await analyzePublicWebsite(productUrl)
    console.log(`[parser] 完成网页分析，共 ${analysis.pages.length} 个页面`)
  } catch (err) {
    console.warn(`[parser] 网页分析失败，使用用户描述继续: ${(err as Error).message}`)
  }

  let assets: ScreenshotAsset[] = []
  try {
    assets = await captureWebsiteScreenshots(demoId, analysis.urls)
    console.log(`[parser] 完成网页截图，共 ${assets.length} 张`)
  } catch (err) {
    console.warn(`[parser] 网页截图失败，继续使用模板画面: ${(err as Error).message}`)
  }

  const input = buildInput(productUrl, description, analysis.sourceSummary, options)
  const steps = await generateProductStoryScenes(input, assets)
  console.log(`[parser] Product Story 脚本生成完成，共 ${steps.length} 个场景`)

  return {
    steps,
    sourceSummary: analysis.sourceSummary,
    thumbnailUrl: assets[0]?.publicUrl ?? null,
  }
}

export async function parseSteps(
  productUrl: string,
  description: string | null,
  options: ParseStepsOptions = {},
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  let analysis: WebsiteAnalysis = { pages: [], urls: [productUrl], sourceSummary: '' }
  try {
    analysis = await analyzePublicWebsite(productUrl)
  } catch (err) {
    console.warn(`[parser] 网页分析失败，使用用户描述继续: ${(err as Error).message}`)
  }

  const input = buildInput(productUrl, description, analysis.sourceSummary, options)
  const scenes = await generateProductStoryScenes(input, [])
  return scenes.map(toStep)
}
