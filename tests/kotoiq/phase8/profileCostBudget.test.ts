import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkBudget, applyOverride, checkRateLimit, __resetRateLimits } from '@/lib/kotoiq/profileCostBudget'
import type { KotoIQDb } from '@/lib/kotoiqDb'

// ── Mock helpers ────────────────────────────────────────────────────────────

function createMockDb(opts: {
  tokenUsageRows?: Array<{ cost_usd: number; metadata?: any }>
  insertError?: any
}): KotoIQDb {
  const { tokenUsageRows = [], insertError = null } = opts

  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: tokenUsageRows, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: insertError }),
  }

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'koto_token_usage') return chainable
      if (table === 'koto_audit_log') return chainable
      return chainable
    }),
  } as any

  return {
    agencyId: 'agency-1',
    client,
    from: vi.fn() as any,
    insert: vi.fn() as any,
    templates: {} as any,
    campaigns: {} as any,
    schemaVersions: {} as any,
    builderSites: {} as any,
    clientProfile: {} as any,
    clarifications: {} as any,
    agencyIntegrations: {} as any,
  }
}

describe('profileCostBudget — checkBudget()', () => {
  it('returns allowed=true, warn=false when spend is below 80% of client budget', async () => {
    // today_spend = 3.80 for both client and agency; estimated = 0.10
    // projected_client = 3.90 → 78% of $5 → no warn
    const db = createMockDb({
      tokenUsageRows: [
        { cost_usd: 3.80, metadata: { client_id: 'client-1' } },
      ],
    })

    const result = await checkBudget({
      agencyId: 'agency-1',
      clientId: 'client-1',
      estimatedCost: 0.10,
      db,
    })

    expect(result.allowed).toBe(true)
    expect(result.warn).toBe(false)
    expect(result.block).toBe(false)
  })

  it('returns warn=true at 82% of client budget ($4.10 spend)', async () => {
    // today_spend = 4.10; estimated = 0.0 (check current state)
    // projected_client = 4.10 → 82% of $5 → warn
    const db = createMockDb({
      tokenUsageRows: [
        { cost_usd: 4.10, metadata: { client_id: 'client-1' } },
      ],
    })

    const result = await checkBudget({
      agencyId: 'agency-1',
      clientId: 'client-1',
      estimatedCost: 0.0,
      db,
    })

    expect(result.allowed).toBe(true)
    expect(result.warn).toBe(true)
    expect(result.block).toBe(false)
    expect(result.scope).toBeNull()
    expect(result.warn_reason).toBe('client')
  })

  it('returns block=true at 101% of client budget ($4.95 + $0.10)', async () => {
    const db = createMockDb({
      tokenUsageRows: [
        { cost_usd: 4.95, metadata: { client_id: 'client-1' } },
      ],
    })

    const result = await checkBudget({
      agencyId: 'agency-1',
      clientId: 'client-1',
      estimatedCost: 0.10,
      db,
    })

    expect(result.allowed).toBe(false)
    expect(result.warn).toBe(true)
    expect(result.block).toBe(true)
    expect(result.scope).toBe('client')
    expect(result.requires_override).toBe(true)
  })

  it('returns scope=agency when agency budget also exceeded', async () => {
    // Agency spend = 49.80, estimated = 0.30 → 50.10 > 50 → agency blocks
    // Client spend also high (matches same rows since no clientId filter for agency)
    const db = createMockDb({
      tokenUsageRows: [
        { cost_usd: 49.80, metadata: { client_id: 'client-1' } },
      ],
    })

    const result = await checkBudget({
      agencyId: 'agency-1',
      clientId: 'client-1',
      estimatedCost: 0.30,
      db,
    })

    expect(result.allowed).toBe(false)
    expect(result.block).toBe(true)
    expect(result.scope).toBe('agency')
  })
})

describe('profileCostBudget — applyOverride()', () => {
  it('writes exactly one koto_audit_log row with action=cost_budget_override', async () => {
    const db = createMockDb({})
    const insertSpy = db.client.from('koto_audit_log').insert as ReturnType<typeof vi.fn>

    const result = await applyOverride({
      agencyId: 'agency-1',
      clientId: 'client-1',
      userId: 'user-1',
      estimatedCost: 0.50,
      originalCap: 5,
      overrideValue: 10,
      scope: 'client',
      sourceType: 'website_scrape',
      justification: 'Client approved extra spend',
      db,
    })

    expect(result.logged).toBe(true)

    // Verify the insert was called with correct shape
    const fromCall = (db.client.from as ReturnType<typeof vi.fn>)
    expect(fromCall).toHaveBeenCalledWith('koto_audit_log')

    // The chainable.insert should have been called
    const chainable = fromCall.mock.results[fromCall.mock.results.length - 1].value
    expect(chainable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'cost_budget_override',
        target_agency_id: 'agency-1',
        target_client_id: 'client-1',
        metadata: expect.objectContaining({
          scope: 'client',
          original_cap: 5,
          override_value: 10,
          justification: 'Client approved extra spend',
          source_type: 'website_scrape',
          client_id: 'client-1',
          estimated_cost: 0.50,
        }),
      })
    )
  })
})

describe('profileCostBudget — checkRateLimit()', () => {
  beforeEach(() => {
    __resetRateLimits()
  })

  it('returns allowed=false after 10 calls for seed_form_url within 60s', () => {
    const agencyId = 'agency-rate-test'

    // 10 calls should succeed
    for (let i = 0; i < 10; i++) {
      const r = checkRateLimit({ agencyId, actionKey: 'seed_form_url' })
      expect(r.allowed).toBe(true)
    }

    // 11th should be blocked
    const blocked = checkRateLimit({ agencyId, actionKey: 'seed_form_url' })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retry_after_ms).toBeGreaterThan(0)
  })

  it('different agencies have independent rate-limit windows', () => {
    // Exhaust agency-A
    for (let i = 0; i < 10; i++) {
      checkRateLimit({ agencyId: 'agency-A', actionKey: 'seed_form_url' })
    }
    const blockedA = checkRateLimit({ agencyId: 'agency-A', actionKey: 'seed_form_url' })
    expect(blockedA.allowed).toBe(false)

    // agency-B should still be allowed
    const allowedB = checkRateLimit({ agencyId: 'agency-B', actionKey: 'seed_form_url' })
    expect(allowedB.allowed).toBe(true)
  })
})
