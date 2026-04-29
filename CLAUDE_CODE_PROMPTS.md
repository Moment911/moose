# Claude Code Build Prompts — KotoIQ Agent Layer

These prompts implement `AGENT_ARCHITECTURE.md` phase by phase. Run them in order. Review and test between each prompt before moving to the next.

**Setup before starting:**

1. Place `AGENT_ARCHITECTURE.md` at the repo root next to `KOTOIQ_INVENTORY.md`.
2. Open Claude Code in the repo: `cd /Users/adamsegall-mini/gsd-workspaces/scout-voice/moose && claude`.
3. Create a new git branch: `git checkout -b feat/agent-layer`.
4. Confirm test client ID and agency ID you want to use for development. Have them ready.

---

## Prompt 0 — Orientation (paste first)

```
Read AGENT_ARCHITECTURE.md and KOTOIQ_INVENTORY.md at the repo root in full. Do not write any code yet.

After reading, confirm in one paragraph each:
1. Your understanding of the three MVP goals.
2. The hierarchy: Strategist → Captains → Tool Registry → Engine functions.
3. Which existing files you will NOT modify (the architecture lists three).
4. Which one engine extraction is required (Section 6 of the architecture doc).

Do not propose changes to the architecture. If you find a contradiction between the two documents, note it but proceed with what AGENT_ARCHITECTURE.md says — the inventory is descriptive, the architecture is prescriptive.

End with the question: "Ready for Phase 1?"
```

**Stop and review.** Confirm Claude Code understood the scope. If anything's wrong, correct it before continuing.

---

## Prompt 1 — Phase 1: Tables and Types

```
Implement Phase 1 from AGENT_ARCHITECTURE.md Section 13.

Tasks:
1. Create the migration file `supabase/migrations/20260601_kotoiq_agent_layer.sql` with the three tables specified in Section 4 of AGENT_ARCHITECTURE.md (kotoiq_agent_goals, kotoiq_agent_runs, kotoiq_agent_actions). Include the indexes specified. Include RLS enable + policies matching the kotoiq_client_activity pattern from migration 20260427_kotoiq_client_activity.sql — read that file first to mirror the exact policy syntax used in this codebase.

2. Create `src/lib/agent/types.ts` with all the type definitions from Section 7.1 and 7.2 of AGENT_ARCHITECTURE.md verbatim. These are the canonical types.

3. Create `src/lib/agent/ledger.ts` with these exported functions:
   - createGoal(s, agency_id, client_id, input) → Goal
   - getGoal(s, goal_id) → Goal | null
   - listActiveGoals(s, client_id?) → Goal[]
   - updateGoalStatus(s, goal_id, status)
   - createRun(s, goal_id, trigger) → run_id
   - updateRunPlan(s, run_id, plan)
   - updateRunStatus(s, run_id, status, error?)
   - finalizeRun(s, run_id, outcome)
   - createAction(s, run_id, planned: PlannedAction) → action_id
   - updateActionOutcome(s, action_id, outcome: ActionOutcome)
   - listPendingApprovals(s, client_id) → Action[]

   All functions should accept a SupabaseClient as first arg. All inserts must include agency_id and client_id. Use the existing kotoiqDb pattern only if appropriate — these are agency-scoped tables so they qualify. Read src/lib/kotoiqDb.ts first to understand the pattern before deciding.

4. Do NOT run the migration. Print the migration filename and contents at the end so I can review and apply manually.

5. Do NOT modify any file outside src/lib/agent/ and supabase/migrations/.

6. Do NOT install any new dependencies.

When finished, list all files created and stop. Run `tsc --noEmit` to verify types compile, and report any errors.
```

**Stop and review.** Apply the migration manually to your dev Supabase. Verify the tables exist and the RLS policies are correct. Run a quick `INSERT` test from the SQL editor with a real `agency_id`.

---

## Prompt 2 — Phase 2: Tool Registry

