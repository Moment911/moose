import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 02 — POST /api/trainer/trainees route tests.
//
// Integration-style.  verifySession is mocked; the Supabase client is mocked
// with a chainable query builder so each action's .from/.select/.eq/etc
// surface can be asserted.  Mirrors tests/kotoiq/phase8/integrationsRoute.
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase mock — chainable query builder ─────────────────────────────────
// Each method returns `this` so chains like .select().eq().eq().maybeSingle()
// resolve against the same programmable mock row/error the test set up.
type MockResponse = { data?: unknown; error?: { message: string } | null }

const qState: {
  lastTable: string | null
  response: MockResponse
  insertedRow: unknown
  updatedRow: unknown
} = {
  lastTable: null,
  response: { data: null, error: null },
  insertedRow: undefined,
  updatedRow: undefined,
}

function makeBuilder() {
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    is: () => api,
    order: () => api,
    insert: (row: unknown) => {
      qState.insertedRow = row
      return api
    },
    update: (row: unknown) => {
      qState.updatedRow = row
      return api
    },
    single: () => Promise.resolve(qState.response),
    maybeSingle: () => Promise.resolve(qState.response),
    then: (resolve: (v: MockResponse) => unknown) => resolve(qState.response),
  }
  return api
}

const mockClient = {
  from: (table: string) => {
    qState.lastTable = table
    return makeBuilder()
  },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

// ── Feature-flag helper — stub so we can control enabled/disabled per test ──
const mockAssertFlag = vi.fn()
vi.mock('../../../src/lib/trainer/featureFlag', async () => {
  // Preserve the real TrainerFeatureDisabledError + isFeatureDisabledError so
  // the route's catch branch behaves correctly.  Only stub assertFitnessCoachEnabled.
  const actual = await vi.importActual<typeof import('../../../src/lib/trainer/featureFlag')>(
    '../../../src/lib/trainer/featureFlag',
  )
  return {
    ...actual,
    assertFitnessCoachEnabled: (...a: unknown[]) => mockAssertFlag(...a),
  }
})

// ── verifySession mock ─────────────────────────────────────────────────────
const mockVerify = vi.fn()
vi.mock('../../../src/lib/apiAuth', () => ({
  verifySession: (...a: unknown[]) => mockVerify(...a),
}))

function mkReq(body: Record<string, unknown>): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request
}

function reset() {
  mockVerify.mockReset()
  mockAssertFlag.mockReset()
  qState.lastTable = null
  qState.response = { data: null, error: null }
  qState.insertedRow = undefined
  qState.updatedRow = undefined
}

async function importRoute() {
  // Dynamic import after mocks are wired
  return import('../../../src/app/api/trainer/trainees/route')
}

