import { describe, it, expect } from 'vitest'
import { detectDiscrepancies } from '../src/lib/kotoiq/profileDiscrepancy'
import { DISCREPANCY_PROFILE } from './fixtures/profiles'

describe('detectDiscrepancies', () => {
  it('flags founding_year with 3 conflicting sources', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reports = detectDiscrepancies(DISCREPANCY_PROFILE.fields as any)
    expect(reports.length).toBeGreaterThanOrEqual(1)
    const fy = reports.find((r) => r.field === 'founding_year')
    expect(fy).toBeTruthy()
    expect(fy!.kind).toBe('numeric')
    expect(fy!.records).toHaveLength(3)
  })

  it('returns empty when a single field has only agreeing sources', () => {
    const reports = detectDiscrepancies({
      business_name: [
        {
          value: 'Unified',
          source_type: 'onboarding_form',
          captured_at: '2026-01-01',
          confidence: 1.0,
        },
        {
          value: 'Unified',
          source_type: 'voice_call',
          captured_at: '2026-02-01',
          confidence: 0.9,
        },
      ],
    })
    expect(reports).toEqual([])
  })

  it('flags industry enum mismatch', () => {
    const reports = detectDiscrepancies({
      industry: [
        {
          value: 'Marketing Agency',
          source_type: 'onboarding_form',
          captured_at: '2026-01-01',
          confidence: 0.9,
        },
        {
          value: 'Advertising',
          source_type: 'claude_inference',
          captured_at: '2026-02-01',
          confidence: 0.7,
        },
      ],
    })
    expect(
      reports.some((r) => r.field === 'industry' && r.kind === 'enum'),
    ).toBe(true)
  })

  it('does not flag founding_year within numeric tolerance', () => {
    const reports = detectDiscrepancies({
      founding_year: [
        {
          value: 2019,
          source_type: 'onboarding_form',
          captured_at: '2026-01-01',
          confidence: 0.9,
        },
        {
          value: 2020,
          source_type: 'voice_call',
          captured_at: '2026-02-01',
          confidence: 0.85,
        },
      ],
    })
    // 2020-2019=1; max=2020; tolerance 0.2 * 2020 = 404 — diff 1 well within
    expect(reports.find((r) => r.field === 'founding_year')).toBeUndefined()
  })

  it('flags list field with > 50% symmetric diff', () => {
    const reports = detectDiscrepancies({
      competitors: [
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: ['Acme', 'Beta'] as any,
          source_type: 'onboarding_form',
          captured_at: '2026-01-01',
          confidence: 0.9,
        },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: ['Gamma', 'Delta'] as any,
          source_type: 'voice_call',
          captured_at: '2026-02-01',
          confidence: 0.7,
        },
      ],
    })
    expect(
      reports.some((r) => r.field === 'competitors' && r.kind === 'list'),
    ).toBe(true)
  })
})
