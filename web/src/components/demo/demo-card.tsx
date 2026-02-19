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
    <div className="glass-card glass-card-hover group rounded-xl px-4 py-3.5 flex items-center gap-4">
      {/* 左侧：站点首字母图标 + 信息 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold select-none"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)',
            border: '1px solid rgba(99,102,241,0.18)',
            color: '#818CF8',
          }}>
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {props.title ?? hostname}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {props.product_url}
          </p>
        </div>
      </div>

      {/* 右侧：时长 + 状态 + 日期 + 操作按钮 */}
      <div className="flex flex-shrink-0 items-center gap-2.5">
        {props.duration && status === 'completed' && (
          <span className="hidden sm:block text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
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
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#86EFAC',
            }}>
            查看
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </Link>
        )}

        {/* 待确认：确认步骤 */}
        {status === 'review' && (
          <Link href={`/demo/${props.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
            style={{
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.2)',
              color: '#FCD34D',
            }}>
            确认步骤
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </Link>
        )}

        {/* 已中断：处理 */}
        {status === 'paused' && (
          <Link href={`/demo/${props.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#FCA5A5',
            }}>
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
