import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  // 如果已登录（middleware 注入了 x-user-id header），直接跳转到 dashboard
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (userId) redirect('/dashboard')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Showrunner</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
          产品 Demo，<br />粘贴 URL 即生成
        </h1>
        <p className="mt-4 text-base text-zinc-500">
          输入产品地址，AI 自动录制操作流程、生成英文旁白、输出可分享的演示视频。
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="w-full rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 sm:w-auto"
          >
            免费开始 →
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-xl border border-zinc-200 px-6 py-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 sm:w-auto"
          >
            已有账号，登录
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-400">注册后免费生成前 3 个 Demo，无需信用卡</p>
      </div>
    </div>
  )
}
