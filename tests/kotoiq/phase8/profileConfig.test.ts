import { describe, it, expect } from 'vitest'
import { SOURCE_TYPES } from '../../../src/lib/kotoiq/profileTypes'
import {
  FEATURE_TAGS,
  SOURCE_CONFIG,
  BUDGETS,
  RATE_LIMITS,
} from '../../../src/lib/kotoiq/profileConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Plan 1 — parity + value checks for the new source-type registry,
// feature tags, per-source config, daily budgets, and rate limits.
//
// Mirrors the Phase 7 parity test style (see tests/profileConfig.test.ts).
// Every assertion matches the Phase 8 plan's <behavior> block and the
// RESEARCH §9 verbatim code blocks.
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_8_SOURCE_TYPES = [
  'typeform_api',
  'jotform_api',
  'google_forms_api',
  'form_scrape',
  'website_scrape',
  'gbp_authenticated',
  'gbp_public',
  'pdf_text_extract',
  'pdf_image_extract',
  'docx_text_extract',
  'image_ocr_vision',
] as const

describe('phase 8 — profileConfig registry', () => {
  it('SOURCE_TYPES includes all 11 new Phase 8 values (D-26)', () => {
    for (const t of PHASE_8_SOURCE_TYPES) {
      expect(SOURCE_TYPES).toContain(t)
    }
  })

  it('SOURCE_TYPES keeps the 7 Phase 7 values (append-only invariant)', () => {
    // Append-only means Phase 7 order is intact and Phase 7 values still exist.
    const PHASE_7_SOURCE_TYPES = [
      'onboarding_form',
      'voice_call',
      'discovery_doc',
      'operator_edit',
      'claude_inference',
      'uploaded_doc',
      'deferred_v2',
    ]
    for (const t of PHASE_7_SOURCE_TYPES) {
      expect(SOURCE_TYPES).toContain(t)
    }
    // Phase 7 (7) + Phase 8 (11) = 18 total
    expect(SOURCE_TYPES).toHaveLength(18)
  })

  it('SOURCE_CONFIG has exactly one entry per new SOURCE_TYPES value (parity)', () => {
    for (const t of PHASE_8_SOURCE_TYPES) {
      expect(SOURCE_CONFIG[t]).toBeDefined()
      expect(typeof SOURCE_CONFIG[t].confidence_ceiling).toBe('number')
      expect(typeof SOURCE_CONFIG[t].default_cost_cap).toBe('number')
      expect(typeof SOURCE_CONFIG[t].feature_tag).toBe('string')
      expect(typeof SOURCE_CONFIG[t].display_label).toBe('string')
    }
    // No extra Phase 8-only keys in SOURCE_CONFIG beyond the 11 values.
    expect(Object.keys(SOURCE_CONFIG).sort()).toEqual(
      [...PHASE_8_SOURCE_TYPES].sort(),
    )
  })

  it('every SOURCE_CONFIG[x].feature_tag resolves to a key in FEATURE_TAGS', () => {
    for (const t of PHASE_8_SOURCE_TYPES) {
      const tag = SOURCE_CONFIG[t].feature_tag
      expect(tag in FEATURE_TAGS).toBe(true)
    }
  })

  it('confidence_ceiling values match CONTEXT D-04 / D-09 / D-12 / D-19', () => {
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

  it('BUDGETS exports the D-22 / D-23 defaults verbatim', () => {
    expect(BUDGETS.PER_CLIENT_DAILY_USD).toBe(5)
    expect(BUDGETS.PER_AGENCY_DAILY_USD).toBe(50)
    expect(BUDGETS.WARN_THRESHOLD_RATIO).toBe(0.8)
  })

  it('RATE_LIMITS exports the RESEARCH §Security Domain caps', () => {
    expect(RATE_LIMITS.SEED_FORM_URL_PER_AGENCY_PER_MIN).toBe(10)
    expect(RATE_LIMITS.CONNECT_GBP_OAUTH_START_PER_AGENCY_PER_HOUR).toBe(5)
  })

  it('FEATURE_TAGS preserves Phase 7 tags + adds Phase 8 tags', () => {
    // Phase 7 tags still present
    const PHASE_7_TAGS = [
      'NARRATE',
      'EXTRACT',
      'VOICE_EXTRACT',
      'DISCOVERY_EXTRACT',
      'DISCREPANCY_CHECK',
      'COMPLETENESS_GATE',
      'CLARIFY_SEVERITY',
      'CLARIFY_CHANNEL',
      'CONFIDENCE_RESCORE',
    ]
    for (const k of PHASE_7_TAGS) expect(k in FEATURE_TAGS).toBe(true)
    // Phase 8 tags added
    const PHASE_8_TAGS = [
      'FORM_EXTRACT',
      'WEBSITE_EXTRACT',
      'GBP_AUTH_EXTRACT',
      'GBP_PUBLIC_EXTRACT',
      'GBP_REVIEW_THEMES',
      'PDF_TEXT_EXTRACT',
      'PDF_VISION_EXTRACT',
      'DOCX_EXTRACT',
      'IMAGE_VISION_EXTRACT',
      'COST_PREVIEW',
    ]
    for (const k of PHASE_8_TAGS) expect(k in FEATURE_TAGS).toBe(true)
  })
})
