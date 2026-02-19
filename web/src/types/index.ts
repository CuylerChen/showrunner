export type DemoStatus =
  | 'pending'
  | 'parsing'
  | 'review'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'completed'
  | 'failed'

export type ActionType = 'navigate' | 'click' | 'fill' | 'wait' | 'assert'

export type StepStatus = 'pending' | 'recording' | 'completed' | 'failed' | 'skipped'

export type PlanType = 'free' | 'starter' | 'pro'

export type SubStatus = 'active' | 'cancelled' | 'expired'

export interface Demo {
  id: string
  user_id: string
  title: string | null
  product_url: string
  description: string | null
  status: DemoStatus
  video_url: string | null
  duration: number | null
  share_token: string
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface Step {
  id: string
  demo_id: string
  position: number
  title: string
  action_type: ActionType
  selector: string | null
  value: string | null
  narration: string | null
  timestamp_start: number | null
  timestamp_end: number | null
  status: StepStatus
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: PlanType
  status: SubStatus
  demos_used_this_month: number
  demos_limit: number
  lemon_squeezy_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

// API 响应类型
export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
