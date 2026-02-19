import { Step } from '../../types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// 主模型 + 备用模型列表，自动降级（ID 均已验证存在于 OpenRouter）
const MODELS = [
  process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-coder:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'upstage/solar-pro-3:free',
  'z-ai/glm-4.5-air:free',
  'stepfun/step-3.5-flash:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
]

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

async function callModel(model: string, userMessage: string) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://showrunner.cuylerchen.uk',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`${response.status}: ${err}`)
  }

  return response.json()
}

export async function parseSteps(
  productUrl: string,
  description: string | null
): Promise<Omit<Step, 'id' | 'demo_id' | 'status' | 'timestamp_start' | 'timestamp_end'>[]> {
  const userMessage = description
    ? `Product URL: ${productUrl}\nDemo description: ${description}`
    : `Product URL: ${productUrl}\nGenerate a sensible onboarding demo flow for this product.`

  let lastError: Error | null = null

  for (const model of MODELS) {
    try {
      console.log(`[parser] 尝试模型: ${model}`)
      const json = await callModel(model, userMessage)
      const msg  = json.choices?.[0]?.message ?? {}
      const raw  = (msg.content || msg.reasoning_content || '').trim()

      if (!raw) throw new Error(`模型返回空内容，原始响应: ${JSON.stringify(json).slice(0, 300)}`)

      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error(`返回格式错误: ${raw.slice(0, 200)}`)

      const steps = JSON.parse(match[0])
      if (!Array.isArray(steps) || steps.length === 0) throw new Error('步骤为空')

      console.log(`[parser] 模型 ${model} 成功，解析 ${steps.length} 个步骤`)
      return steps
    } catch (err) {
      lastError = err as Error
      // 4xx 限速/模型不可用/内容问题 均降级到下一个模型；401/402 鉴权错误不重试
      const isRetryable =
        lastError.message.includes('429') ||
        lastError.message.includes('404') ||
        lastError.message.includes('400') ||
        lastError.message.includes('空内容') ||
        lastError.message.includes('格式错误') ||
        lastError.message.includes('步骤为空')
      if (!isRetryable) throw lastError
      console.warn(`[parser] 模型 ${model} 失败 (${lastError.message.slice(0, 80)})，降级到下一个...`)
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  throw new Error(`所有模型均失败: ${lastError?.message}`)
}
