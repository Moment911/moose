import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — POST /api/trainer/generate route tests.
//
// Mirrors tests/trainer/phase1/traineesRoute.test.ts:
//   - chainable Supabase query-builder mock (each method returns `this`,
//     terminators resolve against a programmable response)
//   - verifySession + assertFitnessCoachEnabled + callSonnet all mocked so
//     the test never touches the network
//   - all six Sonnet prompt modules stubbed with minimal builder stubs
//
// Coverage: auth (401), feature-flag gate (404), unknown action (400),
// happy path + validation paths for each of the 7 actions.
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase mock — chainable query builder ─────────────────────────────────
type MockResponse = { data?: unknown; error?: { message: string } | null }

const qState: {
  calls: Array<{ table: string; op: string; row?: unknown }>
  // Per-table response queue — shift() on each terminator.  Falls back to
  // the generic `response` when a table has no entry.
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

// ── Feature-flag helper ────────────────────────────────────────────────────
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

// ── verifySession mock ─────────────────────────────────────────────────────
const mockVerify = vi.fn()
vi.mock('../../../src/lib/apiAuth', () => ({
  verifySession: (...a: unknown[]) => mockVerify(...a),
}))

// ── Sonnet runner mock ─────────────────────────────────────────────────────
const mockSonnet = vi.fn()
vi.mock('../../../src/lib/trainer/sonnetRunner', () => ({
  callSonnet: (...a: unknown[]) => mockSonnet(...a),
}))

// ── Prompt-module stubs ────────────────────────────────────────────────────
// Each build*Prompt returns a { systemPrompt, userMessage } pair the route
// just threads through to callSonnet.  The *Tool is a Sonnet tool schema;
// only its `name` is inspected by the route, so an empty schema is fine.
const stubTool = (name: string) => ({
  name,
  description: `${name} stub`,
  input_schema: { type: 'object', properties: {}, required: [] },
})
const stubBuilder = () => ({ systemPrompt: 'sys', userMessage: 'msg' })

vi.mock('../../../src/lib/trainer/prompts/baseline', () => ({
  buildBaselinePrompt: stubBuilder,
  baselineTool: stubTool('record_baseline'),
}))
vi.mock('../../../src/lib/trainer/prompts/roadmap', () => ({
  buildRoadmapPrompt: stubBuilder,
  roadmapTool: stubTool('record_roadmap'),
}))
vi.mock('../../../src/lib/trainer/prompts/workout', () => ({
  buildWorkoutPrompt: stubBuilder,
  workoutTool: stubTool('record_workout_plan'),
}))
vi.mock('../../../src/lib/trainer/prompts/foodPrefs', () => ({
  buildFoodPrefsPrompt: stubBuilder,
  foodPrefsTool: stubTool('record_food_preferences_questions'),
}))
vi.mock('../../../src/lib/trainer/prompts/meals', () => ({
  buildMealsPrompt: stubBuilder,
  mealsTool: stubTool('record_meal_plan'),
}))
vi.mock('../../../src/lib/trainer/prompts/adjust', () => ({
  buildAdjustPrompt: stubBuilder,
}))

// ── Request helper ─────────────────────────────────────────────────────────
function mkReq(body: Record<string, unknown>): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request
}

function reset() {
  mockVerify.mockReset()
  mockAssertFlag.mockReset()
  mockSonnet.mockReset()
  qState.calls = []
  qState.tableResponses = {}
  qState.response = { data: null, error: null }
  qState.insertedRow = undefined
  qState.updatedRow = undefined
  qState.lastTable = null
}

async function importRoute() {
  return import('../../../src/app/api/trainer/generate/route')
}

// Shorthand: queue responses for a table in call order.
function queueTable(table: string, responses: MockResponse[]) {
  qState.tableResponses[table] = [...responses]
}

