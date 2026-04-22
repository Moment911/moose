import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — POST /api/trainer/workout-logs route tests.
//
// Same harness as tests/trainer/phase1/traineesRoute.test.ts + phase2/
// generateRoute.test.ts:
//   - chainable Supabase query-builder mock
//   - verifySession + assertFitnessCoachEnabled mocked
//
// Exercises every action for auth, feature-flag gate, validation, and
// happy path.  No Sonnet here — this route is pure DB.
// ─────────────────────────────────────────────────────────────────────────────

type MockResponse = { data?: unknown; error?: { message: string } | null }

const qState: {
  calls: Array<{ table: string; op: string; row?: unknown }>
  tableResponses: Record<string, MockResponse[]>
  response: MockResponse
  insertedRow: unknown
  updatedRow: unknown
  lastTable: string | null
} = {
  calls: [],
  tableResponses: {},
  response: { data: null, error: null },
  insertedRow: undefined,
  updatedRow: undefined,
  lastTable: null,
}

function nextResponse(table: string): MockResponse {
  const queue = qState.tableResponses[table]
  if (queue && queue.length > 0) return queue.shift() as MockResponse
  return qState.response
}

function makeBuilder(table: string) {
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    is: () => api,
    order: () => api,
    insert: (row: unknown) => {
      qState.insertedRow = row
      qState.calls.push({ table, op: 'insert', row })
      return api
    },
    update: (row: unknown) => {
      qState.updatedRow = row
      qState.calls.push({ table, op: 'update', row })
      return api
    },
    delete: () => {
      qState.calls.push({ table, op: 'delete' })
      return api
    },
    single: () => Promise.resolve(nextResponse(table)),
    maybeSingle: () => Promise.resolve(nextResponse(table)),
    then: (resolve: (v: MockResponse) => unknown) => resolve(nextResponse(table)),
  }
  return api
}

const mockClient = {
  from: (table: string) => {
    qState.lastTable = table
    return makeBuilder(table)
  },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

const mockAssertFlag = vi.fn()
vi.mock('../../../src/lib/trainer/featureFlag', async () => {
  const actual = await vi.importActual<typeof import('../../../src/lib/trainer/featureFlag')>(
    '../../../src/lib/trainer/featureFlag',
  )
  return {
    ...actual,
    assertFitnessCoachEnabled: (...a: unknown[]) => mockAssertFlag(...a),
  }
})

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
  qState.calls = []
  qState.tableResponses = {}
  qState.response = { data: null, error: null }
  qState.insertedRow = undefined
  qState.updatedRow = undefined
  qState.lastTable = null
}

async function importRoute() {
  return import('../../../src/app/api/trainer/workout-logs/route')
}

function queueTable(table: string, responses: MockResponse[]) {
  qState.tableResponses[table] = [...responses]
}

