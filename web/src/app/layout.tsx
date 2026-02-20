import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { I18nProvider, type Locale } from '@/lib/i18n'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Showrunner — Demo Copilot',
  description: '自动生成可分享的产品演示视频，粘贴 URL 即可开始',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value ?? 'zh') as Locale

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'} className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">
        <I18nProvider initialLocale={locale}>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
