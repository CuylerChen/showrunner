import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { I18nProvider, type Locale } from '@/lib/i18n'
import './globals.css'

export const metadata: Metadata = {
  title: 'Showrunner — Promo Video Generator',
  description: '自动生成可分享的产品推广视频，粘贴 URL 即可开始',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value ?? 'zh') as Locale

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body className="min-h-screen antialiased">
        <I18nProvider initialLocale={locale}>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
