import type { PlanType } from '@/types'

export type VideoStyleId =
  | 'auto'
  | 'clean_saas'
  | 'bold_launch'
  | 'warm_editorial'
  | 'technical_dark'
  | 'premium_minimal'
  | 'creator_social'

export interface VideoStyleOption {
  id: VideoStyleId
  label: string
  description: string
  starter: boolean
}

export const VIDEO_STYLE_DEFAULT: VideoStyleId = 'auto'

export const VIDEO_STYLES: VideoStyleOption[] = [
  {
    id: 'auto',
    label: 'Smart match',
    description: 'Automatically matches style to the product, brand, and category.',
    starter: true,
  },
  {
    id: 'clean_saas',
    label: 'Clean SaaS',
    description: 'Quiet, product-forward SaaS style for B2B and tools.',
    starter: true,
  },
  {
    id: 'bold_launch',
    label: 'Bold Launch',
    description: 'High-contrast, energetic launch style for promotions.',
    starter: true,
  },
  {
    id: 'warm_editorial',
    label: 'Warm Editorial',
    description: 'Story-led editorial style for commerce, services, and content.',
    starter: true,
  },
  {
    id: 'technical_dark',
    label: 'Technical Dark',
    description: 'Dark, code-forward style for developer and technical products.',
    starter: false,
  },
  {
    id: 'premium_minimal',
    label: 'Premium Minimal',
    description: 'Sparse, premium, restrained style for polished brand stories.',
    starter: false,
  },
  {
    id: 'creator_social',
    label: 'Creator Social',
    description: 'Punchier social promo treatment for creator-led products.',
    starter: false,
  },
]

export function isVideoStyleId(value: unknown): value is VideoStyleId {
  return typeof value === 'string' && VIDEO_STYLES.some(style => style.id === value)
}

export function normalizeVideoStyleId(value: unknown): VideoStyleId | null {
  if (value == null || value === '') return VIDEO_STYLE_DEFAULT
  return isVideoStyleId(value) ? value : null
}

export function getAllowedVideoStyles(plan: PlanType): VideoStyleOption[] {
  if (plan === 'free') {
    return VIDEO_STYLES.filter(style => style.id === VIDEO_STYLE_DEFAULT)
  }

  if (plan === 'starter') {
    return VIDEO_STYLES.filter(style => style.starter)
  }

  return VIDEO_STYLES
}

export function canUseVideoStyle(plan: PlanType, styleId: string | null | undefined): boolean {
  const normalizedStyleId = normalizeVideoStyleId(styleId)
  if (!normalizedStyleId) return false
  return getAllowedVideoStyles(plan).some(style => style.id === normalizedStyleId)
}
