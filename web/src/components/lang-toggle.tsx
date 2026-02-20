'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'

export function LangToggle() {
  const { locale, setLocale } = useTranslation()
  const router = useRouter()

  function handleToggle() {
    const next = locale === 'zh' ? 'en' : 'zh'
    setLocale(next)
    router.refresh() // 触发服务端组件用新语言重新渲染
  }

  return (
    <button
      onClick={handleToggle}
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
