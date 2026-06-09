import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 / Plan 05 — computeInternalLinks (WS6).
//
// EXTRACTION (not a rewrite) of the sibling/cross/hub link computation that
// deployCampaign builds inline (topic-campaign/route.ts ~1745-1785). The helper
// returns the SAME { siblingLinks, crossByCity, hub? } shape so deployCampaign's
// output is byte-identical. It is pure-ish — DB reads only, no writes — so it
// unit-tests against a mocked supabase.
//
// Tests:
//   (1) sibling links deduped by city + self-excluded (new batch wins over prior)
//   (2) cross-campaign related-services grouped by city
//   (3) hub context present only when a hub exists
//   (+) byte-identical merge: mirrors the inline deploy path on a fixture
// ─────────────────────────────────────────────────────────────────────────────

import { computeInternalLinks } from '../../src/lib/wp-shim/computeInternalLinks'

// ── Minimal supabase mock — only the chained query shape the helper uses ──────
//
// The helper makes two kinds of reads:
//   • koto_topic_campaign_deploys (prior published siblings for THIS campaign)
//   • koto_topic_campaigns + koto_topic_campaign_deploys (cross-campaign map)
//
// We model them with a tiny fixture-backed chainable builder.

interface Fixtures {
  priorDeploys: Array<{ city: string; state_abbr: string; wp_post_url: string }>
  otherCampaigns: Array<{ id: string; topic: string }>
  otherDeploys: Array<{ campaign_id: string; city: string; state_abbr: string; wp_post_url: string }>
}

function mockSupabase(fx: Fixtures) {
  function chain(table: string) {
    const state: any = { table, filters: {} }
    const builder: any = {
      select() { return builder },
      eq(col: string, val: any) { state.filters[col] = val; return builder },
      neq(col: string, val: any) { state.filters[`neq_${col}`] = val; return builder },
      in(col: string, vals: any[]) { state.filters[`in_${col}`] = vals; return builder },
      not() { return builder },
      order() { return builder },
      then(resolve: (v: any) => void) {
        resolve({ data: resolveData(), error: null })
      },
    }
    function resolveData() {
      if (table === 'koto_topic_campaign_deploys') {
        // cross-campaign read uses in_campaign_id; the prior-siblings read uses eq campaign_id
        if (state.filters.in_campaign_id) {
          return fx.otherDeploys.filter(d => state.filters.in_campaign_id.includes(d.campaign_id))
        }
        return fx.priorDeploys
      }
      if (table === 'koto_topic_campaigns') {
        return fx.otherCampaigns
      }
      return []
    }
    return builder
  }
  return { from: (table: string) => chain(table) }
}

const NEW_SIBLINGS = [
  { city: 'Austin', state_abbr: 'TX', url: 'https://site.com/plumbing-austin/' },
  { city: 'Dallas', state_abbr: 'TX', url: 'https://site.com/plumbing-dallas/' },
]

describe('computeInternalLinks — sibling links', () => {
  it('(1) merges prior + new siblings, deduped by city (new wins)', async () => {
    const supabase = mockSupabase({
      priorDeploys: [
        { city: 'Austin', state_abbr: 'TX', wp_post_url: 'https://site.com/OLD-austin/' },
        { city: 'Houston', state_abbr: 'TX', wp_post_url: 'https://site.com/plumbing-houston/' },
      ],
      otherCampaigns: [],
      otherDeploys: [],
    })
    const r = await computeInternalLinks(supabase as any, {
      siteId: 'site-1',
      campaignId: 'camp-1',
      newSiblings: NEW_SIBLINGS,
    })
    const byCity = Object.fromEntries(r.siblingLinks.map(s => [s.city, s.url]))
    // Austin appears in both — new batch wins.
    expect(byCity['Austin']).toBe('https://site.com/plumbing-austin/')
    // Houston (prior only) is retained.
    expect(byCity['Houston']).toBe('https://site.com/plumbing-houston/')
    // Dallas (new only) is present.
    expect(byCity['Dallas']).toBe('https://site.com/plumbing-dallas/')
    // Deduped: exactly one entry per city.
    expect(r.siblingLinks.length).toBe(3)
  })
})

describe('computeInternalLinks — cross-campaign map', () => {
  it('(2) groups other campaigns’ published pages by city key', async () => {
    const supabase = mockSupabase({
      priorDeploys: [],
      otherCampaigns: [{ id: 'camp-2', topic: 'Roofing' }],
      otherDeploys: [
        { campaign_id: 'camp-2', city: 'Austin', state_abbr: 'TX', wp_post_url: 'https://site.com/roofing-austin/' },
      ],
    })
    const r = await computeInternalLinks(supabase as any, {
      siteId: 'site-1',
      campaignId: 'camp-1',
      newSiblings: NEW_SIBLINGS,
    })
    const bucket = r.crossByCity.get('austin|TX')
    expect(bucket).toBeTruthy()
    expect(bucket![0].topic).toBe('Roofing')
    expect(bucket![0].url).toBe('https://site.com/roofing-austin/')
  })
})

describe('computeInternalLinks — hub context', () => {
  it('(3) hub present only when a hub is provided', async () => {
    const supabase = mockSupabase({ priorDeploys: [], otherCampaigns: [], otherDeploys: [] })
    const withHub = await computeInternalLinks(supabase as any, {
      siteId: 'site-1', campaignId: 'camp-1', newSiblings: NEW_SIBLINGS,
      hub: { url: 'https://site.com/plumbing/', title: 'Plumbing' },
    })
    expect(withHub.hub).toEqual({ url: 'https://site.com/plumbing/', title: 'Plumbing' })

    const noHub = await computeInternalLinks(supabase as any, {
      siteId: 'site-1', campaignId: 'camp-1', newSiblings: NEW_SIBLINGS,
    })
    expect(noHub.hub).toBeUndefined()
  })
})

describe('computeInternalLinks — byte-identical to the inline deploy path', () => {
  it('reproduces the inline siblingsByCity merge exactly', async () => {
    const priorDeploys = [
      { city: 'Austin', state_abbr: 'TX', wp_post_url: 'https://site.com/OLD-austin/' },
      { city: 'Houston', state_abbr: 'TX', wp_post_url: 'https://site.com/plumbing-houston/' },
    ]
    // Inline reference computation (copied from deployCampaign @1765-1770).
    const priorSiblings = priorDeploys.map(x => ({ city: x.city, state_abbr: x.state_abbr, url: x.wp_post_url }))
    const siblingsByCity = new Map<string, { city: string; state_abbr?: string; url: string }>()
    for (const slink of priorSiblings) siblingsByCity.set(slink.city, slink)
    for (const slink of NEW_SIBLINGS) siblingsByCity.set(slink.city, slink)
    const expected = Array.from(siblingsByCity.values())

    const supabase = mockSupabase({ priorDeploys, otherCampaigns: [], otherDeploys: [] })
    const r = await computeInternalLinks(supabase as any, {
      siteId: 'site-1', campaignId: 'camp-1', newSiblings: NEW_SIBLINGS,
    })
    expect(r.siblingLinks).toEqual(expected)
  })
})
