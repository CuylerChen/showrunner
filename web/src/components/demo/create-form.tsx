'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateForm() {
  const router = useRouter()
  const [url, setUrl]           = useState('')
  const [desc, setDesc]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

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

      if (!data.success) {
        setError(data.error?.message ?? '创建失败，请重试')
        return
      }

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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">生成新的 Demo</h2>

      {/* URL 输入 */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            产品 URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            placeholder="https://app.yourproduct.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
          />
        </div>

        {/* 描述（可选） */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            演示什么？
            <span className="ml-1.5 font-normal text-zinc-400">（可选，不填 AI 自动决定）</span>
          </label>
          <input
            type="text"
            placeholder="用户注册 → 创建第一个项目 → 导出报告"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !url}
        className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '生成中...' : '生成 Demo →'}
      </button>
    </form>
  )
}
