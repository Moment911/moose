import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock sharp
const mockJpeg = vi.fn().mockReturnValue({
  toBuffer: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
})
const mockSharp = vi.fn().mockReturnValue({ jpeg: mockJpeg })
vi.mock('sharp', () => ({ default: (...args: any[]) => mockSharp(...args) }))

// Mock tokenTracker
vi.mock('@/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn(),
}))

// Anthropic Vision mock response
const mockVisionResponse = {
  ok: true,
  status: 200,
  json: async () => ({
    content: [{
      type: 'tool_use',
      id: 'toolu_1',
      name: 'extract_profile_fields',
      input: {
        fields: [{
          field_name: 'phone',
          value: '555-0100',
          source_snippet: 'Call us: 555-0100',
          confidence: 0.8,
        }],
      },
    }],
    usage: { input_tokens: 800, output_tokens: 300 },
  }),
}

process.env.ANTHROPIC_API_KEY = 'test-key'

import { extractFromImage } from '@/lib/kotoiq/profileUploadImage'

describe('Phase 8 — profileUploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue(mockVisionResponse) as any
  })

  it('sends JPEG directly without conversion', async () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02])
    const result = await extractFromImage({
      buffer: buf,
      mime: 'image/jpeg',
      agencyId: 'a',
      clientId: 'c',
      uploadId: 'u',
      storagePath: 'kotoiq-uploads/a/c/u.jpg',
    })

    // sharp should NOT be called for JPEG
    expect(mockSharp).not.toHaveBeenCalled()

    // Verify image block in request
    const callArgs = (globalThis.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    const imgBlock = body.messages[0].content.find((c: any) => c.type === 'image')
    expect(imgBlock.source.media_type).toBe('image/jpeg')

    expect(result.length).toBe(1)
    expect(result[0].record.source_type).toBe('image_ocr_vision')
    expect(result[0].record.source_ref).toBe('upload:u#region=full')
  })

  it('converts HEIC to JPEG via sharp before sending', async () => {
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    const result = await extractFromImage({
      buffer: buf,
      mime: 'image/heic',
      agencyId: 'a',
      clientId: 'c',
      uploadId: 'u',
      storagePath: 'kotoiq-uploads/a/c/u.heic',
    })

    expect(mockSharp).toHaveBeenCalled()
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 90 })

    // Verify media_type is image/jpeg (converted)
    const callArgs = (globalThis.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    const imgBlock = body.messages[0].content.find((c: any) => c.type === 'image')
    expect(imgBlock.source.media_type).toBe('image/jpeg')

    expect(result[0].record.source_type).toBe('image_ocr_vision')
  })

  it('sends PNG with correct media_type', async () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    await extractFromImage({
      buffer: buf,
      mime: 'image/png',
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.png',
    })

    const callArgs = (globalThis.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    const imgBlock = body.messages[0].content.find((c: any) => c.type === 'image')
    expect(imgBlock.source.media_type).toBe('image/png')
  })

  it('sends WebP with correct media_type', async () => {
    const buf = new Uint8Array([0x52, 0x49, 0x46, 0x46])
    await extractFromImage({
      buffer: buf,
      mime: 'image/webp',
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.webp',
    })

    const callArgs = (globalThis.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    const imgBlock = body.messages[0].content.find((c: any) => c.type === 'image')
    expect(imgBlock.source.media_type).toBe('image/webp')
  })

  it('caps confidence at 0.6 ceiling', async () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff])
    const result = await extractFromImage({
      buffer: buf,
      mime: 'image/jpeg',
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.jpg',
    })
    // Mock returns 0.8 confidence, should be capped to 0.6
    expect(result[0].record.confidence).toBe(0.6)
  })

  it('throws IMAGE_TOO_LARGE_AFTER_ENCODING for oversized base64', async () => {
    // Create a buffer that will produce > 5MB base64
    const bigBuf = new Uint8Array(4 * 1024 * 1024) // ~5.3 MB base64
    await expect(
      extractFromImage({
        buffer: bigBuf,
        mime: 'image/jpeg',
        agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.jpg',
      })
    ).rejects.toThrow('IMAGE_TOO_LARGE_AFTER_ENCODING')
  })

  it('includes source_ref with #region=full', async () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff])
    const result = await extractFromImage({
      buffer: buf,
      mime: 'image/jpeg',
      agencyId: 'a', clientId: 'c', uploadId: 'my-upload', storagePath: 'kotoiq-uploads/a/c/my-upload.jpg',
    })
    expect(result[0].record.source_ref).toBe('upload:my-upload#region=full')
  })
})