```
Implement Phase 2 from AGENT_ARCHITECTURE.md Section 13.

Tasks:
1. For each of the 22 tools listed in Section 9 of AGENT_ARCHITECTURE.md, read the actual engine function it wraps. Note the real signature (parameters, types, return type). Do not paraphrase — match exactly.

2. The one extraction: read `src/app/api/kotoiq/route.ts` and find the action handler for `generate_brief`. Extract that logic into a new file `src/lib/contentBriefEngine.ts` with the export:
   ```typescript
   export async function generateBrief(s: SupabaseClient, ai: Anthropic, body: GenerateBriefInput): Promise<GenerateBriefOutput>
   ```
   Define GenerateBriefInput and GenerateBriefOutput interfaces in the same file. After extracting, modify the route.ts handler to delegate to this new function — keep the route handler in place but make it a one-liner that calls generateBrief. Do not change the route's request/response shape.

3. Create `src/lib/agent/tools/schemas.ts` — zod schemas for input and output of all 22 tools. Derive from the actual engine function signatures, not from guesses. If an engine function takes `body: { client_id: string; url: string }` then the input schema is `z.object({ client_id: z.string().uuid(), url: z.string().url() })`. Where the engine returns a complex object, the output schema can be `z.unknown()` for now if the shape is implicit — but mark with a TODO comment.

4. Create `src/lib/agent/tools/registry.ts` exporting:
   ```typescript
   export const TOOL_REGISTRY: Record<string, ToolEntry>
   ```
   With one entry per tool from Section 9 of the architecture doc. Each entry's `invoke` function calls the actual engine function via direct import. Each entry's `estCostUsd` and `estTokens` can be conservative constants for now (e.g., 0.05 USD and 5000 tokens for any LLM-using tool, 0.00 and 0 for read-only tools) — mark with TODO comments to refine later.

5. Create `src/lib/agent/tools/invoker.ts` with:
   ```typescript
   export async function invokeTool(args: {
     s: SupabaseClient;
     ai: Anthropic;
     tool_name: string;
     input: unknown;
     runContext: { run_id: string; client_id: string; agency_id: string };
   }): Promise<{ output: unknown; cost_usd: number; tokens_used: number; duration_ms: number }>
   ```
   Steps inside: lookup tool in registry → validate input with zod → start timer → invoke → validate output with zod → return with timing.

6. Constraints:
   - DO NOT modify any engine file beyond the generate_brief extraction.
   - DO NOT modify route.ts beyond replacing the generate_brief handler body with a delegating call.
   - DO NOT add any LLM logic in this phase. The registry is pure dispatch.
   - DO NOT install new dependencies. Zod is already present.

7. When finished:
   - List all files created or modified.
   - Run `tsc --noEmit` and report errors.
   - Print the count of tool registry entries (should be exactly 22).
   - Print the diff of route.ts changes (should be small — just the generate_brief handler body).

Stop after this is done. Do not start Phase 3.
```

**Stop and review.** Important checks:
- The generate_brief extraction didn't break the existing route behavior. Test the original UI button.
- All 22 tool entries compile.
- Spot-check 2–3 tool invocations against your test client by writing a one-off script.

---

## Prompt 3 — Phase 3: Captains

```
Implement Phase 3 from AGENT_ARCHITECTURE.md.

Tasks:
1. Create `src/lib/agent/captains/base.ts` with the Captain interface from Section 7.2.

2. Create `src/lib/agent/captains/content.ts`:
   - Implements Captain interface
   - name = 'content'
   - ownedTools = the 8 content tools from Section 9
   - assess() reads the data needed for any content-related goal:
     - kotoiq_content_inventory (top 50 by refresh_priority)
     - kotoiq_content_calendar (next 30 days planned)
     - kotoiq_pipeline_runs (last 10 for this client)
   - assess() does NOT call LLM, only DB reads.
   - execute() routes to invokeTool() based on action.tool_name. Validates the captain owns the tool. Records via ledger.updateActionOutcome.
   - plan() — leave as `throw new Error('not implemented — handled by Strategist')` for now.

3. Create `src/lib/agent/captains/semantic.ts`:
   - Same pattern. ownedTools = 7 semantic tools.
   - assess() reads:
     - kotoiq_topical_maps (latest active for client)
     - kotoiq_topical_nodes (count by status)
     - kotoiq_query_clusters (latest)
     - kotoiq_semantic_analysis (latest)

4. Create `src/lib/agent/captains/authority.ts`:
   - ownedTools = 7 authority tools.
   - assess() reads:
     - kotoiq_brand_serp (latest)
     - kotoiq_eeat_audit (latest)
     - kotoiq_schema_audit (latest)
     - kotoiq_backlink_profile (latest)

5. Constraints:
   - Captains are pure functions — no module-level state.
   - assess() must be safe to call repeatedly; no writes.
   - All three captains export a default singleton: `export const contentCaptain: Captain = { ... }`.

6. When finished:
   - Run `tsc --noEmit`.
   - For each captain, run `assess({ goal: <test goal>, s: <client>})` against the test client and print the resulting State to stdout. Use the test client_id and agency_id I will provide separately. (Pause and ask me for these IDs before this step — do not proceed without them.)

7. DO NOT implement plan() in the captains. That belongs in Phase 4 with the Strategist.

Stop after Phase 3.
```

