# Phase 8 Deferred Items

Items discovered during Phase 8 execution that are out of scope for the
current plan or blocked on external action. Cleared by phase transition.

## From Plan 08-01

### BLOCKED — Push `supabase/migrations/20260520_kotoiq_agency_integrations.sql` to Supabase

**Task:** 08-01 Task 3 (checkpoint:human-action, gate: blocking)

**Status:** Deferred — executor running as parallel worktree agent cannot
safely invoke `supabase db push --linked` because:

1. No `SUPABASE_ACCESS_TOKEN` is available in the executor environment.
2. A push from this worktree would also push unrelated pre-existing
   uncommitted migrations present in the main checkout
   (`20260524_koto_pipelines.sql`,
   `20260524_momenta_default_pipeline.sql`) — cross-plan contamination.
3. The plan itself anticipates this exact case (08-01-PLAN.md Task 3
   line 400-403): "If you're unable to push (CI-only / no access),
   record the blocker in STATE.md Blockers section … wrap
   `agencyIntegrations.*` calls in try/catch + console.error during
   Plan 03; user-visible features stay behind 'Coming soon' toasts
   until backlog clears."

**Resume action for operator:**

```bash
export SUPABASE_ACCESS_TOKEN=<your token>
supabase db push --linked
# Verify:
supabase db pull --schema public --dry-run | grep -c koto_agency_integrations
```

Expected: migration `20260520` appears in
`supabase_migrations.schema_migrations` and `\d koto_agency_integrations`
lists all 13 columns + unique constraint + RLS + trigger.

**Downstream impact:** Plans 08-03..08-07 read/write this table. Until
the push lands, Plan 03's `profileIntegrationsVault` + any
`agencyIntegrations.*` call will 404 silently. Plan 03 MUST wrap those
calls in try/catch (matches Phase 7 kotoiq_pipeline_runs precedent in
STATE.md line 117-118).

**Orchestrator note:** This blocker belongs in STATE.md Blockers section
when the Phase 8 wave completes. Deferral is consistent with the same
pattern Phase 7 established for `kotoiq_pipeline_runs`.
