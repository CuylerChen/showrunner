import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { CreateForm } from '@/components/demo/create-form'
import { DemoCard } from '@/components/demo/demo-card'

async function getDemos(userId: string) {
  const supabase = createAdminClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return []

  const { data } = await supabase
    .from('demos')
    .select('id, title, product_url, status, duration, share_token, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const demos = await getDemos(userId)

  return (
    <div className="space-y-8">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demo 工作台</h1>
        <p className="mt-1 text-sm text-zinc-500">粘贴产品 URL，自动生成可分享的演示视频</p>
      </div>

      {/* 创建表单 */}
      <CreateForm />

      {/* Demo 列表 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          我的 Demo（{demos.length}）
        </h2>

        {demos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center">
            <p className="text-sm text-zinc-400">还没有 Demo，上方输入 URL 开始生成</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {demos.map(demo => (
              <DemoCard key={demo.id} {...demo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