When Claude Code asks for the test client_id and agency_id, give them.

**Stop and review.** Confirm each captain's `assess()` returns reasonable data for your real test client.

---

## Prompt 4 — Phase 4: Strategist + first goal

```
Implement Phase 4 from AGENT_ARCHITECTURE.md.

Tasks:
1. Create `src/lib/agent/llm.ts`:
   - Wraps Anthropic SDK with the same patterns as src/lib/ads/llmRouter.ts (read that file first).
   - Exports: `agentLLM(args: { ai: Anthropic; system: string; user: string; schema: z.ZodType; temperature?: number }): Promise<{ result: unknown; tokens: number; cost_usd: number }>`
   - Uses claude-sonnet-4-20250514 by default.
   - Validates JSON output against the provided zod schema with one retry on validation failure.
   - Logs token usage via existing src/lib/tokenTracker.ts (read it first).

2. Create `src/lib/agent/budget.ts`:
   - `checkAndReserveBudget(args)` per the architecture spec.
   - Reads goal's budget. Sums actual cost from kotoiq_agent_runs for this goal. Returns ok/not-ok.

3. Create `src/lib/agent/goals/base.ts` with the GoalDefinition interface from Section 7.5 of the architecture.

4. Create `src/lib/agent/goals/recoverDecayingContent.ts`:
   - Implements GoalDefinition.
   - assess(): calls contentCaptain.assess() then runs predict_content_decay tool on top 20 inventory items. Returns combined State.
   - shouldAct(state): true if any item has decay_score < 60.
   - verify(): reads same URLs after 7 days, recomputes decay_score, returns VerificationResult.

5. Create `src/lib/agent/strategist.ts`:
   - Strategist interface per Section 7.3.
   - previewPlan() steps:
     a. Load goal from ledger.
     b. Call goal definition's assess().
     c. Build a planning prompt: include goal type, scope, budget, current state summary, list of available tools (filtered by goal's captains).
     d. Call agentLLM() with a zod schema enforcing PlannedAction[] output.
     e. Validate each planned action against the tool registry — if a tool isn't owned by the goal's captains, drop it and log a warning.
     f. Apply budget check — trim plan if over budget.
     g. Persist plan to kotoiq_agent_runs.plan.
     h. Return Plan.
   - runGoal() steps:
     a. previewPlan() → plan.
     b. For each PlannedAction:
        - createAction() in ledger.
        - If approval_required, set status='pending', skip and continue.
        - Else: invokeTool() via the captain. updateActionOutcome().
     c. Call goal definition's verify(). Persist outcome.
     d. Return RunOutcome.

6. Constraints:
   - The planner LLM prompt must list the available tools by name and description, but constrained to those owned by the goal's captains (so the planner for recoverDecayingContent only sees Content captain tools).
   - Approval gates: if any action in the plan has approval_required=true, the run pauses with status='awaiting_approval' and exits cleanly. The next run trigger continues from where it paused.

7. When finished:
   - Create a smoke test: a script at `scripts/agent-smoke-test.ts` that:
     a. Creates a recover_decaying_content goal for the test client.
     b. Calls strategist.previewPlan() and prints the plan.
     c. Does NOT execute the plan.
   - Run the smoke test and paste the output.

Stop after Phase 4. Do not move to execution yet.
```

**Stop and review.** Read the plan output. Does it make sense? Are the chosen actions reasonable? If the planner is hallucinating tools or proposing weird sequences, the prompt in step 5c needs refinement before going further.

---

## Prompt 5 — Phase 5: Execution + Verification

