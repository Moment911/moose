import { describe, it, expect } from 'vitest'
import {
  MODELS,
  HALO_THRESHOLDS,
  DISCREPANCY_TOLERANCE,
  STAGE_DEMANDS,
  FEATURE_TAGS,
  CONFIDENCE_RUBRIC,
  SEVERITY_RULES,
  CHANNEL_RULES,
  HOT_COLUMNS,
  MAX_VOICE_TRANSCRIPT_PULLS,
  MAX_PASTED_TEXT_CHARS,
  SEED_DEBOUNCE_SECONDS,
  SMS_RATE_LIMIT_PER_CLIENT_HOUR,
} from '../src/lib/kotoiq/profileConfig'

describe('profileConfig', () => {
  it('MODELS pins the canonical codebase IDs (Plan 1 SUMMARY)', () => {
    expect(MODELS.SONNET).toBe('claude-sonnet-4-5-20250929')
    expect(MODELS.HAIKU).toBe('claude-haiku-4-5-20251001')
    expect(MODELS.ANTHROPIC_VERSION).toBe('2023-06-01')
  })

  it('HALO_THRESHOLDS matches UI-SPEC §3', () => {
    expect(HALO_THRESHOLDS.CONFIDENT).toBe(0.85)
    expect(HALO_THRESHOLDS.GUESSED).toBe(0.5)
  })

  it('DISCREPANCY_TOLERANCE matches RESEARCH §6', () => {
    expect(DISCREPANCY_TOLERANCE.numeric).toBe(0.2)
    expect(DISCREPANCY_TOLERANCE.string_similarity).toBe(0.7)
    expect(DISCREPANCY_TOLERANCE.list_symmetric_diff).toBe(0.5)
  })

  it('STAGE_DEMANDS has the 5 documented stages', () => {
    expect(Object.keys(STAGE_DEMANDS).sort()).toEqual([
      'eeat',
      'entity_graph',
      'hyperlocal_content',
      'query_path',
      'strategy',
    ])
    // Spot check: hyperlocal_content has the 4 required fields per RESEARCH §7
    expect(STAGE_DEMANDS.hyperlocal_content.required).toEqual([
      'business_name',
      'primary_service',
      'service_area',
      'phone',
    ])
  })

  it('FEATURE_TAGS has distinct token-logging tags (Phase 7 baseline 9; Phase 8 appends 10 → 19)', () => {
    const values = Object.values(FEATURE_TAGS)
    expect(new Set(values).size).toBe(values.length)
    // Phase 7 shipped 9; Phase 8 (D-26) appends one tag per new source
    // family + COST_PREVIEW = 10 more. Phase 8 parity coverage lives in
    // tests/kotoiq/phase8/profileConfig.test.ts.
    expect(values.length).toBe(19)
    // Spot check: a few RESEARCH §4 tags are present
    expect(values).toContain('profile_seed_extract')
    expect(values).toContain('profile_completeness_gate')
  })

  it('CONFIDENCE_RUBRIC + SEVERITY_RULES + CHANNEL_RULES are non-empty strings', () => {
    expect(typeof CONFIDENCE_RUBRIC).toBe('string')
    expect(CONFIDENCE_RUBRIC).toContain('1.0')
    expect(CONFIDENCE_RUBRIC).toContain('verbatim')
    expect(SEVERITY_RULES).toContain('high')
    expect(CHANNEL_RULES).toContain('sms')
  })

  it('HOT_COLUMNS has exactly 11 entries matching the migration', () => {
    expect(HOT_COLUMNS).toHaveLength(11)
    expect(HOT_COLUMNS).toContain('business_name')
    expect(HOT_COLUMNS).toContain('state')
    expect(HOT_COLUMNS).toContain('founding_year')
  })

  it('hard caps and rate limits are enforced', () => {
    expect(MAX_VOICE_TRANSCRIPT_PULLS).toBe(10)
    expect(MAX_PASTED_TEXT_CHARS).toBe(50000)
    expect(SEED_DEBOUNCE_SECONDS).toBe(30)
    expect(SMS_RATE_LIMIT_PER_CLIENT_HOUR).toBe(3)
  })
})
