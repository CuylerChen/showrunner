import { err, type ErrorCode } from '@/lib/api'

export type CreemModerationDecision = 'allow' | 'flag' | 'deny'

export type ContentModerationErrorCode = Extract<
  ErrorCode,
  'PROMPT_REJECTED' | 'CONTENT_MODERATION_NOT_CONFIGURED' | 'CONTENT_MODERATION_UNAVAILABLE'
>

type CreemModerationResponse = {
  id?: string
  object?: string
  prompt?: string
  external_id?: string
  decision?: CreemModerationDecision
  usage?: { units?: number }
}

type DemoModerationInput = {
  product_url: string
  description?: string | null
  audience?: string | null
  key_points?: string | null
  brand_tone?: string | null
  cta_text?: string | null
  cta_url?: string | null
}

type StepModerationInput = {
  title: string
  narration?: string | null
}

type CreemModerationEnv = {
  CREEM_API_KEY?: string
  CREEM_API_BASE_URL?: string
}

export class ContentModerationError extends Error {
  readonly code: ContentModerationErrorCode

  constructor(code: ContentModerationErrorCode, message: string) {
    super(message)
    this.name = 'ContentModerationError'
    this.code = code
  }
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  return normalized ? normalized : null
}

function line(label: string, value: string | null | undefined): string | null {
  const normalized = clean(value)
  return normalized ? `${label}: ${normalized}` : null
}

function moderationTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.CREEM_MODERATION_TIMEOUT_MS)
  if (!Number.isFinite(value) || value <= 0) return 5000
  return Math.min(15000, Math.max(1000, Math.floor(value)))
}

export function resolveCreemModerationBaseUrl(
  env: CreemModerationEnv = process.env as CreemModerationEnv,
): string {
  const configuredBaseUrl = clean(env.CREEM_API_BASE_URL)
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '')

  const apiKey = clean(env.CREEM_API_KEY) ?? ''
  return apiKey.startsWith('creem_test_') ? 'https://test-api.creem.io' : 'https://api.creem.io'
}

export function composeDemoModerationPrompt(input: DemoModerationInput): string {
  return [
    line('Product URL', input.product_url),
    line('Description', input.description),
    line('Audience', input.audience),
    line('Key points', input.key_points),
    line('Brand tone', input.brand_tone),
    line('CTA text', input.cta_text),
    line('CTA URL', input.cta_url),
  ].filter((value): value is string => Boolean(value)).join('\n')
}

export function composeStepsModerationPrompt(steps: StepModerationInput[]): string {
  return steps.flatMap((step, index) => [
    line(`Scene ${index + 1} title`, step.title),
    line(`Scene ${index + 1} narration`, step.narration),
  ]).filter((value): value is string => Boolean(value)).join('\n')
}

export async function assertPromptAllowedByCreem(
  prompt: string,
  options: { externalId?: string } = {},
): Promise<CreemModerationResponse> {
  const normalizedPrompt = clean(prompt)
  if (!normalizedPrompt) {
    throw new ContentModerationError('PROMPT_REJECTED', '内容安全审核未通过，请补充有效内容后重试。')
  }

  const apiKey = clean(process.env.CREEM_API_KEY)
  if (!apiKey) {
    throw new ContentModerationError(
      'CONTENT_MODERATION_NOT_CONFIGURED',
      'Content moderation is not configured. Please set CREEM_API_KEY before enabling generation.',
    )
  }

  let response: Response
  try {
    response = await fetch(`${resolveCreemModerationBaseUrl()}/v1/moderation/prompt`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: normalizedPrompt,
        ...(options.externalId ? { external_id: options.externalId } : {}),
      }),
      signal: AbortSignal.timeout(moderationTimeoutMs()),
    })
  } catch {
    throw new ContentModerationError(
      'CONTENT_MODERATION_UNAVAILABLE',
      '内容安全审核暂时不可用，请稍后重试。',
    )
  }

  if (!response.ok) {
    throw new ContentModerationError(
      'CONTENT_MODERATION_UNAVAILABLE',
      '内容安全审核暂时不可用，请稍后重试。',
    )
  }

  let payload: CreemModerationResponse
  try {
    payload = await response.json() as CreemModerationResponse
  } catch {
    throw new ContentModerationError(
      'CONTENT_MODERATION_UNAVAILABLE',
      '内容安全审核暂时不可用，请稍后重试。',
    )
  }

  if (payload.decision === 'allow') return payload

  if (payload.decision === 'flag' || payload.decision === 'deny') {
    throw new ContentModerationError(
      'PROMPT_REJECTED',
      '内容安全审核未通过，请修改提示词或分镜文本后重试。',
    )
  }

  throw new ContentModerationError(
    'CONTENT_MODERATION_UNAVAILABLE',
    '内容安全审核暂时不可用，请稍后重试。',
  )
}

export function handleContentModerationError(error: unknown) {
  if (error instanceof ContentModerationError) {
    return err(error.code, error.message)
  }
  throw error
}
