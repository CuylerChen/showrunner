const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST',
])

export const databaseUnavailableMessage =
  '数据库连接失败，请先启动 MySQL，并确认 MYSQL_HOST、MYSQL_PORT、MYSQL_USER、MYSQL_PASSWORD、MYSQL_DATABASE 配置正确。'

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function getCause(error: unknown): unknown {
  if (!error || typeof error !== 'object') return null
  return (error as { cause?: unknown }).cause
}

export function isDatabaseConnectionError(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 6; depth += 1) {
    const code = getErrorCode(current)
    if (code && DATABASE_CONNECTION_ERROR_CODES.has(code)) return true
    current = getCause(current)
    if (!current) return false
  }
  return false
}
