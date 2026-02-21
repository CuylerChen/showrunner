// 从 Worker 获取 storageState，保存到 DB，关闭浏览器会话，触发重新解析步骤
import { headers } from 'next/headers'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { parseQueue } from '@/lib/queue'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await headers()
  if (!h.get('x-user-id')) return Response.json({ success: false }, { status: 401 })

  const { id }  = await params
  const WORKER  = process.env.WORKER_INTERNAL_URL ?? 'http://worker:3001'

  // 向 Worker 发送保存指令（Worker 会关闭 Playwright 会话并返回 storageState）
  const res = await fetch(`${WORKER}/browser-sessions/${id}/save`, { method: 'POST' })
    .catch(e => { throw new Error(`Worker unavailable: ${e.message}`) })

  const data = await res.json()
  if (!data.ok || !data.state) {
    return Response.json({ success: false, error: 'Failed to get state from worker' }, { status: 500 })
  }

  // 读取 demo 的 product_url 和 description（重新解析时需要）
  const demo = await db
    .select({ product_url: schema.demos.product_url, description: schema.demos.description })
    .from(schema.demos)
    .where(eq(schema.demos.id, id))
    .then(rows => rows[0] ?? null)

  if (!demo) {
    return Response.json({ success: false, error: 'Demo not found' }, { status: 404 })
  }

  // 将 storageState JSON 写入 session_cookies 字段，并重置 demo 状态为 pending（等待重新解析）
  await db.update(schema.demos)
    .set({ session_cookies: data.state, status: 'pending' })
    .where(eq(schema.demos.id, id))

  // 触发重新解析：用登录态加载页面，生成针对已登录内容的步骤
  await parseQueue.add('parse', {
    demoId:      id,
    productUrl:  demo.product_url!,
    description: demo.description ?? null,
    isReparse:   true,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })

  console.log(`[save-session] demo=${id} 登录状态已保存，已触发重新解析`)
  return Response.json({ success: true })
}