```
Implement Phase 5 from AGENT_ARCHITECTURE.md.

Tasks:
1. Wire up runGoal() to actually execute non-approval-gated actions. Use the captain.execute() path. Persist every action's outcome via ledger.

2. Add the verification step at the end of runGoal(): goal.verify() runs after all executable actions complete (or are pending approval). The verification result goes into kotoiq_agent_runs.outcome.

3. Add resume support: if a run is in status='awaiting_approval', a subsequent runGoal() call (or a dedicated resumeRun(run_id) function) checks for newly-approved actions and continues execution from the next pending action.

4. Update scripts/agent-smoke-test.ts:
   - Now create the goal with requires_approval=false.
   - Call strategist.runGoal() end-to-end.
   - Print: plan, each action's outcome, the verification result, total cost.
   - Make the budget very low (budget_actions: 2, budget_usd: 0.50) to keep this test cheap.

5. Run the smoke test against the real test client and paste the output.

6. Constraints:
   - If any action fails (tool throws, schema validation fails, budget exceeded), the run status becomes 'failed' but partial outcomes are still recorded. No silent swallowing.
   - The verification step runs even on partial completion — verify() must handle the case where some planned actions never executed.

Stop after Phase 5.
```

**Stop and review.** This is the first time anything actually executes against your real data. Check:
- Did the actions produce reasonable output?
- Did the cost match the estimate?
- Did the verification result make sense?
- Are the ledger entries (`kotoiq_agent_runs`, `kotoiq_agent_actions`) clean?

---

## Prompt 6 — Phase 6: API Routes + Cron

```
Implement Phase 6 from AGENT_ARCHITECTURE.md.

Tasks:
1. Create `src/app/api/kotoiq/agent/goals/route.ts`:
   - POST — create a goal. verifySession(req). Body: { client_id, goal_type, scope, budget?, schedule_cron?, threshold_config?, requires_approval? }. Returns Goal.
   - GET — list goals for the agency. Optional ?client_id, ?status filters. Returns Goal[].
   - PATCH — update goal status or budget. Body: { goal_id, ...updates }. Returns updated Goal.
   - All handlers use verifySession(req) — do not trust body.agency_id.

2. Create `src/app/api/kotoiq/agent/runs/route.ts`:
   - POST — start a new run for a goal. Body: { goal_id, trigger: 'manual' }. Returns the RunOutcome (or partial state if it pauses for approval).
   - GET — list runs. Required ?goal_id or ?client_id. Returns Run[] with status and outcome summary.
   - GET ?run_id=X — single run with full plan, actions, outcome.

3. Create `src/app/api/kotoiq/agent/actions/route.ts`:
   - GET — list pending approvals for the agency. Optional ?client_id. Returns Action[] joined with run + goal context.
   - POST — approve or reject an action. Body: { action_id, decision: 'approve' | 'reject', edited_input?, reason? }. On approve, marks action approved and triggers run resume. On reject, marks rejected and the run continues (skipping that action).

4. Create `src/app/api/cron/agent-evaluator/route.ts`:
   - GET handler. Verifies process.env.CRON_SECRET against req header (read existing cron routes for the exact pattern — there are 8 of them in this codebase).
   - Reads all kotoiq_agent_goals where status='active' AND trigger IN ('schedule','threshold').
   - For schedule triggers: parse schedule_cron, check if it matches the current hour.
   - For threshold triggers: call the goal definition's shouldAct(state) — requires loading state via assess().
   - For each match: calls strategist.runGoal() with trigger='cron'. Don't await all in parallel — process sequentially with try/catch around each so one failure doesn't block others.
   - Returns summary: { goals_checked, runs_triggered, errors }.

5. Update vercel.json: add `{ "path": "/api/cron/agent-evaluator", "schedule": "0 6 * * *" }` to the crons array. Also add maxDuration override for /api/kotoiq/agent/* routes (use 300 same as the main route).

6. Constraints:
   - All four routes use verifySession() except the cron route which uses CRON_SECRET.
   - No direct DB access in route handlers — go through ledger.ts and strategist.ts.
   - Error responses follow the existing pattern: JSON `{ error: string, details?: unknown }` with appropriate status codes.

7. When finished:
   - List all files created or modified.
   - Run tsc --noEmit.
   - Show the updated vercel.json crons section.

Stop after Phase 6.
```

**Stop and review.** Hit each endpoint with curl or Postman. Confirm auth works. Confirm the cron route requires the secret.

---

