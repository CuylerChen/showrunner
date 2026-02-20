'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { zh } from '@/locales/zh'
import { en } from '@/locales/en'

export type Locale = 'zh' | 'en'
export type Translations = typeof zh

const translations: Record<Locale, Translations> = { zh, en }

interface I18nContextValue {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  t: zh,
  setLocale: () => {},
})

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  return (
    <I18nContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
