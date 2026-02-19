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

  const initial = hostname.charAt(0).toUpperCase()

  const date = new Date(props.created_at as string).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric',
  })

  return (
    <div className="glass-card glass-card-hover rounded-xl px-4 py-3.5 flex items-center gap-4">
      {/* 站点首字母图标 */}
      <div className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold select-none"
        style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
        {initial}
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {props.title ?? hostname}
        </p>
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {props.product_url}
        </p>
      </div>

      {/* 右侧元信息 + 操作 */}
      <div className="flex flex-shrink-0 items-center gap-2.5">
        {props.duration && status === 'completed' && (
          <span className="hidden sm:block text-xs tabular-nums"
            style={{ color: 'var(--text-muted)' }}>
            {props.duration}s
          </span>
        )}

        <StatusBadge status={status} />

        <span className="hidden sm:block text-xs" style={{ color: 'var(--text-muted)' }}>
          {date}
        </span>

        {/* 已完成：查看 */}
        {status === 'completed' && (
          <Link href={`/share/${props.share_token}`} target="_blank"
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer hover:opacity-80"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
            查看
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </Link>
        )}

        {/* 待确认 */}
        {status === 'review' && (
          <Link href={`/demo/${props.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer hover:opacity-80"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
            确认步骤
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </Link>
        )}

        {/* 已中断 */}
        {status === 'paused' && (
          <Link href={`/demo/${props.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer hover:opacity-80"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            处理
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
