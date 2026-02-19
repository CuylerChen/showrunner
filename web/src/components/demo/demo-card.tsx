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
  created_at: string | Date
}

export function DemoCard(props: DemoCardProps) {
  const { status } = useDemoRealtime(props.id, props.status)

  const hostname = (() => {
    try { return new URL(props.product_url).hostname }
    catch { return props.product_url }
  })()

  const date = new Date(props.created_at as string).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric',
  })

  return (
    <div className="glass-card glass-card-hover group rounded-xl p-4 flex items-center justify-between gap-4">
      {/* 左侧：图标 + 信息 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* 站点图标占位 */}
        <div className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#818CF8' }}>
          {hostname.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {props.title ?? hostname}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {props.product_url}
          </p>
        </div>
      </div>

      {/* 右侧：状态 + 时间 + 操作 */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {props.duration && status === 'completed' && (
          <span className="hidden sm:block text-xs" style={{ color: 'var(--text-muted)' }}>
            {props.duration}s
          </span>
        )}

        <StatusBadge status={status} />

        <span className="hidden sm:block text-xs" style={{ color: 'var(--text-muted)' }}>
          {date}
        </span>

        {status === 'completed' && (
          <Link href={`/share/${props.share_token}`} target="_blank"
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818CF8',
            }}>
            查看 →
          </Link>
        )}

        {status === 'review' && (
          <Link href={`/demo/${props.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.25)',
              color: '#FCD34D',
            }}>
            确认步骤 →
          </Link>
        )}

        {status === 'paused' && (
          <Link href={`/demo/${props.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#FCA5A5',
            }}>
            处理 →
          </Link>
        )}
      </div>
    </div>
  )
}
