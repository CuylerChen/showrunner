'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/demo/status-badge'
import { useDemoRealtime } from '@/hooks/use-demo-realtime'
import type { Demo, Step, DemoStatus } from '@/types'

type DemoWithSteps = Demo & { steps: Step[] }

export default function DemoDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [demo, setDemo]     = useState<DemoWithSteps | null>(null)
  const [steps, setSteps]   = useState<Step[]>([])
  const [loading, setLoading]   = useState(true)
  const [starting, setStarting] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)

  const { status, errorMessage } = useDemoRealtime(id, demo?.status ?? 'pending')

  useEffect(() => {
    fetch(`/api/demos/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setDemo(d.data); setSteps(d.data.steps ?? []) }
      })
      .finally(() => setLoading(false))
  }, [id])

  // 状态变为 completed 自动跳转分享页
  useEffect(() => {
    if (status === 'completed' && demo?.share_token) {
      router.push(`/share/${demo.share_token}`)
    }
  }, [status, demo?.share_token, router])

  async function startRecording() {
    setStarting(true)
    await fetch(`/api/demos/${id}/start`, { method: 'POST' })
    setStarting(false)
  }

  async function resolveStep(stepId: string, action: 'skip' | 'retry') {
    setResolving(stepId)
    await fetch(`/api/demos/${id}/steps/${stepId}/resolve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    setResolving(null)
  }

  async function updateStep(stepId: string, field: 'title' | 'narration', value: string) {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, [field]: value } : s))
  }

  async function saveSteps() {
    await fetch(`/api/demos/${id}/steps`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ steps: steps.map(s => ({ id: s.id, position: s.position, title: s.title, narration: s.narration })) }),
    })
  }

  if (loading) return <div className="py-20 text-center text-sm text-zinc-400">加载中...</div>
  if (!demo)   return <div className="py-20 text-center text-sm text-zinc-400">Demo 不存在</div>

  const isPaused   = status === 'paused'
  const isReview   = status === 'review'
  const isRunning  = ['recording', 'processing', 'parsing'].includes(status)

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{demo.title ?? demo.product_url}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">{demo.product_url}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* 错误提示 */}
      {isPaused && errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm font-medium text-red-700">录制中断</p>
          <p className="mt-0.5 text-sm text-red-500">{errorMessage}</p>
        </div>
      )}

      {/* 进行中提示 */}
      {isRunning && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-sm text-blue-600">
            {status === 'parsing'   && '⏳ AI 正在解析步骤，请稍候...'}
            {status === 'recording' && '⏳ 正在录制，完成后自动跳转...'}
            {status === 'processing' && '⏳ 正在合成视频，即将完成...'}
          </p>
        </div>
      )}

      {/* 步骤列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            步骤（{steps.length}）
          </h2>
          {isReview && (
            <button onClick={saveSteps} className="text-xs text-zinc-500 underline-offset-2 hover:underline">
              保存修改
            </button>
          )}
        </div>

        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`rounded-xl border bg-white p-4 transition ${
              step.status === 'failed'  ? 'border-red-200 bg-red-50' :
              step.status === 'skipped' ? 'border-zinc-100 opacity-50' :
              step.status === 'completed' ? 'border-green-100' :
              'border-zinc-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* 序号 */}
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-500">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                {/* 步骤标题（review 时可编辑） */}
                {isReview ? (
                  <input
                    value={step.title}
                    onChange={e => updateStep(step.id, 'title', e.target.value)}
                    className="w-full text-sm font-medium text-zinc-900 bg-transparent outline-none border-b border-transparent focus:border-zinc-300"
                  />
                ) : (
                  <p className="text-sm font-medium text-zinc-900">{step.title}</p>
                )}

                {/* 动作类型标签 */}
                <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                  {step.action_type}
                  {step.selector && ` · ${step.selector}`}
                </span>

                {/* 旁白（review 时可编辑） */}
                {isReview ? (
                  <textarea
                    value={step.narration ?? ''}
                    onChange={e => updateStep(step.id, 'narration', e.target.value)}
                    rows={2}
                    placeholder="旁白文案（英文朗读）"
                    className="mt-2 w-full rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500 outline-none focus:border-zinc-300 resize-none"
                  />
                ) : (
                  step.narration && (
                    <p className="mt-1 text-xs italic text-zinc-400">"{step.narration}"</p>
                  )
                )}
              </div>

              {/* 失败时的介入按钮 */}
              {isPaused && step.status === 'failed' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    disabled={!!resolving}
                    onClick={() => resolveStep(step.id, 'retry')}
                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {resolving === step.id ? '...' : '重试'}
                  </button>
                  <button
                    disabled={!!resolving}
                    onClick={() => resolveStep(step.id, 'skip')}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    跳过
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 开始录制按钮 */}
      {isReview && (
        <button
          onClick={startRecording}
          disabled={starting}
          className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {starting ? '正在触发录制...' : '✓ 确认步骤，开始录制 →'}
        </button>
      )}
    </div>
  )
}
