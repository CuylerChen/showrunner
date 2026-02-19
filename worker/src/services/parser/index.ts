import { Step } from '../../types'

const SYSTEM_PROMPT = `You are a browser automation expert using Playwright.
Given a product URL and a user description, generate a precise list of browser automation steps.

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
- First step is always navigate to the product URL
- Selectors must be valid Playwright locator strings. Allowed formats:
  - Text match (preferred for buttons/links): text="Get Started" or text=Sign up
    → "text=" matches ANY element type (a, button, span, div) containing that text
    → Use this when you don't know the exact tag
  - Has-text with tag: button:has-text("Submit"), a:has-text("Login")
    → Only use when you are certain of the tag type
  - CSS: [data-testid="foo"], .class-name, #id, input[type="email"]
  - ARIA: [role="button"][name="Submit"], [aria-label="Close"]
  - NEVER use jQuery selectors like :contains(), :eq(), :first — they are INVALID in Playwright
  - For clickable text of unknown tag, always use text="..." format
- For "navigate" steps, put the URL in "value" and set "selector" to null
- For "wait" steps, put milliseconds in "value" (e.g. "2000")
- narration must be natural spoken English, present tense
- Maximum 8 steps`

export async function parseSteps(
  productUrl: string,
  description: string | null
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置')

  const userMessage = description
    ? `Product URL: ${productUrl}\nDemo description: ${description}`
    : `Product URL: ${productUrl}\nGenerate a sensible onboarding demo flow for this product.`

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
