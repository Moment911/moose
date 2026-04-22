# Trainer Phase 3: Trainee Auth + /my-plan — Context

**Gathered:** 2026-04-21
**Status:** PARKED — do not execute until Trainer Phase 2 code-completes.
**Sketch authored by:** prep session 2026-04-21. Lighter than Phase 1 — boundary + key decisions + plan map only. Full decision expansion when this phase promotes.

<domain>
## Phase Boundary

Turn trainees from "rows the agency sees" into "real Koto users with their own login and a read-only plan view." After Phase 3:

1. Creating a trainee via `/trainer/new` (Phase 1) OR upgrading an existing trainee (new action) provisions a Supabase auth account with a limited `trainer_trainee` role.
2. The trainee receives a magic-link invite email via Resend with a link to `/my-plan`.
3. Trainee signs in with the magic link → lands on `/my-plan` → sees their current week (workout + meals + grocery list).
4. Trainee can log their own sets in the workout grid (replaces agency-on-behalf entry from Phase 2).
5. RLS tightens: `koto_fitness_*` tables get a second policy allowing trainee-self-read on rows where `trainee_id = current_user_trainee_id`.

**Explicit non-goals for Phase 3:**

- No trainee chat / messaging. Read-only + log entry only.
- No in-app progress photos (v2 Phase 4).
- No push notifications / email nudges (v2 Phase 5).
- Magic-link invite is one-time; no password flow, no 2FA. If trainee loses access, operator resends.

</domain>

<key_decisions>
## Key Decisions

See `.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-CONTEXT.md` for initiative-wide decisions. Phase 3-specific additions:

- **D-P3-01: Trainee auth uses Supabase auth directly, not a shadow user system.** A trainee is a real `auth.users` row with `user_metadata.role = 'trainer_trainee'` + `user_metadata.trainee_id = <uuid>` + `user_metadata.agency_id = <uuid>`. No parallel "trainee table" in auth.
- **D-P3-02: `users.role` column extended.** Add `trainer_trainee` to the enum if it's an enum; otherwise just use the role as a string. Check existing `users` schema convention at plan time (hierarchy per memory: Koto Admin → Agencies → Clients — trainee is a new peer, not a nested role).
- **D-P3-03: Magic-link invite via Resend.** Subject line + copy authored in Phase 3 plan. Invite link expires 7 days; resend action refreshes it. One-tap sign-in (Supabase magic-link flow) → lands on `/my-plan` not the agency dashboard.
- **D-P3-04: `/my-plan` is a separate surface, not a permission-gated `/trainer` view.** Trainee never sees the agency chrome (sidebar, client list, etc.). `/my-plan` renders in a minimal layout branded per the agency (white-label inherited from Phase 1 `agencies` row).
- **D-P3-05: RLS for trainee self-read.** Each `koto_fitness_*` table gets a second policy: `(agency_id-scoped policy) OR (trainee_id = auth.jwt()->'user_metadata'->>'trainee_id'::uuid)`. Exact jwt-claim extraction pattern to be confirmed against Koto's existing Supabase RLS conventions at plan time.
- **D-P3-06: Trainee can log their own sets; cannot edit plan.** Workout-log grid renders + persists to `koto_fitness_workout_logs` with `agency_id` auto-set from the JWT claim. Agency can still override / edit logs (admin-side).
- **D-P3-07: Invite surfaces on Phase 1 detail page.** `/trainer/:traineeId` gets a new "Invite" button (enabled once plan generated in Phase 2). Click → triggers `/api/trainer/trainees?action=send_invite`. Status badge reflects invite state: `not_invited` / `invited` / `active` / `bounced`.
- **D-P3-08: Bounced-email handling via Resend webhook.** If the invite bounces, `/trainer/:traineeId` shows the bounce + an "Edit email + resend" affordance. Don't silently fail.
- **D-P3-09: Trainee self-service limited to: view current week, log sets, log body weight (v2 preview allowed here — one small check-in).** Everything else is agency-side.
- **D-P3-10: Disclaimers + liability copy.** `/my-plan` shows "Not medical advice. Consult your physician before starting any new program." pinned on the workout view. Trainee must check a one-time "I've read the disclaimer" box on first sign-in before the plan becomes visible. Stored as `users.user_metadata.trainer_disclaimer_ack_at`.

</key_decisions>

<plan_map>
## Plan Map (to be expanded when promoted)

- **Plan 01 — Auth provisioning + `users.role` extension** (Wave 1)
  - Migration to expand role taxonomy if needed
  - `provisionTraineeAccount(trainee_id, email, agency_id)` helper that creates the Supabase auth user + sets metadata
  - Resend magic-link invite email template + send action
- **Plan 02 — `/api/trainer/trainees` invite actions + RLS tightening** (Wave 2)
  - New actions on existing dispatcher: `send_invite`, `resend_invite`, `revoke_invite`
  - Migration adding trainee-self-read RLS policies to all 4 `koto_fitness_*` tables
  - Cross-agency test: trainee A cannot read trainee B's logs
- **Plan 03 — `/my-plan` surface** (Wave 2, parallel with 02)
  - New route + minimal-chrome layout
  - Current-week workout + meal + grocery view
  - Workout-log grid (trainee self-entry version of Phase 2 Plan 06)
  - One-time disclaimer ack gate
- **Plan 04 — Resend bounce webhook + invite status UI** (Wave 3)
  - Webhook handler for Resend delivery events
  - Phase 1 `/trainer/:traineeId` status badge update

</plan_map>

<canonical_refs>
## Canonical References (expand when promoting)

- Phase 1 CONTEXT + PLAN 01 (RLS patterns to extend)
- Phase 2 CONTEXT + workout log grid UI to mirror on `/my-plan`
- Existing Koto auth patterns: `src/hooks/useAuth.jsx`, `src/lib/supabase.js` → `createClient_()` (auto-provisioning reference)
- Koto Resend patterns: existing onboarding email templates in `src/app/api/onboarding/`
- Supabase magic-link docs (executor opens at implementation time): https://supabase.com/docs/guides/auth/auth-magic-link
- `_knowledge/env-vars.md` — RESEND_API_KEY already present; no new secrets expected for Phase 3

</canonical_refs>

<promotion_gate>
## Promotion Checklist

- [ ] Trainer Phase 2 all plans code-complete + verified
- [ ] Phase 2 pilot: at least 1 test trainee has a generated plan in dev (proves agency-side works before trainee surface loads on top)
- [ ] White-label branding story for `/my-plan` confirmed (does agency logo / colors carry through? — if yes, agency's `branding` jsonb column is the source)
- [ ] Resend sender + domain confirmed (existing `koto_onboarding_recipients` flow sends from `onboarding@hellokoto.com`; trainee invites may need a new sender or reuse)
- [ ] Legal + disclaimer copy reviewed
- [ ] RLS pattern for trainee-self-read confirmed against Koto's Supabase convention (JWT claim extraction or `app.trainee_id` session setting?)
- [ ] This CONTEXT re-read and expanded into full decisions where D-P3-XX entries need more specificity

Once all checked, flip `status:` to `Ready for planning` and run `/gsd-plan-phase trainer-03-trainee-auth-and-my-plan`.

</promotion_gate>
