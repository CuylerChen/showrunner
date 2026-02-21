// 转发用户交互事件（点击 / 键盘 / 滚动 / 导航）
import { headers } from 'next/headers'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await headers()
  if (!h.get('x-user-id')) return Response.json({ ok: false }, { status: 401 })

  const { id }  = await params
  const WORKER  = process.env.WORKER_INTERNAL_URL ?? 'http://worker:3001'
  const body    = await req.json()

  const res = await fetch(`${WORKER}/browser-sessions/${id}/input`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => null)

  return Response.json(res ? await res.json() : { ok: true })
}
