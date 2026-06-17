import type { ScreenshotAsset } from './assets'
import {
  getVideoStyleDescriptor,
  normalizeVideoStyleId,
  type VideoStyleId,
} from '../video-styles'

export type VisualType = 'screenshot' | 'template' | 'cta'
export const PRODUCT_CATEGORIES = ['saas', 'developer_tool', 'ecommerce', 'local_service', 'content', 'generic'] as const
export type ProductCategory = typeof PRODUCT_CATEGORIES[number]

export interface ProductStoryInput {
  productUrl: string
  description: string
  brandName?: string
  brandColors?: string[]
  productCategory?: ProductCategory
  audience?: string
  keyPoints?: string
  brandTone?: string
  ctaText?: string
  ctaUrl?: string
  videoStyle?: VideoStyleId
  sourceSummary: string
}

export interface ProductStoryScene {
  position: number
  title: string
  narration: string
  kicker?: string | null
  proof_points?: string[]
  cta_headline?: string | null
  visual_style?: string | null
  style_id: VideoStyleId
  product_type: ProductCategory
  visual_type: VisualType
  visual_asset_url: string | null
}

type AssetRole = ScreenshotAsset['role']

interface RawScene {
  position?: number
  title?: string
  narration?: string
  kicker?: string
  proof_points?: unknown
  proofPoints?: unknown
  cta_headline?: string
  ctaHeadline?: string
  visual_style?: string
  visualStyle?: string
  style_id?: string
  styleId?: string
  product_type?: string
  productType?: string
  visual_type?: string
  visual_asset_url?: string | null
  visual_role?: string
  asset_role?: string
  role?: string
}

const ROLE_PRIORITY: AssetRole[] = ['home', 'features', 'product', 'customers', 'pricing', 'about']
const DEFAULT_PRODUCT_CATEGORY: ProductCategory = 'generic'

export function normalizeProductCategory(value: unknown, fallback: ProductCategory = DEFAULT_PRODUCT_CATEGORY): ProductCategory {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (PRODUCT_CATEGORIES as readonly string[]).includes(normalized)
    ? normalized as ProductCategory
    : fallback
}

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

function normalizeProofPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(point => point.slice(0, 90))
}

function normalizeScenes(
  rawScenes: RawScene[],
  assets: ScreenshotAsset[],
  productCategory: ProductCategory = DEFAULT_PRODUCT_CATEGORY,
  videoStyle: VideoStyleId = 'auto',
): ProductStoryScene[] {
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
      kicker: scene.kicker ? String(scene.kicker).slice(0, 48) : null,
      proof_points: normalizeProofPoints(scene.proof_points ?? scene.proofPoints),
      cta_headline: scene.cta_headline || scene.ctaHeadline ? String(scene.cta_headline ?? scene.ctaHeadline).slice(0, 120) : null,
      visual_style: scene.visual_style || scene.visualStyle ? String(scene.visual_style ?? scene.visualStyle).slice(0, 80) : null,
      style_id: normalizeVideoStyleId(scene.style_id ?? scene.styleId ?? videoStyle),
      product_type: normalizeProductCategory(scene.product_type ?? scene.productType, productCategory),
      visual_type: visualType,
      visual_asset_url: visualType === 'screenshot' ? asset?.publicUrl ?? null : null,
    }
  }).filter(scene => scene.narration.trim())
}

export function fallbackProductStory(input: ProductStoryInput, assets: ScreenshotAsset[]): ProductStoryScene[] {
  const product = input.brandName?.trim() || productName(input)
  const ctaText = input.ctaText?.trim() || 'Learn more'
  const audience = input.audience?.trim()
  const keyPoint = input.keyPoints?.split(/[\n,;。]+/).map(point => point.trim()).find(Boolean)
  const tone = input.brandTone?.trim()
  const productCategory = normalizeProductCategory(input.productCategory)
  const style = getVideoStyleDescriptor(input.videoStyle)

  const rawScenes: RawScene[] = [
    {
      title: `Meet ${product}`,
      narration: audience
        ? `${product} gives ${audience} a clearer way to understand the offer and decide whether it fits their workflow.`
        : `${product} gives visitors a clearer way to understand the offer and decide whether it fits their workflow.`,
      kicker: 'Product promise',
      proof_points: audience ? [audience, ctaText] : [product, ctaText],
      visual_style: tone || style.fallbackVisualStyle,
      product_type: productCategory,
      visual_type: 'screenshot',
      visual_role: 'home',
    },
    {
      title: 'Start with the customer problem',
      narration: 'The story frames the everyday friction buyers are trying to solve before introducing the product as the next step.',
      kicker: 'Customer problem',
      proof_points: ['Buyer friction', 'Clear next step'],
      visual_style: tone || style.fallbackVisualStyle,
      product_type: productCategory,
      visual_type: 'template',
    },
    {
      title: 'Show the product value',
      narration: keyPoint
        ? `The core value centers on ${keyPoint}, turning a feature into a practical reason for viewers to keep watching.`
        : 'The core value turns product capabilities into practical reasons for viewers to keep watching and consider the next step.',
      kicker: 'Product value',
      proof_points: keyPoint ? [keyPoint, ctaText] : ['Practical value', ctaText],
      visual_style: tone || style.fallbackVisualStyle,
      product_type: productCategory,
      visual_type: 'screenshot',
      visual_role: 'features',
    },
    {
      title: 'Make benefits concrete',
      narration: 'Each benefit is presented in plain language, so the audience can connect the product to a real outcome.',
      kicker: 'Concrete benefits',
      proof_points: ['Plain-language benefit', 'Real outcome'],
      visual_style: tone || style.fallbackVisualStyle,
      product_type: productCategory,
      visual_type: 'screenshot',
      visual_role: 'product',
    },
    {
      title: tone ? `Close with a ${tone} next step` : 'Close with a clear next step',
      narration: `${ctaText} gives interested viewers a simple path from the video back to the product experience.`,
      kicker: 'Next step',
      proof_points: [ctaText, input.ctaUrl || input.productUrl],
      cta_headline: ctaText,
      visual_style: tone || `${style.fallbackVisualStyle} CTA`,
      product_type: productCategory,
      visual_type: 'cta',
    },
  ]

  return normalizeScenes(rawScenes, assets, productCategory, style.id)
}

