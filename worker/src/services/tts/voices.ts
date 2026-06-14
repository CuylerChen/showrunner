export type TtsVoiceId =
  | 'default'
  | 'professional_female'
  | 'warm_male'
  | 'energetic_female'
  | 'founder_male'

const VOICE_IDS = new Set<string>([
  'default',
  'professional_female',
  'warm_male',
  'energetic_female',
  'founder_male',
])

const OPENAI_VOICES: Record<TtsVoiceId, string | null> = {
  default: null,
  professional_female: 'nova',
  warm_male: 'onyx',
  energetic_female: 'shimmer',
  founder_male: 'echo',
}

const KOKORO_VOICES: Record<TtsVoiceId, string> = {
  default: 'af_heart',
  professional_female: 'af_sky',
  warm_male: 'am_adam',
  energetic_female: 'af_bella',
  founder_male: 'am_michael',
}

export function isTtsVoiceId(value: unknown): value is TtsVoiceId {
  return typeof value === 'string' && VOICE_IDS.has(value)
}

export function resolveStepTtsVoiceId(
  stepVoiceId: string | null | undefined,
  demoVoiceId: string | null | undefined,
): TtsVoiceId {
  if (isTtsVoiceId(stepVoiceId)) return stepVoiceId
  if (isTtsVoiceId(demoVoiceId)) return demoVoiceId
  return 'default'
}

export function resolveOpenAiVoice(voiceId: TtsVoiceId, fallbackVoice: string): string {
  return OPENAI_VOICES[voiceId] ?? fallbackVoice
}

export function resolveKokoroVoice(voiceId: TtsVoiceId): string {
  return KOKORO_VOICES[voiceId]
}

export function speechSpeedFromPercent(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const speed = Number(value) / 100
  return Math.min(4, Math.max(0.25, speed))
}
