// 从 Worker 获取 storageState，保存到 DB，关闭浏览器会话
import { headers } from 'next/headers'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

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

  // 将 storageState JSON 写入 session_cookies 字段
  await db.update(schema.demos)
    .set({ session_cookies: data.state })
    .where(eq(schema.demos.id, id))

  return Response.json({ success: true })
}
