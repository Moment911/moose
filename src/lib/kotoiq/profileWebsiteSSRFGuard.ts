import 'server-only'
import dns from 'dns'

// ── SSRF Guard ─────────────────────────────────────────────────────────────────
// Shared utility consumed by Plan 04 (form scrape) and Plan 05 (website crawl).
// Refuses requests that would hit internal/private IPs or disallowed schemes/ports.

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set([80, 443, 0]) // 0 = no port specified (default)

/**
 * Throws with code 'SSRF_BLOCKED' if the given URL:
 * - Uses a non-http(s) scheme
 * - Specifies a port other than 80/443
 * - Resolves to a private/internal IP address
 */
export async function refuseIfInternalIp(url: string): Promise<void> {
  // ── Parse URL ──────────────────────────────────────────────────────────────
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw ssrfError(`Invalid URL: ${url}`)
  }

  // ── Scheme check ───────────────────────────────────────────────────────────
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw ssrfError(`Disallowed scheme: ${parsed.protocol} in ${url}`)
  }

  // ── Port check ─────────────────────────────────────────────────────────────
  const port = parsed.port ? Number(parsed.port) : 0
  if (port !== 0 && !ALLOWED_PORTS.has(port)) {
    throw ssrfError(`Disallowed port: ${port} in ${url}`)
  }

  // ── DNS resolution ─────────────────────────────────────────────────────────
  const hostname = parsed.hostname

  // Bracket-stripped IPv6 literal check
  if (isPrivateIp(hostname)) {
    throw ssrfError(`Hostname resolves to private IP: ${hostname}`)
  }

  let address: string
  try {
    const result = await dns.promises.lookup(hostname)
    address = result.address
  } catch (err: any) {
    throw ssrfError(`DNS lookup failed for ${hostname}: ${err.message}`)
  }

  if (isPrivateIp(address)) {
    throw ssrfError(`Resolved IP ${address} is private/internal for ${url}`)
  }
}

// ── Private IP detection ─────────────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (ip === '127.0.0.1' || ip.startsWith('127.')) return true
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  if (ip === '169.254.169.254') return true
  if (ip.startsWith('169.254.')) return true
  if (ip === '0.0.0.0') return true

  // 172.16.0.0 – 172.31.255.255
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10)
    if (second >= 16 && second <= 31) return true
  }

  // IPv6 checks
  const lower = ip.toLowerCase()
  if (lower === '::1') return true
  if (lower.startsWith('fe80')) return true
  if (lower.startsWith('fc00') || lower.startsWith('fd')) return true

  return false
}

// ── Error helper ─────────────────────────────────────────────────────────────

function ssrfError(message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string }
  err.code = 'SSRF_BLOCKED'
  return err
}
