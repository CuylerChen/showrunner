import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and, desc, sql, or, gt } from 'drizzle-orm'
import { parseQueue } from '@/lib/queue'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'
import { assertSafePublicUrl } from '@/lib/security/safe-url'

type UpdateResult = { affectedRows?: number }

const CreateDemoSchema = z.object({
  product_url: z.string().url('请输入有效的产品 URL'),
  description: z.string().max(500).nullable().optional(),
  audience: z.string().max(300).nullable().optional(),
  key_points: z.string().max(1000).nullable().optional(),
  brand_tone: z.string().max(80).nullable().optional(),
  cta_text: z.string().max(100).nullable().optional(),
  cta_url: z.string().url('请输入有效的 CTA URL').max(2048).nullable().optional().or(z.literal('')),
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

  const conditions = [eq(schema.demos.user_id, user.id)]
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
  const userId = user.id

  const body = await req.json().catch(() => null)
  const parsed = CreateDemoSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(e => e.message).join(', '))
  }
  const { product_url, description, audience, key_points, brand_tone, cta_text, cta_url } = parsed.data
  const normalizedCtaUrl = cta_url === '' ? null : cta_url ?? null
  let safeProductUrl: URL
  try {
    safeProductUrl = await assertSafePublicUrl(product_url)
    if (normalizedCtaUrl) await assertSafePublicUrl(normalizedCtaUrl)
  } catch (validationError) {
    return err('VALIDATION_ERROR', (validationError as Error).message)
  }
  const normalizedProductUrl = safeProductUrl.toString()

  const reserved = await db
    .update(schema.subscriptions)
    .set({
      demos_used_this_month: sql`CASE WHEN ${schema.subscriptions.demos_limit} = -1 THEN ${schema.subscriptions.demos_used_this_month} ELSE ${schema.subscriptions.demos_used_this_month} + 1 END`,
    })
    .where(and(
      eq(schema.subscriptions.user_id, userId),
      or(
        eq(schema.subscriptions.demos_limit, -1),
        sql`${schema.subscriptions.demos_used_this_month} < ${schema.subscriptions.demos_limit}`,
      ),
    ))

  const reservedRows = (reserved[0] as UpdateResult | undefined)?.affectedRows ?? 0
  if (reservedRows === 0) {
    return err('QUOTA_EXCEEDED', '本月免费额度已用完。当前版本暂不支持自助升级，请联系管理员增加额度。')
  }

  // 创建 Demo 记录
  const demoId      = crypto.randomUUID()
  const share_token = crypto.randomUUID()

  async function releaseQuota() {
    await db
      .update(schema.subscriptions)
      .set({
        demos_used_this_month: sql`GREATEST(${schema.subscriptions.demos_used_this_month} - 1, 0)`,
      })
      .where(and(
        eq(schema.subscriptions.user_id, userId),
        gt(schema.subscriptions.demos_limit, -1),
      ))
  }

  try {
    await db.insert(schema.demos).values({
      id:          demoId,
      user_id:     userId,
      product_url: normalizedProductUrl,
      description: description ?? null,
      audience:    audience ?? null,
      key_points:  key_points ?? null,
      brand_tone:  brand_tone ?? null,
      cta_text:    cta_text ?? null,
      cta_url:     normalizedCtaUrl,
      status:      'pending',
      share_token,
    })

    // 入队 parse-queue
    await parseQueue.add('parse', {
      demoId,
      productUrl:  normalizedProductUrl,
      description: description ?? null,
      audience: audience ?? null,
      keyPoints: key_points ?? null,
      brandTone: brand_tone ?? null,
      ctaText: cta_text ?? null,
      ctaUrl: normalizedCtaUrl,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
  } catch (queueError) {
    await db.delete(schema.demos).where(eq(schema.demos.id, demoId)).catch(() => undefined)
    await releaseQuota()
    return err('INTERNAL_ERROR', `创建任务失败: ${(queueError as Error).message}`)
  }

  return ok({ id: demoId, status: 'pending', share_token }, 201)
}
