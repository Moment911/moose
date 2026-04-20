import { describe, it, expect } from 'vitest'
import { estimateCost } from '../../../src/lib/kotoiq/profileCostEstimate'
import { SOURCE_CONFIG } from '../../../src/lib/kotoiq/profileConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Plan 2 Task 1 — rule-based cost estimator (D-24).
//
// Covers every behavior assertion in the plan for estimateCost():
//   - website_scrape scope A returns [0.50, 1.50]
//   - scope monotonicity: A < C < B (per D-05: mode B costs 3-5x mode A)
//   - typeform_api returns exactly the SOURCE_CONFIG default_cost_cap
//   - pdf_text_extract returns ~0.05 (no vision call)
//   - pdf_image_extract scales with page count (~$0.10/page vision)
//   - image_ocr_vision returns ~0.50
//   - Unknown source_type throws a TypeError with a helpful message
//
// Pure-function module: no mocks, no I/O. Imports SOURCE_CONFIG so changes
// to default_cost_cap propagate automatically to these assertions.
// ─────────────────────────────────────────────────────────────────────────────

describe('phase 8 — estimateCost (rule-based, D-24)', () => {
  it('website_scrape scope A returns a number in [0.50, 1.50]', () => {
    const cost = estimateCost({
      source_type: 'website_scrape',
      params: { scope: 'A', useJs: true },
    })
    expect(typeof cost).toBe('number')
    expect(cost).toBeGreaterThanOrEqual(0.5)
    expect(cost).toBeLessThanOrEqual(1.5)
  })

  it('website_scrape scope monotonicity: A < C < B (D-05 — mode B is 3-5x A)', () => {
    const a = estimateCost({ source_type: 'website_scrape', params: { scope: 'A' } })
    const b = estimateCost({ source_type: 'website_scrape', params: { scope: 'B' } })
    const c = estimateCost({ source_type: 'website_scrape', params: { scope: 'C' } })

    expect(a).toBeGreaterThan(0)
    expect(c).toBeGreaterThan(a)
    expect(b).toBeGreaterThan(c)
    // D-05: B costs 3-5x A
    expect(b / a).toBeGreaterThanOrEqual(2.5)
    expect(b / a).toBeLessThanOrEqual(6.0)
  })

  it('typeform_api returns exactly the SOURCE_CONFIG default_cost_cap (0.05)', () => {
    const cost = estimateCost({ source_type: 'typeform_api' })
    expect(cost).toBe(0.05)
    // Parity with registry: changing default_cost_cap in SOURCE_CONFIG
    // flows through without touching this test.
    expect(cost).toBe(SOURCE_CONFIG.typeform_api.default_cost_cap)
  })

  it('pdf_text_extract returns ~0.05 (pdf-parse + Sonnet text extraction — no vision call)', () => {
    const cost = estimateCost({ source_type: 'pdf_text_extract', params: { pageCount: 10, visionMode: false } })
    expect(cost).toBeCloseTo(0.05, 2)
  })

  it('pdf_image_extract scales with page count (~$0.10/page vision)', () => {
    const cost10 = estimateCost({
      source_type: 'pdf_image_extract',
      params: { pageCount: 10, visionMode: true },
    })
    const cost20 = estimateCost({
      source_type: 'pdf_image_extract',
      params: { pageCount: 20, visionMode: true },
    })
    expect(cost10).toBeCloseTo(1.0, 1) // 10 pages × $0.10
    expect(cost20).toBeCloseTo(2.0, 1) // 20 pages × $0.10
    // Strictly scales with page count
    expect(cost20).toBeGreaterThan(cost10)
    expect(cost20 / cost10).toBeCloseTo(2, 1)
  })

  it('image_ocr_vision returns ~0.50 (single vision call)', () => {
    const cost = estimateCost({ source_type: 'image_ocr_vision', params: { sizeBytes: 1_000_000 } })
    expect(cost).toBeCloseTo(0.5, 2)
  })

  it('gbp_authenticated + gbp_public return flat per-mode values', () => {
    expect(estimateCost({ source_type: 'gbp_authenticated', params: { mode: 'authenticated' } })).toBe(0.30)
    expect(estimateCost({ source_type: 'gbp_public', params: { mode: 'public' } })).toBe(0.10)
  })

  it('form_scrape returns the SOURCE_CONFIG default_cost_cap (0.15 — scrape + Sonnet)', () => {
    const cost = estimateCost({ source_type: 'form_scrape', params: { via: 'scrape' } })
    expect(cost).toBe(SOURCE_CONFIG.form_scrape.default_cost_cap)
    expect(cost).toBe(0.15)
  })

  it('docx_text_extract returns the SOURCE_CONFIG default_cost_cap (0.05)', () => {
    const cost = estimateCost({ source_type: 'docx_text_extract' })
    expect(cost).toBe(0.05)
  })

  it('Unknown source_type throws a TypeError with a helpful message', () => {
    expect(() =>
      estimateCost({
        // @ts-expect-error — intentionally passing an invalid value
        source_type: 'mystery_source',
      }),
    ).toThrow(TypeError)

    try {
      estimateCost({
        // @ts-expect-error — intentionally passing an invalid value
        source_type: 'mystery_source',
      })
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain('Unknown source_type')
      expect(msg).toContain('mystery_source')
      expect(msg).toContain('known:')
    }
  })

  it('returns a non-negative USD amount for every SOURCE_CONFIG key', () => {
    for (const st of Object.keys(SOURCE_CONFIG) as Array<keyof typeof SOURCE_CONFIG>) {
      const cost = estimateCost({ source_type: st as any })
      expect(cost).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(cost)).toBe(true)
    }
  })
})
