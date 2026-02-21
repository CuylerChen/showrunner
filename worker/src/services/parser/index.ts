import { chromium } from 'playwright'
import { Step } from '../../types'

// ── 普通解析 Prompt（公开页面，无登录）────────────────────────────
const SYSTEM_PROMPT = `You are a browser automation expert using Playwright.
Given a product URL, the page's visible text, interactive elements (with their real attributes), and a user description, generate a precise list of browser automation steps.

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Each step must follow this schema:
{
  "position": number,
  "title": string,
  "action_type": "navigate" | "click" | "fill" | "wait" | "assert",
  "selector": string | null,
  "value": string | null,
  "narration": string,
  "wait_for_selector": string | null
}

Rules:
- First step is always navigate to the product URL (action_type: "navigate", value: the URL, selector: null)
- Use the INTERACTIVE ELEMENTS list to pick selectors from REAL elements on the page
- Selector priority (best to worst):
  1. [data-testid="..."] if available
  2. input[placeholder="exact text"] for inputs
  3. button:has-text("exact text") for buttons
  4. a:has-text("exact text") for links (Next.js Link = <a> tag)
  5. [aria-label="..."] for icon buttons
  6. input[type="email"], input[type="password"] for auth forms
- For "navigate" steps, put the URL in "value" and set "selector" to null
- For "wait" steps, put milliseconds in "value" (e.g. "2000"), selector: null
- narration must be natural spoken English, present tense
- Maximum 8 steps
- NEVER use jQuery selectors like :contains(), :eq() — they are INVALID in Playwright
- wait_for_selector: CSS selector for an element that proves the step result is fully loaded on screen.
  - For "navigate" steps: use the main content container selector (e.g. "main", ".dashboard", "[data-testid='home']", "nav"). Pick something that only appears AFTER the page fully loads, NOT a skeleton/placeholder.
  - For "click" steps that open new content: use a selector for the resulting page/panel/modal content.
  - For "fill" and "wait" steps: set to null.
  - Use simple, robust selectors: tag names, IDs, data-testid, or short class names. Avoid overly specific selectors.
  - If unsure, set to null (visual stability detection will be used as fallback).`

// ── 登录模拟 Prompt（重新解析，带 session cookies）──────────────────
function buildLoginSimPrompt(userEmail: string): string {
  return `You are a browser automation expert using Playwright.
The user has already authenticated into this product via OAuth/SSO. Generate a demo video script that FIRST simulates the login flow, THEN showcases the product's main features.

IMPORTANT: The recording browser will have session cookies active. This means:
- When the user "fills" the email/password and clicks Login, the browser will authenticate instantly and redirect to the dashboard
- This creates a natural-looking login → dashboard flow in the video

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Each step must follow this schema:
{
  "position": number,
  "title": string,
  "action_type": "navigate" | "click" | "fill" | "wait" | "assert",
  "selector": string | null,
  "value": string | null,
  "narration": string,
  "wait_for_selector": string | null
}

STEP STRUCTURE (generate exactly in this order):

LOGIN SIMULATION (positions 1-4, use PUBLIC PAGE ELEMENTS below):
1. navigate → Login page URL (find "Sign in" / "Log in" / "Login" link href in PUBLIC PAGE ELEMENTS, use the absolute URL)
   wait_for_selector: selector for an element on the login page (e.g. input[type="email"], form, ".login-form")
2. fill → Email field selector (from PUBLIC PAGE INPUT elements, type="email" or placeholder containing "email")
   value: "${userEmail}"
   wait_for_selector: null
3. fill → Password field selector (from PUBLIC PAGE INPUT elements, type="password")
   value: "••••••••"
   wait_for_selector: null
4. click → Submit/Login button selector (from PUBLIC PAGE BUTTON elements, text like "Sign in", "Log in", "Continue")
   wait_for_selector: use a selector from LOGGED-IN PAGE ELEMENTS (the main dashboard container), because after click the session kicks in and instantly redirects

PRODUCT DEMO (positions 5-8, use LOGGED-IN PAGE ELEMENTS below):
Generate 4 steps that demonstrate the product's key features. Use navigate, click, or assert actions.

General Rules:
- Selector priority: [data-testid] > input[placeholder] > button:has-text() > a:has-text() > [aria-label]
- For "navigate" steps: put URL in "value", selector: null
- For "fill" steps: wait_for_selector: null
- narration: natural spoken English, present tense, engaging
- NEVER use jQuery selectors like :contains(), :eq()
- wait_for_selector for navigate/click steps: pick a stable element that appears after the action completes`
}

interface PageData {
  text: string
  elements: string
}

