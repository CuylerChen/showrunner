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
    return { ok: false, message: 'Only http(s) URLs without credentials are allowed' }
  }

  if (net.isIP(normalizeIpAddress(url.hostname)) && isBlockedIpAddress(url.hostname)) {
    return {
      ok: false,
      message: 'Private, loopback, link-local, multicast, and metadata addresses are not allowed',
    }
  }

  return { ok: true, url }
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  const parsed = validateUrlForUserInput(raw)
  if (!parsed.ok) throw new Error(parsed.message)

  const records = await dns.lookup(parsed.url.hostname, { all: true, verbatim: true })
  if (!records.length) throw new Error('Hostname could not be resolved')

  if (records.some(record => isBlockedIpAddress(record.address))) {
    throw new Error('Hostname resolves to a blocked address')
  }

  return parsed.url
}

export async function resolveSafeRedirectUrl(
  raw: string,
  fetchImpl: typeof fetch = fetch,
): Promise<URL> {
  let current = await assertSafePublicUrl(raw)

  for (let i = 0; i < 5; i++) {
    const response = await fetchImpl(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShowrunnerPromoBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    })

    if (![301, 302, 303, 307, 308].includes(response.status)) return current

    const location = response.headers.get('location')
    if (!location) return current

    current = await assertSafePublicUrl(new URL(location, current).toString())
  }

  throw new Error('Too many redirects')
}
