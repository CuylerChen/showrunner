// 启动 / 查询 / 关闭远程登录浏览器会话
import { headers } from 'next/headers'

const WORKER = process.env.WORKER_INTERNAL_URL ?? 'http://worker:3001'

async function getUserId() {
  const h = await headers()
  return h.get('x-user-id')
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getUserId()) return Response.json({ success: false }, { status: 401 })
  const { id } = await params
  const body   = await req.json()

  const res = await fetch(`${WORKER}/browser-sessions/${id}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(e => { throw new Error(`Worker unavailable: ${e.message}`) })

  return Response.json(await res.json())
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getUserId()) return Response.json({ success: false }, { status: 401 })
  const { id } = await params

  const res = await fetch(`${WORKER}/browser-sessions/${id}`)
    .catch(() => null)
  if (!res) return Response.json({ active: false, url: null })
  return Response.json(await res.json())
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getUserId()) return Response.json({ success: false }, { status: 401 })
  const { id } = await params

  const res = await fetch(`${WORKER}/browser-sessions/${id}`, { method: 'DELETE' })
    .catch(() => null)
  return Response.json(res ? await res.json() : { ok: true })
}
