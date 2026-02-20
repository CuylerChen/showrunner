import { cookies } from 'next/headers'
import { zh } from '@/locales/zh'
import { en } from '@/locales/en'
import type { Locale } from './i18n'

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const val = cookieStore.get('locale')?.value
  return val === 'en' ? 'en' : 'zh'
}

export async function getT() {
  const locale = await getServerLocale()
  return { t: locale === 'en' ? en : zh, locale }
}