export async function generateProductStoryScenes(
  input: ProductStoryInput,
  assets: ScreenshotAsset[],
): Promise<ProductStoryScene[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[parser] OPENAI_API_KEY missing, using product story fallback')
    return fallbackProductStory(input, assets)
  }
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  const style = getVideoStyleDescriptor(input.videoStyle)

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
  "kicker": string,
  "proof_points": string[],
  "cta_headline": string | null,
  "visual_style": string,
  "style_id": string,
  "product_type": "saas" | "developer_tool" | "ecommerce" | "local_service" | "content" | "generic",
  "visual_type": "screenshot" | "template" | "cta",
  "visual_role": "home" | "features" | "pricing" | "customers" | "about" | "product"
}
Rules:
- Create 5 to 7 scenes.
- Structure: hook, problem, product value, benefit scenes, CTA.
- Keep each narration natural for voiceover, 12 to 28 words.
- Keep kicker short, 2 to 4 words, product-specific.
- Include 2 to 4 proof_points per scene using only supported product details.
- Use cta_headline only for the CTA scene unless a scene needs a strong action label.
- Set product_type to the detected category unless the source clearly supports a more specific allowed category.
- Use visual_style to describe the desired scene feel for this product category.
- Include "style_id" on every scene. Use the requested style id exactly unless it is "auto"; when "auto", infer the best style and still return "auto" as style_id.
- Use screenshots when they help prove the product story; use template when source material is thin.
- Last scene must be a CTA.
- Avoid fake claims, unsupported metrics, invented customers, and guarantees.
- Use the user's language when obvious; otherwise use English.`

  const userMessage = [
    `Product URL: ${input.productUrl}`,
    input.description ? `User notes:\n${input.description}` : '',
    input.brandName ? `Detected brand name:\n${input.brandName}` : '',
    input.brandColors?.length ? `Detected brand colors:\n${input.brandColors.join(', ')}` : '',
    `Detected product category:\n${normalizeProductCategory(input.productCategory)}`,
    input.audience ? `Audience:\n${input.audience}` : '',
    input.keyPoints ? `Key points:\n${input.keyPoints}` : '',
    input.brandTone ? `Brand tone:\n${input.brandTone}` : '',
    input.ctaText ? `CTA text:\n${input.ctaText}` : '',
    input.ctaUrl ? `CTA URL:\n${input.ctaUrl}` : '',
    `Requested video style: ${style.id} - ${style.prompt}`,
    input.sourceSummary ? `Website source summary:\n${input.sourceSummary}` : 'No website source text was available.',
    assetSummary ? `Available screenshot assets:\n${assetSummary}` : 'No screenshots were available.',
  ].filter(Boolean).join('\n\n')

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
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
        temperature: 0.45,
        max_tokens: 2200,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`OpenAI-compatible API error ${resp.status}: ${errText.slice(0, 200)}`)
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonText = raw.match(/\[[\s\S]*\]/)?.[0] ?? raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonText) throw new Error(`Invalid scene JSON: ${raw.slice(0, 200)}`)

    const parsed = JSON.parse(jsonText) as RawScene[] | { scenes?: RawScene[] }
    const rawScenes = Array.isArray(parsed) ? parsed : parsed.scenes
    if (!Array.isArray(rawScenes) || rawScenes.length < 1) throw new Error('Scene JSON was empty')

    const scenes = normalizeScenes(rawScenes, assets, normalizeProductCategory(input.productCategory), normalizeVideoStyleId(input.videoStyle))
    if (scenes.length < 1) throw new Error('No usable scenes returned')
    return scenes
  } catch (err) {
    console.warn(`[parser] product story generation failed, using fallback: ${(err as Error).message}`)
    return fallbackProductStory(input, assets)
  }
}
