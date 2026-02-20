'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from './status-badge'
import { useDemoRealtime } from '@/hooks/use-demo-realtime'
import { useTranslation } from '@/lib/i18n'
import type { DemoStatus } from '@/types'

interface DemoCardProps {
  id: string
  title: string | null
  product_url: string
  status: DemoStatus
  duration: number | null
  share_token: string
  view_count: number
  cta_url: string | null
  cta_text: string | null
  created_at: string | Date
}

/* ── 图标 ──────────────────────────────────────────────── */
function IconEye() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/* ── CTA 设置面板 ───────────────────────────────────────── */
function CtaPanel({ id, initUrl, initText, onClose }: {
  id: string
  initUrl: string | null
  initText: string | null
  onClose: (url: string | null, text: string | null) => void
}) {
  const [url, setUrl]   = useState(initUrl ?? '')
  const [text, setText] = useState(initText ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/demos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cta_url:  url.trim() || null,
          cta_text: text.trim() || null,
        }),
      })
      onClose(url.trim() || null, text.trim() || null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-3"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        视频结束时显示行动按钮（CTA）
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            跳转链接
          </label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-product.com/signup"
            className="input-dark w-full rounded-lg px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            按钮文字
          </label>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="立即体验（留空使用默认）"
            maxLength={40}
            className="input-dark w-full rounded-lg px-3 py-2 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => onClose(initUrl, initText)}
          className="rounded-lg px-3 py-1.5 text-xs cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-brand rounded-lg px-4 py-1.5 text-xs font-medium flex items-center gap-1.5"
        >
          {saving && <span className="h-3 w-3 rounded-full border border-white/40 border-t-white animate-spin" />}
          保存
        </button>
      </div>
    </div>
  )
}

/* ── 主组件 ─────────────────────────────────────────────── */
export function DemoCard(props: DemoCardProps) {
  const { status } = useDemoRealtime(props.id, props.status)
  const { t, locale } = useTranslation()
  const dc = t.demoCard

  const [ctaOpen, setCtaOpen]   = useState(false)
  const [ctaUrl, setCtaUrl]     = useState(props.cta_url)
  const [ctaText, setCtaText]   = useState(props.cta_text)

  const hostname = (() => {
    try { return new URL(props.product_url).hostname }
    catch { return props.product_url }
  })()

  const initial = hostname.charAt(0).toUpperCase()

  const date = new Date(props.created_at as string).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : 'en-US',
    { month: 'short', day: 'numeric' },
  )

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* ── 主行 ──────────────────────────────────────────── */}
      <div className="px-4 py-3.5 flex items-center gap-4">
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
          {/* 观看次数 */}
          {status === 'completed' && props.view_count > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs tabular-nums"
              style={{ color: 'var(--text-muted)' }}>
              <IconEye />
              {props.view_count}
            </span>
          )}

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

          {/* 已完成：查看 + CTA 设置 */}
          {status === 'completed' && (
            <>
              <Link href={`/share/${props.share_token}`} target="_blank"
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer hover:opacity-80"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
                {dc.view}
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
                  <path d="M2 6h8M6 2l4 4-4 4" />
                </svg>
              </Link>
              {/* CTA 设置按钮 */}
              <button
                onClick={() => setCtaOpen(v => !v)}
                title="分享设置"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer"
                style={{
                  background: ctaOpen ? '#EEF2FF' : 'transparent',
                  border: `1px solid ${ctaOpen ? '#C7D2FE' : 'var(--border)'}`,
                  color: ctaOpen ? '#4338CA' : 'var(--text-muted)',
                }}
              >
                <IconSettings />
                <IconChevron open={ctaOpen} />
              </button>
            </>
          )}

          {/* 待确认 */}
          {status === 'review' && (
            <Link href={`/demo/${props.id}`}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer hover:opacity-80"
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
              {dc.reviewSteps}
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
              {dc.handle}
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 inline ml-1 -mt-0.5">
                <path d="M2 6h8M6 2l4 4-4 4" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* ── CTA 设置面板（可展开）─────────────────────────── */}
      {ctaOpen && status === 'completed' && (
        <CtaPanel
          id={props.id}
          initUrl={ctaUrl}
          initText={ctaText}
          onClose={(url, text) => {
            setCtaUrl(url)
            setCtaText(text)
            setCtaOpen(false)
          }}
        />
      )}
    </div>
  )
}
