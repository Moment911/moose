import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock pdf-parse
const mockPdfParse = vi.fn()
vi.mock('pdf-parse', () => ({ default: (...args: any[]) => mockPdfParse(...args) }))

// Mock extractFromPastedText
const mockExtractFromPastedText = vi.fn().mockResolvedValue([
  {
    field_name: 'business_name',
    record: {
      value: 'Acme Corp',
      source_type: 'claude_inference',
      captured_at: '2026-04-20T00:00:00.000Z',
      confidence: 0.9,
    },
  },
])
vi.mock('@/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: (...args: any[]) => mockExtractFromPastedText(...args),
  EXTRACT_SYSTEM_PROMPT_FOR_EXPORT: 'test prompt',
}))

// Mock tokenTracker
vi.mock('@/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn(),
}))

// Mock fetch for vision path
const mockFetchResponse = {
  ok: true,
  status: 200,
  json: async () => ({
    content: [{
      type: 'tool_use',
      id: 'toolu_1',
      name: 'extract_profile_fields',
      input: {
        fields: [{
          field_name: 'business_name',
          value: 'Scanned Corp',
          source_snippet: 'Scanned Corp LLC',
          confidence: 0.7,
        }],
      },
    }],
    usage: { input_tokens: 500, output_tokens: 200 },
  }),
}

process.env.ANTHROPIC_API_KEY = 'test-key'

import { extractFromPdf } from '@/lib/kotoiq/profileUploadPdf'

describe('Phase 8 — profileUploadPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('text path (pdf-parse returns >= 100 chars)', () => {
    it('uses extractFromPastedText with source_type=pdf_text_extract', async () => {
      const longText = 'A'.repeat(200)
      mockPdfParse.mockResolvedValue({ text: longText, numpages: 3 })

      const result = await extractFromPdf({
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        agencyId: 'agency-1',
        clientId: 'client-1',
        uploadId: 'upload-1',
        storagePath: 'kotoiq-uploads/agency-1/client-1/upload-1.pdf',
      })

      expect(mockExtractFromPastedText).toHaveBeenCalledWith(
        expect.objectContaining({
          text: longText.slice(0, 20_000),
          agencyId: 'agency-1',
          clientId: 'client-1',
          sourceLabel: 'pdf_text_extract',
        })
      )
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].record.source_type).toBe('pdf_text_extract')
      expect(result[0].record.source_ref).toBe('upload:upload-1#page=1-3')
      expect(result[0].record.confidence).toBeLessThanOrEqual(0.75)
    })

    it('caps confidence at 0.75 ceiling', async () => {
      mockPdfParse.mockResolvedValue({ text: 'B'.repeat(200), numpages: 1 })
      mockExtractFromPastedText.mockResolvedValue([{
        field_name: 'website',
        record: { value: 'https://x.com', source_type: 'claude_inference', captured_at: 'now', confidence: 0.95 },
      }])

      const result = await extractFromPdf({
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.pdf',
      })
      expect(result[0].record.confidence).toBe(0.75)
    })
  })

  describe('vision path (pdf-parse returns < 100 chars)', () => {
    beforeEach(() => {
      mockPdfParse.mockResolvedValue({ text: 'short', numpages: 1 })
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse) as any
    })

    it('falls back to Anthropic Vision with document block', async () => {
      const result = await extractFromPdf({
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        agencyId: 'agency-1',
        clientId: 'client-1',
        uploadId: 'upload-1',
        storagePath: 'kotoiq-uploads/agency-1/client-1/upload-1.pdf',
      })

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' })
      )

      // Verify document block in request
      const callArgs = (globalThis.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      const docBlock = body.messages[0].content.find((c: any) => c.type === 'document')
      expect(docBlock).toBeDefined()
      expect(docBlock.source.media_type).toBe('application/pdf')

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].record.source_type).toBe('pdf_image_extract')
      expect(result[0].record.confidence).toBeLessThanOrEqual(0.6)
    })

    it('caps confidence at 0.6 ceiling for vision path', async () => {
      const result = await extractFromPdf({
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.pdf',
      })
      // The mock returns confidence 0.7 which should be capped at 0.6
      expect(result[0].record.confidence).toBe(0.6)
    })

    it('includes per-page citation in source_ref', async () => {
      mockPdfParse.mockResolvedValue({ text: '', numpages: 5 })
      const result = await extractFromPdf({
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.pdf',
      })
      expect(result[0].record.source_ref).toBe('upload:u#page=1-5')
    })
  })
})
