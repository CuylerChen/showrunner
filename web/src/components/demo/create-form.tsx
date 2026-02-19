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
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex h-2 w-2 rounded-full"
          style={{ background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.15)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          生成新的 Demo
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            产品 URL
            <span className="ml-1" style={{ color: '#DC2626' }}>*</span>
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

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            演示内容
            <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>（可选）</span>
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
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3.5 py-2.5"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5"
            style={{ color: '#DC2626' }}>
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
          </svg>
          <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          AI 将自动解析页面并规划操作步骤
        </p>
        <button
          type="submit"
          disabled={loading || !url}
          className="btn-brand flex-shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              AI 解析中...
            </>
          ) : (
            <>
              生成 Demo
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
