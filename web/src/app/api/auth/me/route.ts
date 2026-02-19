import { getCurrentUser } from '@/lib/auth'
import { ok } from '@/lib/api'

export async function GET() {
  const { user, response } = await getCurrentUser()
  if (!user) return response!
  return ok(user)
}
