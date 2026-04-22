---
phase: trainer-01-intake-and-dispatcher
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/views/trainer/TrainerListPage.jsx
  - src/views/trainer/TrainerIntakePage.jsx
  - src/views/trainer/TrainerDetailPage.jsx
  - src/components/trainer/IntakeForm.jsx
  - src/app/App.jsx
  - src/components/Sidebar.jsx
  - tests/trainer/phase1/sidebarFeatureFlag.test.tsx
  - tests/trainer/phase1/intakeForm.test.tsx
autonomous: false
requirements: []
tags: [trainer, ui, sidebar, intake-form, feature-flag]

must_haves:
  truths:
    - "Sidebar renders a 'Trainer' item only when the session's agency.features.fitness_coach === true"
    - "/trainer renders TrainerListPage which calls POST /api/trainer/trainees action=list"
    - "/trainer/new renders TrainerIntakePage with IntakeForm bound to intakeSchema"
    - "/trainer/:traineeId renders TrainerDetailPage stub (Phase 2 placeholder)"
    - "IntakeForm submit calls POST /api/trainer/trainees action=create and redirects to /trainer on success"
    - "IntakeForm surfaces Zod validation errors inline per field"
    - "Attempting to visit /trainer without the feature flag shows the 404 the API returns (no UI crash)"
  artifacts:
    - path: "src/views/trainer/TrainerListPage.jsx"
      provides: "Trainee list view at /trainer"
    - path: "src/views/trainer/TrainerIntakePage.jsx"
      provides: "Intake wizard at /trainer/new"
    - path: "src/views/trainer/TrainerDetailPage.jsx"
      provides: "Phase 1 stub at /trainer/:traineeId"
    - path: "src/components/trainer/IntakeForm.jsx"
      provides: "Reusable intake form bound to intakeSchema"
    - path: "src/app/App.jsx"
      provides: "Three new route registrations"
      contains: "/trainer"
    - path: "src/components/Sidebar.jsx"
      provides: "Feature-flag-gated Trainer entry"
      contains: "fitness_coach"
  key_links:
    - from: "src/components/Sidebar.jsx"
      to: "src/hooks/useAuth.jsx"
      via: "reads auth.agency.features.fitness_coach"
      pattern: "features?.fitness_coach"
    - from: "src/components/trainer/IntakeForm.jsx"
      to: "src/lib/trainer/intakeSchema.ts"
      via: "form validates against intakeSchema before submit"
      pattern: "intakeSchema"
---

<objective>
Ship the agency-facing UI for Trainer Phase 1: sidebar entry (feature-flag gated), trainee list, intake form, and a stub detail page. After this plan an operator on an agency with `fitness_coach: true` can manage trainees end-to-end; an operator on an agency without the flag never sees the feature exists.

**Purpose:** Completes Phase 1. Closes the loop between Plan 01's schema and Plan 02's API. Phase 2 adds the `/trainer/:traineeId` plan view; this plan ships the stub so routing works the moment Phase 2 lands.

**Output:** Three view components, one reusable intake form component, route registrations in `App.jsx`, a feature-flag-gated sidebar entry, and component tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-CONTEXT.md
@.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-02-PLAN.md
@src/app/App.jsx
@src/components/Sidebar.jsx
@src/hooks/useAuth.jsx
@src/views/OnboardingPage.jsx
@src/views/ClientsPage.jsx
@AGENTS.md

<interfaces>
<!-- Patterns this plan must match -->

From `src/app/App.jsx` (existing route registration pattern): follow whatever shape ClientsPage + OnboardingPage currently use. Do NOT introduce a new routing library or wrapper.

From `src/components/Sidebar.jsx` (existing pattern): follow whatever shape the existing sidebar items use. Feature flag read from `useAuth()` hook:
```jsx
const { agency } = useAuth()
const showTrainer = agency?.features?.fitness_coach === true
// ... inside render, conditional on showTrainer
```

From `src/hooks/useAuth.jsx`: this hook must expose `agency.features`. If it currently doesn't, Plan 03 extends the hook to include the `features` column from the agency row fetched at session boot. If a separate session-loader file populates auth context, extend THAT file.

Fetch pattern (matches Koto client-side convention):
```jsx
const resp = await fetch('/api/trainer/trainees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'list', archived: false }),
})
const data = await resp.json()
// If resp.status === 404 → feature disabled or route gate tripped. Show empty state.
```

