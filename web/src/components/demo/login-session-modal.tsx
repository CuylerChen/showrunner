'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  demoId: string
  productUrl: string
  hasExistingSession: boolean
  onSaved: () => void
  onClose: () => void
}

export function LoginSessionModal({ demoId, productUrl, hasExistingSession, onSaved, onClose }: Props) {
  const [phase, setPhase]       = useState<'idle' | 'active'>('idle')
  const [starting, setStarting] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [navUrl, setNavUrl]     = useState(productUrl)
  const [tick, setTick]         = useState(0)          // 驱动截图轮询

  const containerRef = useRef<HTMLDivElement>(null)

  /* ── 截图轮询（400ms） ──────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'active') return
    const id = setInterval(() => setTick(n => n + 1), 400)
    return () => clearInterval(id)
  }, [phase])

  /* ── 启动远程浏览器 ─────────────────────────────────────── */
  async function startSession() {
    setStarting(true)
    setError(null)
    try {
      const res  = await fetch(`/api/demos/${demoId}/login-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? '启动失败')
      setPhase('active')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  /* ── 保存登录状态 ───────────────────────────────────────── */
  async function saveState() {
    setSaving(true)
    setError(null)
    try {
      const res  = await fetch(`/api/demos/${demoId}/login-session/save`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? '保存失败')
      setPhase('idle')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /* ── 关闭（清理会话） ───────────────────────────────────── */
  async function handleClose() {
    if (phase === 'active') {
      fetch(`/api/demos/${demoId}/login-session`, { method: 'DELETE' }).catch(() => {})
    }
    onClose()
  }

  /* ── 点击截图 → 转换坐标发给 Worker ───────────────────── */
  function handleImgClick(e: React.MouseEvent<HTMLImageElement>) {
    const img  = e.currentTarget
    const rect = img.getBoundingClientRect()
    const x    = Math.round((e.clientX - rect.left) * (1280 / rect.width))
    const y    = Math.round((e.clientY - rect.top)  * (720  / rect.height))
    sendInput({ type: 'click', x, y })
    containerRef.current?.focus()
  }

  /* ── 滚轮 ───────────────────────────────────────────────── */
  function handleWheel(e: React.WheelEvent<HTMLImageElement>) {
    const img  = e.currentTarget
    const rect = img.getBoundingClientRect()
    const x    = Math.round((e.clientX - rect.left) * (1280 / rect.width))
    const y    = Math.round((e.clientY - rect.top)  * (720  / rect.height))
    sendInput({ type: 'scroll', x, y, deltaY: e.deltaY })
  }

  /* ── 键盘 ───────────────────────────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent) {
    // 忽略导航栏的输入框（它有自己的 handler）
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    e.preventDefault()
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      sendInput({ type: 'type', text: e.key })
    } else {
      sendInput({ type: 'key', key: e.key })
    }
  }

  /* ── 导航栏提交 ─────────────────────────────────────────── */
  function handleNav(e: React.FormEvent) {
    e.preventDefault()
    let url = navUrl.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    sendInput({ type: 'navigate', url })
  }

  function sendInput(event: object) {
    fetch(`/api/demos/${demoId}/login-session/input`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(event),
    }).catch(() => {})
  }

  /* ── 渲染 ───────────────────────────────────────────────── */
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        width: '100%',
        maxWidth: phase === 'active' ? '920px' : '480px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'max-width 0.3s ease',
      }}>

        {/* 标题栏 */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔐</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
              配置登录状态
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{ color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* ── 初始状态（未启动会话） ── */}
          {phase === 'idle' && (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                录制需要登录的产品时，需要先在远程浏览器中完成登录，系统将保存登录状态供后续录制使用。
              </p>

              {hasExistingSession && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '0.75rem',
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span style={{ color: '#86EFAC', fontSize: '0.875rem' }}>✓ 已有保存的登录状态</span>
                  <span style={{ color: 'rgba(134,239,172,0.6)', fontSize: '0.75rem' }}>（可重新启动浏览器更新）</span>
                </div>
              )}

              {error && (
                <p style={{ color: '#FCA5A5', fontSize: '0.875rem' }}>{error}</p>
              )}

              <button
                onClick={startSession}
                disabled={starting}
                className="btn-brand rounded-xl py-3 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {starting
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      正在启动远程浏览器...
                    </span>
                  : '🌐  启动远程浏览器'}
              </button>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                浏览器运行在服务器上，登录凭据不会被记录
              </p>
            </>
          )}

          {/* ── 活跃状态（会话进行中） ── */}
          {phase === 'active' && (
            <>
              {/* 地址栏 */}
              <form onSubmit={handleNav} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={navUrl}
                  onChange={e => setNavUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    flex: 1, padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
                <button type="submit" style={{
                  padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818CF8', fontSize: '0.8125rem', cursor: 'pointer',
                }}>
                  跳转
                </button>
              </form>

              {/* 截图显示区 */}
              <div
                ref={containerRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                style={{
                  outline: 'none',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  cursor: 'crosshair',
                  background: '#000',
                  lineHeight: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/demos/${demoId}/login-session/screenshot?t=${tick}`}
                  alt="远程浏览器"
                  onClick={handleImgClick}
                  onWheel={handleWheel}
                  style={{ width: '100%', display: 'block' }}
                  draggable={false}
                />
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                点击图像操控浏览器 · 完成登录后点击「保存登录状态」
              </p>

              {error && (
                <p style={{ color: '#FCA5A5', fontSize: '0.875rem' }}>{error}</p>
              )}

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleClose}
                  style={{
                    padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer',
                    background: 'none',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={saveState}
                  disabled={saving}
                  className="btn-brand rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        保存中...
                      </span>
                    : '✓ 保存登录状态'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
