import { describe, it, expect } from 'vitest'
import { SOURCE_TYPES, type SourceType, type ClientProfile } from '@/lib/kotoiq/profileTypes'

const PHASE_8_SOURCE_TYPES: SourceType[] = [
  'typeform_api', 'jotform_api', 'google_forms_api', 'form_scrape',
  'website_scrape',
  'gbp_authenticated', 'gbp_public',
  'pdf_text_extract', 'pdf_image_extract',
  'docx_text_extract', 'image_ocr_vision',
]

describe('Phase 8 — sourcesRegistry parity', () => {
  it('SOURCE_TYPES contains all 11 Phase 8 values', () => {
    for (const st of PHASE_8_SOURCE_TYPES) {
      expect(SOURCE_TYPES).toContain(st)
    }
  })

  it('a source row with source_type website_scrape type-checks against ClientProfile.sources shape', () => {
    const row: ClientProfile['sources'][number] = {
      source_type: 'website_scrape',
      source_url: 'https://x.com/about',
      added_at: new Date().toISOString(),
      added_by: 'operator-123',
      metadata: { pages_crawled: 5 },
    }
    expect(row.source_type).toBe('website_scrape')
    expect(row.source_url).toBe('https://x.com/about')
  })

  it('a source row with source_ref upload:{uuid}#page=3 type-checks', () => {
    const row: ClientProfile['sources'][number] = {
      source_type: 'pdf_text_extract',
      source_ref: 'upload:550e8400-e29b-41d4-a716-446655440000#page=3',
      added_at: new Date().toISOString(),
      added_by: 'operator-456',
    }
    expect(row.source_type).toBe('pdf_text_extract')
    expect(row.source_ref).toContain('page=3')
  })
})