Intake form layout (v1 — one-column form, no multi-step wizard):
- Section 1: Identity (name, email, phone)
- Section 2: About you (age, sex, height, current weight, target weight)
- Section 3: Your goal (primary_goal radio + training_experience_years + training_days_per_week + equipment_access)
- Section 4: Health check (medical_flags textarea, injuries textarea, pregnancy toggle, sleep_hours, stress_level)
- Section 5: Food (dietary_preference radio, allergies, meals_per_day, grocery_budget)
- Section 6: Lifestyle (occupation_activity)
- Section 7: Trainer notes (agency-internal)
- Disclaimer pinned at top: "Not medical advice. Trainer consult your physician." (CONTEXT D-20)
- Submit button bottom-right; shows per-field Zod error inline next to the field on fail
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend useAuth (or session loader) to expose agency.features</name>
  <files>src/hooks/useAuth.jsx (or whatever file currently loads the agency row)</files>
  <read_first>
    - CONTEXT D-14 (sidebar must read flag without flicker — loaded at session boot)
    - Existing `useAuth.jsx` — understand what it already fetches
  </read_first>
  <behavior>
    - `useAuth()` return value includes `agency: { id, name, features: {...} }`
    - If session load already fetches the agency row, add `features` to the select list
    - If `features` is null / undefined (e.g. old agency row pre-migration), treat as `{}` — never crash on missing field
  </behavior>
  <action>
Locate the exact file where the agency row is loaded at session boot. Extend the Supabase select to include `features`. If auth context shape needs to change, update consumers — but most should just read the new field.
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Sidebar — feature-flag-gated Trainer entry</name>
  <files>src/components/Sidebar.jsx, tests/trainer/phase1/sidebarFeatureFlag.test.tsx</files>
  <read_first>
    - CONTEXT D-14 + D-18
    - Existing `Sidebar.jsx` to match icon + style conventions
  </read_first>
  <behavior>
    - New sidebar item "Trainer" renders ONLY when `agency?.features?.fitness_coach === true`
    - When flag is false or undefined, item is entirely absent from DOM (no `display: none` — not rendered at all)
    - Icon follows Sidebar.jsx's existing icon convention (lucide? heroicons? match whatever is in use)
    - Link target: `/trainer`
  </behavior>
  <action>
Edit `Sidebar.jsx` adding the conditional item. Use the simplest working pattern — a `{showTrainer && <SidebarItem ... />}` wrapper.

Write `tests/trainer/phase1/sidebarFeatureFlag.test.tsx`:
- Render Sidebar with `agency.features.fitness_coach = true` → item visible
- Render with `agency.features.fitness_coach = false` → item NOT in DOM
- Render with `agency.features = {}` → item NOT in DOM
- Render with `agency.features = undefined` → item NOT in DOM (no crash)
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 3: IntakeForm component + intake page</name>
  <files>src/components/trainer/IntakeForm.jsx, src/views/trainer/TrainerIntakePage.jsx, tests/trainer/phase1/intakeForm.test.tsx</files>
  <read_first>
    - CONTEXT D-15 (field list) + D-20 (disclaimer copy)
    - Plan 02 `src/lib/trainer/intakeSchema.ts` — reuse the Zod schema for client-side validation
    - Existing Koto form patterns (`OnboardingPage.jsx`, `KotoProposalBuilderPage.jsx`) for styling + validation idioms
  </read_first>
  <behavior>
    - IntakeForm accepts `onSubmit(values: IntakeInput)` callback
    - Uses `intakeSchema.safeParse(values)` on submit — surfaces errors per field
    - Disclaimer visible above first field
    - All enum fields rendered as radio groups (not dropdowns) for quicker eyeballing
    - Required fields marked with a small asterisk; only `full_name` is required in Phase 1
    - Submit button disabled while in-flight; spinner shown
    - On success (200 from API): redirect to `/trainer` using Koto's existing router primitive (match whatever App.jsx routes use)
    - On 404 (feature disabled): show message "Trainer module is not enabled for your agency. Contact Koto support."
    - On 400 (Zod error from server): merge server errors into local form error state
  </behavior>
  <action>
Create `src/components/trainer/IntakeForm.jsx` as a controlled form. Create `src/views/trainer/TrainerIntakePage.jsx` as a thin wrapper that renders IntakeForm + handles fetch + redirect.

