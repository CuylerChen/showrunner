import { Step } from '../../types'
import { assertSafePublicUrl, resolveSafeRedirectUrl } from '../../utils/safe-url'
import { captureWebsiteScreenshots, type ScreenshotAsset } from './assets'
import {
  generateProductStoryScenes,
  normalizeProductCategory,
  type ProductCategory,
  type ProductStoryInput,
  type ProductStoryScene,
} from './scenes'

export type { ProductCategory } from './scenes'

const MAX_PAGES = 6
const MAX_PAGE_TEXT = 2600

export interface PageData {
  url: string
  title: string
  description: string
  headings: string[]
  text: string
}

export interface BrandProfile {
  name: string
  colors: string[]
  primaryColor: string | null
}

export interface WebsiteAnalysis {
  pages: PageData[]
  urls: string[]
  sourceSummary: string
  brandProfile: BrandProfile
  productCategory: ProductCategory
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
  brandProfile: BrandProfile
  productCategory: ProductCategory
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

function normalizeHexColor(value: string): string | null {
  const color = value.trim()
  const short = color.match(/^#([0-9a-f]{3})$/i)
  if (short) {
    return `#${short[1].split('').map(char => `${char}${char}`).join('')}`.toUpperCase()
  }

  const full = color.match(/^#([0-9a-f]{6})$/i)
  return full ? `#${full[1].toUpperCase()}` : null
}

function fallbackBrandName(productUrl: string): string {
  try {
    return new URL(productUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'Product'
  }
}

function cleanBrandName(value: string, productUrl: string): string {
  const candidate = value
    .split(/\s+[|·•]\s+|\s+-\s+|\s+–\s+|\s+—\s+/)[0]
    ?.replace(/\s+/g, ' ')
    .trim()

  return (candidate || fallbackBrandName(productUrl)).slice(0, 80)
}

type ProductCategorySignal = {
  pattern: RegExp
  weight: number
}

const PRODUCT_CATEGORY_SIGNALS: Record<Exclude<ProductCategory, 'generic'>, ProductCategorySignal[]> = {
  ecommerce: [
    { pattern: /\b(cart|checkout|catalog|shipping|discounts?|coupons?|orders?|buy|shop|store|commerce|ecommerce|inventory)\b/i, weight: 2 },
    { pattern: /\b(product catalog|online store|add to cart|free shipping|payment methods?)\b/i, weight: 3 },
  ],
  developer_tool: [
    { pattern: /\b(api|sdk|docs?|webhooks?|endpoints?|cli|github|npm|openapi|graphql|developers?)\b/i, weight: 2 },
    { pattern: /\b(api keys?|developer tools?|code examples?|client libraries?)\b/i, weight: 3 },
  ],
  local_service: [
    { pattern: /\b(clinic|dental|dentist|salon|repair|restaurant|studio|law firm|agency|consultations?)\b/i, weight: 2 },
    { pattern: /\b(appointments?|service area|book online|near me|business hours|visit us|local service)\b/i, weight: 3 },
  ],
  content: [
    { pattern: /\b(newsletters?|articles?|courses?|episodes?|membership|blog|podcast|creator|publication|lessons?)\b/i, weight: 2 },
    { pattern: /\b(content library|online course|paid membership|creator community)\b/i, weight: 3 },
  ],
  saas: [
    { pattern: /\b(dashboard|workflow|analytics|collaboration|crm|automation|workspace|platform|software|reports?|integrations?)\b/i, weight: 2 },
    { pattern: /\b(team dashboard|workflow automation|customer relationship|project management|business software)\b/i, weight: 3 },
  ],
}

function productUrlText(productUrl: string): string {
  try {
    const url = new URL(productUrl)
    return `${url.hostname} ${url.pathname.replace(/[/-]+/g, ' ')}`
  } catch {
    return productUrl
  }
}

export function inferProductCategory(input: {
  productUrl: string
  description?: string | null
  sourceSummary?: string | null
}): ProductCategory {
  const text = [
    productUrlText(input.productUrl),
    input.description ?? '',
    input.sourceSummary ?? '',
  ].join('\n').toLowerCase()

  const scores = Object.entries(PRODUCT_CATEGORY_SIGNALS).map(([category, signals]) => ({
    category: normalizeProductCategory(category),
    score: signals.reduce((sum, signal) => sum + (signal.pattern.test(text) ? signal.weight : 0), 0),
  })).sort((left, right) => right.score - left.score)

  const winner = scores[0]
  return winner && winner.score >= 2 ? winner.category : 'generic'
}

export function extractBrandProfileFromHtml(html: string, productUrl: string): BrandProfile {
  const explicitName = matchMeta(html, ['og:site_name', 'application-name', 'apple-mobile-web-app-title'])
  const title = explicitName || extractTitle(html)
  const name = cleanBrandName(title, productUrl)
  const colors = [
    matchMeta(html, ['theme-color', 'msapplication-TileColor']),
  ].map(color => normalizeHexColor(color)).filter((color): color is string => Boolean(color))

  return {
    name,
    colors: [...new Set(colors)],
    primaryColor: colors[0] ?? null,
  }
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

async function fetchHtml(url: string, redirectDepth = 0): Promise<string> {
  if (redirectDepth > 5) throw new Error('网页重定向次数过多')

  const safeUrl = await assertSafePublicUrl(url)
  const resp = await fetch(safeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ShowrunnerPromoBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(12000),
  })
  if ([301, 302, 303, 307, 308].includes(resp.status)) {
    const location = resp.headers.get('location')
    if (!location) throw new Error('网页重定向缺少 Location')
    return fetchHtml(new URL(location, safeUrl).toString(), redirectDepth + 1)
  }
  if (!resp.ok) throw new Error(`网页抓取失败 ${resp.status}`)
  return await resp.text()
}

function summarizePages(pages: PageData[], brandProfile: BrandProfile): string {
  const brandSummary = [
    `Brand: ${brandProfile.name}`,
    brandProfile.primaryColor ? `Primary color: ${brandProfile.primaryColor}` : '',
  ].filter(Boolean).join('\n')

  const pageSummary = pages.map((page, index) => [
    `PAGE ${index + 1}: ${page.url}`,
    page.title ? `Title: ${page.title}` : '',
    page.description ? `Description: ${page.description}` : '',
    page.headings.length ? `Headings: ${page.headings.join(' | ')}` : '',
    `Text: ${page.text}`,
  ].filter(Boolean).join('\n')).join('\n\n')

  return [brandSummary, pageSummary].filter(Boolean).join('\n\n')
}

export async function analyzePublicWebsite(productUrl: string): Promise<WebsiteAnalysis> {
  const safeHome = await resolveSafeRedirectUrl(productUrl)
  const homeHtml = await fetchHtml(safeHome.toString())
  const brandProfile = extractBrandProfileFromHtml(homeHtml, safeHome.toString())
  const urls = Array.from(new Set([
    safeHome.toString(),
    ...extractLinks(homeHtml, safeHome.toString()),
  ])).slice(0, MAX_PAGES)
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

  const sourceSummary = summarizePages(pages, brandProfile)

  return {
    pages,
    urls,
    sourceSummary,
    brandProfile,
    productCategory: inferProductCategory({
      productUrl: safeHome.toString(),
      sourceSummary,
    }),
  }
}

function toStep(scene: ProductStoryScene): Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'> {
  return {
    position: scene.position,
    title: scene.title,
    action_type: 'wait',
    selector: null,
    value: productStorySceneMetadata(scene, null),
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
  brandProfile: BrandProfile,
  productCategory: ProductCategory,
): ProductStoryInput {
  return {
    productUrl,
    description: description ?? '',
    brandName: brandProfile.name,
    brandColors: brandProfile.colors,
    productCategory,
    audience: options.audience,
    keyPoints: options.keyPoints,
    brandTone: options.brandTone,
    ctaText: options.ctaText,
    ctaUrl: options.ctaUrl,
    sourceSummary,
  }
}

export function productStorySceneMetadata(scene: ProductStoryScene, brandProfile: BrandProfile | null): string {
  return JSON.stringify({
    durationMs: 3000,
    kicker: scene.kicker ?? null,
    proofPoints: scene.proof_points ?? [],
    ctaHeadline: scene.cta_headline ?? null,
    visualStyle: scene.visual_style ?? null,
    brandColor: brandProfile?.primaryColor ?? null,
    productType: scene.product_type ?? 'generic',
  })
}

export async function parseProductStory(
  demoId: string,
  productUrl: string,
  description: string | null,
  options: ParseStepsOptions = {},
): Promise<ParseProductStoryResult> {
  console.log('[parser] 分析公开网页并生成 Product Story 场景...')

  let analysis: WebsiteAnalysis = {
    pages: [],
    urls: [productUrl],
    sourceSummary: '',
    brandProfile: extractBrandProfileFromHtml('', productUrl),
    productCategory: inferProductCategory({ productUrl, description }),
  }
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

  const productCategory = inferProductCategory({
    productUrl,
    description,
    sourceSummary: analysis.sourceSummary,
  })
  const input = buildInput(productUrl, description, analysis.sourceSummary, options, analysis.brandProfile, productCategory)
  const steps = await generateProductStoryScenes(input, assets)
  console.log(`[parser] Product Story 脚本生成完成，共 ${steps.length} 个场景`)

  return {
    steps,
    sourceSummary: analysis.sourceSummary,
    thumbnailUrl: assets[0]?.publicUrl ?? null,
    brandProfile: analysis.brandProfile,
    productCategory,
  }
}

export async function parseSteps(
  productUrl: string,
  description: string | null,
  options: ParseStepsOptions = {},
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  let analysis: WebsiteAnalysis = {
    pages: [],
    urls: [productUrl],
    sourceSummary: '',
    brandProfile: extractBrandProfileFromHtml('', productUrl),
    productCategory: inferProductCategory({ productUrl, description }),
  }
  try {
    analysis = await analyzePublicWebsite(productUrl)
  } catch (err) {
    console.warn(`[parser] 网页分析失败，使用用户描述继续: ${(err as Error).message}`)
  }

  const productCategory = inferProductCategory({
    productUrl,
    description,
    sourceSummary: analysis.sourceSummary,
  })
  const input = buildInput(productUrl, description, analysis.sourceSummary, options, analysis.brandProfile, productCategory)
  const scenes = await generateProductStoryScenes(input, [])
  return scenes.map(toStep)
}
