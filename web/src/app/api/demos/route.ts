import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and, desc, sql } from 'drizzle-orm'
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
  const status = searchParams.get('status') as typeof schema.demos.status.enumValues[number] | null
  const offset = (page - 1) * limit

  let conditions = [eq(schema.demos.user_id, user.id)]
  if (status) conditions.push(eq(schema.demos.status, status))

  const [items, countResult] = await Promise.all([
    db
      .select({
        id:          schema.demos.id,
        title:       schema.demos.title,
        product_url: schema.demos.product_url,
        status:      schema.demos.status,
        duration:    schema.demos.duration,
        share_token: schema.demos.share_token,
        created_at:  schema.demos.created_at,
      })
      .from(schema.demos)
      .where(and(...conditions))
      .orderBy(desc(schema.demos.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.demos)
      .where(and(...conditions))
      .then(rows => rows[0]?.count ?? 0),
  ])

  return ok({ items, total: Number(countResult), page, limit })
}

// POST /api/demos — 创建 Demo 并触发 AI 解析
export async function POST(req: NextRequest) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const body = await req.json().catch(() => null)
  const parsed = CreateDemoSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(e => e.message).join(', '))
  }
  const { product_url, description } = parsed.data

  // 检查额度
  const sub = await getSubscription(user.id)
  if (!sub) return err('INTERNAL_ERROR', '订阅信息不存在')

  const hasQuota = sub.demos_limit === -1 || sub.demos_used_this_month < sub.demos_limit
  if (!hasQuota) {
    return err('QUOTA_EXCEEDED', `本月额度已用完（${sub.demos_used_this_month}/${sub.demos_limit}），请升级套餐`)
  }

  // 创建 Demo 记录
  const demoId      = crypto.randomUUID()
  const share_token = crypto.randomUUID()

  await db.insert(schema.demos).values({
    id:          demoId,
    user_id:     user.id,
    product_url,
    description: description ?? null,
    status:      'pending',
    share_token,
  })

  // 扣减额度
  await db
    .update(schema.subscriptions)
    .set({ demos_used_this_month: sub.demos_used_this_month + 1 })
    .where(eq(schema.subscriptions.user_id, user.id))

  // 入队 parse-queue
  await parseQueue.add('parse', {
    demoId,
    productUrl:  product_url,
    description: description ?? null,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })

  return ok({ id: demoId, status: 'pending', share_token }, 201)
}