// ── Playwright 加载页面，提取 DOM 元素和文字 ──────────────────────
async function fetchPageData(url: string, sessionStateJson?: string | null): Promise<PageData> {
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })

    // 解析 session 状态（支持新格式 StorageState 和旧格式 Cookie[]）
    let storageState: Parameters<typeof browser.newContext>[0]['storageState'] = undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let legacyCookies: any[] | null = null
    if (sessionStateJson) {
      try {
        const parsed = JSON.parse(sessionStateJson)
        if (Array.isArray(parsed)) {
          legacyCookies = parsed
        } else if (parsed && typeof parsed === 'object') {
          storageState = parsed
        }
      } catch {}
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ...(storageState ? { storageState } : {}),
    })
    if (legacyCookies) await context.addCookies(legacyCookies)

    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    // 登录态页面动态内容更多，等待时间更长
    await page.waitForTimeout(sessionStateJson ? 4000 : 2000)

    const text = await page.evaluate(() =>
      (document.body.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000)
    )

    const elements = await page.evaluate(() => {
      const items: string[] = []

      document.querySelectorAll<HTMLElement>('button, [role="button"]').forEach(el => {
        const txt = el.innerText?.trim().replace(/\s+/g, ' ').slice(0, 60)
        const testId = el.getAttribute('data-testid')
        const ariaLabel = el.getAttribute('aria-label')
        const id = el.id
        const type = (el as HTMLButtonElement).type
        const parts: string[] = []
        if (txt)       parts.push(`text="${txt}"`)
        if (testId)    parts.push(`data-testid="${testId}"`)
        if (ariaLabel) parts.push(`aria-label="${ariaLabel}"`)
        if (id)        parts.push(`id="${id}"`)
        if (type && type !== 'submit') parts.push(`type="${type}"`)
        if (parts.length) items.push(`BUTTON: ${parts.join(', ')}`)
      })

      document.querySelectorAll<HTMLInputElement>('input, textarea').forEach(el => {
        const parts: string[] = []
        if (el.type && el.type !== 'text') parts.push(`type="${el.type}"`)
        if (el.placeholder)  parts.push(`placeholder="${el.placeholder}"`)
        if (el.name)         parts.push(`name="${el.name}"`)
        if (el.id)           parts.push(`id="${el.id}"`)
        const testId = el.getAttribute('data-testid')
        if (testId)          parts.push(`data-testid="${testId}"`)
        const ariaLabel = el.getAttribute('aria-label')
        if (ariaLabel)       parts.push(`aria-label="${ariaLabel}"`)
        items.push(`INPUT: ${parts.join(', ') || '(no attributes)'}`)
      })

      document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(el => {
        const href = el.getAttribute('href') ?? ''
        if (href.startsWith('#') || href.startsWith('javascript')) return
        const txt = el.innerText?.trim().replace(/\s+/g, ' ').slice(0, 60)
        if (!txt) return
        items.push(`LINK: text="${txt}" href="${href}"`)
      })

      return items.slice(0, 50).join('\n')
    })

    return { text, elements }
  } catch (err) {
    console.warn('[parser] Playwright 抓取失败，回退到 HTTP:', (err as Error).message.slice(0, 100))
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShowrunnerBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      const html = await resp.text()
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000)
      return { text, elements: '' }
    } catch {
      return { text: '', elements: '' }
    }
  } finally {
    await browser?.close()
  }
}

// ── 调用 DeepSeek API ──────────────────────────────────────────────
async function callDeepSeek(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置')

  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.3,
      max_tokens:  2500,
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`DeepSeek API 错误 ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await resp.json()) as { choices: { message: { content: string } }[] }
  const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!raw) throw new Error('DeepSeek 返回空内容')

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`返回格式错误: ${raw.slice(0, 200)}`)

  const steps = JSON.parse(match[0])
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('步骤为空')
  return steps
}

// ── 主入口 ─────────────────────────────────────────────────────────
export async function parseSteps(
  productUrl: string,
  description: string | null,
  sessionStateJson?: string | null,
  userEmail?: string | null
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {

  // ── 模式 1：带 session（登录后重新解析）──────────────────────────
  if (sessionStateJson && userEmail) {
    console.log('[parser] 双页扫描模式：公开页 + 已登录页...')

    // 并行扫描两个页面
    const [publicData, authData] = await Promise.all([
      fetchPageData(productUrl, null),            // 公开页：提取登录表单选择器
      fetchPageData(productUrl, sessionStateJson), // 已登录页：提取 dashboard 元素
    ])
    console.log(`[parser] 公开页 ${publicData.text.length}字 / 已登录页 ${authData.text.length}字`)

    const userMessage = [
      `Product URL: ${productUrl}`,
      '── PUBLIC PAGE (use for login simulation steps 1-4) ──',
      publicData.text  ? `Visible text:\n${publicData.text}` : '',
      publicData.elements ? `Interactive elements:\n${publicData.elements}` : '',
      '── LOGGED-IN PAGE (use for product demo steps 5-8) ──',
      authData.text    ? `Visible text:\n${authData.text}` : '',
      authData.elements   ? `Interactive elements:\n${authData.elements}` : '',
      description ? `Demo description: ${description}` : '',
    ].filter(Boolean).join('\n\n')

    console.log('[parser] 调用 DeepSeek（登录模拟模式）...')
    const steps = await callDeepSeek(buildLoginSimPrompt(userEmail), userMessage)
    console.log(`[parser] 生成 ${steps.length} 个步骤（含登录模拟）`)
    return steps
  }

  // ── 模式 2：普通解析（公开页）──────────────────────────────────
  const loginHint = sessionStateJson ? '（已登录态，无 email）' : '（公开页面）'
  console.log(`[parser] 抓取页面内容 ${loginHint}...`)
  const { text, elements } = await fetchPageData(productUrl, sessionStateJson)
  console.log(`[parser] 页面文字 ${text.length} 字符，可交互元素 ${elements.split('\n').filter(Boolean).length} 个`)

  const userMessage = [
    `Product URL: ${productUrl}`,
    text     ? `Page visible text:\n${text}` : '',
    elements ? `INTERACTIVE ELEMENTS ON THE PAGE (use these for accurate selectors):\n${elements}` : '',
    description
      ? `Demo description: ${description}`
      : 'Generate a sensible onboarding demo flow for this product.',
  ].filter(Boolean).join('\n\n')

  console.log('[parser] 调用 DeepSeek API...')
  const steps = await callDeepSeek(SYSTEM_PROMPT, userMessage)
  console.log(`[parser] DeepSeek 成功，解析 ${steps.length} 个步骤`)
  return steps
}
