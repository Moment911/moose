---
phase: trainer-01-intake-and-dispatcher
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/trainer/intakeSchema.ts
  - src/lib/trainer/featureFlag.ts
  - src/app/api/trainer/trainees/route.ts
  - tests/trainer/phase1/traineesRoute.test.ts
  - tests/trainer/phase1/intakeSchema.test.ts
autonomous: false
requirements: []
tags: [trainer, api, dispatcher, feature-flag, zod]

must_haves:
  truths:
    - "POST /api/trainer/trainees with action='create' + valid intake persists a row scoped to the session's agency_id"
    - "POST /api/trainer/trainees from an agency whose features.fitness_coach !== 'true' returns 404 for every action"
    - "POST /api/trainer/trainees?action=get with a trainee_id belonging to a DIFFERENT agency returns 404 (not 403)"
    - "body.agency_id is silently ignored — agencyId comes only from verifySession"
    - "Zod intakeSchema validates a good payload and rejects a missing-required-field payload with per-field error messages"
    - "archive sets archived_at and status='archived'; list with archived=false filters them out"
  artifacts:
    - path: "src/lib/trainer/intakeSchema.ts"
      provides: "Zod schema for trainee intake (shared between route + UI)"
      contains: "intakeSchema"
    - path: "src/lib/trainer/featureFlag.ts"
      provides: "assertFitnessCoachEnabled(db, agencyId) helper — throws 404-shape if flag off"
      contains: "fitness_coach"
    - path: "src/app/api/trainer/trainees/route.ts"
      provides: "JSON dispatcher with 6 actions (list/get/create/update/archive/unarchive)"
      contains: "verifySession"
    - path: "tests/trainer/phase1/traineesRoute.test.ts"
      provides: "Per-action auth + feature-flag + cross-agency tests"
    - path: "tests/trainer/phase1/intakeSchema.test.ts"
      provides: "Schema happy path + per-field rejection tests"
  key_links:
    - from: "src/app/api/trainer/trainees/route.ts"
      to: "src/lib/trainer/featureFlag.ts"
      via: "assertFitnessCoachEnabled called before every ALLOWED_ACTIONS switch"
      pattern: "assertFitnessCoachEnabled"
    - from: "src/app/api/trainer/trainees/route.ts"
      to: "src/lib/trainer/intakeSchema.ts"
      via: "create + update actions parse body through intakeSchema"
      pattern: "intakeSchema"
---

<objective>
Ship the agency-facing API for Trainer Phase 1: a single JSON dispatcher at `/api/trainer/trainees` with 6 actions (list/get/create/update/archive/unarchive), feature-flag gated on `agencies.features->>fitness_coach = 'true'`, agency-isolated, with a shared Zod intake schema that Plan 03's intake form reuses.

**Purpose:** This is the full surface an operator needs to manage trainees in Phase 1. Plan 03's UI consumes every action. Phase 2's generate route adds actions on a separate `/api/trainer/generate` endpoint — it does not mutate this file.

**Output:** Zod schema, feature-flag assertion helper, Next.js route handler, and tests proving auth / feature-flag / cross-agency isolation all hold.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-CONTEXT.md
@.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-01-PLAN.md
@src/app/api/kotoiq/profile/route.ts
@src/lib/apiAuth.ts
@AGENTS.md

<interfaces>
<!-- Canonical route-handler pattern inherited from Phase 7 -->

From `src/app/api/kotoiq/profile/route.ts`:
```ts
export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_ACTIONS = ['list', 'get', 'create', 'update', 'archive', 'unarchive'] as const
type Action = typeof ALLOWED_ACTIONS[number]

export async function POST(req: NextRequest) {
  const session = await verifySession(req)
  if (!session.verified || !session.agencyId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { action, ...args } = await req.json()
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }
  // ... feature-flag gate, then action switch ...
}
```

From Plan 01 schema — intake columns the create action writes (full list in CONTEXT D-15):
- `full_name` (required)
- All other fields optional but CHECK-constrained

