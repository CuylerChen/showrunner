'use client'

import Link from 'next/link'
import { StatusBadge } from './status-badge'
import { useDemoRealtime } from '@/hooks/use-demo-realtime'
import type { DemoStatus } from '@/types'

interface DemoCardProps {
  id: string
  title: string | null
  product_url: string
  status: DemoStatus
  duration: number | null
  share_token: string
  created_at: string
}

export function DemoCard(props: DemoCardProps) {
  const { status } = useDemoRealtime(props.id, props.status)

  const hostname = (() => {
    try { return new URL(props.product_url).hostname }
    catch { return props.product_url }
  })()

  return (
    <div className="group rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-zinc-900">
            {props.title ?? hostname}
          </p>
          <p className="mt-0.5 truncate text-sm text-zinc-400">{props.product_url}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm">
        {status === 'completed' && (
          <>
            {props.duration && (
              <span className="text-zinc-400">{props.duration}s</span>
            )}
            <Link
              href={`/share/${props.share_token}`}
              target="_blank"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              查看分享页 →
            </Link>
          </>
        )}

        {status === 'review' && (
          <Link
            href={`/demo/${props.id}`}
            className="font-medium text-amber-600 underline-offset-2 hover:underline"
          >
            确认步骤 →
          </Link>
        )}

        {status === 'paused' && (
          <Link
            href={`/demo/${props.id}`}
            className="font-medium text-red-600 underline-offset-2 hover:underline"
          >
            处理录制失败 →
          </Link>
        )}
      </div>
    </div>
  )
}
