// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Golden-file profile fixtures used by Plans 2-5 unit suites.
//
// Three shapes:
//   COMPLETE_PROFILE     — every hot column populated, single source per field
//   PARTIAL_PROFILE      — only business_name + phone known (worst-case
//                          launch-gate scenario at < 30% completeness)
//   DISCREPANCY_PROFILE  — three conflicting ProvenanceRecord entries on
//                          founding_year — exercises D-11 discrepancy catcher
//
// Fixtures intentionally use Partial<ClientProfile> so each plan can extend
// or override fields without touching the others.
// ─────────────────────────────────────────────────────────────────────────────

import type { ClientProfile, ProvenanceRecord } from '../../src/lib/kotoiq/profileTypes'

const pr = (overrides: Partial<ProvenanceRecord>): ProvenanceRecord => ({
  value: overrides.value ?? 'unset',
  source_type: overrides.source_type ?? 'onboarding_form',
  captured_at: '2026-04-17T00:00:00Z',
  confidence: overrides.confidence ?? 0.9,
  ...overrides,
})

export const COMPLETE_PROFILE: Partial<ClientProfile> = {
  business_name: 'Unified Marketing',
  website: 'https://unifiedmktg.com',
  primary_service: 'Google Ads management for local service businesses',
  target_customer: 'small businesses in South Florida',
  service_area: 'South Florida',
  phone: '+15615551234',
  founding_year: 2019,
  unique_selling_prop: 'Same-day response and fixed-price retainers',
  industry: 'Marketing Agency',
  city: 'Boca Raton',
  state: 'FL',
  fields: {
    business_name: [pr({ value: 'Unified Marketing', confidence: 1.0 })],
    website: [pr({ value: 'https://unifiedmktg.com', confidence: 1.0 })],
    primary_service: [
      pr({
        value: 'Google Ads management for local service businesses',
        confidence: 0.95,
      }),
    ],
    target_customer: [
      pr({ value: 'small businesses in South Florida', confidence: 0.9 }),
    ],
    service_area: [pr({ value: 'South Florida', confidence: 0.9 })],
    phone: [pr({ value: '+15615551234', confidence: 1.0 })],
    founding_year: [pr({ value: 2019, confidence: 0.9 })],
    unique_selling_prop: [
      pr({
        value: 'Same-day response and fixed-price retainers',
        source_type: 'voice_call',
        source_ref: 'retell_call:complete-fixture-1',
        confidence: 0.85,
      }),
    ],
    industry: [pr({ value: 'Marketing Agency', confidence: 0.9 })],
    city: [pr({ value: 'Boca Raton', confidence: 0.95 })],
    state: [pr({ value: 'FL', confidence: 1.0 })],
  },
}

export const PARTIAL_PROFILE: Partial<ClientProfile> = {
  business_name: 'RDC Contracting',
  website: null,
  primary_service: null,
  target_customer: null,
  service_area: null,
  phone: '+15615559999',
  founding_year: null,
  unique_selling_prop: null,
  industry: null,
  city: null,
  state: null,
  fields: {
    business_name: [pr({ value: 'RDC Contracting', confidence: 1.0 })],
    phone: [
      pr({
        value: '+15615559999',
        source_type: 'onboarding_form',
        confidence: 0.9,
      }),
    ],
  },
}

// Three sources disagree on the founding year — onboarding_form (2019),
// voice_call paraphrase suggesting 2020, claude_inference from website
// copy suggesting 2011.  D-11 discrepancy catcher should surface this as
// a pink dot + callout listing all three values.
export const DISCREPANCY_PROFILE: Partial<ClientProfile> = {
  business_name: 'Pangea Plumbing',
  founding_year: 2019,
  fields: {
    business_name: [pr({ value: 'Pangea Plumbing', confidence: 1.0 })],
    founding_year: [
      pr({
        value: 2019,
        source_type: 'onboarding_form',
        confidence: 0.9,
        source_url: 'https://hellokoto.com/clients/xyz',
      }),
      pr({
        value: 2020,
        source_type: 'voice_call',
        confidence: 0.85,
        source_ref: 'retell_call:abc',
        source_snippet: "We've been serving South Florida for about six years.",
      }),
      pr({
        value: 2011,
        source_type: 'claude_inference',
        confidence: 0.6,
        source_snippet: 'Website says 15 years in business',
      }),
    ],
  },
}
