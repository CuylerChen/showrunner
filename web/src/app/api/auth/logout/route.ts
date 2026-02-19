import { cookies } from 'next/headers'
import { ok } from '@/lib/api'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('token')
  return ok({ message: '已退出登录' })
}
