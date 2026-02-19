import { NextResponse } from 'next/server'

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'DEMO_NOT_READY'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED:     401,
  FORBIDDEN:        403,
  NOT_FOUND:        404,
  QUOTA_EXCEEDED:   402,
  DEMO_NOT_READY:   409,
  VALIDATION_ERROR: 422,
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
