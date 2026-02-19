'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

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
      .then(d => {
        if (d.success) setData(d.data)
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [token])

  // 根据播放时间更新当前高亮步骤
  function handleTimeUpdate() {
    const current = videoRef.current?.currentTime ?? 0
    if (!data) return
    const idx = data.steps.findLastIndex(s => s.timestamp_start != null && current >= s.timestamp_start)
    if (idx >= 0) setActiveStep(idx)
  }

  // 点击步骤跳转到对应时间节点
  function seekToStep(step: ShareStep) {
    if (!videoRef.current || step.timestamp_start == null) return
    videoRef.current.currentTime = step.timestamp_start
    videoRef.current.play()
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-zinc-400">加载中...</p>
    </div>
  )

  if (notFound || !data) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold text-zinc-700">分享页不存在</p>
        <p className="mt-1 text-sm text-zinc-400">Demo 可能尚未生成完成，或链接已失效</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶栏 */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Showrunner</p>
            <h1 className="mt-0.5 text-base font-semibold">{data.title ?? 'Product Demo'}</h1>
          </div>
          <span className="text-xs text-zinc-500">{data.duration}s</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* 视频播放器 */}
          <div className="flex-1">
            <div className="overflow-hidden rounded-2xl bg-zinc-900">
              <video
                ref={videoRef}
                src={data.video_url}
                controls
                onTimeUpdate={handleTimeUpdate}
                className="w-full"
                playsInline
              />
            </div>
          </div>

          {/* 步骤导航 */}
          <div className="w-full lg:w-64">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              步骤导航
            </p>
            <div className="space-y-1.5">
              {data.steps.map((step, idx) => (
                <button
                  key={step.position}
                  onClick={() => seekToStep(step)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    idx === activeStep
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    idx === activeStep ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {step.position}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{step.title}</p>
                    {step.timestamp_start != null && (
                      <p className="mt-0.5 text-xs text-zinc-600">
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
