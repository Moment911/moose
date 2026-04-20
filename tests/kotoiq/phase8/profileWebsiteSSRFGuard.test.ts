import { describe, it, expect, vi, beforeEach } from 'vitest'
import dns from 'dns'

// ── Mock server-only (no-op in test) ─────────────────────────────────────────
vi.mock('server-only', () => ({}))

// ── Mock dns.promises.lookup ─────────────────────────────────────────────────
vi.mock('dns', () => {
  const lookup = vi.fn()
  return {
    default: { promises: { lookup } },
    promises: { lookup },
  }
})

const mockLookup = dns.promises.lookup as ReturnType<typeof vi.fn>

import { refuseIfInternalIp } from '@/lib/kotoiq/profileWebsiteSSRFGuard'

// ── Helpers ──────────────────────────────────────────────────────────────────

function expectSsrfBlocked(err: unknown) {
  expect(err).toBeInstanceOf(Error)
  expect((err as any).code).toBe('SSRF_BLOCKED')
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('profileWebsiteSSRFGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: resolve to a safe public IP
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 })
  })

  // ── Scheme checks ────────────────────────────────────────────────────────

  describe('bad schemes', () => {
    it.each([
      'file:///etc/passwd',
      'gopher://evil.com',
      'data:text/html,<h1>hi</h1>',
      'javascript:alert(1)',
      'ftp://files.example.com/foo',
    ])('refuses %s', async (url) => {
      try {
        await refuseIfInternalIp(url)
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
        expect((err as Error).message).toContain('Disallowed scheme')
      }
    })
  })

  // ── Port checks ──────────────────────────────────────────────────────────

  describe('non-standard ports', () => {
    it.each([
      'http://example.com:8080',
      'http://example.com:3000',
      'https://example.com:8443',
      'http://example.com:22',
    ])('refuses %s', async (url) => {
      try {
        await refuseIfInternalIp(url)
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
        expect((err as Error).message).toContain('Disallowed port')
      }
    })

    it('allows explicit port 80', async () => {
      await expect(refuseIfInternalIp('http://example.com:80')).resolves.toBeUndefined()
    })

    it('allows explicit port 443', async () => {
      await expect(refuseIfInternalIp('https://example.com:443')).resolves.toBeUndefined()
    })
  })

  // ── Private IPv4 ranges ──────────────────────────────────────────────────

  describe('private IPv4 ranges', () => {
    it.each([
      ['127.0.0.1', 'loopback'],
      ['127.0.0.2', 'loopback range'],
      ['10.0.0.1', '10.x class A'],
      ['10.255.255.255', '10.x max'],
      ['172.16.0.1', '172.16.x'],
      ['172.31.255.255', '172.31.x max'],
      ['192.168.0.1', '192.168.x'],
      ['192.168.255.255', '192.168.x max'],
      ['169.254.169.254', 'AWS metadata'],
      ['0.0.0.0', 'unspecified'],
    ])('refuses resolved IP %s (%s)', async (ip, _label) => {
      mockLookup.mockResolvedValue({ address: ip, family: 4 })
      try {
        await refuseIfInternalIp('https://example.com')
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
        expect((err as Error).message).toContain('private/internal')
      }
    })
  })

  // ── Private IPv6 ─────────────────────────────────────────────────────────

  describe('private IPv6 ranges', () => {
    it.each([
      ['::1', 'loopback'],
      ['fe80::1', 'link-local'],
      ['fc00::1', 'unique-local fc00'],
      ['fd12:3456::1', 'unique-local fd'],
    ])('refuses resolved IP %s (%s)', async (ip, _label) => {
      mockLookup.mockResolvedValue({ address: ip, family: 6 })
      try {
        await refuseIfInternalIp('https://example.com')
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
        expect((err as Error).message).toContain('private/internal')
      }
    })
  })

  // ── Internal hostnames ───────────────────────────────────────────────────

  describe('internal hostnames', () => {
    it('refuses localhost (resolves to 127.0.0.1)', async () => {
      mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 })
      try {
        await refuseIfInternalIp('https://localhost/admin')
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
      }
    })

    it('refuses localhost (resolves to ::1)', async () => {
      mockLookup.mockResolvedValue({ address: '::1', family: 6 })
      try {
        await refuseIfInternalIp('https://localhost/admin')
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
      }
    })
  })

  // ── DNS failure ──────────────────────────────────────────────────────────

  describe('DNS failure', () => {
    it('throws SSRF_BLOCKED on DNS lookup failure', async () => {
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'))
      try {
        await refuseIfInternalIp('https://nonexistent.invalid')
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
        expect((err as Error).message).toContain('DNS lookup failed')
      }
    })
  })

  // ── Invalid URL ──────────────────────────────────────────────────────────

  describe('invalid URLs', () => {
    it('throws SSRF_BLOCKED for malformed URL', async () => {
      try {
        await refuseIfInternalIp('not-a-url')
        expect.fail('should have thrown')
      } catch (err) {
        expectSsrfBlocked(err)
        expect((err as Error).message).toContain('Invalid URL')
      }
    })
  })

  // ── Valid public URLs ────────────────────────────────────────────────────

  describe('valid public URLs', () => {
    it('allows http with public IP', async () => {
      await expect(refuseIfInternalIp('http://example.com')).resolves.toBeUndefined()
      expect(mockLookup).toHaveBeenCalledWith('example.com')
    })

    it('allows https with public IP', async () => {
      await expect(refuseIfInternalIp('https://www.example.com/about')).resolves.toBeUndefined()
      expect(mockLookup).toHaveBeenCalledWith('www.example.com')
    })

    it('allows https with path and query', async () => {
      await expect(
        refuseIfInternalIp('https://example.com/services?lang=en')
      ).resolves.toBeUndefined()
    })
  })
})
