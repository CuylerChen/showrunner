import dns from 'node:dns/promises'
import net from 'node:net'

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; message: string }

function inRange(value: number, start: number, end: number) {
  return value >= start && value <= end
}

function ipv4ToNumber(ip: string) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

function normalizeIpAddress(address: string) {
  return address.replace(/^\[|\]$/g, '')
}

export function isBlockedIpAddress(address: string): boolean {
  const normalized = normalizeIpAddress(address)
  const version = net.isIP(normalized)

  if (version === 4) {
    const n = ipv4ToNumber(normalized)
    return (
      inRange(n, ipv4ToNumber('0.0.0.0'), ipv4ToNumber('0.255.255.255')) ||
      inRange(n, ipv4ToNumber('10.0.0.0'), ipv4ToNumber('10.255.255.255')) ||
      inRange(n, ipv4ToNumber('127.0.0.0'), ipv4ToNumber('127.255.255.255')) ||
      inRange(n, ipv4ToNumber('169.254.0.0'), ipv4ToNumber('169.254.255.255')) ||
      inRange(n, ipv4ToNumber('172.16.0.0'), ipv4ToNumber('172.31.255.255')) ||
      inRange(n, ipv4ToNumber('192.168.0.0'), ipv4ToNumber('192.168.255.255')) ||
      inRange(n, ipv4ToNumber('224.0.0.0'), ipv4ToNumber('239.255.255.255')) ||
      normalized === '169.254.169.254'
    )
  }

  if (version === 6) {
    const lower = normalized.toLowerCase()
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:')
    )
  }

  return false
}

export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (!url.hostname) return null
    return url
  } catch {
    return null
  }
}

export function validateUrlForUserInput(raw: string): UrlValidationResult {
  const url = parseHttpUrl(raw)
  if (!url) {
    return { ok: false, message: '请输入有效的 http(s) URL，且不要包含用户名或密码' }
  }

  if (net.isIP(normalizeIpAddress(url.hostname)) && isBlockedIpAddress(url.hostname)) {
    return { ok: false, message: '不支持内网、本机或云 metadata 地址' }
  }

  return { ok: true, url }
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  const parsed = validateUrlForUserInput(raw)
  if (parsed.ok === false) {
    throw new Error(parsed.message)
  }

  const records = await dns.lookup(parsed.url.hostname, { all: true, verbatim: true })
  if (!records.length) throw new Error('无法解析目标域名')

  if (records.some(record => isBlockedIpAddress(record.address))) {
    throw new Error('目标域名解析到不允许访问的地址')
  }

  return parsed.url
}