Write `tests/trainer/phase1/intakeForm.test.tsx`:
- Renders all 7 sections
- Submits empty → inline error on full_name
- Submits valid minimum (only full_name) → onSubmit called with the value
- Submits with primary_goal='bad' (forced into state) → inline error on primary_goal
- Fetch mock returns 404 → shows feature-disabled message
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 4: TrainerListPage</name>
  <files>src/views/trainer/TrainerListPage.jsx</files>
  <read_first>
    - CONTEXT D-16 (column list)
    - `src/views/ClientsPage.jsx` for table styling + loading states
  </read_first>
  <behavior>
    - On mount: POST /api/trainer/trainees action=list
    - Renders table: name, goal, age, days/week, created_at, status badge
    - Status badge colors: `intake_complete` = neutral, `plan_generated` = green, `archived` = gray
    - Row click navigates to `/trainer/:traineeId`
    - "Add Trainee" button top-right → `/trainer/new`
    - Empty state: "No trainees yet. Click Add Trainee to get started."
    - 404 response: same "Trainer module is not enabled" message as IntakeForm
    - No archived trainees by default; add a "Show archived" toggle top-right that re-fetches with `archived: true`
  </behavior>
  <action>
Create `src/views/trainer/TrainerListPage.jsx`. Match ClientsPage.jsx structure (fetch on mount, loading → list → empty state flow).
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 5: TrainerDetailPage stub</name>
  <files>src/views/trainer/TrainerDetailPage.jsx</files>
  <read_first>
    - CONTEXT "Explicit non-goals for Phase 1" — no plan view yet
  </read_first>
  <behavior>
    - Reads `traineeId` from route params
    - POST /api/trainer/trainees action=get with the traineeId — displays name + intake summary
    - Big placeholder panel: "Plan generation lands in Phase 2." with a disabled "Generate Plan" button
    - Archive + Unarchive buttons wired to the API
    - 404 handling same as list page
  </behavior>
  <action>
Create `src/views/trainer/TrainerDetailPage.jsx` as a minimal intake summary + stub panel. Design signal: the page should feel intentionally incomplete so an operator expects the Phase 2 upgrade rather than thinking the product is broken.
  </action>
</task>

<task type="auto" tdd="false">
  <name>Task 6: Register routes in App.jsx</name>
  <files>src/app/App.jsx</files>
  <read_first>
    - Existing App.jsx route registration conventions
    - CONTEXT D-13
  </read_first>
  <behavior>
    - `/trainer` → `<TrainerListPage />`
    - `/trainer/new` → `<TrainerIntakePage />`
    - `/trainer/:traineeId` → `<TrainerDetailPage />`
    - Routes only hit the page components — feature-flag gating happens server-side (404) and on the sidebar
  </behavior>
  <action>
Edit `src/app/App.jsx` adding the three routes. Do not alter any existing route. Import the three view components.
  </action>
</task>

</tasks>

<verification>
- `pnpm lint` passes
- `pnpm typecheck` passes (JSX + TS files)
- `pnpm test tests/trainer/phase1/` all green
- Manual dev-server walkthrough (per CLAUDE.md UI rule): start dev server, toggle `fitness_coach: true` on your dev agency via SQL, log in, confirm sidebar shows Trainer, navigate to /trainer, click Add Trainee, submit valid intake, see it appear in list, click it, see stub detail page, archive, see it disappear, toggle archived filter, see it reappear.
- Manual negative: set `fitness_coach: false`, confirm sidebar hides the entry, direct-navigate to /trainer → shows feature-disabled message (not a crash)
</verification>

<deviations_protocol>
- If Koto uses a form library (`react-hook-form`, `formik`, something custom) in OnboardingPage.jsx, reuse it — do NOT hand-roll a form system for Trainer
- If `useAuth.jsx` loads agency state from Zustand / Jotai / React Context, match the existing pattern
- If the project uses Tailwind / CSS modules / styled-components, match the Sidebar.jsx + ClientsPage.jsx conventions exactly — no new styling approach
- If the Koto router is not React Router (check `src/app/App.jsx` before starting) — e.g. if Next.js App Router handles `/trainer` directly via file-system routing — adapt. The decision to put routes in `App.jsx` is inherited from the existing codebase pattern (per CODEBASE.md "src/app/App.jsx — ALL routes registered here"); verify this is still current at execute time
</deviations_protocol>
