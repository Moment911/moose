import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// opportunityList.test — WS6 extensive opportunity list (Phase 12 / 12-05).
//
// The correctness anchor of WS6 is the PURE competitor-keyword extraction +
// merge/dedup. buildOpportunityList feeds those extra seed phrases through the
// existing analyzePageGaps / scoreServiceCityGrid (reused, NOT reimplemented) so
// there is ONE ranked, bucketed, provenance-preserving list — the same grid the
// client's own services produce, but EXTENSIVE and competitor-driven.
//
//   competitorKeywordsFromIntel(intel) — pure, IO-free:
//     extracts a deduped competitor keyword/phrase set from the WS5
//     competitor_intel payload (fields.competitor_intel from 12-04):
//       - dfs_compare intersection keywords (if present)
//       - organic SERP competitor titles, tokenized to short noun phrases
//       - AEO cited-URL slugs
//     returns string[] normalized + deduped.
//
//   mergeServicePhrases(services, competitorPhrases) — pure:
//     unions the client's own services with the competitor-derived phrases
//     without duplicating an existing service (case-insensitive dedup), and
//     reports how many were own vs competitor_derived so the UI can show the
//     list grew.
//
// All tests run on fixtures — no DB, no network (mirrors competitorIntel's pure
// reconciliation tests).
// ─────────────────────────────────────────────────────────────────────────────

import {
  competitorKeywordsFromIntel,
  mergeServicePhrases,
} from '../../src/lib/kotoiq/opportunityList'

describe('competitorKeywordsFromIntel', () => {
  it('extracts deduped competitor keywords from a full intel payload', () => {
    const intel = {
      competitors: [
        { name: 'Emergency Water Damage Restoration | Acme', domain: 'acme.com', organic: { rank: 2 } },
        { name: 'Acme Restoration', domain: 'acme.com', geo: { local_pack_rank: 1, cells_present: 9 } },
        { name: 'Mold Removal Phoenix - BestCo', domain: 'bestco.com', organic: { rank: 4 } },
      ],
      dfs_compare: {
        intersection_keywords: ['water damage repair', 'flood cleanup', 'Water Damage Repair'],
      },
      aeo_cited_urls: [
        'https://acme.com/services/basement-flood-cleanup',
        'https://bestco.com/mold-remediation-guide',
      ],
    }

    const kws = competitorKeywordsFromIntel(intel as any)

    // Returns a non-empty deduped list of normalized phrases.
    expect(Array.isArray(kws)).toBe(true)
    expect(kws.length).toBeGreaterThan(0)

    // dfs_compare intersection keywords survive (deduped, case-insensitive).
    expect(kws).toContain('water damage repair')
    expect(kws.filter(k => k === 'water damage repair')).toHaveLength(1)
    expect(kws).toContain('flood cleanup')

    // AEO cited-URL slugs are turned into phrases.
    expect(kws).toContain('basement flood cleanup')
    expect(kws).toContain('mold remediation guide')

    // No empties, all lowercase-normalized, fully deduped.
    expect(kws.every(k => k.length > 0 && k === k.toLowerCase())).toBe(true)
    expect(new Set(kws).size).toBe(kws.length)
  })

  it('is graceful on an empty / partial / missing intel payload', () => {
    expect(competitorKeywordsFromIntel(undefined as any)).toEqual([])
    expect(competitorKeywordsFromIntel(null as any)).toEqual([])
    expect(competitorKeywordsFromIntel({} as any)).toEqual([])
    expect(competitorKeywordsFromIntel({ competitors: [] } as any)).toEqual([])
    // Only one source present still works.
    expect(
      competitorKeywordsFromIntel({ dfs_compare: { intersection_keywords: ['ac repair'] } } as any),
    ).toContain('ac repair')
  })
})

describe('mergeServicePhrases', () => {
  it('grows the candidate set without duplicating existing services (dedup)', () => {
    const services = ['Water Damage Restoration', 'Mold Removal']
    const competitorPhrases = [
      'water damage restoration', // dup of an own service (case-insensitive) — must NOT add
      'flood cleanup',
      'basement flood cleanup',
      'flood cleanup', // internal dup — collapse
    ]

    const { merged, source_counts } = mergeServicePhrases(services, competitorPhrases)

    // Own services always preserved.
    expect(merged).toContain('Water Damage Restoration')
    expect(merged).toContain('Mold Removal')

    // Competitor-derived NEW phrases added.
    expect(merged).toContain('flood cleanup')
    expect(merged).toContain('basement flood cleanup')

    // The case-insensitive duplicate of an own service is NOT added again.
    expect(merged.filter(m => m.toLowerCase() === 'water damage restoration')).toHaveLength(1)

    // Fully deduped overall.
    expect(new Set(merged.map(m => m.toLowerCase())).size).toBe(merged.length)

    // The list genuinely grew, and the counts expose own vs competitor_derived.
    expect(merged.length).toBeGreaterThan(services.length)
    expect(source_counts.own).toBe(2)
    expect(source_counts.competitor_derived).toBe(2) // flood cleanup + basement flood cleanup
    expect(source_counts.own + source_counts.competitor_derived).toBe(merged.length)
  })

  it('returns just the own services when there are no competitor phrases', () => {
    const { merged, source_counts } = mergeServicePhrases(['Plumbing'], [])
    expect(merged).toEqual(['Plumbing'])
    expect(source_counts).toEqual({ own: 1, competitor_derived: 0 })
  })
})
