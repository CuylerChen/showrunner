import { getCurrentUser, getSubscription } from '@/lib/auth'
import { ok, err } from '@/lib/api'

// GET /api/subscription — 获取当前套餐与额度
export async function GET() {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const sub = await getSubscription(user.id)
  if (!sub) return err('NOT_FOUND', '订阅信息不存在')

  return ok({
    plan:                    sub.plan,
    status:                  sub.status,
    demos_used_this_month:   sub.demos_used_this_month,
    demos_limit:             sub.demos_limit,
    current_period_end:      sub.current_period_end,
  })
}
