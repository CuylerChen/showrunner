import { NextRequest } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET /api/demos/[id]/status — SSE 实时状态推送
export async function GET(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params

  // 验证 Demo 归属
  const demo = await db
    .select({ id: schema.demos.id, status: schema.demos.status, error_message: schema.demos.error_message })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) {
    return new Response('Demo 不存在或无权访问', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = demo.status
      let lastError  = demo.error_message

      // 发送初始状态
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ status: lastStatus, error_message: lastError })}\n\n`)
      )

      // 每 2 秒轮询数据库
      const interval = setInterval(async () => {
        try {
          const current = await db
            .select({ status: schema.demos.status, error_message: schema.demos.error_message })
            .from(schema.demos)
            .where(eq(schema.demos.id, id))
            .then(rows => rows[0] ?? null)

          if (!current) {
            clearInterval(interval)
            controller.close()
            return
          }

          if (current.status !== lastStatus || current.error_message !== lastError) {
            lastStatus = current.status
            lastError  = current.error_message
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ status: lastStatus, error_message: lastError })}\n\n`)
            )
          }

          // 终态时关闭连接
          if (lastStatus === 'completed' || lastStatus === 'failed') {
            clearInterval(interval)
            controller.close()
          }
        } catch {
          clearInterval(interval)
          controller.close()
        }
      }, 2000)

      // 客户端断开时清理
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
