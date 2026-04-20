import { describe, it, expect } from 'vitest'
import { SOURCE_TYPES } from '@/lib/kotoiq/profileTypes'
import { FEATURE_TAGS, SOURCE_CONFIG, BUDGETS } from '@/lib/kotoiq/profileConfig'

const PHASE_8_SOURCE_TYPES = [
  'typeform_api', 'jotform_api', 'google_forms_api', 'form_scrape',
  'website_scrape',
  'gbp_authenticated', 'gbp_public',
  'pdf_text_extract', 'pdf_image_extract',
  'docx_text_extract', 'image_ocr_vision',
] as const

describe('Phase 8 — SOURCE_TYPES extension', () => {
  it('includes all 11 new Phase 8 values', () => {
    for (const st of PHASE_8_SOURCE_TYPES) {
      expect(SOURCE_TYPES).toContain(st)
    }
  })
})

describe('Phase 8 — SOURCE_CONFIG parity', () => {
  it('has exactly one entry per new SOURCE_TYPES value', () => {
    for (const st of PHASE_8_SOURCE_TYPES) {
      expect(SOURCE_CONFIG[st]).toBeDefined()
      expect(SOURCE_CONFIG[st].confidence_ceiling).toBeGreaterThan(0)
      expect(SOURCE_CONFIG[st].display_label).toBeTruthy()
    }
  })

  it('every SOURCE_CONFIG[x].feature_tag resolves to a key in FEATURE_TAGS', () => {
    for (const st of PHASE_8_SOURCE_TYPES) {
      const tag = SOURCE_CONFIG[st].feature_tag
      expect(tag in FEATURE_TAGS).toBe(true)
    }
  })

  it('confidence_ceiling values match CONTEXT decisions', () => {
    expect(SOURCE_CONFIG.typeform_api.confidence_ceiling).toBe(0.9)
    expect(SOURCE_CONFIG.jotform_api.confidence_ceiling).toBe(0.9)
    expect(SOURCE_CONFIG.google_forms_api.confidence_ceiling).toBe(0.9)
    expect(SOURCE_CONFIG.form_scrape.confidence_ceiling).toBe(0.7)
    expect(SOURCE_CONFIG.website_scrape.confidence_ceiling).toBe(0.6)
    expect(SOURCE_CONFIG.gbp_authenticated.confidence_ceiling).toBe(0.85)
    expect(SOURCE_CONFIG.gbp_public.confidence_ceiling).toBe(0.75)
    expect(SOURCE_CONFIG.pdf_text_extract.confidence_ceiling).toBe(0.75)
    expect(SOURCE_CONFIG.pdf_image_extract.confidence_ceiling).toBe(0.6)
    expect(SOURCE_CONFIG.docx_text_extract.confidence_ceiling).toBe(0.75)
    expect(SOURCE_CONFIG.image_ocr_vision.confidence_ceiling).toBe(0.6)
  })
})

describe('Phase 8 — BUDGETS', () => {
  it('exports correct budget constants', () => {
    expect(BUDGETS.PER_CLIENT_DAILY_USD).toBe(5)
    expect(BUDGETS.PER_AGENCY_DAILY_USD).toBe(50)
    expect(BUDGETS.WARN_THRESHOLD_RATIO).toBe(0.8)
  })
})
