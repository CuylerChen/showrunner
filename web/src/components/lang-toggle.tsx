'use client'

import { useTranslation } from '@/lib/i18n'

export function LangToggle() {
  const { locale, setLocale } = useTranslation()
  return (
    <button
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      {locale === 'zh' ? 'EN' : '中文'}
    </button>
  )
}
