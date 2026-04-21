import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock Supabase client
const mockUpload = vi.fn().mockResolvedValue({ error: null })
const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example.com/file' }, error: null })
const mockRemove = vi.fn().mockResolvedValue({ error: null })
const mockDownload = vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]), error: null })

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
        remove: mockRemove,
        download: mockDownload,
      }),
    },
  }),
}))

// Set env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

import {
  buildUploadPath,
  parseUploadPath,
  uploadToStorage,
  getSignedUrl,
  deleteUpload,
  downloadForProcessing,
} from '@/lib/kotoiq/profileUploadStorage'

describe('Phase 8 — profileUploadStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildUploadPath', () => {
    it('constructs correct path', () => {
      const path = buildUploadPath('agency-1', 'client-2', 'upload-3', 'pdf')
      expect(path).toBe('kotoiq-uploads/agency-1/client-2/upload-3.pdf')
    })
  })

  describe('parseUploadPath', () => {
    it('parses valid path', () => {
      const parsed = parseUploadPath('kotoiq-uploads/agency-1/client-2/upload-3.pdf')
      expect(parsed).toEqual({
        agencyId: 'agency-1',
        clientId: 'client-2',
        uploadId: 'upload-3',
        ext: 'pdf',
      })
    })

    it('returns null for invalid path', () => {
      expect(parseUploadPath('wrong/path')).toBeNull()
      expect(parseUploadPath('kotoiq-uploads/only-two-parts')).toBeNull()
    })

    it('returns null for wrong prefix', () => {
      expect(parseUploadPath('other-prefix/agency/client/file.pdf')).toBeNull()
    })
  })

  describe('uploadToStorage', () => {
    it('uploads with correct path and returns metadata', async () => {
      const buf = new Uint8Array([1, 2, 3, 4])
      const result = await uploadToStorage({
        agencyId: 'agency-1',
        clientId: 'client-2',
        buffer: buf,
        ext: 'pdf',
        contentType: 'application/pdf',
        uploadId: 'upload-id-1',
      })
      expect(result.path).toBe('kotoiq-uploads/agency-1/client-2/upload-id-1.pdf')
      expect(result.uploadId).toBe('upload-id-1')
      expect(result.bytes).toBe(4)
      expect(mockUpload).toHaveBeenCalledWith(
        'kotoiq-uploads/agency-1/client-2/upload-id-1.pdf',
        buf,
        { contentType: 'application/pdf', upsert: false }
      )
    })

    it('generates UUID if uploadId not provided', async () => {
      const buf = new Uint8Array([1, 2])
      const result = await uploadToStorage({
        agencyId: 'a',
        clientId: 'c',
        buffer: buf,
        ext: 'png',
        contentType: 'image/png',
      })
      expect(result.uploadId).toBeTruthy()
      expect(result.path).toContain('kotoiq-uploads/a/c/')
    })
  })

  describe('getSignedUrl', () => {
    it('returns signed URL for own agency path', async () => {
      const url = await getSignedUrl({
        path: 'kotoiq-uploads/agency-1/client-2/upload-3.pdf',
        agencyId: 'agency-1',
      })
      expect(url).toBe('https://signed.example.com/file')
    })

    it('throws STORAGE_AGENCY_MISMATCH for cross-agency path', async () => {
      await expect(
        getSignedUrl({
          path: 'kotoiq-uploads/other-agency/client-2/upload-3.pdf',
          agencyId: 'agency-1',
        })
      ).rejects.toThrow('STORAGE_AGENCY_MISMATCH')
    })

    it('throws STORAGE_BAD_PATH for invalid path', async () => {
      await expect(
        getSignedUrl({ path: 'invalid/path', agencyId: 'agency-1' })
      ).rejects.toThrow('STORAGE_BAD_PATH')
    })

    it('caps TTL at 3600', async () => {
      await getSignedUrl({
        path: 'kotoiq-uploads/agency-1/client-2/upload-3.pdf',
        agencyId: 'agency-1',
        ttlSec: 9999,
      })
      // Should have called with 3600 (capped)
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'kotoiq-uploads/agency-1/client-2/upload-3.pdf',
        3600
      )
    })
  })

  describe('deleteUpload', () => {
    it('deletes for own agency', async () => {
      await deleteUpload({
        path: 'kotoiq-uploads/agency-1/client-2/upload-3.pdf',
        agencyId: 'agency-1',
      })
      expect(mockRemove).toHaveBeenCalledWith(['kotoiq-uploads/agency-1/client-2/upload-3.pdf'])
    })

    it('throws STORAGE_AGENCY_MISMATCH for cross-agency delete', async () => {
      await expect(
        deleteUpload({
          path: 'kotoiq-uploads/other-agency/client-2/upload-3.pdf',
          agencyId: 'agency-1',
        })
      ).rejects.toThrow('STORAGE_AGENCY_MISMATCH')
    })
  })

  describe('downloadForProcessing', () => {
    it('downloads for own agency', async () => {
      const result = await downloadForProcessing({
        path: 'kotoiq-uploads/agency-1/client-2/upload-3.pdf',
        agencyId: 'agency-1',
      })
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('throws STORAGE_AGENCY_MISMATCH for cross-agency download', async () => {
      await expect(
        downloadForProcessing({
          path: 'kotoiq-uploads/other-agency/client-2/upload-3.pdf',
          agencyId: 'agency-1',
        })
      ).rejects.toThrow('STORAGE_AGENCY_MISMATCH')
    })
  })
})
