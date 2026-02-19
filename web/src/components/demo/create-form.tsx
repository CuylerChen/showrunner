'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateForm() {
  const router = useRouter()
  const [url, setUrl]         = useState('')
  const [desc, setDesc]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/demos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ product_url: url, description: desc || null }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error?.message ?? '创建失败，请重试'); return }
      setUrl('')
      setDesc('')
      router.refresh()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}
      className="glass-card rounded-2xl p-6"
      style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.4)' }}>

      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-2 w-2 rounded-full" style={{ background: '#6366F1', boxShadow: '0 0 6px #6366F1' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          生成新的 Demo
        </h2>
      </div>

      <div className="space-y-3">
        {/* URL 输入 */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            产品 URL <span style={{ color: '#F87171' }}>*</span>
          </label>
          <input
            type="url"
            required
            placeholder="https://app.yourproduct.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="input-dark w-full rounded-lg px-3.5 py-2.5 text-sm"
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            演示内容
            <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>（可选，留空由 AI 决定）</span>
          </label>
          <input
            type="text"
            placeholder="例：用户注册 → 创建项目 → 导出报告"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="input-dark w-full rounded-lg px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg px-3.5 py-2.5 text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !url}
        className="btn-brand mt-4 w-full rounded-lg py-2.5 text-sm font-semibold"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            AI 解析中...
          </span>
        ) : '生成 Demo →'}
      </button>
    </form>
  )
}
