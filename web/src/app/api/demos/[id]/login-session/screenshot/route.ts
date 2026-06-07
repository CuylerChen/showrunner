// 转发截图（no-cache）
import { headers } from 'next/headers'
import { findOwnedDemo } from '@/lib/demo-owner'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { id }   = await params
  const demo = await findOwnedDemo(userId, id)
  if (!demo) return new Response('Session not found', { status: 404 })

  const WORKER   = process.env.WORKER_INTERNAL_URL ?? 'http://worker:3001'

  const res = await fetch(`${WORKER}/browser-sessions/${id}/screenshot`, { cache: 'no-store' })
    .catch(() => null)

  if (!res || !res.ok) return new Response('Session not found', { status: 404 })

  const buf = await res.arrayBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type':  'image/jpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
