import type { PlanType } from '@/types'

export type TtsVoiceId =
  | 'default'
  | 'professional_female'
  | 'warm_male'
  | 'energetic_female'
  | 'founder_male'

export interface PlanCapabilities {
  videosPerMonth: number
  voiceSelection: boolean
  perSceneVoice: boolean
  ttsSpeedControl: boolean
  customAudio: boolean
  priorityQueue: boolean
}

export interface TtsVoiceOption {
  id: TtsVoiceId
  label: string
  description: string
  starter: boolean
}

export const PLAN_CAPABILITIES: Record<PlanType, PlanCapabilities> = {
  free: {
    videosPerMonth: 1,
    voiceSelection: false,
    perSceneVoice: false,
    ttsSpeedControl: false,
    customAudio: false,
    priorityQueue: false,
  },
  starter: {
    videosPerMonth: 10,
    voiceSelection: true,
    perSceneVoice: false,
    ttsSpeedControl: true,
    customAudio: false,
    priorityQueue: false,
  },
  pro: {
    videosPerMonth: -1,
    voiceSelection: true,
    perSceneVoice: true,
    ttsSpeedControl: true,
    customAudio: true,
    priorityQueue: true,
  },
}

export const TTS_SPEED_MIN = 80
export const TTS_SPEED_MAX = 120
export const TTS_SPEED_DEFAULT = 100

export const TTS_VOICES: TtsVoiceOption[] = [
  {
    id: 'default',
    label: 'Default Narrator',
    description: 'Balanced narration for product videos.',
    starter: true,
  },
  {
    id: 'professional_female',
    label: 'Professional Female',
    description: 'Clear, polished voice for SaaS product walkthroughs.',
    starter: true,
  },
  {
    id: 'warm_male',
    label: 'Warm Male',
    description: 'Calm and friendly voice for founder-style explainers.',
    starter: true,
  },
  {
    id: 'energetic_female',
    label: 'Energetic Female',
    description: 'Brighter voice for launches and promotional clips.',
    starter: true,
  },
  {
    id: 'founder_male',
    label: 'Founder Male',
    description: 'Confident voice for expert or founder scenes.',
    starter: false,
  },
]

export function getPlanCapabilities(plan: PlanType): PlanCapabilities {
  return PLAN_CAPABILITIES[plan]
}

export function getAllowedTtsVoices(plan: PlanType): TtsVoiceOption[] {
  if (plan === 'free') {
    return TTS_VOICES.filter(voice => voice.id === 'default')
  }

  if (plan === 'starter') {
    return TTS_VOICES.filter(voice => voice.starter)
  }

  return TTS_VOICES
}

export function isTtsVoiceId(value: unknown): value is TtsVoiceId {
  return typeof value === 'string' && TTS_VOICES.some(voice => voice.id === value)
}

export function canUseVideoVoice(plan: PlanType, voiceId: string | null | undefined): boolean {
  const normalizedVoiceId = voiceId || 'default'
  return getAllowedTtsVoices(plan).some(voice => voice.id === normalizedVoiceId)
}

export function canUsePerSceneVoice(plan: PlanType, voiceId: string | null | undefined): boolean {
  const normalizedVoiceId = voiceId || 'default'
  return plan === 'pro' && getAllowedTtsVoices(plan).some(voice => voice.id === normalizedVoiceId)
}

export function normalizeTtsSpeed(value: unknown): number | null {
  const speed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(speed)) return null
  if (speed < TTS_SPEED_MIN || speed > TTS_SPEED_MAX) return null
  return speed
}

export function canUseTtsSpeed(plan: PlanType, speed: unknown): boolean {
  const normalizedSpeed = normalizeTtsSpeed(speed)
  if (normalizedSpeed === null) return false
  if (normalizedSpeed === TTS_SPEED_DEFAULT) return true
  return getPlanCapabilities(plan).ttsSpeedControl
}

export function canUseCustomAudio(plan: PlanType): boolean {
  return getPlanCapabilities(plan).customAudio
}

export function getTtsQueuePriority(plan: PlanType): number {
  if (plan === 'pro') return 1
  if (plan === 'starter') return 5
  return 10
}
