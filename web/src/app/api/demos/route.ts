import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { parseQueue } from '@/lib/queue'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import { ok, err } from '@/lib/api'

const CreateDemoSchema = z.object({
  product_url: z.string().url('请输入有效的产品 URL'),
  description: z.string().max(500).nullable().optional(),
})

// GET /api/demos — 获取当前用户的 Demo 列表
export async function GET(req: NextRequest) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { searchParams } = req.nextUrl
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const status = searchParams.get('status')
  const offset = (page - 1) * limit

  const supabase = createAdminClient()
  let query = supabase
    .from('demos')
    .select('id, title, product_url, status, duration, share_token, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) return err('INTERNAL_ERROR', error.message)

  return ok({ items: data ?? [], total: count ?? 0, page, limit })
}

// POST /api/demos — 创建 Demo 并触发 AI 解析
export async function POST(req: NextRequest) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  // 解析并校验请求体
  const body = await req.json().catch(() => null)
  const parsed = CreateDemoSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
  }
  const { product_url, description } = parsed.data

  // 检查额度
  const sub = await getSubscription(user.id)
  if (!sub) return err('INTERNAL_ERROR', '订阅信息不存在')

  const hasQuota = sub.demos_limit === -1 || sub.demos_used_this_month < sub.demos_limit
  if (!hasQuota) {
    return err('QUOTA_EXCEEDED', `本月额度已用完（${sub.demos_used_this_month}/${sub.demos_limit}），请升级套餐`)
  }

  const supabase = createAdminClient()

  // 创建 Demo 记录
  const { data: demo, error: demoError } = await supabase
    .from('demos')
    .insert({ user_id: user.id, product_url, description: description ?? null, status: 'pending' })
    .select('id, share_token, status')
    .single()

  if (demoError || !demo) return err('INTERNAL_ERROR', demoError?.message ?? '创建失败')

  // 扣减额度
  await supabase
    .from('subscriptions')
    .update({ demos_used_this_month: sub.demos_used_this_month + 1 })
    .eq('user_id', user.id)

  // 入队 parse-queue
  await parseQueue.add('parse', {
    demoId:      demo.id,
    productUrl:  product_url,
    description: description ?? null,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })

  return ok({ id: demo.id, status: demo.status, share_token: demo.share_token }, 201)
}
