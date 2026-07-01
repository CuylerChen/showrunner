import { NextResponse } from 'next/server'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'PLAN_RESTRICTED'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_PORTAL_UNAVAILABLE'
  | 'PROMPT_REJECTED'
  | 'CONTENT_MODERATION_NOT_CONFIGURED'
  | 'CONTENT_MODERATION_UNAVAILABLE'
  | 'DEMO_NOT_READY'
  | 'VALIDATION_ERROR'
  | 'START_FAILED'
  | 'RECORD_RETRY_FAILED'
  | 'PAYMENT_PROVIDER_ERROR'
  | 'INTERNAL_ERROR'

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED:     401,
  FORBIDDEN:        403,
  NOT_FOUND:        404,
  QUOTA_EXCEEDED:   402,
  PLAN_RESTRICTED:  403,
  SUBSCRIPTION_NOT_FOUND: 404,
  SUBSCRIPTION_PORTAL_UNAVAILABLE: 409,
  PROMPT_REJECTED: 400,
  CONTENT_MODERATION_NOT_CONFIGURED: 503,
  CONTENT_MODERATION_UNAVAILABLE: 503,
  DEMO_NOT_READY:   409,
  VALIDATION_ERROR: 422,
  START_FAILED:     503,
  RECORD_RETRY_FAILED: 503,
  PAYMENT_PROVIDER_ERROR: 502,
  INTERNAL_ERROR:   500,
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function err(code: ErrorCode, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: STATUS_MAP[code] }
  )
}
