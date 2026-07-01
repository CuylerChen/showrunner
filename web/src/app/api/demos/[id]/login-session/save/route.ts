// 从 Worker 获取 storageState，保存到 DB，关闭浏览器会话，触发重新解析步骤
import { headers } from 'next/headers'
import { db, schema } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { parseQueue } from '@/lib/queue'
import {
  assertPromptAllowedByCreem,
  composeDemoModerationPrompt,
  handleContentModerationError,
} from '@/lib/moderation/creem'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) return Response.json({ success: false }, { status: 401 })

  const { id }  = await params
  const WORKER  = process.env.WORKER_INTERNAL_URL ?? 'http://worker:3001'

  // 向 Worker 发送保存指令（Worker 会关闭 Playwright 会话并返回 storageState）
  const res = await fetch(`${WORKER}/browser-sessions/${id}/save`, { method: 'POST' })
    .catch(e => { throw new Error(`Worker unavailable: ${e.message}`) })

  const data = await res.json()
  if (!data.ok || !data.state) {
    return Response.json({ success: false, error: 'Failed to get state from worker' }, { status: 500 })
  }

  // 读取 demo 的创建参数（重新解析时需要保留原配置）
  const demo = await db
    .select({
      product_url: schema.demos.product_url,
      description: schema.demos.description,
      audience: schema.demos.audience,
      key_points: schema.demos.key_points,
      brand_tone: schema.demos.brand_tone,
      cta_text: schema.demos.cta_text,
      cta_url: schema.demos.cta_url,
      video_style: schema.demos.video_style,
      narration_language: schema.demos.narration_language,
    })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, userId)))
    .then(rows => rows[0] ?? null)

  if (!demo) {
    return Response.json({ success: false, error: 'Demo not found' }, { status: 404 })
  }

  try {
    await assertPromptAllowedByCreem(
      composeDemoModerationPrompt({
        product_url: demo.product_url ?? '',
        description: demo.description,
        audience: demo.audience,
        key_points: demo.key_points,
        brand_tone: demo.brand_tone,
        cta_text: demo.cta_text,
        cta_url: demo.cta_url,
      }),
      { externalId: `user_${userId}:demo_${id}:reparse` },
    )
  } catch (moderationError) {
    return handleContentModerationError(moderationError)
  }

  try {
    // 将 storageState JSON 写入 session_cookies 字段，并重置 demo 状态为 pending（等待重新解析）
    await db.update(schema.demos)
      .set({
        session_cookies:  data.state,
        login_video_path: data.loginVideoPath ?? null,  // 登录录制视频路径
        status:           'pending',
        error_message:    null,
      })
      .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, userId)))

    // 触发重新解析：用登录态加载页面，生成针对已登录内容的步骤
    await parseQueue.add('parse', {
      demoId:      id,
      productUrl:  demo.product_url!,
      description: demo.description ?? null,
      audience:    demo.audience ?? undefined,
      keyPoints:   demo.key_points ?? undefined,
      brandTone:   demo.brand_tone ?? undefined,
      ctaText:     demo.cta_text ?? undefined,
      ctaUrl:      demo.cta_url ?? undefined,
      videoStyle:  demo.video_style,
      narrationLanguage: demo.narration_language,
      isReparse:   true,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
  } catch (queueError) {
    await db.update(schema.demos)
      .set({
        status:        'failed',
        error_message: `Failed to enqueue reparse job: ${(queueError as Error).message}`,
      })
      .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, userId)))

    return Response.json({
      success: false,
      error: 'Failed to enqueue reparse job',
    }, { status: 500 })
  }

  console.log(`[save-session] demo=${id} 登录状态已保存，已触发重新解析`)
  return Response.json({ success: true })
}
