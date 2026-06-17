export type VideoStyleId =
  | 'auto'
  | 'clean_saas'
  | 'bold_launch'
  | 'warm_editorial'
  | 'technical_dark'
  | 'premium_minimal'
  | 'creator_social'

export interface VideoStyleDescriptor {
  id: VideoStyleId
  label: string
  prompt: string
  fallbackVisualStyle: string
  className: string
}

export const VIDEO_STYLE_DEFAULT: VideoStyleId = 'auto'

export const VIDEO_STYLE_DESCRIPTORS: Record<VideoStyleId, VideoStyleDescriptor> = {
  auto: {
    id: 'auto',
    label: 'Smart match',
    prompt: 'Infer the best visual style from product category, brand colors, source material, and brand tone.',
    fallbackVisualStyle: 'product-matched',
    className: 'style-auto',
  },
  clean_saas: {
    id: 'clean_saas',
    label: 'Clean SaaS',
    prompt: 'Quiet, product-forward SaaS style with clear surfaces, restrained accents, and dashboard/product proof emphasis.',
    fallbackVisualStyle: 'clean SaaS product story',
    className: 'style-clean-saas',
  },
  bold_launch: {
    id: 'bold_launch',
    label: 'Bold Launch',
    prompt: 'High-contrast launch and promo style with confident headlines, energetic accents, and stronger call-to-action rhythm.',
    fallbackVisualStyle: 'bold launch promo',
    className: 'style-bold-launch',
  },
  warm_editorial: {
    id: 'warm_editorial',
    label: 'Warm Editorial',
    prompt: 'Story-led editorial style with warmer surfaces, human benefit framing, and calm product proof.',
    fallbackVisualStyle: 'warm editorial product story',
    className: 'style-warm-editorial',
  },
  technical_dark: {
    id: 'technical_dark',
    label: 'Technical Dark',
    prompt: 'Dark, code-forward technical style for developer and technical products, with proof, code, APIs, or workflow details emphasized.',
    fallbackVisualStyle: 'dark technical product story',
    className: 'style-technical-dark',
  },
  premium_minimal: {
    id: 'premium_minimal',
    label: 'Premium Minimal',
    prompt: 'Sparse, premium, restrained brand style with high whitespace, fewer chips, neutral surfaces, and precise copy.',
    fallbackVisualStyle: 'premium minimal brand story',
    className: 'style-premium-minimal',
  },
  creator_social: {
    id: 'creator_social',
    label: 'Creator Social',
    prompt: 'Punchier social promo style with sharper pacing, shorter captions, and creator-friendly benefit framing.',
    fallbackVisualStyle: 'creator social promo',
    className: 'style-creator-social',
  },
}

export function isVideoStyleId(value: unknown): value is VideoStyleId {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(VIDEO_STYLE_DESCRIPTORS, value)
}

export function normalizeVideoStyleId(value: unknown): VideoStyleId {
  return isVideoStyleId(value) ? value : VIDEO_STYLE_DEFAULT
}

export function getVideoStyleDescriptor(value: unknown): VideoStyleDescriptor {
  return VIDEO_STYLE_DESCRIPTORS[normalizeVideoStyleId(value)]
}
