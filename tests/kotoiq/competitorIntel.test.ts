import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// competitorIntel.test — WS5 three-lens competitor-intel aggregator (Phase 12 / 12-04).
//
// The correctness anchor of WS5 is the PURE identity reconciliation: organic
// competitors are domain rows (DataForSEO SERP rank_group), GEO competitors are
// business-name rows (grid-scan local pack), AEO competitors are brand rows
// (kotoiq_aeo_competitors share-of-voice). A naive merge double-counts the same
// competitor across lenses. reconcileCompetitorIdentities() collapses them into
// one per-competitor × per-lens set:
//
//   match rules
//     organic.domain ↔ aeo.domain          — exact host, www-stripped, lowercased
//     geo.business_name ↔ aeo.brand        — normalized-name equality OR aeo.aliases[] membership
//   unmatched entries stay as single-lens rows (NEVER dropped)
//   the same competitor NEVER double-counts across lenses
//
// normalizeBrand(s) and hostOf(url) are pure helpers. All tests run on fixtures —
// no DB, no network (mirrors scoreServiceCityGrid's computeCellScore/bucketCell).
// ─────────────────────────────────────────────────────────────────────────────

import {
  reconcileCompetitorIdentities,
  normalizeBrand,
  hostOf,
  type OrganicCompetitor,
  type GeoCompetitor,
  type AeoCompetitor,
} from '../../src/lib/kotoiq/competitorIntel'

describe('normalizeBrand', () => {
  it('lowercases, trims, collapses whitespace, strips punctuation/suffixes', () => {
    expect(normalizeBrand('  Acme  Plumbing,  LLC ')).toBe('acme plumbing')
    expect(normalizeBrand('Acme Plumbing Inc.')).toBe('acme plumbing')
    expect(normalizeBrand('ACME-PLUMBING')).toBe('acme plumbing')
  })
  it('is stable / idempotent and safe on empty', () => {
    expect(normalizeBrand('')).toBe('')
    expect(normalizeBrand(normalizeBrand('Acme Plumbing Co'))).toBe('acme plumbing')
  })
})

describe('hostOf', () => {
  it('extracts the bare host, www-stripped + lowercased', () => {
    expect(hostOf('https://WWW.Acme.com/services')).toBe('acme.com')
    expect(hostOf('http://acme.com')).toBe('acme.com')
    expect(hostOf('acme.com/path')).toBe('acme.com')
  })
  it('returns empty string on garbage rather than throwing', () => {
    expect(hostOf('')).toBe('')
    expect(hostOf('not a url at all')).toBe('')
  })
})

describe('reconcileCompetitorIdentities', () => {
  it('merges organic(domain) + aeo(same domain) into ONE row with both lenses', () => {
    const organic: OrganicCompetitor[] = [
      { name: 'Acme Plumbing', domain: 'acme.com', rank_group: 1 },
    ]
    const aeo: AeoCompetitor[] = [
      { brand: 'Acme Plumbing', share: 40, avg_position: 1.5, mentions: 12, domain: 'https://www.acme.com' },
    ]
    const out = reconcileCompetitorIdentities({ organic, geo: [], aeo })
    expect(out).toHaveLength(1)
    expect(out[0].organic).toEqual({ rank: 1 })
    expect(out[0].aeo).toEqual({ share: 40, avg_position: 1.5, mentions: 12 })
    expect(out[0].domain).toBe('acme.com')
  })

  it('merges geo business_name matching an aeo alias; non-matching stays separate', () => {
    const geo: GeoCompetitor[] = [
      { business_name: 'Bob the Plumber', local_pack_rank: 2, cells_present: 5 },
      { business_name: 'Unrelated Co', local_pack_rank: 4, cells_present: 1 },
    ]
    const aeo: AeoCompetitor[] = [
      { brand: 'Bobs Plumbing', share: 22, avg_position: 2.0, mentions: 6, aliases: ['Bob the Plumber'] },
    ]
    const out = reconcileCompetitorIdentities({ organic: [], geo, aeo })
    // Bob the Plumber (geo) merges into Bobs Plumbing (aeo) via alias → 1 row.
    // Unrelated Co (geo only) → 1 row. Total = 2.
    expect(out).toHaveLength(2)
    const bob = out.find(c => c.geo && c.aeo)
    expect(bob).toBeTruthy()
    expect(bob!.geo).toEqual({ local_pack_rank: 2, cells_present: 5 })
    expect(bob!.aeo).toEqual({ share: 22, avg_position: 2.0, mentions: 6 })
    const unrelated = out.find(c => c.geo && !c.aeo)
    expect(unrelated!.name.toLowerCase()).toContain('unrelated')
  })

  it('merges geo business_name matching an aeo brand by normalized-name equality', () => {
    const geo: GeoCompetitor[] = [
      { business_name: 'Acme Plumbing LLC', local_pack_rank: 1, cells_present: 9 },
    ]
    const aeo: AeoCompetitor[] = [
      { brand: 'Acme Plumbing', share: 51, avg_position: 1.2, mentions: 20 },
    ]
    const out = reconcileCompetitorIdentities({ organic: [], geo, aeo })
    expect(out).toHaveLength(1)
    expect(out[0].geo).toBeTruthy()
    expect(out[0].aeo).toBeTruthy()
  })

  it('preserves single-lens rows and never double-counts a 3-lens competitor', () => {
    const organic: OrganicCompetitor[] = [
      { name: 'Acme Plumbing', domain: 'acme.com', rank_group: 1 },
      { name: 'Organic Only', domain: 'organiconly.com', rank_group: 7 },
    ]
    const geo: GeoCompetitor[] = [
      { business_name: 'Acme Plumbing', local_pack_rank: 1, cells_present: 9 },
      { business_name: 'Geo Only Co', local_pack_rank: 3, cells_present: 2 },
    ]
    const aeo: AeoCompetitor[] = [
      { brand: 'Acme Plumbing', share: 60, avg_position: 1.1, mentions: 30, domain: 'acme.com' },
      { brand: 'Aeo Only Brand', share: 5, avg_position: 4.0, mentions: 2 },
    ]
    const out = reconcileCompetitorIdentities({ organic, geo, aeo })
    // Acme = 1 row (all three lenses). Organic Only, Geo Only Co, Aeo Only Brand = 3 single-lens rows.
    // Total distinct = 4.
    expect(out).toHaveLength(4)
    const acme = out.find(c => normalizeBrand(c.name) === 'acme plumbing')!
    expect(acme.organic).toEqual({ rank: 1 })
    expect(acme.geo).toEqual({ local_pack_rank: 1, cells_present: 9 })
    expect(acme.aeo).toEqual({ share: 60, avg_position: 1.1, mentions: 30 })
    // No other row also claims Acme's lenses (no double-count).
    const acmeLike = out.filter(c => normalizeBrand(c.name) === 'acme plumbing')
    expect(acmeLike).toHaveLength(1)
  })

  it('does not crash on empty / missing lenses', () => {
    expect(reconcileCompetitorIdentities({ organic: [], geo: [], aeo: [] })).toEqual([])
    expect(
      reconcileCompetitorIdentities({ organic: [{ name: 'X', domain: 'x.com', rank_group: 1 }], geo: [], aeo: [] }),
    ).toHaveLength(1)
  })
})