describe('POST /api/trainer/trainees', () => {
  beforeEach(() => reset())

  describe('auth', () => {
    it('401 when session not verified', async () => {
      mockVerify.mockResolvedValue({ verified: false, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list' }) as never)
      expect(res.status).toBe(401)
    })

    it('401 when verified but agencyId missing', async () => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list' }) as never)
      expect(res.status).toBe(401)
    })
  })

  describe('body + action validation', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined) // flag enabled
    })

    it('400 on invalid JSON', async () => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      const { POST } = await importRoute()
      const badReq = {
        json: async () => {
          throw new Error('bad json')
        },
        headers: new Headers(),
      } as unknown as Request
      const res = await POST(badReq as never)
      expect(res.status).toBe(400)
    })

    it('400 on unknown action', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'destroy_universe' }) as never)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.allowed_actions).toBeTruthy()
    })
  })

  describe('feature-flag gate', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
    })

    it('404 when fitness_coach disabled (not 403)', async () => {
      const { TrainerFeatureDisabledError } = await import(
        '../../../src/lib/trainer/featureFlag'
      )
      mockAssertFlag.mockRejectedValue(new TrainerFeatureDisabledError())
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list' }) as never)
      expect(res.status).toBe(404)
    })

    it('404 propagates across every action when flag disabled', async () => {
      const { TrainerFeatureDisabledError } = await import(
        '../../../src/lib/trainer/featureFlag'
      )
      mockAssertFlag.mockRejectedValue(new TrainerFeatureDisabledError())
      const { POST } = await importRoute()
      for (const action of ['list', 'get', 'create', 'update', 'archive', 'unarchive']) {
        const res = await POST(mkReq({ action, trainee_id: 't1' }) as never)
        expect(res.status).toBe(404)
      }
    })

    it('500 when flag lookup fails with unexpected error', async () => {
      mockAssertFlag.mockRejectedValue(new Error('db blew up'))
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list' }) as never)
      expect(res.status).toBe(500)
    })
  })

  describe('list action', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('returns trainees array from the DB response', async () => {
      qState.response = {
        data: [{ id: 't1', full_name: 'Jane', agency_id: 'agency-A' }],
        error: null,
      }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.trainees).toHaveLength(1)
      expect(body.trainees[0].id).toBe('t1')
    })

    it('queries koto_fitness_trainees table', async () => {
      qState.response = { data: [], error: null }
      const { POST } = await importRoute()
      await POST(mkReq({ action: 'list' }) as never)
      expect(qState.lastTable).toBe('koto_fitness_trainees')
    })

    it('500 when DB returns error', async () => {
      qState.response = { data: null, error: { message: 'oops' } }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list' }) as never)
      expect(res.status).toBe(500)
    })
  })

  describe('get action', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when trainee_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get' }) as never)
      expect(res.status).toBe(400)
    })

    it('404 when trainee not found (or belongs to different agency)', async () => {
      qState.response = { data: null, error: null }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get', trainee_id: 't1' }) as never)
      expect(res.status).toBe(404)
    })

    it('returns trainee when found under this agency', async () => {
      qState.response = {
        data: { id: 't1', full_name: 'Jane', agency_id: 'agency-A' },
        error: null,
      }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.trainee.id).toBe('t1')
    })
  })

  describe('create action', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 with field_errors when intake invalid', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'create', primary_goal: 'moonshot' }) as never,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.field_errors).toBeTruthy()
      expect(body.field_errors.full_name).toBeTruthy() // missing required
    })

    it('201 with trainee_id on success', async () => {
      qState.response = { data: { id: 'new-trainee-id' }, error: null }
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'create',
          full_name: 'Jane Runner',
          about_you: 'Marathon goal in 6 months',
        }) as never,
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.trainee_id).toBe('new-trainee-id')
    })

    it('ignores body.agency_id — uses session agencyId', async () => {
      qState.response = { data: { id: 'x' }, error: null }
      const { POST } = await importRoute()
      await POST(
        mkReq({
          action: 'create',
          full_name: 'Jane',
          about_you: 'Context for Jane',
          agency_id: 'agency-HIJACK',
        }) as never,
      )
      const inserted = qState.insertedRow as { agency_id: string }
      expect(inserted.agency_id).toBe('agency-A')
    })
  })

  describe('update action', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when trainee_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'update', patch: { trainer_notes: 'x' } }) as never)
      expect(res.status).toBe(400)
    })

    it('400 when patch missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'update', trainee_id: 't1' }) as never)
      expect(res.status).toBe(400)
    })

    it('400 with field_errors on invalid patch', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update',
          trainee_id: 't1',
          patch: { primary_goal: 'moonshot' },
        }) as never,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.field_errors.primary_goal).toBeTruthy()
    })

    it('404 when no row matched (cross-agency or missing)', async () => {
      qState.response = { data: null, error: null }
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update',
          trainee_id: 't1',
          patch: { trainer_notes: 'new note' },
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('200 ok:true on success', async () => {
      qState.response = { data: { id: 't1' }, error: null }
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update',
          trainee_id: 't1',
          patch: { trainer_notes: 'new note' },
        }) as never,
      )
      expect(res.status).toBe(200)
    })
  })

  describe('archive + unarchive', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('archive: sets archived_at + status=archived', async () => {
      qState.response = { data: { id: 't1' }, error: null }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'archive', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const updated = qState.updatedRow as { archived_at: string; status: string }
      expect(updated.status).toBe('archived')
      expect(updated.archived_at).toMatch(/^\d{4}-/) // ISO timestamp
    })

    it('unarchive: clears archived_at + resets status to intake_complete', async () => {
      qState.response = { data: { id: 't1' }, error: null }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'unarchive', trainee_id: 't1' }) as never)
      expect(res.status).toBe(200)
      const updated = qState.updatedRow as { archived_at: string | null; status: string }
      expect(updated.archived_at).toBeNull()
      expect(updated.status).toBe('intake_complete')
    })

    it('archive: 400 without trainee_id', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'archive' }) as never)
      expect(res.status).toBe(400)
    })

    it('archive: 404 when no matching row', async () => {
      qState.response = { data: null, error: null }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'archive', trainee_id: 't1' }) as never)
      expect(res.status).toBe(404)
    })
  })
})
