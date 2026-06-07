// 转发用户交互事件（点击 / 键盘 / 滚动 / 导航）
import { headers } from 'next/headers'
import { assertSafePublicUrl } from '@/lib/security/safe-url'
import { findOwnedDemo, forbiddenDemoResponse } from '@/lib/demo-owner'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) return Response.json({ ok: false }, { status: 401 })

  const { id }  = await params
  const demo = await findOwnedDemo(userId, id)
  if (!demo) return forbiddenDemoResponse()

  const WORKER  = process.env.WORKER_INTERNAL_URL ?? 'http://worker:3001'
  const body    = await req.json()

  if (body?.type === 'navigate') {
    try {
      const safeUrl = await assertSafePublicUrl(String(body.url ?? ''))
      body.url = safeUrl.toString()
    } catch (e) {
      return Response.json({ ok: false, error: (e as Error).message }, { status: 422 })
    }
  }

  const res = await fetch(`${WORKER}/browser-sessions/${id}/input`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => null)

  return Response.json(res ? await res.json() : { ok: true })
}
