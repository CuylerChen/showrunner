export type NarrationLanguageId =
  | 'auto'
  | 'en'
  | 'zh'
  | 'ko'
  | 'ja'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'

export const NARRATION_LANGUAGE_DEFAULT: NarrationLanguageId = 'auto'

const NARRATION_LANGUAGE_IDS = new Set<string>([
  'auto',
  'en',
  'zh',
  'ko',
  'ja',
  'es',
  'fr',
  'de',
  'pt',
  'it',
])

const LANGUAGE_INSTRUCTIONS: Record<NarrationLanguageId, string> = {
  auto: 'Use the user language when it is obvious from user notes or source material; otherwise use English.',
  en: 'Write all titles, narration, kickers, proof points, and CTA copy in English.',
  zh: 'Write all titles, narration, kickers, proof points, and CTA copy in Simplified Chinese for Mandarin voiceover.',
  ko: 'Write all titles, narration, kickers, proof points, and CTA copy in Korean.',
  ja: 'Write all titles, narration, kickers, proof points, and CTA copy in Japanese.',
  es: 'Write all titles, narration, kickers, proof points, and CTA copy in Spanish.',
  fr: 'Write all titles, narration, kickers, proof points, and CTA copy in French.',
  de: 'Write all titles, narration, kickers, proof points, and CTA copy in German.',
  pt: 'Write all titles, narration, kickers, proof points, and CTA copy in Portuguese.',
  it: 'Write all titles, narration, kickers, proof points, and CTA copy in Italian.',
}

export function isNarrationLanguageId(value: unknown): value is NarrationLanguageId {
  return typeof value === 'string' && NARRATION_LANGUAGE_IDS.has(value)
}

export function normalizeNarrationLanguageId(value: unknown): NarrationLanguageId {
  return isNarrationLanguageId(value) ? value : NARRATION_LANGUAGE_DEFAULT
}

export function getNarrationLanguageInstruction(value: unknown): string {
  return LANGUAGE_INSTRUCTIONS[normalizeNarrationLanguageId(value)]
}
