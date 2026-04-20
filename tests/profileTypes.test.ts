import { describe, it, expect } from 'vitest'
import {
  SOURCE_TYPES,
  CANONICAL_FIELD_NAMES,
  type ProvenanceRecord,
  type EntityGraphSeed,
} from '../src/lib/kotoiq/profileTypes'

describe('profileTypes', () => {
  it('SOURCE_TYPES includes every Phase 7 value (7) + Phase 8 appends (11) = 18', () => {
    // Phase 7 kept seven source types; Phase 8 (D-26) appends 11 more.
    // Phase 8 parity test at tests/kotoiq/phase8/profileConfig.test.ts
    // covers the new values; here we guard the Phase 7 invariants.
    expect(SOURCE_TYPES).toHaveLength(18)
    expect(SOURCE_TYPES).toContain('onboarding_form')
    expect(SOURCE_TYPES).toContain('voice_call')
    expect(SOURCE_TYPES).toContain('deferred_v2')
  })

  it('CANONICAL_FIELD_NAMES includes every hot column', () => {
    const HOT = [
      'business_name',
      'website',
      'primary_service',
      'target_customer',
      'service_area',
      'phone',
      'founding_year',
      'unique_selling_prop',
      'industry',
      'city',
      'state',
    ]
    for (const hc of HOT) expect(CANONICAL_FIELD_NAMES).toContain(hc)
  })

  it('ProvenanceRecord accepts the 9 documented fields', () => {
    const rec: ProvenanceRecord = {
      value: 'Google Ads management',
      source_type: 'onboarding_form',
      source_url: 'https://hellokoto.com/clients/abc',
      source_snippet: 'We do Google Ads for local service businesses.',
      char_offset_start: 0,
      char_offset_end: 50,
      captured_at: '2026-04-17T00:00:00Z',
      confidence: 0.95,
    }
    expect(rec.confidence).toBe(0.95)
  })

  it('EntityGraphSeed has exactly 8 D-22 keys', () => {
    const seed: EntityGraphSeed = {
      client_node: { id: 'c1', label: 'Unified', confidence: 1.0, source_refs: [] },
      service_nodes: [],
      audience_nodes: [],
      competitor_nodes: [],
      service_area_nodes: [],
      differentiator_edges: [],
      trust_anchor_nodes: [],
      confidence_by_node: {},
    }
    expect(Object.keys(seed).sort()).toEqual([
      'audience_nodes',
      'client_node',
      'competitor_nodes',
      'confidence_by_node',
      'differentiator_edges',
      'service_area_nodes',
      'service_nodes',
      'trust_anchor_nodes',
    ])
  })
})
