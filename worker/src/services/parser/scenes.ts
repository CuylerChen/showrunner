import type { ScreenshotAsset } from './assets'

export type VisualType = 'screenshot' | 'template' | 'cta'

export interface ProductStoryInput {
  productUrl: string
  description: string
  audience?: string
  keyPoints?: string
  brandTone?: string
  ctaText?: string
  ctaUrl?: string
  sourceSummary: string
}

export interface ProductStoryScene {
  position: number
  title: string
  narration: string
  visual_type: VisualType
  visual_asset_url: string | null
}

type AssetRole = ScreenshotAsset['role']

interface RawScene {
  position?: number
  title?: string
  narration?: string
  visual_type?: string
  visual_asset_url?: string | null
  visual_role?: string
  asset_role?: string
  role?: string
}

const ROLE_PRIORITY: AssetRole[] = ['home', 'features', 'product', 'customers', 'pricing', 'about']

function productName(input: ProductStoryInput): string {
  const fromDescription = input.description.split(/[.。!！\n]/)[0]?.trim()
  if (fromDescription) return fromDescription.slice(0, 80)

  try {
    return new URL(input.productUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'this product'
  }
}

function assetByRole(assets: ScreenshotAsset[], role: AssetRole): ScreenshotAsset | undefined {
  return assets.find(asset => asset.role === role)
}

function selectAsset(assets: ScreenshotAsset[], role: string | undefined, index: number): ScreenshotAsset | undefined {
  if (!assets.length) return undefined

  if (role && isAssetRole(role)) {
    const exact = assetByRole(assets, role)
    if (exact) return exact
  }

  const preferredRole = ROLE_PRIORITY[Math.min(index, ROLE_PRIORITY.length - 1)]
  return assetByRole(assets, preferredRole) ?? assets[Math.min(index, assets.length - 1)] ?? assets[0]
}

function isAssetRole(role: string): role is AssetRole {
  return ['home', 'features', 'pricing', 'customers', 'about', 'product'].includes(role)
}

function normalizeVisualType(value: string | undefined, hasAsset: boolean, isLast: boolean): VisualType {
  if (isLast || value === 'cta') return 'cta'
  if (value === 'screenshot' && hasAsset) return 'screenshot'
  if (value === 'template') return 'template'
  return hasAsset ? 'screenshot' : 'template'
}

function normalizeScenes(rawScenes: RawScene[], assets: ScreenshotAsset[]): ProductStoryScene[] {
  const limitedScenes = rawScenes.slice(0, 7)

  return limitedScenes.map((scene, index) => {
    const role = scene.visual_role ?? scene.asset_role ?? scene.role
    const asset = selectAsset(assets, role, index)
    const isLast = index === limitedScenes.length - 1
    const visualType = normalizeVisualType(scene.visual_type, Boolean(asset), isLast)

    return {
      position: index + 1,
      title: String(scene.title || `Scene ${index + 1}`).slice(0, 120),
      narration: String(scene.narration || scene.title || '').slice(0, 500),
      visual_type: visualType,
      visual_asset_url: visualType === 'screenshot' ? asset?.publicUrl ?? null : null,
    }
  }).filter(scene => scene.narration.trim())
}

export function fallbackProductStory(input: ProductStoryInput, assets: ScreenshotAsset[]): ProductStoryScene[] {
  const product = productName(input)
  const ctaText = input.ctaText?.trim() || 'Learn more'
  const audience = input.audience?.trim()
  const keyPoint = input.keyPoints?.split(/[\n,;。]+/).map(point => point.trim()).find(Boolean)
  const tone = input.brandTone?.trim()

  const rawScenes: RawScene[] = [
    {
      title: `Meet ${product}`,
      narration: audience
        ? `${product} gives ${audience} a clearer way to understand the offer and decide whether it fits their workflow.`
        : `${product} gives visitors a clearer way to understand the offer and decide whether it fits their workflow.`,
      visual_type: 'screenshot',
      visual_role: 'home',
    },
    {
      title: 'Start with the customer problem',
      narration: 'The story frames the everyday friction buyers are trying to solve before introducing the product as the next step.',
      visual_type: 'template',
    },
    {
      title: 'Show the product value',
      narration: keyPoint
        ? `The core value centers on ${keyPoint}, turning a feature into a practical reason for viewers to keep watching.`
        : 'The core value turns product capabilities into practical reasons for viewers to keep watching and consider the next step.',
      visual_type: 'screenshot',
      visual_role: 'features',
    },
    {
      title: 'Make benefits concrete',
      narration: 'Each benefit is presented in plain language, so the audience can connect the product to a real outcome.',
      visual_type: 'screenshot',
      visual_role: 'product',
    },
    {
      title: tone ? `Close with a ${tone} next step` : 'Close with a clear next step',
      narration: `${ctaText} gives interested viewers a simple path from the video back to the product experience.`,
      visual_type: 'cta',
    },
  ]

  return normalizeScenes(rawScenes, assets)
}

export async function generateProductStoryScenes(
  input: ProductStoryInput,
  assets: ScreenshotAsset[],
): Promise<ProductStoryScene[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn('[parser] DEEPSEEK_API_KEY missing, using product story fallback')
    return fallbackProductStory(input, assets)
  }

  const assetSummary = assets.map(asset => `${asset.role}: ${asset.url} -> ${asset.publicUrl}`).join('\n')
  const systemPrompt = `You are a senior product marketing video writer.
Create a Product Story marketing video from website source text, screenshots, and user notes.
Return ONLY valid JSON. No markdown, no explanation.
Return either a JSON array or an object with a "scenes" array.
Each scene must be:
{
  "position": number,
  "title": string,
  "narration": string,
  "visual_type": "screenshot" | "template" | "cta",
  "visual_role": "home" | "features" | "pricing" | "customers" | "about" | "product"
}
Rules:
- Create 5 to 7 scenes.
- Structure: hook, problem, product value, benefit scenes, CTA.
- Keep each narration natural for voiceover, 12 to 28 words.
- Use screenshots when they help prove the product story; use template when source material is thin.
- Last scene must be a CTA.
- Avoid fake claims, unsupported metrics, invented customers, and guarantees.
- Use the user's language when obvious; otherwise use English.`

  const userMessage = [
    `Product URL: ${input.productUrl}`,
    input.description ? `User notes:\n${input.description}` : '',
    input.audience ? `Audience:\n${input.audience}` : '',
    input.keyPoints ? `Key points:\n${input.keyPoints}` : '',
    input.brandTone ? `Brand tone:\n${input.brandTone}` : '',
    input.ctaText ? `CTA text:\n${input.ctaText}` : '',
    input.ctaUrl ? `CTA URL:\n${input.ctaUrl}` : '',
    input.sourceSummary ? `Website source summary:\n${input.sourceSummary}` : 'No website source text was available.',
    assetSummary ? `Available screenshot assets:\n${assetSummary}` : 'No screenshots were available.',
  ].filter(Boolean).join('\n\n')

  try {
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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.45,
        max_tokens: 2200,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`DeepSeek API error ${resp.status}: ${errText.slice(0, 200)}`)
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonText = raw.match(/\[[\s\S]*\]/)?.[0] ?? raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonText) throw new Error(`Invalid scene JSON: ${raw.slice(0, 200)}`)

    const parsed = JSON.parse(jsonText) as RawScene[] | { scenes?: RawScene[] }
    const rawScenes = Array.isArray(parsed) ? parsed : parsed.scenes
    if (!Array.isArray(rawScenes) || rawScenes.length < 1) throw new Error('Scene JSON was empty')

    const scenes = normalizeScenes(rawScenes, assets)
    if (scenes.length < 1) throw new Error('No usable scenes returned')
    return scenes
  } catch (err) {
    console.warn(`[parser] product story generation failed, using fallback: ${(err as Error).message}`)
    return fallbackProductStory(input, assets)
  }
}
