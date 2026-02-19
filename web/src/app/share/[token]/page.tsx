'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
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

export default function SharePage() {
  const { token }     = useParams<{ token: string }>()
  const videoRef      = useRef<HTMLVideoElement>(null)
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
    const idx = data.steps.findLastIndex(s => s.timestamp_start != null && current >= s.timestamp_start)
    if (idx >= 0) setActiveStep(idx)
  }

  function seekToStep(step: ShareStep) {
    if (!videoRef.current || step.timestamp_start == null) return
    videoRef.current.currentTime = step.timestamp_start
    videoRef.current.play()
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</span>
      </div>
    </div>
  )

  if (notFound || !data) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">🎬</div>
        <p className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>分享页不存在</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Demo 可能尚未生成完成，或链接已失效</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* 顶栏 */}
      <header className="sticky top-0 z-10"
        style={{
          background: 'rgba(7,11,20,0.9)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <ShowrunnerLogo size={26} />
            <div className="hidden sm:block h-4 w-px" style={{ background: 'var(--border-bright)' }} />
            <h1 className="hidden sm:block text-sm font-medium truncate max-w-xs"
              style={{ color: 'var(--text-secondary)' }}>
              {data.title ?? 'Product Demo'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.2)' }}>
              {data.duration}s
            </span>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* 标题（移动端） */}
        <h1 className="sm:hidden text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {data.title ?? 'Product Demo'}
        </h1>

        <div className="flex flex-col gap-5 lg:flex-row">
          {/* 视频播放器 */}
          <div className="flex-1">
            <div className="overflow-hidden rounded-2xl"
              style={{ background: '#000', boxShadow: '0 8px 48px rgba(0,0,0,0.7)' }}>
              <video
                ref={videoRef}
                src={data.video_url}
                controls
                onTimeUpdate={handleTimeUpdate}
                className="w-full block"
                playsInline
              />
            </div>
          </div>

          {/* 步骤导航 */}
          <div className="w-full lg:w-60 flex-shrink-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}>
              章节
            </p>
            <div className="space-y-1">
              {data.steps.map((step, idx) => (
                <button
                  key={step.position}
                  onClick={() => seekToStep(step)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
                  style={{
                    background: idx === activeStep ? 'rgba(99,102,241,0.12)' : 'transparent',
                    border: `1px solid ${idx === activeStep ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
                  }}
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: idx === activeStep ? '#6366F1' : 'rgba(255,255,255,0.06)',
                      color: idx === activeStep ? 'white' : 'var(--text-muted)',
                    }}>
                    {step.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug font-medium"
                      style={{ color: idx === activeStep ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {step.title}
                    </p>
                    {step.timestamp_start != null && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {step.timestamp_start.toFixed(1)}s
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
