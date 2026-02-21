'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ShowrunnerLogo } from '@/components/logo'
import { useTranslation } from '@/lib/i18n'

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
  cta_url: string | null
  cta_text: string | null
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

function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function IconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7 4" />
      <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5L9 12" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M8 2v8M5 7l3 3 3-3" />
      <path d="M2 12h12" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 8l3.5 3.5L13 4" />
    </svg>
  )
}

/* ── 分享栏 ─────────────────────────────────────────────── */
function ShareBar({ title, videoUrl }: { title: string | null; videoUrl: string }) {
  const { t } = useTranslation()
  const sp = t.sharePage
  const [copied, setCopied] = React.useState(false)

  const shareUrl  = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = title
    ? `${title} — ${sp.shareLabel}`
    : sp.shareLabel

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function openX() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openLinkedIn() {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const btnBase = 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer'

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{sp.shareLabel}</span>

      {/* 复制链接 */}
      <button onClick={handleCopy}
        className={btnBase}
        style={{ background: copied ? '#F0FDF4' : 'var(--bg-elevated)', border: `1px solid ${copied ? '#BBF7D0' : 'var(--border)'}`, color: copied ? '#15803D' : 'var(--text-secondary)' }}>
        {copied ? <IconCheck /> : <IconLink />}
        {copied ? sp.copied : sp.copyLink}
      </button>

      {/* X / Twitter */}
      <button onClick={openX}
        className={btnBase}
        style={{ background: '#000', border: '1px solid #000', color: '#fff' }}>
        <IconX />
        X
      </button>

      {/* LinkedIn */}
      <button onClick={openLinkedIn}
        className={btnBase}
        style={{ background: '#0A66C2', border: '1px solid #0A66C2', color: '#fff' }}>
        <IconLinkedIn />
        LinkedIn
      </button>

      {/* 下载视频 */}
      <a href={videoUrl} download="product-tour.mp4"
        className={btnBase}
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
        <IconDownload />
        {sp.downloadVideo}
      </a>
    </div>
  )
}

/* ── 加载状态 ──────────────────────────────────────────── */
function LoadingScreen() {
  const { t } = useTranslation()
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
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.sharePage.loading}</span>
        </div>
      </div>
    </div>
  )
}

/* ── 404 状态 ──────────────────────────────────────────── */
function NotFoundScreen() {
  const { t } = useTranslation()
  const sp = t.sharePage
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
            {sp.notFound}
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {sp.notFoundDesc}
          </p>
          <Link href="/"
            className="mt-6 inline-block btn-outline rounded-lg px-5 py-2 text-sm">
            {sp.backHome}
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── 主页面 ────────────────────────────────────────────── */
export default function SharePage() {
  const { token }   = useParams<{ token: string }>()
  const { t } = useTranslation()
  const sp = t.sharePage
  const videoRef    = useRef<HTMLVideoElement>(null)
  const [data, setData]             = useState<ShareData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [showCta, setShowCta]       = useState(false)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); else setNotFound(true) })
      .finally(() => setLoading(false))

    // 记录一次观看（fire-and-forget）
    fetch(`/api/share/${token}/view`, { method: 'POST' }).catch(() => {})
  }, [token])

  function handleTimeUpdate() {
    const current = videoRef.current?.currentTime ?? 0
    if (!data) return
    const idx = data.steps.findLastIndex(
      s => s.timestamp_start != null && current >= s.timestamp_start
    )
    if (idx >= 0) setActiveStep(idx)
  }

  function handleVideoEnded() {
    if (data?.cta_url) setShowCta(true)
  }

  function seekToStep(step: ShareStep) {
    if (!videoRef.current || step.timestamp_start == null) return
    videoRef.current.currentTime = step.timestamp_start
    videoRef.current.play()
    setShowCta(false)
  }

  if (loading) return <LoadingScreen />
  if (notFound || !data) return <NotFoundScreen />

  const hasSteps = data.steps.length > 0
  const hasCta   = !!data.cta_url

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-surface)' }}>

      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20"
        style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
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
            <div className="relative overflow-hidden rounded-2xl"
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
                onEnded={handleVideoEnded}
                className="w-full block"
                playsInline
              />

              {/* ── CTA 结尾浮层 ──────────────────────── */}
              {hasCta && showCta && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                  style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
                >
                  <p className="text-white text-lg font-semibold px-6 text-center">
                    {data.title ?? sp.defaultTitle}
                  </p>
                  <a
                    href={data.cta_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: '#6366F1', color: 'white' }}
                  >
                    {data.cta_text || sp.ctaDefault}
                    <IconArrow />
                  </a>
                  <button
                    onClick={() => { setShowCta(false); if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play() } }}
                    className="text-xs text-white/60 hover:text-white/90 transition-colors cursor-pointer"
                  >
                    {sp.replay}
                  </button>
                </div>
              )}
            </div>

            {/* 视频下方信息栏 */}
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {data.title ?? 'Product Tour'}
              </p>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {hasSteps ? sp.stepsCount(data.steps.length) : ''}
              </span>
            </div>

            {/* 分享栏 */}
            <ShareBar title={data.title} videoUrl={data.video_url} />
          </div>

          {/* ── 章节列表 ─────────────────────────────────── */}
          {hasSteps && (
            <div className="w-full lg:w-56 flex-shrink-0">
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <IconPlay />
                  <span className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>
                    {sp.chapters}
                  </span>
                </div>

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
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            background: isActive ? '#6366F1' : 'var(--bg-elevated)',
                            color: isActive ? 'white' : 'var(--text-muted)',
                          }}>
                          {step.position}
                        </span>

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

                {/* CTA 按钮 — 章节列表底部 */}
                {hasCta && (
                  <div className="px-3 pb-3">
                    <a
                      href={data.cta_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{ background: '#6366F1', color: 'white' }}
                    >
                      {data.cta_text || sp.ctaDefault}
                      <IconArrow />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── 页脚 ─────────────────────────────────────────── */}
      <footer className="flex items-center justify-center gap-1.5 py-4 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {sp.footerBefore}
        <Link href="/" className="font-medium hover:underline" style={{ color: '#6366F1' }}>
          Showrunner
        </Link>
        {sp.footerAfter}
      </footer>
    </div>
  )
}