describe('POST /api/trainer/generate', () => {
  beforeEach(() => reset())

  describe('auth', () => {
    it('401 when session not verified', async () => {
      mockVerify.mockResolvedValue({ verified: false, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'generate_baseline' }) as never)
      expect(res.status).toBe(401)
    })

    it('401 when verified but agencyId missing', async () => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: null })
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'generate_baseline' }) as never)
      expect(res.status).toBe(401)
    })
  })

  describe('body + action validation', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 on invalid JSON', async () => {
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
      const res = await POST(mkReq({ action: 'nuke_orbit' }) as never)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.allowed_actions).toBeTruthy()
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
      const res = await POST(
        mkReq({ action: 'generate_baseline', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('500 when flag lookup fails with unexpected error', async () => {
      mockAssertFlag.mockRejectedValue(new Error('db blew up'))
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'generate_baseline', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(500)
    })
  })

  describe('generate_baseline', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when trainee_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(mkReq({ action: 'generate_baseline' }) as never)
      expect(res.status).toBe(400)
    })

    it('404 when trainee not found', async () => {
      queueTable('koto_fitness_trainees', [{ data: null, error: null }])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'generate_baseline', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('502 when Sonnet errors', async () => {
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      mockSonnet.mockResolvedValue({
        ok: false,
        error: 'anthropic_http_500',
        status: 502,
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'generate_baseline', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(502)
    })

    it('happy path: inserts plan + returns plan_id + baseline', async () => {
      const baseline = {
        training_readiness: { ok_to_train: true, red_flags: [] },
        bmr: 1800,
      }
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        { data: { id: 'plan-1' }, error: null },
      ])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: baseline,
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'generate_baseline', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.plan_id).toBe('plan-1')
      expect(body.baseline).toEqual(baseline)
      // Inserted row should pin agency_id from session
      const inserted = qState.insertedRow as { agency_id: string; block_number: number }
      expect(inserted.agency_id).toBe('agency-A')
      expect(inserted.block_number).toBe(1)
    })

    it('short-circuits when training_readiness.ok_to_train === false', async () => {
      const baseline = {
        training_readiness: {
          ok_to_train: false,
          red_flags: ['recent_surgery'],
        },
      }
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        { data: { id: 'plan-1' }, error: null },
      ])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: baseline,
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'generate_baseline', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok_to_train).toBe(false)
      expect(body.red_flags).toEqual(['recent_surgery'])
    })
  })

  describe('generate_roadmap', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when plan_id missing', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({ action: 'generate_roadmap', trainee_id: 't1' }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('404 when plan not found for this agency', async () => {
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [{ data: null, error: null }])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_roadmap',
          trainee_id: 't1',
          plan_id: 'plan-1',
        }) as never,
      )
      expect(res.status).toBe(404)
    })

    it('happy path: updates plan + returns roadmap', async () => {
      const roadmap = { phases: [{ phase: 1 }, { phase: 2 }, { phase: 3 }] }
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            block_number: 1,
            baseline: { training_readiness: { ok_to_train: true } },
          },
          error: null,
        },
      ])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: roadmap,
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_roadmap',
          trainee_id: 't1',
          plan_id: 'plan-1',
        }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.roadmap).toEqual(roadmap)
      const updated = qState.updatedRow as { roadmap: unknown }
      expect(updated.roadmap).toEqual(roadmap)
    })
  })

  describe('generate_workout', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when phase invalid', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_workout',
          trainee_id: 't1',
          plan_id: 'plan-1',
          phase: 9,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('400 when baseline missing on plan', async () => {
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            baseline: null,
            roadmap: { phases: [] },
          },
          error: null,
        },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_workout',
          trainee_id: 't1',
          plan_id: 'plan-1',
          phase: 1,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('happy path: updates workout_plan + phase_ref + flips trainee status', async () => {
      const workout = { sessions: [] }
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            baseline: { training_readiness: { ok_to_train: true } },
            roadmap: { phases: [] },
          },
          error: null,
        },
      ])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: workout,
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_workout',
          trainee_id: 't1',
          plan_id: 'plan-1',
          phase: 1,
        }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.workout_plan).toEqual(workout)

      // Both plan + trainee tables should have been .update()-ed.  The
      // last .update() the test saw should include status=plan_generated
      // (the trainee-status flip runs after the plan update).
      const traineeUpdate = qState.calls
        .filter((c) => c.table === 'koto_fitness_trainees' && c.op === 'update')
        .map((c) => c.row as { status?: string })
      expect(traineeUpdate.some((r) => r.status === 'plan_generated')).toBe(true)
    })
  })

  describe('elicit_food_prefs + submit_food_prefs', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('elicit: happy path returns questions', async () => {
      const questions = [{ question_id: 'q1', prompt: 'Allergies?' }]
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            baseline: { training_readiness: { ok_to_train: true } },
          },
          error: null,
        },
      ])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: { questions },
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'elicit_food_prefs',
          trainee_id: 't1',
          plan_id: 'plan-1',
        }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.questions).toEqual(questions)
    })

    it('submit: 400 when answers not array', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'submit_food_prefs',
          trainee_id: 't1',
          plan_id: 'plan-1',
          answers: 'nope',
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('submit: 400 when entry missing question_id', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'submit_food_prefs',
          trainee_id: 't1',
          plan_id: 'plan-1',
          answers: [{ answer: 'ok' }],
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('submit: happy path stores answers', async () => {
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            food_preferences: { questions: [{ question_id: 'q1' }], answers: null },
          },
          error: null,
        },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'submit_food_prefs',
          trainee_id: 't1',
          plan_id: 'plan-1',
          answers: [{ question_id: 'q1', answer: 'none' }],
        }) as never,
      )
      expect(res.status).toBe(200)
      const updated = qState.updatedRow as {
        food_preferences: { answers: Array<{ question_id: string }> }
      }
      expect(updated.food_preferences.answers[0].question_id).toBe('q1')
    })
  })

  describe('generate_meals', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when answers not yet submitted', async () => {
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            baseline: { training_readiness: { ok_to_train: true } },
            food_preferences: { questions: [{ question_id: 'q1' }], answers: null },
          },
          error: null,
        },
      ])
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_meals',
          trainee_id: 't1',
          plan_id: 'plan-1',
        }) as never,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('answers_not_submitted')
    })

    it('happy path: persists meal_plan + grocery_list', async () => {
      // Mirrors MealsOutput shape from prompts/meals.ts: weeks + grocery_list
      // as siblings.  Route splits grocery_list out, keeps rest as meal_plan.
      const meals = {
        plan_name: 'Test Plan',
        weeks: [],
        grocery_list: { organized_by_aisle: [{ aisle: 'produce', items: [] }] },
        disclaimer: 'Not medical advice.',
      }
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            baseline: { training_readiness: { ok_to_train: true } },
            food_preferences: {
              questions: [{ question_id: 'q1' }],
              answers: [{ question_id: 'q1', answer: 'ok' }],
            },
          },
          error: null,
        },
      ])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: meals,
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'generate_meals',
          trainee_id: 't1',
          plan_id: 'plan-1',
        }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      // meal_plan envelope keeps everything except grocery_list
      expect(body.meal_plan.plan_name).toBe('Test Plan')
      expect(body.meal_plan.weeks).toEqual([])
      expect(body.meal_plan.grocery_list).toBeUndefined()
      // grocery_list lives in its own column
      expect(body.grocery_list).toEqual({
        organized_by_aisle: [{ aisle: 'produce', items: [] }],
      })
    })
  })

  describe('adjust_block', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-A' })
      mockAssertFlag.mockResolvedValue(undefined)
    })

    it('400 when next_phase invalid', async () => {
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'adjust_block',
          trainee_id: 't1',
          prior_plan_id: 'plan-1',
          next_phase: 99,
        }) as never,
      )
      expect(res.status).toBe(400)
    })

    it('happy path: inserts new plan row at block_number+1', async () => {
      const newWorkout = { sessions: [] }
      const adjustments = [{ change: 'reduce_volume' }]
      queueTable('koto_fitness_trainees', [
        { data: { id: 't1', agency_id: 'agency-A' }, error: null },
      ])
      queueTable('koto_fitness_plans', [
        {
          // prior plan
          data: {
            id: 'plan-1',
            agency_id: 'agency-A',
            trainee_id: 't1',
            block_number: 1,
            baseline: { training_readiness: { ok_to_train: true } },
            roadmap: { phases: [] },
            workout_plan: {
              sessions: [
                { day_number: 1, exercises: [] },
                { day_number: 2, exercises: [] },
              ],
            },
          },
          error: null,
        },
        // insert of new plan row
        { data: { id: 'plan-2' }, error: null },
      ])
      queueTable('koto_fitness_workout_logs', [{ data: [], error: null }])
      mockSonnet.mockResolvedValue({
        ok: true,
        data: { workout_plan: newWorkout, adjustments_made: adjustments },
        usage: { inputTokens: 1, outputTokens: 1 },
      })
      const { POST } = await importRoute()
      const res = await POST(
        mkReq({
          action: 'adjust_block',
          trainee_id: 't1',
          prior_plan_id: 'plan-1',
          next_phase: 2,
        }) as never,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.new_plan_id).toBe('plan-2')
      expect(body.workout_plan).toEqual(newWorkout)
      expect(body.adjustments_made).toEqual(adjustments)
      const inserted = qState.insertedRow as {
        block_number: number
        phase_ref: number
      }
      expect(inserted.block_number).toBe(2)
      expect(inserted.phase_ref).toBe(2)
    })
  })
})
