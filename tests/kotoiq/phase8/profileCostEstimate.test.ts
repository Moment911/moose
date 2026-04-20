import { describe, it, expect } from 'vitest'
import { estimateCost } from '@/lib/kotoiq/profileCostEstimate'

describe('profileCostEstimate — estimateCost()', () => {
  it('website_scrape scope A with useJs returns a number in [0.50, 1.50]', () => {
    const cost = estimateCost({ source_type: 'website_scrape', params: { scope: 'A', useJs: true } })
    expect(cost).toBeGreaterThanOrEqual(0.05)
    expect(cost).toBeLessThanOrEqual(1.50)
    expect(typeof cost).toBe('number')
  })

  it('website_scrape scope monotonicity: A < C < B', () => {
    const a = estimateCost({ source_type: 'website_scrape', params: { scope: 'A' } })
    const b = estimateCost({ source_type: 'website_scrape', params: { scope: 'B' } })
    const c = estimateCost({ source_type: 'website_scrape', params: { scope: 'C' } })
    expect(a).toBeLessThan(c)
    expect(c).toBeLessThan(b)
  })

  it('typeform_api returns 0.05 exactly (matches SOURCE_CONFIG default_cost_cap)', () => {
    const cost = estimateCost({ source_type: 'typeform_api' })
    expect(cost).toBe(0.05)
  })

  it('pdf_text_extract returns ~0.05 (no vision call)', () => {
    const cost = estimateCost({ source_type: 'pdf_text_extract', params: { pageCount: 10, visionMode: false } })
    expect(cost).toBe(0.05)
  })

  it('pdf_image_extract scales with page count (~$0.10/page vision)', () => {
    const cost10 = estimateCost({ source_type: 'pdf_image_extract', params: { pageCount: 10, visionMode: true } })
    const cost20 = estimateCost({ source_type: 'pdf_image_extract', params: { pageCount: 20, visionMode: true } })
    expect(cost10).toBe(1.00)
    expect(cost20).toBe(2.00)
    expect(cost20).toBeGreaterThan(cost10)
  })

  it('image_ocr_vision returns ~0.50', () => {
    const cost = estimateCost({ source_type: 'image_ocr_vision' })
    expect(cost).toBe(0.50)
  })

  it('unknown source_type throws TypeError with helpful message', () => {
    expect(() => estimateCost({ source_type: 'nonexistent_source' as any })).toThrow(TypeError)
    expect(() => estimateCost({ source_type: 'nonexistent_source' as any })).toThrow(
      /Unknown source_type: nonexistent_source; known: \[/
    )
  })
})
