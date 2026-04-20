import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Plan 2 Task 2 — budget/override/rate-limit gate tests (D-22, D-23,
// D-25 + RESEARCH §Security Domain rate-limits).
//
// Covers every <behavior> bullet from the plan:
//   1. Below 80% of $5 client budget → { allowed:true, warn:false, block:false }
//   2. At 82% client budget          → { allowed:true, warn:true, block:false, scope:'client' }
//   3. 101% client budget            → { allowed:false, warn:true, block:true, requires_override:true }
//   4. Agency block wins priority    → { allowed:false, block:true, scope:'agency' }
//   5. applyOverride writes exactly one koto_audit_log row with full metadata
//   6. checkRateLimit sliding window — 10/min for seed_form_url
//   7. Per-agency rate-limit isolation (different agencies don't share buckets)
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock scaffold ─────────────────────────────────────────────────────────────
// Mimics the Phase 7 profileRoute.test.ts mock pattern:
//  - a chainable .from(table).select().eq().gte() query builder
//  - a chainable .from(table).insert() call for audit-log writes.
// Each test assigns fresh mocks so the chain returns the fixture it needs.

const auditInsert = vi.fn()
const auditFrom = vi.fn()
const tokenUsageBuilder: {
  rows: Array<{ cost_usd: number | null; metadata?: any }>
  error: any
} = { rows: [], error: null }

function makeTokenUsageChain() {
  // db.client.from('koto_token_usage').select(...).eq(...).gte(...)
  // returns a thenable that resolves to { data, error }
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    then: (resolve: any) =>
      resolve({ data: tokenUsageBuilder.rows, error: tokenUsageBuilder.error }),
  }
  return chain
}

function dbFrom(table: string) {
  if (table === 'koto_token_usage') return makeTokenUsageChain()
  if (table === 'koto_audit_log') {
    return {
      insert: (row: any) => {
        auditInsert(row)
        return Promise.resolve({ data: [row], error: null })
      },
    }
  }
  return { select: () => ({ eq: () => ({ then: (r: any) => r({ data: [], error: null }) }) }) }
}

vi.mock('../../../src/lib/kotoiqDb', () => ({
  getKotoIQDb: vi.fn((_agencyId: string) => ({
    agencyId: _agencyId,
    client: { from: dbFrom },
    from: dbFrom,
  })),
}))

// Import AFTER mocks are declared (Vitest hoists vi.mock to top).
import {
  checkBudget,
  applyOverride,
  checkRateLimit,
  getTodaySpend,
  __resetRateLimits,
} from '../../../src/lib/kotoiq/profileCostBudget'

const AGENCY = '00000000-0000-0000-0000-0000000000a1'
const AGENCY_B = '00000000-0000-0000-0000-0000000000b2'
const CLIENT = '00000000-0000-0000-0000-0000000000c1'
const USER = '00000000-0000-0000-0000-0000000000e1'

beforeEach(() => {
  tokenUsageBuilder.rows = []
  tokenUsageBuilder.error = null
  auditInsert.mockReset()
  auditFrom.mockReset()
  __resetRateLimits()
})

describe('phase 8 — checkBudget (D-22 per-client + D-23 per-agency)', () => {
  it('below 80% of client budget returns allowed=true, warn=false, block=false', async () => {
    tokenUsageBuilder.rows = [{ cost_usd: 3.8, metadata: { client_id: CLIENT } }]
    const r = await checkBudget({
      agencyId: AGENCY,
      clientId: CLIENT,
      estimatedCost: 0.1,
    })
    expect(r.allowed).toBe(true)
    expect(r.warn).toBe(false)
    expect(r.block).toBe(false)
    expect(r.scope).toBeNull()
    expect(r.today_spend_client).toBeCloseTo(3.8, 2)
    expect(r.projected_client).toBeCloseTo(3.9, 2)
    expect(r.requires_override).toBe(false)
  })

  it('at 82% client spend (warn threshold crossed) → warn=true, block=false, scope=null', async () => {
    tokenUsageBuilder.rows = [{ cost_usd: 4.0, metadata: { client_id: CLIENT } }]
    const r = await checkBudget({
      agencyId: AGENCY,
      clientId: CLIENT,
      estimatedCost: 0.1, // projected = 4.10 → 82% of $5
    })
    expect(r.allowed).toBe(true)
    expect(r.warn).toBe(true)
    expect(r.block).toBe(false)
    expect(r.warn_reason).toBe('client')
  })

  it('at 101% client spend → allowed=false, block=true, scope=client, requires_override=true', async () => {
    tokenUsageBuilder.rows = [{ cost_usd: 4.95, metadata: { client_id: CLIENT } }]
    const r = await checkBudget({
      agencyId: AGENCY,
      clientId: CLIENT,
      estimatedCost: 0.1, // projected = 5.05 → over $5
    })
    expect(r.allowed).toBe(false)
    expect(r.warn).toBe(true) // 101% crosses the 80% warn too
    expect(r.block).toBe(true)
    expect(r.scope).toBe('client')
    expect(r.requires_override).toBe(true)
    expect(r.block_reason).toBe('client')
  })

  it('agency block wins over client block (scope priority = agency)', async () => {
    // 3 client rows + aggregated agency spend of 49.80 (from the sum).
    tokenUsageBuilder.rows = [
      { cost_usd: 2.0, metadata: { client_id: CLIENT } }, // counted for client + agency
      { cost_usd: 47.8, metadata: { client_id: 'other-client' } }, // counted for agency only
    ]
    const r = await checkBudget({
      agencyId: AGENCY,
      clientId: CLIENT,
      estimatedCost: 0.3, // projected agency = 50.10 → over $50
    })
    expect(r.allowed).toBe(false)
    expect(r.block).toBe(true)
    expect(r.scope).toBe('agency')
    expect(r.block_reason).toBe('agency')
  })
})

