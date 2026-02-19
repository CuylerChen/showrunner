import { Step } from '../../types'

const SYSTEM_PROMPT = `You are a browser automation expert using Playwright.
Given a product URL, the page's visible text content, and a user description, generate a precise list of browser automation steps.

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Each step must follow this schema:
{
  "position": number,
  "title": string,
  "action_type": "navigate" | "click" | "fill" | "wait" | "assert",
  "selector": string | null,
  "value": string | null,
  "narration": string
}

Rules:
- First step is always navigate to the product URL (action_type: "navigate", value: the URL, selector: null)
- Use the provided page text content to pick selectors that match REAL elements on the page
- Selectors must be valid Playwright locator strings:
  - Text match (best for buttons/links): text="Exact Button Text"
  - Has-text with tag: button:has-text("Submit"), a:has-text("Login")
  - CSS attributes: [data-testid="foo"], [aria-label="Close"], input[type="email"]
  - NEVER use jQuery selectors like :contains(), :eq() — they are INVALID
- For "navigate" steps, put the URL in "value" and set "selector" to null
- For "wait" steps, put milliseconds in "value" (e.g. "2000"), selector: null
- narration must be natural spoken English, present tense
- Maximum 8 steps`

// 抓取页面可见文字（截断到 3000 字符避免超出 token 限制）
async function fetchPageText(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShowrunnerBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return ''
    const html = await resp.text()
    // 提取纯文本：去掉 script/style 标签，再去掉所有 HTML 标签
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    return text
  } catch {
    return ''
  }
}

export async function parseSteps(
  productUrl: string,
  description: string | null
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置')

  // 先抓取页面内容，让 AI 根据真实 DOM 文字生成选择器
  console.log('[parser] 抓取页面内容...')
  const pageText = await fetchPageText(productUrl)
  if (pageText) {
    console.log(`[parser] 页面文字已获取 (${pageText.length} 字符)`)
  } else {
    console.warn('[parser] 无法获取页面内容，将凭 URL 猜测步骤')
  }

  const userMessage = [
    `Product URL: ${productUrl}`,
    pageText ? `Page text content:\n${pageText}` : '',
    description
      ? `Demo description: ${description}`
      : 'Generate a sensible onboarding demo flow for this product.',
  ].filter(Boolean).join('\n\n')

  console.log('[parser] 调用 DeepSeek API...')

  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`DeepSeek API 错误 ${resp.status}: ${err.slice(0, 200)}`)
  }

  const data = (await resp.json()) as {
    choices: { message: { content: string } }[]
  }

  const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!raw) throw new Error('DeepSeek 返回空内容')

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`返回格式错误: ${raw.slice(0, 200)}`)

  const steps = JSON.parse(match[0])
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('步骤为空')

  console.log(`[parser] DeepSeek 成功，解析 ${steps.length} 个步骤`)
  return steps
}
