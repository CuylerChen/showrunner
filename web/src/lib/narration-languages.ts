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

export interface NarrationLanguageOption {
  id: NarrationLanguageId
}

export const NARRATION_LANGUAGE_DEFAULT: NarrationLanguageId = 'auto'

export const NARRATION_LANGUAGES: NarrationLanguageOption[] = [
  { id: 'auto' },
  { id: 'en' },
  { id: 'zh' },
  { id: 'ko' },
  { id: 'ja' },
  { id: 'es' },
  { id: 'fr' },
  { id: 'de' },
  { id: 'pt' },
  { id: 'it' },
]

const NARRATION_LANGUAGE_IDS = new Set<string>(NARRATION_LANGUAGES.map(language => language.id))

export function isNarrationLanguageId(value: unknown): value is NarrationLanguageId {
  return typeof value === 'string' && NARRATION_LANGUAGE_IDS.has(value)
}

export function normalizeNarrationLanguageId(value: unknown): NarrationLanguageId | null {
  if (value == null || value === '') return NARRATION_LANGUAGE_DEFAULT
  return isNarrationLanguageId(value) ? value : null
}
