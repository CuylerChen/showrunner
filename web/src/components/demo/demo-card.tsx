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
  has_session: boolean
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

function IconKey() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="6" cy="7" r="3.5" />
      <path d="M9 9.5l5.5 4.5M11.5 12l1.5 1.5" />
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

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M3 8l3.5 3.5L13 4" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
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

/* ── Session 登录凭证面板 ──────────────────────────────── */
const EXTRACT_SCRIPT = `(function(){
  var c=document.cookie.split(';').map(function(p){
    var i=p.indexOf('='),n=p.slice(0,i).trim(),v=p.slice(i+1).trim();
    return {name:n,value:v,domain:location.hostname,path:'/',
            secure:location.protocol==='https:',httpOnly:false,sameSite:'Lax'};
  }).filter(function(x){return x.name;});
  var out=JSON.stringify(c);
  navigator.clipboard.writeText(out)
    .then(function(){alert('✅ 已复制 '+c.length+' 个 Cookie！\\n\\n请返回 Showrunner 粘贴到输入框。');})
    .catch(function(){prompt('请手动复制：',out);});
})()`

function SessionPanel({ id, initHasSession, onClose }: {
  id: string
  initHasSession: boolean
  onClose: (hasSession: boolean) => void
}) {
  const [raw, setRaw]       = useState('')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    setError('')
    let cookies: unknown[]
    try {
      cookies = JSON.parse(raw.trim())
      if (!Array.isArray(cookies) || cookies.length === 0) throw new Error()
    } catch {
      setError('格式错误：请确保粘贴的是完整的 JSON 数组')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/demos/${id}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      })
      const data = await res.json()
      if (data.success) {
        onClose(true)
      } else {
        setError(data.error?.message ?? '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      await fetch(`/api/demos/${id}/session`, { method: 'DELETE' })
      onClose(false)
    } finally {
      setClearing(false)
    }
  }

  function handleCopyScript() {
    navigator.clipboard.writeText(EXTRACT_SCRIPT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-4"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>

      {/* 说明标题 */}
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        为需要登录的产品设置录制凭证
      </p>

      {/* 当前状态 */}
      {initHasSession && (
        <div className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-2"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
          <IconCheck />
          登录凭证已设置，录制时将自动使用
        </div>
      )}

      {/* 步骤说明 */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: '#6366F1' }}>1</span>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            在您的浏览器中打开产品网站并完成登录
          </p>
        </div>

        <div className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: '#6366F1' }}>2</span>
          <div className="flex-1 space-y-2">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              按 <kbd className="rounded px-1.5 py-0.5 text-xs font-mono"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>F12</kbd>
              {' → '}<strong>Console</strong>，将以下代码粘贴后按 Enter：
            </p>
            <div className="relative rounded-lg overflow-hidden"
              style={{ background: '#1E1E3F', border: '1px solid #3730A3' }}>
              <pre className="px-3 py-2.5 text-xs text-indigo-200 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {EXTRACT_SCRIPT}
              </pre>
              <button
                onClick={handleCopyScript}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer"
                style={{
                  background: copied ? '#4ADE80' : '#6366F1',
                  color: 'white',
                }}
              >
                {copied ? <IconCheck /> : <IconCopy />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              脚本会自动将 Cookie 复制到剪贴板并弹出确认提示。
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: '#6366F1' }}>3</span>
          <div className="flex-1 space-y-2">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              将复制的内容粘贴到下方：
            </p>
            <textarea
              value={raw}
              onChange={e => { setRaw(e.target.value); setError('') }}
              placeholder='[{"name":"session","value":"...","domain":"app.example.com","path":"/"}]'
              rows={3}
              className="input-dark w-full rounded-lg px-3 py-2 text-xs font-mono resize-none"
            />
            {error && (
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between">
        <div>
          {initHasSession && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="text-xs cursor-pointer hover:underline"
              style={{ color: '#DC2626' }}
            >
              {clearing ? '清除中...' : '清除凭证'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onClose(initHasSession)}
            className="rounded-lg px-3 py-1.5 text-xs cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !raw.trim()}
            className="btn-brand rounded-lg px-4 py-1.5 text-xs font-medium flex items-center gap-1.5"
          >
            {saving && <span className="h-3 w-3 rounded-full border border-white/40 border-t-white animate-spin" />}
            保存凭证
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 主组件 ─────────────────────────────────────────────── */
export function DemoCard(props: DemoCardProps) {
  const { status } = useDemoRealtime(props.id, props.status)
  const { t, locale } = useTranslation()
  const dc = t.demoCard

  const [ctaOpen, setCtaOpen]       = useState(false)
  const [ctaUrl, setCtaUrl]         = useState(props.cta_url)
  const [ctaText, setCtaText]       = useState(props.cta_text)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [hasSession, setHasSession]  = useState(props.has_session)

  const hostname = (() => {
    try { return new URL(props.product_url).hostname }
    catch { return props.product_url }
  })()

  const initial = hostname.charAt(0).toUpperCase()

  const date = new Date(props.created_at as string).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : 'en-US',
    { month: 'short', day: 'numeric' },
  )

  const showSessionBtn = status === 'review' || status === 'paused'

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
                onClick={() => { setCtaOpen(v => !v); setSessionOpen(false) }}
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

          {/* 登录凭证按钮（review / paused 状态显示）*/}
          {showSessionBtn && (
            <button
              onClick={() => { setSessionOpen(v => !v); setCtaOpen(false) }}
              title={hasSession ? '已设置登录凭证' : '设置登录凭证'}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer"
              style={{
                background: hasSession
                  ? (sessionOpen ? '#F0FDF4' : '#F0FDF4')
                  : (sessionOpen ? '#EEF2FF' : 'transparent'),
                border: `1px solid ${
                  hasSession ? '#BBF7D0' : sessionOpen ? '#C7D2FE' : 'var(--border)'
                }`,
                color: hasSession ? '#15803D' : sessionOpen ? '#4338CA' : 'var(--text-muted)',
              }}
            >
              <IconKey />
              {hasSession && <IconCheck />}
              <IconChevron open={sessionOpen} />
            </button>
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

      {/* ── Session 凭证面板（可展开）────────────────────── */}
      {sessionOpen && showSessionBtn && (
        <SessionPanel
          id={props.id}
          initHasSession={hasSession}
          onClose={(hs) => {
            setHasSession(hs)
            setSessionOpen(false)
          }}
        />
      )}
    </div>
  )
}
