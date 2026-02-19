import { GoogleGenerativeAI } from '@google/generative-ai'
import { Step } from '../../types'

const SYSTEM_PROMPT = `You are a browser automation expert.
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
- Use specific CSS selectors (prefer [data-testid], aria roles, or descriptive class names)
- narration must be natural spoken English, present tense
- Maximum 8 steps`

export async function parseSteps(
  productUrl: string,
  description: string | null
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  const apiKey = process.env.GOOGLE_AI_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_KEY 未配置')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const userMessage = description
    ? `Product URL: ${productUrl}\nDemo description: ${description}`
    : `Product URL: ${productUrl}\nGenerate a sensible onboarding demo flow for this product.`

  console.log('[parser] 调用 Gemini 2.0 Flash...')

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
  })

  const raw = result.response.text().trim()
  if (!raw) throw new Error('Gemini 返回空内容')

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`返回格式错误: ${raw.slice(0, 200)}`)

  const steps = JSON.parse(match[0])
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('步骤为空')

  console.log(`[parser] Gemini 成功，解析 ${steps.length} 个步骤`)
  return steps
}
