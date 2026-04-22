import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — POST /api/trainer/my-plan tests.
//
// Trainee-facing route with its OWN auth path (verifyTraineeSession inside
// the route, not the shared verifySession). We mock the supabase client so
// auth.getUser + `.from(...)` both resolve against a programmable state.
// ─────────────────────────────────────────────────────────────────────────────

type MockResponse = { data?: unknown; error?: { message: string } | null }

const qState: {
  lastTable: string | null
  response: MockResponse
  tableResponses: Record<string, MockResponse[]>
  insertedRow: unknown
  updatedRow: unknown
  calls: Array<{ table: string; op: string; row?: unknown }>
  authUserResponse: { data: { user: { id: string } | null }; error: { message: string } | null }
} = {
  lastTable: null,
  response: { data: null, error: null },
  tableResponses: {},
  insertedRow: undefined,
  updatedRow: undefined,
  calls: [],
  authUserResponse: { data: { user: null }, error: null },
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
    limit: () => api,
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
  auth: {
    getUser: (_token: string) =>
      Promise.resolve({
        data: qState.authUserResponse.data,
        error: qState.authUserResponse.error,
      }),
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

function mkReq(body: Record<string, unknown>, token: string | null = 'valid-token'): Request {
  const h = new Headers()
  if (token) h.set('authorization', `Bearer ${token}`)
  return { json: async () => body, headers: h } as unknown as Request
}

function reset() {
  mockAssertFlag.mockReset()
  qState.lastTable = null
  qState.response = { data: null, error: null }
  qState.tableResponses = {}
  qState.insertedRow = undefined
  qState.updatedRow = undefined
  qState.calls = []
  qState.authUserResponse = { data: { user: null }, error: null }
  // Ensure bypass mode off in every test
  delete process.env.NEXT_PUBLIC_BYPASS_AUTH
}

function stubAuthedTrainee() {
  qState.authUserResponse = {
    data: { user: { id: 'user-abc' } },
    error: null,
  }
  // koto_fitness_trainee_users mapping lookup (first call in verifyTraineeSession)
  qState.tableResponses['koto_fitness_trainee_users'] = [
    {
      data: {
        trainee_id: 'trainee-1',
        agency_id: 'agency-A',
        disclaimer_ack_at: null,
        invite_status: 'active',
      },
      error: null,
    },
  ]
}

async function importRoute() {
  return import('../../../src/app/api/trainer/my-plan/route')
}

describe('POST /api/trainer/my-plan', () => {
  beforeEach(() => reset())

  describe('auth', () => {
    it('401 when Authorization header missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }, null) as never)
      expect(res.status).toBe(401)
    })

    it('401 when token does not resolve to a user', async () => {
      qState.authUserResponse = { data: { user: null }, error: { message: 'invalid token' } }
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(401)
    })

    it('404 when user has no trainee mapping (not 403)', async () => {
      qState.authUserResponse = { data: { user: { id: 'stranger' } }, error: null }
      qState.tableResponses['koto_fitness_trainee_users'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(404)
    })

    it('404 when mapping status=revoked', async () => {
      qState.authUserResponse = { data: { user: { id: 'user-x' } }, error: null }
      qState.tableResponses['koto_fitness_trainee_users'] = [
        {
          data: {
            trainee_id: 't1',
            agency_id: 'agency-A',
            disclaimer_ack_at: null,
            invite_status: 'revoked',
          },
          error: null,
        },
      ]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(404)
    })
  })

  describe('body + action validation', () => {
    beforeEach(() => {
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 on invalid JSON', async () => {
      stubAuthedTrainee()
      const { POST } = await importRoute()
      const badReq = {
        json: async () => {
          throw new Error('bad json')
        },
        headers: new Headers({ authorization: 'Bearer token' }),
      } as unknown as Request
      const res = await POST(badReq as never)
      expect(res.status).toBe(400)
    })

    it('400 on unknown action', async () => {
      stubAuthedTrainee()
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'delete_everything' }) as never)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.allowed_actions).toEqual(
        expect.arrayContaining(['get_my_plan', 'log_set', 'update_log']),
      )
    })
  })

  describe('feature-flag gate', () => {
    it('404 when fitness_coach disabled for the agency', async () => {
      stubAuthedTrainee()
      const { TrainerFeatureDisabledError } = await import(
        '../../../src/lib/trainer/featureFlag'
      )
      mockAssertFlag.mockRejectedValue(new TrainerFeatureDisabledError())
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(404)
    })

    it('500 when flag lookup fails unexpectedly', async () => {
      stubAuthedTrainee()
      mockAssertFlag.mockRejectedValue(new Error('db kaput'))
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(500)
    })
  })

  describe('get_my_plan', () => {
    beforeEach(() => {
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('returns plan + trainee + agency + invite meta', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_plans'] = [
        {
          data: {
            id: 'plan-1',
            block_number: 2,
            baseline: { calories: 2400 },
            workout_plan: { weeks: [] },
            food_preferences: null,
            meal_plan: null,
            grocery_list: null,
            roadmap: null,
            phase_ref: 1,
            playbook: null,
            adjustment_summary: null,
            generated_at: '2026-04-10T00:00:00Z',
            model: 'claude-sonnet-4',
          },
          error: null,
        },
      ]
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { full_name: 'Jane Runner', primary_goal: 'lose_fat' }, error: null },
      ]
      qState.tableResponses['agencies'] = [
        {
          data: {
            name: 'Coach Inc',
            brand_name: 'CoachCo',
            brand_color: '#123456',
            brand_logo_url: 'https://x.test/logo.png',
            support_email: 'coach@coach.test',
          },
          error: null,
        },
      ]
      // logs query returns empty
      qState.tableResponses['koto_fitness_workout_logs'] = [{ data: [], error: null }]

      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.plan.id).toBe('plan-1')
      expect(body.plan.block_number).toBe(2)
      expect(body.trainee.full_name).toBe('Jane Runner')
      expect(body.agency.name).toBe('CoachCo') // brand_name preferred
      expect(body.invite.status).toBe('active')
    })

    it('strips playbook.personal_closing_note.other_client_mentions', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_plans'] = [
        {
          data: {
            id: 'plan-1',
            block_number: 1,
            playbook: {
              personal_closing_note: {
                body: 'Great work',
                other_client_mentions: ['client-X', 'client-Y'],
              },
            },
          },
          error: null,
        },
      ]
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { full_name: 'Jane', primary_goal: null }, error: null },
      ]
      qState.tableResponses['agencies'] = [{ data: null, error: null }]
      qState.tableResponses['koto_fitness_workout_logs'] = [{ data: [], error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      const body = await res.json()
      expect(body.plan.playbook.personal_closing_note.other_client_mentions).toBeUndefined()
      expect(body.plan.playbook.personal_closing_note.body).toBe('Great work')
    })

    it('returns plan=null when trainee has no plan yet', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_plans'] = [{ data: null, error: null }]
      qState.tableResponses['koto_fitness_trainees'] = [
        { data: { full_name: 'Jane', primary_goal: null }, error: null },
      ]
      qState.tableResponses['agencies'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'get_my_plan' }) as never)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.plan).toBeNull()
    })
  })

  describe('log_set', () => {
    beforeEach(() => {
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when plan_id missing', async () => {
      stubAuthedTrainee()
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          session_day_number: 1,
          exercise_id: 'squat',
          exercise_name: 'Squat',
          set_number: 1,
          actual_reps: 10,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('400 on out-of-range session_day_number', async () => {
      stubAuthedTrainee()
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'p1',
          session_day_number: 99,
          exercise_id: 'squat',
          exercise_name: 'Squat',
          set_number: 1,
          actual_reps: 10,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('404 when plan belongs to a different agency', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_plans'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'p1',
          session_day_number: 1,
          exercise_id: 'squat',
          exercise_name: 'Squat',
          set_number: 1,
          actual_reps: 10,
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('404 when plan belongs to a different trainee', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_plans'] = [
        { data: { id: 'p1', trainee_id: 'someone-else' }, error: null },
      ]
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'p1',
          session_day_number: 1,
          exercise_id: 'squat',
          exercise_name: 'Squat',
          set_number: 1,
          actual_reps: 10,
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('201 on success + inserts with trainee_id from session (not body)', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_plans'] = [
        { data: { id: 'p1', trainee_id: 'trainee-1' }, error: null },
      ]
      qState.tableResponses['koto_fitness_workout_logs'] = [
        { data: { id: 'log-xyz' }, error: null },
      ]
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'log_set',
          plan_id: 'p1',
          trainee_id: 'HIJACK-trainee',  // should be ignored
          session_day_number: 3,
          exercise_id: 'deadlift',
          exercise_name: 'Deadlift',
          set_number: 2,
          actual_reps: 8,
          actual_weight_kg: 120,
          rpe: 8,
        }) as never,
      )
      expect(res.status).toBe(201)
      const inserted = qState.insertedRow as {
        trainee_id: string
        agency_id: string
        plan_id: string
        actual_reps: number
      }
      expect(inserted.trainee_id).toBe('trainee-1') // from session, not body
      expect(inserted.agency_id).toBe('agency-A')
      expect(inserted.plan_id).toBe('p1')
      expect(inserted.actual_reps).toBe(8)
    })
  })

  describe('update_log', () => {
    beforeEach(() => {
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when log_id missing', async () => {
      stubAuthedTrainee()
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'update_log', patch: { actual_reps: 10 } }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('400 when patch empty', async () => {
      stubAuthedTrainee()
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'update_log', log_id: 'log-1', patch: {} }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('404 when log belongs to another trainee', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_workout_logs'] = [{ data: null, error: null }]
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update_log',
          log_id: 'log-1',
          patch: { actual_reps: 10 },
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('200 on success', async () => {
      stubAuthedTrainee()
      qState.tableResponses['koto_fitness_workout_logs'] = [
        { data: { id: 'log-1' }, error: null },
      ]
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'update_log',
          log_id: 'log-1',
          patch: { actual_reps: 12, rpe: 9 },
        }) as never,
      )
      expect(res.status).toBe(200)
      const upd = qState.updatedRow as { actual_reps: number; rpe: number }
      expect(upd.actual_reps).toBe(12)
      expect(upd.rpe).toBe(9)
    })
  })
})
