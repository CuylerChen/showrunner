'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ShowrunnerLogo } from '@/components/logo'

interface ShareStep {
  position: number
  title: string
  timestamp_start: number
  timestamp_end: number
}

interface ShareData {
  title: string | null
  video_url: string
  duration: number
  steps: ShareStep[]
}

/* ── 图标 ──────────────────────────────────────────────── */
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function IconFilm() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
      <rect x="4" y="14" width="40" height="26" rx="3"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 22h40" stroke="currentColor" strokeWidth="2" />
      <path d="M4 14l8-8M17 14l8-8M30 14l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="33" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M22.5 33l2.5 1.5-2.5 1.5" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── 加载状态 ──────────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <ShowrunnerLogo size={26} />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</span>
        </div>
      </div>
    </div>
  )
}

/* ── 404 状态 ──────────────────────────────────────────── */
function NotFoundScreen() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg-surface)' }}>
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <Link href="/"><ShowrunnerLogo size={26} /></Link>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }}>
            <IconFilm />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            分享页不存在
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Demo 可能尚未生成完成，或链接已失效
          </p>
          <Link href="/"
            className="mt-6 inline-block btn-outline rounded-lg px-5 py-2 text-sm">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── 主页面 ────────────────────────────────────────────── */
export default function SharePage() {
  const { token }   = useParams<{ token: string }>()
  const videoRef    = useRef<HTMLVideoElement>(null)
  const [data, setData]             = useState<ShareData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); else setNotFound(true) })
      .finally(() => setLoading(false))
  }, [token])

  function handleTimeUpdate() {
    const current = videoRef.current?.currentTime ?? 0
    if (!data) return
    const idx = data.steps.findLastIndex(
      s => s.timestamp_start != null && current >= s.timestamp_start
    )
    if (idx >= 0) setActiveStep(idx)
  }

  function seekToStep(step: ShareStep) {
    if (!videoRef.current || step.timestamp_start == null) return
    videoRef.current.currentTime = step.timestamp_start
    videoRef.current.play()
  }

  if (loading) return <LoadingScreen />
  if (notFound || !data) return <NotFoundScreen />

  const hasSteps = data.steps.length > 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-surface)' }}>

      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20"
        style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {/* 左：Logo + 分隔线 + 标题 */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex-shrink-0 cursor-pointer">
              <ShowrunnerLogo size={26} />
            </Link>
            <div className="hidden sm:block h-4 w-px flex-shrink-0"
              style={{ background: 'var(--border-bright)' }} />
            <h1 className="hidden sm:block text-sm font-medium truncate"
              style={{ color: 'var(--text-secondary)', maxWidth: '280px' }}>
              {data.title ?? 'Product Demo'}
            </h1>
          </div>

          {/* 右：时长 */}
          <div className="flex items-center gap-1.5 flex-shrink-0 rounded-full px-3 py-1.5"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
            <IconClock />
            <span className="text-xs font-medium tabular-nums">{data.duration}s</span>
          </div>
        </div>
      </header>

      {/* ── 内容区 ───────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">

        {/* 移动端标题 */}
        <h1 className="sm:hidden text-base font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}>
          {data.title ?? 'Product Demo'}
        </h1>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

          {/* ── 视频播放器 ──────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="overflow-hidden rounded-2xl"
              style={{
                background: '#000',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)',
              }}>
              <video
                ref={videoRef}
                src={data.video_url}
                controls
                onTimeUpdate={handleTimeUpdate}
                className="w-full block"
                playsInline
              />
            </div>

            {/* 视频下方信息栏 */}
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {data.title ?? 'Product Demo'}
              </p>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {hasSteps ? `${data.steps.length} 个步骤` : ''}
              </span>
            </div>
          </div>

          {/* ── 章节列表 ─────────────────────────────────── */}
          {hasSteps && (
            <div className="w-full lg:w-56 flex-shrink-0">
              <div className="glass-card rounded-2xl overflow-hidden">
                {/* 列表标题 */}
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <IconPlay />
                  <span className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>
                    章节导航
                  </span>
                </div>

                {/* 步骤列表 */}
                <div className="p-2 space-y-0.5">
                  {data.steps.map((step, idx) => {
                    const isActive = idx === activeStep
                    return (
                      <button
                        key={step.position}
                        onClick={() => seekToStep(step)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer"
                        style={{
                          background: isActive ? '#EEF2FF' : 'transparent',
                          border: `1px solid ${isActive ? '#C7D2FE' : 'transparent'}`,
                        }}
                        onMouseEnter={e => {
                          if (!isActive)
                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'
                        }}
                        onMouseLeave={e => {
                          if (!isActive)
                            (e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        {/* 序号圆圈 */}
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            background: isActive ? '#6366F1' : 'var(--bg-elevated)',
                            color: isActive ? 'white' : 'var(--text-muted)',
                          }}>
                          {step.position}
                        </span>

                        {/* 步骤文字 */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug truncate"
                            style={{ color: isActive ? '#3730A3' : 'var(--text-secondary)' }}>
                            {step.title}
                          </p>
                          {step.timestamp_start != null && (
                            <p className="mt-0.5 text-xs tabular-nums"
                              style={{ color: 'var(--text-muted)' }}>
                              {step.timestamp_start.toFixed(1)}s
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── 页脚 ─────────────────────────────────────────── */}
      <footer className="flex items-center justify-center gap-1.5 py-4 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        由
        <Link href="/" className="font-medium hover:underline" style={{ color: '#6366F1' }}>
          Showrunner
        </Link>
        生成
      </footer>
    </div>
  )
}