describe('phase 8 — applyOverride (D-25 audit logging)', () => {
  it('writes exactly one koto_audit_log row with action=cost_budget_override + full metadata', async () => {
    const result = await applyOverride({
      agencyId: AGENCY,
      clientId: CLIENT,
      userId: USER,
      estimatedCost: 3.2,
      originalCap: 5.0,
      overrideValue: 10.0,
      scope: 'client',
      sourceType: 'website_scrape',
      justification: 'Large multi-location client',
    })

    expect(result.logged).toBe(true)
    expect(auditInsert).toHaveBeenCalledTimes(1)

    const row = auditInsert.mock.calls[0][0]
    expect(row.action).toBe('cost_budget_override')
    expect(row.user_id).toBe(USER)
    expect(row.target_agency_id).toBe(AGENCY)
    expect(row.target_client_id).toBe(CLIENT)
    expect(row.metadata.scope).toBe('client')
    expect(row.metadata.original_cap).toBe(5.0)
    expect(row.metadata.override_value).toBe(10.0)
    expect(row.metadata.justification).toBe('Large multi-location client')
    expect(row.metadata.source_type).toBe('website_scrape')
    expect(row.metadata.client_id).toBe(CLIENT)
    expect(row.metadata.estimated_cost).toBe(3.2)
  })

  it('null justification is accepted and persisted as null (not omitted)', async () => {
    await applyOverride({
      agencyId: AGENCY,
      clientId: CLIENT,
      userId: USER,
      estimatedCost: 1.0,
      originalCap: 5.0,
      overrideValue: 6.0,
      scope: 'per_source_cap',
      sourceType: 'pdf_image_extract',
    })
    const row = auditInsert.mock.calls[0][0]
    expect(row.metadata.justification).toBeNull()
  })
})

describe('phase 8 — checkRateLimit (sliding-window)', () => {
  it('seed_form_url: first 10 calls allowed, 11th blocked', () => {
    for (let i = 0; i < 10; i++) {
      const r = checkRateLimit({ agencyId: AGENCY, actionKey: 'seed_form_url' })
      expect(r.allowed).toBe(true)
    }
    const over = checkRateLimit({ agencyId: AGENCY, actionKey: 'seed_form_url' })
    expect(over.allowed).toBe(false)
    expect(over.retry_after_ms).toBeGreaterThan(0)
    expect(over.retry_after_ms).toBeLessThanOrEqual(60_000)
  })

  it('different agencies maintain independent rate-limit buckets', () => {
    // Exhaust agency A
    for (let i = 0; i < 10; i++) {
      checkRateLimit({ agencyId: AGENCY, actionKey: 'seed_form_url' })
    }
    // Agency B is unaffected
    const rB = checkRateLimit({ agencyId: AGENCY_B, actionKey: 'seed_form_url' })
    expect(rB.allowed).toBe(true)
    // Agency A still blocked
    const rA = checkRateLimit({ agencyId: AGENCY, actionKey: 'seed_form_url' })
    expect(rA.allowed).toBe(false)
  })

  it('connect_gbp_oauth_start: first 5 per hour allowed, 6th blocked', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit({ agencyId: AGENCY, actionKey: 'connect_gbp_oauth_start' }).allowed).toBe(true)
    }
    const over = checkRateLimit({ agencyId: AGENCY, actionKey: 'connect_gbp_oauth_start' })
    expect(over.allowed).toBe(false)
    // 1h window upper bound
    expect(over.retry_after_ms).toBeLessThanOrEqual(3_600_000)
  })

  it('actions do not bleed into each other (seed_form_url separate from connect_gbp_oauth_start)', () => {
    for (let i = 0; i < 10; i++) checkRateLimit({ agencyId: AGENCY, actionKey: 'seed_form_url' })
    const gbp = checkRateLimit({ agencyId: AGENCY, actionKey: 'connect_gbp_oauth_start' })
    expect(gbp.allowed).toBe(true)
  })
})

describe('phase 8 — getTodaySpend', () => {
  it('scoped to client_id filters metadata->client_id correctly', async () => {
    tokenUsageBuilder.rows = [
      { cost_usd: 1.0, metadata: { client_id: CLIENT } },
      { cost_usd: 2.0, metadata: { client_id: 'other' } },
      { cost_usd: 0.5, metadata: { client_id: CLIENT } },
    ]
    const db = await import('../../../src/lib/kotoiqDb')
    const inst = db.getKotoIQDb(AGENCY)
    const total = await getTodaySpend(inst as any, AGENCY, CLIENT)
    expect(total).toBeCloseTo(1.5, 4)
  })

  it('agency-wide spend (clientId=null) sums every row regardless of metadata', async () => {
    tokenUsageBuilder.rows = [
      { cost_usd: 1.0, metadata: { client_id: CLIENT } },
      { cost_usd: 2.0, metadata: { client_id: 'other' } },
      { cost_usd: 0.5 },
    ]
    const db = await import('../../../src/lib/kotoiqDb')
    const inst = db.getKotoIQDb(AGENCY)
    const total = await getTodaySpend(inst as any, AGENCY, null)
    expect(total).toBeCloseTo(3.5, 4)
  })

  it('read failure returns 0 (fail-open — never block on DB read error)', async () => {
    tokenUsageBuilder.error = new Error('db exploded')
    tokenUsageBuilder.rows = []
    const db = await import('../../../src/lib/kotoiqDb')
    const inst = db.getKotoIQDb(AGENCY)
    const total = await getTodaySpend(inst as any, AGENCY, CLIENT)
    expect(total).toBe(0)
  })
})
