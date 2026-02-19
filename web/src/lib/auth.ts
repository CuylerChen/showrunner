import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from './supabase/server'
import { err } from './api'

export async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) return { user: null, response: err('UNAUTHORIZED', '请先登录') }

  const supabase = createAdminClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('clerk_id', userId)
    .single()

  if (!user) return { user: null, response: err('UNAUTHORIZED', '用户不存在') }

  return { user, response: null }
}

export async function getSubscription(userId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}