Zod schema shape (Plan 02 authors it):
```ts
export const intakeSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  age: z.number().int().positive().optional(),
  sex: z.string().optional(),
  height_cm: z.number().positive().optional(),
  current_weight_kg: z.number().positive().optional(),
  target_weight_kg: z.number().positive().optional(),
  primary_goal: z.enum(['lose_fat','gain_muscle','maintain','performance','recomp']).optional(),
  training_experience_years: z.number().nonnegative().optional(),
  training_days_per_week: z.number().int().min(0).max(7).optional(),
  equipment_access: z.enum(['none','bands','home_gym','full_gym']).optional(),
  medical_flags: z.string().optional(),
  injuries: z.string().optional(),
  pregnancy_or_nursing: z.boolean().optional(),
  dietary_preference: z.enum(['none','vegetarian','vegan','pescatarian','keto','paleo','custom']).optional(),
  allergies: z.string().optional(),
  grocery_budget_usd_per_week: z.number().nonnegative().optional(),
  meals_per_day: z.number().int().min(3).max(6).optional(),
  sleep_hours_avg: z.number().nonnegative().optional(),
  stress_level: z.number().int().min(1).max(10).optional(),
  occupation_activity: z.enum(['sedentary','light','moderate','heavy']).optional(),
  trainer_notes: z.string().optional(),
})
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: intakeSchema.ts — Zod intake contract</name>
  <files>src/lib/trainer/intakeSchema.ts, tests/trainer/phase1/intakeSchema.test.ts</files>
  <read_first>
    - CONTEXT D-15 (field enumeration) + D-11 (Zod validation rule)
    - `src/lib/kotoiq/profileTypes.ts` for Zod patterns Koto already uses
  </read_first>
  <behavior>
    - Export `intakeSchema` (Zod object per interfaces block)
    - Export `IntakeInput` (inferred type) for UI consumers
    - Export `intakeSchemaPartial` (all fields optional) for the `update` action's partial payloads
    - Test: valid payload parses; missing `full_name` rejects with `'full_name'` in issues path; bad enum rejects with enum path
  </behavior>
  <action>
Write `src/lib/trainer/intakeSchema.ts` per the Interfaces block. Add Vitest spec in `tests/trainer/phase1/intakeSchema.test.ts` with 3-4 happy-path and edge cases.
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 2: featureFlag.ts — agencies.features->>fitness_coach gate</name>
  <files>src/lib/trainer/featureFlag.ts</files>
  <read_first>
    - CONTEXT D-09 (404 not 403) + D-18 (defense-in-depth)
    - `src/lib/apiAuth.ts` — understand what `verifySession` returns so the helper signature fits
  </read_first>
  <behavior>
    - Export `async function assertFitnessCoachEnabled(supabase, agencyId): Promise<void>`
    - Reads `agencies.features` for `agencyId`; if `features?.fitness_coach !== true` → throws `new Error('not_found')` with a sentinel the route handler maps to HTTP 404
    - Caches nothing — every request checks live DB state so Koto admin flag flips take effect immediately
  </behavior>
  <action>
Write `src/lib/trainer/featureFlag.ts` as a pure helper consuming the Supabase client + agencyId. Return type is `void` on success; throw a tagged error on fail. Route handler wraps this in a try/catch → 404.
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 3: /api/trainer/trainees/route.ts — 6-action dispatcher</name>
  <files>src/app/api/trainer/trainees/route.ts, tests/trainer/phase1/traineesRoute.test.ts</files>
  <read_first>
    - CONTEXT §decisions D-08 through D-12
    - `src/app/api/kotoiq/profile/route.ts` lines 1-200 for exact dispatcher pattern (verifySession → ALLOWED_ACTIONS → body.agency_id ignore → 404-not-403)
    - Next.js App Router docs: https://nextjs.org/docs/app/api-reference/file-conventions/route — open at implementation time to verify current signatures
  </read_first>
  <behavior>
    - `export const runtime = 'nodejs'` + `export const maxDuration = 60`
    - POST handler runs `verifySession` FIRST; 401 if not verified
    - Runs `assertFitnessCoachEnabled`; catches sentinel → 404
    - Validates `action` against `ALLOWED_ACTIONS = ['list','get','create','update','archive','unarchive']`
    - Every query uses Supabase client with explicit `.eq('agency_id', session.agencyId)` — feature flag sentinel AND query-level isolation are both required
    - `list` — args: `{ archived?: boolean }` default false. Returns `{ trainees: [...] }` ordered by `created_at DESC`
    - `get` — args: `{ trainee_id }`. Returns trainee row or 404 if not found or cross-agency
    - `create` — args: intakeSchema payload. Inserts row + returns `{ trainee_id }`. On Zod parse fail → 400 with Zod issues
    - `update` — args: `{ trainee_id, patch: Partial<IntakeInput> }`. Parses patch against `intakeSchemaPartial`; updates matching row scoped by agency_id + trainee_id
    - `archive` — args: `{ trainee_id }`. Sets `archived_at = now()` + `status = 'archived'`
    - `unarchive` — args: `{ trainee_id }`. Clears `archived_at` + resets status based on presence of a generated plan (Phase 2 concern — Phase 1 just sets `status = 'intake_complete'`)
    - All error shapes: `NextResponse.json({ error: '<code>' }, { status: <code> })`. Codes: `unauthorized`, `feature_disabled` (but returned as 404 body `{ error: 'not_found' }`), `unknown_action`, `invalid_payload`, `not_found`, `internal_error`
  </behavior>
  <action>
Write the route handler mirroring `src/app/api/kotoiq/profile/route.ts` structure. Six action handlers, each 5-15 lines. Use a Supabase server-side client created with service role if that matches Koto's existing route-handler convention (confirm from `kotoiq/profile/route.ts` before writing).

Write `tests/trainer/phase1/traineesRoute.test.ts`:
- Agency A session + `fitness_coach: true` + create → 200, row visible
- Agency B session + `fitness_coach: false` + any action → 404
- Agency A gets trainee X (owned by A) → 200
- Agency B gets trainee X (owned by A) with `fitness_coach: true` → 404
- Bad `action` → 400
- `create` with `primary_goal: 'nope'` → 400 + Zod issues in body
- `body.agency_id: 'wrong'` is ignored → create still uses session agency
  </action>
</task>

</tasks>

<verification>
- `pnpm lint` passes (no new ESLint errors, including agency-isolation rules if they apply to non-kotoiq tables)
- `pnpm typecheck` passes
- `pnpm test tests/trainer/phase1/` all green
- Manual: hit `curl -X POST /api/trainer/trainees -d '{"action":"create","full_name":"Test"}'` with a session cookie for an agency that has `fitness_coach: true` → 200 + trainee persisted
- Manual: same curl with `fitness_coach: false` → 404
</verification>

<deviations_protocol>
- If Koto's existing auth pattern passes `agencyId` via a different mechanism than `verifySession(req).agencyId`, adapt the route signature to match — do NOT introduce a parallel auth pattern. The canonical reference is `src/app/api/kotoiq/profile/route.ts`
- If Koto already has a generic "is feature enabled" helper elsewhere (grep for `features->>` before writing), reuse it instead of creating `src/lib/trainer/featureFlag.ts`
- If the Zod version Koto uses has different API (`z.enum` vs `z.nativeEnum` vs `literal union`), match the existing Koto convention — consistency beats local preference
</deviations_protocol>
