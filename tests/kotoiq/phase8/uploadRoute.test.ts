import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock apiAuth
const mockSession = {
  verified: true,
  agencyId: 'agency-1',
  userId: 'user-1',
  isSuperAdmin: false,
  role: 'owner',
  clientId: null,
}
vi.mock('@/lib/apiAuth', () => ({
  verifySession: vi.fn().mockResolvedValue({
    verified: true,
    agencyId: 'agency-1',
    userId: 'user-1',
    isSuperAdmin: false,
    role: 'owner',
    clientId: null,
  }),
}))

// Mock kotoiqDb
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'client-1' } })
vi.mock('@/lib/kotoiqDb', () => ({
  getKotoIQDb: () => ({
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        }),
      }),
    },
  }),
}))

// Mock uploadToStorage
const mockUploadToStorage = vi.fn().mockResolvedValue({
  path: 'kotoiq-uploads/agency-1/client-1/test-uuid.pdf',
  uploadId: 'test-uuid',
  bytes: 100,
})
vi.mock('@/lib/kotoiq/profileUploadStorage', () => ({
  uploadToStorage: (...args: any[]) => mockUploadToStorage(...args),
  buildUploadPath: vi.fn(),
  parseUploadPath: vi.fn(),
}))

// Mock detectFileType
vi.mock('@/lib/kotoiq/profileUploadDetect', () => ({
  detectFileType: (buf: Uint8Array) => {
    if (buf[0] === 0x25 && buf[1] === 0x50) {
      return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf', valid: true }
    }
    return { kind: 'unknown', mime: null, ext: null, valid: false, reason: 'unsupported_type' }
  },
}))

// Mock crypto
vi.mock('node:crypto', () => ({
  randomUUID: () => 'test-uuid',
}))

import { POST } from '@/app/api/kotoiq/profile/upload/route'
import { NextRequest } from 'next/server'

function makeFormDataRequest(opts: {
  fileBytes?: Uint8Array
  fileName?: string
  clientId?: string
  fileSize?: number
}): NextRequest {
  const formData = new FormData()
  if (opts.clientId) formData.set('client_id', opts.clientId)
  if (opts.fileBytes) {
    const blob = new Blob([opts.fileBytes as unknown as BlobPart], { type: 'application/octet-stream' })
    const file = new File([blob], opts.fileName ?? 'test.pdf')
    formData.set('file', file)
  }
  return new NextRequest('http://localhost/api/kotoiq/profile/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('Phase 8 — upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: { id: 'client-1' } })
  })

  it('returns 401 for unauthenticated session', async () => {
    const { verifySession } = await import('@/lib/apiAuth')
    ;(verifySession as any).mockResolvedValueOnce({ verified: false, agencyId: null, userId: null })

    const req = makeFormDataRequest({ fileBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), clientId: 'c1' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing client_id', async () => {
    const req = makeFormDataRequest({ fileBytes: new Uint8Array([0x25, 0x50]) })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('missing_client_id')
  })

  it('returns 400 for missing file', async () => {
    const formData = new FormData()
    formData.set('client_id', 'client-1')
    const req = new NextRequest('http://localhost/api/kotoiq/profile/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('missing_file')
  })

  it('returns 413 for files > 25MB', async () => {
    // Create a file that reports > 25MB via .size
    const bigBuf = new Uint8Array(26 * 1024 * 1024)
    bigBuf[0] = 0x25
    bigBuf[1] = 0x50
    const req = makeFormDataRequest({ fileBytes: bigBuf, clientId: 'client-1', fileName: 'big.pdf' })
    const res = await POST(req)
    expect(res.status).toBe(413)
    const data = await res.json()
    expect(data.error).toBe('file_too_large')
    expect(data.limit_mb).toBe(25)
  })

  it('returns 415 for unsupported file type', async () => {
    const htmlBuf = new TextEncoder().encode('<html><body>hello</body></html>')
    const req = makeFormDataRequest({ fileBytes: htmlBuf, clientId: 'client-1', fileName: 'page.html' })
    const res = await POST(req)
    expect(res.status).toBe(415)
    const data = await res.json()
    expect(data.error).toBe('unsupported_type')
  })

  it('returns 404 for cross-agency client', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null })
    const pdfBuf = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    const req = makeFormDataRequest({ fileBytes: pdfBuf, clientId: 'other-client', fileName: 'doc.pdf' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 200 with upload metadata for valid PDF', async () => {
    const pdfBuf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
    const req = makeFormDataRequest({ fileBytes: pdfBuf, clientId: 'client-1', fileName: 'brochure.pdf' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.upload_id).toBe('test-uuid')
    expect(data.kind).toBe('pdf')
    expect(data.mime).toBe('application/pdf')
    expect(data.ext).toBe('pdf')
    expect(data.file_name).toBe('brochure.pdf')
  })

  it('calls uploadToStorage with correct args', async () => {
    const pdfBuf = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    const req = makeFormDataRequest({ fileBytes: pdfBuf, clientId: 'client-1', fileName: 'test.pdf' })
    await POST(req)
    expect(mockUploadToStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        clientId: 'client-1',
        ext: 'pdf',
        contentType: 'application/pdf',
        uploadId: 'test-uuid',
      })
    )
  })
})