describe('POST /api/trainer/workout-logs', () => {
  beforeEach(() => reset())

  describe('auth + gate', () => {
    it('401 when session unverified', async () => {
      mockVerify.mockResolvedValue({ verified: false, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list_for_plan', plan_id: 'x' }) as never)
      expect(res.status).toBe(401)
    })

    it('404 when fitness_coach disabled', async () => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      const { TrainerFeatureDisabledError } = await import(
        '../../../src/lib/trainer/featureFlag'
      )
      mockAssertFlag.mockRejectedValue(new TrainerFeatureDisabledError())
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list_for_plan', plan_id: 'x' }) as never)
      expect(res.status).toBe(404)
    })

    it('400 on unknown action', async () => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'whatever' }) as never)
      expect(res.status).toBe(400)
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
  })

  describe('list_for_plan', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when plan_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'list_for_plan' }) as never)
      expect(res.status).toBe(400)
    })

    it('404 when plan not found under this agency', async () => {
      queueTable('koto_fitness_plans', [{ data: null, error: null }])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'list_for_plan', plan_id: 'plan-1' }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('happy path: returns logs array', async () => {
      queueTable('koto_fitness_plans', [
        { data: { id: 'plan-1' }, error: null },
      ])
      queueTable('koto_fitness_workout_logs', [
        {
          data: [
            { id: 'l1', exercise_id: 'squat', set_number: 1 },
            { id: 'l2', exercise_id: 'squat', set_number: 2 },
          ],
          error: null,
        },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'list_for_plan', plan_id: 'plan-1' }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.logs).toHaveLength(2)
    })
  })

  describe('log_set', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when session_day_number out of range', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'plan-1',
          trainee_id: 't1',
          session_day_number: 99,
          exercise_id: 'squat',
          exercise_name: 'Back Squat',
          set_number: 1,
          actual_reps: 5,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('400 when set_number < 1', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'plan-1',
          trainee_id: 't1',
          session_day_number: 1,
          exercise_id: 'squat',
          exercise_name: 'Back Squat',
          set_number: 0,
          actual_reps: 5,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('404 when plan trainee mismatch', async () => {
      queueTable('koto_fitness_plans', [
        { data: { id: 'plan-1', trainee_id: 'other' }, error: null },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'plan-1',
          trainee_id: 't1',
          session_day_number: 1,
          exercise_id: 'squat',
          exercise_name: 'Back Squat',
          set_number: 1,
          actual_reps: 5,
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('happy path: inserts + returns log_id (201)', async () => {
      queueTable('koto_fitness_plans', [
        { data: { id: 'plan-1', trainee_id: 't1' }, error: null },
      ])
      queueTable('koto_fitness_workout_logs', [
        { data: { id: 'log-1' }, error: null },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'plan-1',
          trainee_id: 't1',
          session_day_number: 1,
          exercise_id: 'squat',
          exercise_name: 'Back Squat',
          set_number: 1,
          actual_reps: 5,
          actual_weight_kg: 100,
          rpe: 8,
        }) as never,
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.log_id).toBe('log-1')
      const inserted = qState.insertedRow as {
        agency_id: string
        actual_weight_kg: number
        rpe: number
      }
      expect(inserted.agency_id).toBe('agency-A')
      expect(inserted.actual_weight_kg).toBe(100)
      expect(inserted.rpe).toBe(8)
    })
  })

  describe('update_log', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when log_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'update_log', patch: { actual_reps: 5 } }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('400 when patch empty', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'update_log', log_id: 'l1', patch: {} }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('400 when rpe out of range', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update_log',
          log_id: 'l1',
          patch: { rpe: 99 },
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('404 when row not in this agency', async () => {
      queueTable('koto_fitness_workout_logs', [{ data: null, error: null }])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update_log',
          log_id: 'l1',
          patch: { actual_reps: 5 },
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('happy path', async () => {
      queueTable('koto_fitness_workout_logs', [
        { data: { id: 'l1' }, error: null },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update_log',
          log_id: 'l1',
          patch: { actual_reps: 7, notes: 'felt heavy' },
        }) as never,
      )
      expect(res.status).toBe(200)
      const updated = qState.updatedRow as { actual_reps: number; notes: string }
      expect(updated.actual_reps).toBe(7)
      expect(updated.notes).toBe('felt heavy')
    })
  })

  describe('delete_log', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when log_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'delete_log' }) as never)
      expect(res.status).toBe(400)
    })

    it('404 when row belongs to different agency', async () => {
      queueTable('koto_fitness_workout_logs', [{ data: null, error: null }])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'delete_log', log_id: 'l1' }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('happy path', async () => {
      queueTable('koto_fitness_workout_logs', [
        { data: { id: 'l1' }, error: null },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'delete_log', log_id: 'l1' }) as never,
      )
      expect(res.status).toBe(200)
      expect(
        qState.calls.some(
          (c) => c.op === 'delete' && c.table === 'koto_fitness_workout_logs',
        ),
      ).toBe(true)
    })
  })

  describe('compute_adherence', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when plan_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'compute_adherence' }) as never)
      expect(res.status).toBe(400)
    })

    it('404 when plan not in this agency', async () => {
      queueTable('koto_fitness_plans', [{ data: null, error: null }])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'compute_adherence', plan_id: 'plan-1' }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('happy path: scheduled vs logged roll-up', async () => {
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            workout_plan: {
              sessions: [
                {
                  day_number: 1,
                  exercises: [
                    { exercise_id: 'squat', sets: 3 },
                    { exercise_id: 'bench', sets: 3 },
                  ],
                },
                {
                  day_number: 2,
                  exercises: [{ exercise_id: 'dead', sets: 3 }],
                },
                {
                  day_number: 3,
                  exercises: [{ exercise_id: 'ohp', sets: 3 }],
                },
                {
                  day_number: 4,
                  exercises: [{ exercise_id: 'row', sets: 3 }],
                },
              ],
            },
          },
          error: null,
        },
      ])
      queueTable('koto_fitness_workout_logs', [
        {
          data: [
            { session_day_number: 1, exercise_id: 'squat' },
            { session_day_number: 1, exercise_id: 'squat' },
            { session_day_number: 2, exercise_id: 'dead' },
          ],
          error: null,
        },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'compute_adherence', plan_id: 'plan-1' }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.scheduled_sessions).toBe(4)
      expect(body.logged_sessions).toBe(2)
      expect(body.adherence_pct).toBe(50)
      expect(
        body.per_exercise.find(
          (p: { exercise_id: string }) => p.exercise_id === 'squat',
        ),
      ).toEqual({ exercise_id: 'squat', scheduled_sets: 3, logged_sets: 2 })
    })
  })
})