## Prompt 7 — Phase 7: Goals 2 and 3

```
Implement Phase 7 from AGENT_ARCHITECTURE.md.

Tasks:
1. Create src/lib/agent/goals/closeTopicalGap.ts following the pattern of recoverDecayingContent.ts. Spec is in Section 8.2 of the architecture doc.

2. Create src/lib/agent/goals/defendBrandSerp.ts following the same pattern. Spec is in Section 8.3.

3. Register both new goal definitions wherever recoverDecayingContent.ts is registered (likely a goals index or strategist lookup).

4. Update scripts/agent-smoke-test.ts to allow choosing which goal to test via a CLI argument: `npx tsx scripts/agent-smoke-test.ts recover_decaying_content` or `close_topical_gap` or `defend_brand_serp`. Default behavior unchanged.

5. Run all three smoke tests. Paste outputs for each.

Stop after Phase 7.
```

**Stop and review.** All three goals should plan and execute. The plans for `defend_brand_serp` will hit approval gates more often than the others — that's expected.

---

## Prompt 8 — Phase 8: Approval UI + demo

```
Implement Phase 8 from AGENT_ARCHITECTURE.md.

Tasks:
1. Create src/components/kotoiq/AgentQueueTab.jsx — a new tab component:
   - Fetches GET /api/kotoiq/agent/actions (pending approvals).
   - Renders each as a card: tool name, captain badge, run+goal context, planner reasoning, input summary, estimated cost.
   - Approve / Reject buttons. Approve calls POST with decision='approve'. Reject opens a small modal asking for reason.
   - Refresh on action.

2. Create src/components/kotoiq/AgentGoalsTab.jsx — minimal goal management:
   - Fetches GET /api/kotoiq/agent/goals.
   - Renders a list with status, goal_type, last run time, link to runs.
   - "New Goal" button opens a modal with goal_type select, scope (URLs textarea or topics tags), budget fields, requires_approval checkbox. POST to /api/kotoiq/agent/goals.
   - "Run Now" button on each active goal — POSTs to /api/kotoiq/agent/runs.

3. Update src/views/KotoIQPage.jsx — add two new tabs to the sidebar under a new section "Agent":
   - { id: 'agent_queue', label: 'Agent Queue', component: AgentQueueTab }
   - { id: 'agent_goals', label: 'Agent Goals', component: AgentGoalsTab }
   Place this section above "Reports & Tools" in the sidebar order.

4. Constraints:
   - Match existing tab component patterns — read 2–3 existing tabs first (e.g., ScorecardTab, OnPageTab) to match styling, fetch patterns, error handling.
   - Use the existing fetch pattern, not new abstractions.
   - No new dependencies.

5. When finished:
   - npm run dev locally.
   - Take screenshots (or describe in detail) of the two new tabs rendering against the test client.

Stop after Phase 8. The MVP is complete.
```

---

## Final review checklist

After Phase 8, run through this list manually:

- [ ] All three goal types create, plan, execute, verify successfully on the test client.
- [ ] Approval gates work — UI shows pending, approve resumes execution, reject skips cleanly.
- [ ] Cron evaluator runs successfully on Vercel staging (check logs).
- [ ] No edits to `route.ts` beyond the `generate_brief` extraction.
- [ ] No edits to `autonomousPipeline.ts` or `builder/pipelineOrchestrator.ts`.
- [ ] `tsc --noEmit` clean.
- [ ] Cost per typical run on test client < $1 USD.
- [ ] All three new tables have RLS enabled with correct policies.
- [ ] `kotoiq_agent_runs.outcome` populated correctly for completed runs.

If any are red, that's a fix-up prompt before declaring done.

---

## When something goes wrong mid-build

If Claude Code starts proposing changes outside the agent layer, interrupt and paste:

> Stop. The architecture document is explicit that you do not modify [file]. If there's a real reason you need to, explain it as a question and I'll decide. Do not modify it without confirmation.

If Claude Code asks to add a dependency, interrupt and paste:

> No new dependencies in this build. If a feature needs one, propose it as a question with reasoning and I'll decide. Otherwise use what's in package.json.

If Claude Code's plan output looks like it's hallucinating tools, refine the planner prompt in `strategist.ts` — usually the issue is the system prompt isn't constraining hard enough on "you may only choose from this exact list of tools."
