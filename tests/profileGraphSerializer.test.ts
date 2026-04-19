import { describe, it, expect } from 'vitest'
import {
  profileToEntityGraphSeed,
  profileToLegacyClientShape,
} from '../src/lib/kotoiq/profileGraphSerializer'
import { COMPLETE_PROFILE } from './fixtures/profiles'
import type { ClientProfile } from '../src/lib/kotoiq/profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — D-22 entity graph serializer + legacy-shape projector.
// Pure-function tests; no I/O, no Supabase, no Anthropic.
// ─────────────────────────────────────────────────────────────────────────────

function mkProfile(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    id: 'p1',
    agency_id: 'a1',
    client_id: 'c1',
    business_name: null,
    website: null,
    primary_service: null,
    target_customer: null,
    service_area: null,
    phone: null,
    founding_year: null,
    unique_selling_prop: null,
    industry: null,
    city: null,
    state: null,
    fields: {},
    entity_graph_seed: {},
    completeness_score: null,
    completeness_reasoning: null,
    soft_gaps: [],
    margin_notes: [],
    sources: [],
    last_seeded_at: null,
    last_edited_at: null,
    launched_at: null,
    last_pipeline_run_id: null,
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    ...overrides,
  } as ClientProfile
}

describe('profileToEntityGraphSeed', () => {
  it('produces all 8 D-22 keys from COMPLETE_PROFILE', () => {
    const p = mkProfile({ ...(COMPLETE_PROFILE as Partial<ClientProfile>) })
    const seed = profileToEntityGraphSeed(p)
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

  it('client_node.id matches profile.client_id', () => {
    const p = mkProfile({ client_id: 'client-xyz', business_name: 'Unified' })
    const seed = profileToEntityGraphSeed(p)
    expect(seed.client_node.id).toBe('client-xyz')
    expect(seed.client_node.label).toBe('Unified')
  })

  it('service_nodes contains primary_service', () => {
    const p = mkProfile({
      business_name: 'Unified',
      primary_service: 'Google Ads management',
    })
    const seed = profileToEntityGraphSeed(p)
    expect(seed.service_nodes.length).toBeGreaterThanOrEqual(1)
    expect(seed.service_nodes[0].label).toBe('Google Ads management')
  })

  it('confidence_by_node has entry for every node', () => {
    const p = mkProfile({
      business_name: 'Unified',
      primary_service: 'SEO',
    })
    const seed = profileToEntityGraphSeed(p)
    const allIds = [seed.client_node.id, ...seed.service_nodes.map((n) => n.id)]
    for (const id of allIds) {
      expect(seed.confidence_by_node).toHaveProperty(id)
    }
  })
})

describe('profileToLegacyClientShape', () => {
  it('exposes the 8 fields hyperlocalContentEngine.ts:147 expects', () => {
    const p = mkProfile({
      business_name: 'Unified',
      website: 'https://u.com',
      primary_service: 'SEO',
      industry: 'Marketing',
      target_customer: 'SMB',
      city: 'Boca Raton',
      state: 'FL',
    })
    const shape = profileToLegacyClientShape(p)
    expect(Object.keys(shape).sort()).toEqual([
      'city',
      'id',
      'industry',
      'name',
      'primary_service',
      'state',
      'target_customer',
      'website',
    ])
    expect(shape.name).toBe('Unified')
    expect(shape.website).toBe('https://u.com')
  })
})
