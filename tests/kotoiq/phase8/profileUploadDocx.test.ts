import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock mammoth
const mockConvertToHtml = vi.fn()
vi.mock('mammoth', () => ({
  convertToHtml: (...args: any[]) => mockConvertToHtml(...args),
}))

// Mock extractFromPastedText
const mockExtractFromPastedText = vi.fn()
vi.mock('@/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: (...args: any[]) => mockExtractFromPastedText(...args),
}))

// Mock tokenTracker
vi.mock('@/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn(),
}))

process.env.ANTHROPIC_API_KEY = 'test-key'

import { extractFromDocx } from '@/lib/kotoiq/profileUploadDocx'

describe('Phase 8 — profileUploadDocx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractFromPastedText.mockResolvedValue([
      {
        field_name: 'primary_service',
        record: {
          value: 'Web Design',
          source_type: 'claude_inference',
          captured_at: '2026-04-20T00:00:00.000Z',
          confidence: 0.85,
        },
      },
    ])
  })

  it('splits by h1/h2 headings and extracts per section', async () => {
    mockConvertToHtml.mockResolvedValue({
      value: '<h1>Company Overview</h1><p>We do web design for local businesses.</p><h1>Services</h1><p>SEO, PPC, Social Media</p>',
      messages: [],
    })

    const result = await extractFromDocx({
      buffer: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      agencyId: 'agency-1',
      clientId: 'client-1',
      uploadId: 'upload-1',
      storagePath: 'kotoiq-uploads/agency-1/client-1/upload-1.docx',
    })

    // extractFromPastedText called twice (one per section)
    expect(mockExtractFromPastedText).toHaveBeenCalledTimes(2)
    expect(result.length).toBe(2)
    expect(result[0].record.source_type).toBe('docx_text_extract')
    expect(result[0].record.source_ref).toContain('upload:upload-1#section=Company%20Overview')
    expect(result[1].record.source_ref).toContain('upload:upload-1#section=Services')
  })

  it('caps confidence at 0.75 ceiling', async () => {
    mockConvertToHtml.mockResolvedValue({
      value: '<h1>Info</h1><p>Some content here</p>',
      messages: [],
    })
    mockExtractFromPastedText.mockResolvedValue([{
      field_name: 'business_name',
      record: { value: 'Test', source_type: 'claude_inference', captured_at: 'now', confidence: 0.95 },
    }])

    const result = await extractFromDocx({
      buffer: new Uint8Array([0x50, 0x4b]),
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.docx',
    })
    expect(result[0].record.confidence).toBe(0.75)
  })

  it('returns empty array for empty DOCX', async () => {
    mockConvertToHtml.mockResolvedValue({ value: '', messages: [] })

    const result = await extractFromDocx({
      buffer: new Uint8Array([]),
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.docx',
    })
    expect(result).toEqual([])
  })

  it('returns empty array for DOCX with very short HTML', async () => {
    mockConvertToHtml.mockResolvedValue({ value: '<p>hi</p>', messages: [] })

    const result = await extractFromDocx({
      buffer: new Uint8Array([]),
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.docx',
    })
    expect(result).toEqual([])
  })

  it('handles DOCX without headings as single (untitled) section', async () => {
    mockConvertToHtml.mockResolvedValue({
      value: '<p>We are Acme Corp, providing excellent services in HVAC and plumbing for the greater metro area since 2015.</p>',
      messages: [],
    })

    const result = await extractFromDocx({
      buffer: new Uint8Array([0x50, 0x4b]),
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.docx',
    })
    expect(mockExtractFromPastedText).toHaveBeenCalledTimes(1)
    expect(result[0].record.source_ref).toContain('#section=(untitled)')
  })

  it('uses source_type docx_text_extract', async () => {
    mockConvertToHtml.mockResolvedValue({
      value: '<h2>About</h2><p>Some text here about the company</p>',
      messages: [],
    })

    const result = await extractFromDocx({
      buffer: new Uint8Array([]),
      agencyId: 'a', clientId: 'c', uploadId: 'u', storagePath: 'kotoiq-uploads/a/c/u.docx',
    })
    expect(result[0].record.source_type).toBe('docx_text_extract')
  })
})
