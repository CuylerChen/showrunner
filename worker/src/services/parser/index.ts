import { Step } from '../../types'

const MAX_PAGES = 6
const MAX_PAGE_TEXT = 2600

interface PageData {
  url: string
  title: string
  description: string
  headings: string[]
  text: string
}

interface PromoScene {
  position: number
  title: string
  narration: string
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

async function analyzePublicWebsite(productUrl: string): Promise<PageData[]> {
  const homeHtml = await fetchHtml(productUrl)
  const urls = [productUrl, ...extractLinks(homeHtml, productUrl)]
  const uniqueUrls = Array.from(new Set(urls)).slice(0, MAX_PAGES)
  const pages: PageData[] = []

  for (const url of uniqueUrls) {
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

  return pages
}

function fallbackScenes(productUrl: string, description: string | null): PromoScene[] {
  const product = description?.split(/[.。!！\n]/)[0]?.trim() || new URL(productUrl).hostname.replace(/^www\./, '')
  return [
    {
      position: 1,
      title: `Meet ${product}`,
      narration: `${product} helps teams understand the product, communicate the value, and move buyers from curiosity to action.`,
    },
    {
      position: 2,
      title: 'Built for the problem your customers feel every day',
      narration: 'The story starts with a clear customer problem, then shows how the product removes friction and creates a better workflow.',
    },
    {
      position: 3,
      title: 'Turn features into benefits',
      narration: 'Each core capability is translated into a concrete outcome, so viewers understand why the product matters.',
    },
    {
      position: 4,
      title: 'Make the next step obvious',
      narration: 'The video closes with a simple call to action that sends qualified viewers back to the product.',
    },
  ]
}

function getOpenAIChatCompletionsUrl(): string {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

async function callOpenAIForScenes(productUrl: string, description: string | null, pages: PageData[]): Promise<PromoScene[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[parser] OPENAI_API_KEY 未配置，使用推广视频兜底脚本')
    return fallbackScenes(productUrl, description)
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const sourceSummary = pages.map((page, index) => [
    `PAGE ${index + 1}: ${page.url}`,
    page.title ? `Title: ${page.title}` : '',
    page.description ? `Description: ${page.description}` : '',
    page.headings.length ? `Headings: ${page.headings.join(' | ')}` : '',
    `Text: ${page.text}`,
  ].filter(Boolean).join('\n')).join('\n\n')

  const systemPrompt = `You are a senior product marketing video writer.
Create a short product introduction video plan from public website content and user notes.
Return ONLY a valid JSON array. No markdown, no explanation.
Each item must be:
{
  "position": number,
  "title": string,
  "narration": string
}
Rules:
- Create 5 to 7 scenes.
- Scene 1 must be a hook.
- Last scene must be a call to action.
- Keep each narration natural for voiceover, 12 to 28 words.
- Avoid unsupported claims, fake metrics, and invented customer names.
- If the source is thin, write a useful but generic product marketing story.
- Use the same language as the user's description when obvious; otherwise use English.`

  const userMessage = [
    `Product URL: ${productUrl}`,
    description ? `User notes:\n${description}` : '',
    pages.length ? `Website analysis:\n${sourceSummary}` : 'No website content was available.',
  ].filter(Boolean).join('\n\n')

  const resp = await fetch(getOpenAIChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 1800,
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`OpenAI Chat Completions API 错误 ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`推广脚本返回格式错误: ${raw.slice(0, 200)}`)

  const scenes = JSON.parse(match[0]) as PromoScene[]
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('推广脚本为空')

  return scenes.slice(0, 7).map((scene, index) => ({
    position: index + 1,
    title: String(scene.title || `Scene ${index + 1}`).slice(0, 120),
    narration: String(scene.narration || scene.title || '').slice(0, 500),
  }))
}

export async function parseSteps(
  productUrl: string,
  description: string | null,
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  console.log('[parser] 分析公开网页并生成推广视频场景...')

  let pages: PageData[] = []
  try {
    pages = await analyzePublicWebsite(productUrl)
    console.log(`[parser] 完成网页分析，共 ${pages.length} 个页面`)
  } catch (err) {
    console.warn(`[parser] 网页分析失败，使用用户描述继续: ${(err as Error).message}`)
  }

  const scenes = await callOpenAIForScenes(productUrl, description, pages)
  console.log(`[parser] 推广视频脚本生成完成，共 ${scenes.length} 个场景`)

  return scenes.map(scene => ({
    position: scene.position,
    title: scene.title,
    action_type: 'wait',
    selector: null,
    value: '3000',
    narration: scene.narration,
    wait_for_selector: null,
  }))
}
