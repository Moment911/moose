# KotoIQ Agentic Orchestration Layer — Architecture Decision Document

**Status:** v1 — input spec for Claude Code implementation
**Owner:** Adam
**Grounded in:** `KOTOIQ_INVENTORY.md` (read-only recon pass)
**Goal:** Build a goal-driven orchestration layer that closes the loop across KotoIQ's existing 130 action handlers, 32 semantic agents, two pipeline systems, and ~70 tables — without rewriting any of them.

---

## 0. Read this first

This document is written to be handed to Claude Code as the spec for an MVP build. It contains:

- Six decisions, each with a recommended answer and reasoning. Override any you disagree with before passing to Claude Code.
- The MVP scope — what gets built first, what gets deferred.
- The new tables, new files, and new module boundaries.
- The contracts between layers, expressed as TypeScript interfaces.
- A phased build plan with concrete checkpoints.

This document does **not** propose:

- Refactoring `src/app/api/kotoiq/route.ts` (the 5200-line monolith). It is wrapped, not edited.
- Replacing `autonomousPipeline.ts` or `pipelineOrchestrator.ts`. They are wrapped, not replaced.
- Reconciling the 12-vs-32 semantic agent discrepancy. The orchestrator treats the semantic agent suite as opaque tools.
- Fixing the missing migrations or auth gap on the main route. Both are tracked as preconditions, not part of this build.

---

## 1. Decisions Required

These are the six decisions that shape the build. My recommended answer is in **bold** with reasoning. Override before handing to Claude Code if you disagree.

### Decision 1 — How to expose the 130 action handlers as agent tools

The main route dispatches on `body.action` to ~130 handlers. The agent cannot meaningfully choose among 130 tools, and most actions (CRUD/list/get) aren't goal-relevant.

**Recommendation: Hand-pick ~22 actions that map to the three MVP goals. Everything else stays UI-only and invisible to the agent.**

The 22 actions, by goal:

| Goal | Actions exposed as agent tools |
|---|---|
| `recover_decaying_content` | `predict_content_decay`, `get_content_inventory`, `build_content_inventory`, `analyze_on_page`, `generate_brief`, `run_autonomous_pipeline`, `get_pipeline_run` |
| `close_topical_gap` | `generate_topical_map`, `get_topical_map`, `analyze_topical_coverage`, `audit_topical_authority`, `analyze_query_paths`, `generate_brief`, `run_autonomous_pipeline` |
| `defend_brand_serp` | `brand_serp_scan`, `get_brand_serp` (read), `audit_eeat`, `audit_schema`, `generate_schema`, `knowledge_graph_export`, `analyze_backlinks`, `find_backlinks` |

The remaining ~108 actions stay accessible to the UI and bot but are not in the agent's tool registry. They get added later as new goals are introduced.

Reasoning: planner tool selection accuracy collapses past ~30 tools. Hand-picked is faster to ship, easier to debug, and matches the MVP goal grammar. Auto-generation of all 130 is technically possible but produces a planner that hallucinates which action to call.

### Decision 2 — How to handle the two pipeline systems

The inventory found two independent systems both writing to `kotoiq_pipeline_runs`:
- `autonomousPipeline.ts` — per-keyword, 8 steps (brief → write → plagiarism → watermark → on-page → schema → score → publish)
- `builder/pipelineOrchestrator.ts` — 7-stage multi-keyword (Profile → Ingest → Graph → Plan → Generate → Ship → Measure)

**Recommendation: For MVP, the orchestrator only invokes `autonomousPipeline.runAutonomousPipeline()`. Treat `builder/pipelineOrchestrator.ts` as a separate concern — it stays for the existing builder/template flow but the agent layer does not call it.**

Reasoning: `autonomousPipeline.ts` matches the per-keyword shape the three MVP goals need (decay recovery, gap-fill content, brand SERP fix all want one piece of content). The 7-stage builder orchestrator is a different abstraction (multi-keyword campaign deployment) that doesn't map to the goals we're starting with. Reconciling the two is a separate project — flagged as tech debt, not blocking.

The agent's `kotoiq_agent_runs` ledger will record which pipeline was invoked so we can revisit later.

### Decision 3 — Semantic agents: 12 or 32?

The inventory shows 32 agents, the marketing says 12. Each agent is invoked individually via main-route actions.

**Recommendation: Defer reconciliation. The MVP orchestrator does not invoke individual semantic agents. It only invokes them indirectly via `run_autonomous_pipeline` and via the existing main-route actions that already bundle them.**

Reasoning: building the agent layer is independent of how the semantic agents are organized. If the marketing materials need fixing, that's a separate doc fix. If the code needs reorganizing, that's a separate refactor. Neither blocks orchestration.

### Decision 4 — Job queue: now or later?

No external job queue today. Pipeline runs use in-memory Maps (lost on cold start) plus DB rows in try/catch that swallow errors.

**Recommendation: For MVP, use the existing pattern — DB-backed status with in-process execution. Add Vercel Cron triggers for scheduled runs. Defer real queue (Inngest or Trigger.dev) to phase 2.**

Reasoning: introducing a queue adds 1–2 weeks and a new infrastructure dependency. The MVP goals can run synchronously in 30s–4min per call (well within Vercel's 300s limit). Scheduled "monitor decay nightly" runs use Vercel Cron, same as the existing `competitor-watch` cron.

Phase 2 risk to flag: if any goal's plan exceeds 300s in practice, we're forced to introduce a queue or break the plan into multiple cron-triggered steps. Inngest is the suggested choice (managed, Vercel-native, durable) when we do.

### Decision 5 — Auth on the agent surface

Main route trusts `body.agency_id`. Newer routes use `verifySession()`.

**Recommendation: All agent endpoints use `verifySession()` from `src/lib/apiAuth.ts`. The agent NEVER calls main-route actions via HTTP — it imports and calls the engine functions directly (e.g., `import { analyzeOnPage } from '@/lib/onPageEngine'`). This sidesteps the auth gap entirely.**

Reasoning: the auth gap on the main route is a separate problem that should not block this build, but the agent must not propagate the gap. Direct function imports are also faster (no HTTP round-trip) and give us TypeScript-level contracts. The downside is the agent can only call functions that have engine-file equivalents — a few actions are inline in `route.ts` and would need to be extracted to call from the agent. Those are listed in Section 6.

### Decision 6 — The ~11 missing migrations

`kotoiq_keywords`, `kotoiq_snapshots`, `kotoiq_content_briefs`, etc., are heavily used in code but lack migration files.

**Recommendation: For MVP, the agent reads from these tables (they exist in production Supabase even without local migrations) but the agent's own tables (`kotoiq_agent_runs`, `kotoiq_agent_actions`, `kotoiq_agent_goals`) are created with proper migrations. Backfilling the missing migrations is tracked as a precondition for production deployment of the agent — agents should not act on tables whose schema we cannot read locally for type generation.**

Reasoning: backfilling 11 migrations is a separate task with its own validation cost. Blocking on it stalls the build. Reading from undocumented tables is acceptable for MVP read paths because the orchestrator is just synthesizing data already used by the existing UI.

---

## 2. MVP Scope

What ships in this build:

- One **Strategist** agent with three goal types: `recover_decaying_content`, `close_topical_gap`, `defend_brand_serp`.
- Three **Domain Captains**: Content, Semantic, Authority.
- A **tool registry** with 22 entries (per Decision 1).
- A **ledger** of three new tables: `kotoiq_agent_goals`, `kotoiq_agent_runs`, `kotoiq_agent_actions`.
- Three new API routes under `/api/kotoiq/agent/`: `goals`, `runs`, `actions`.
- A unified **review queue** that extends the existing `kotoiq_ads_rec_*` approval pattern to non-ads recommendations.
- Vercel Cron entry for nightly decay-monitoring goal evaluation.

What is explicitly out of scope:

- Refactoring the 5200-line main route.
- Replacing or merging the two pipeline systems.
- Reconciling 12-vs-32 semantic agents.
- Backfilling the missing migrations.
- Adding auth to the main route.
- Introducing an external job queue.
- Generalizing the ads LLM router to all features (flagged as next-best work, not in MVP).

---

## 3. Architecture

### 3.1 Layer diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1 — STRATEGIST                                            │
│  src/lib/agent/strategist.ts                                    │
│  • Reads goal from kotoiq_agent_goals                           │
│  • Reads state via Captain.assess()                             │
│  • Produces plan (sequence of Captain.execute() calls)          │
│  • Records plan + outcome to kotoiq_agent_runs                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓ invokes
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2 — DOMAIN CAPTAINS                                       │
│  src/lib/agent/captains/{content,semantic,authority}.ts         │
│  • Uniform interface: assess(scope) → state                     │
│                       plan(goal, state) → actions               │
│                       execute(actions) → outcome                │
│  • Each owns ~7 tool registry entries                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓ invokes
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3 — TOOL REGISTRY                                         │
│  src/lib/agent/tools/registry.ts                                │
│  • 22 wrapped engine functions                                  │
│  • Each entry: name, description, zod input schema,             │
│                zod output schema, owning captain, cost estimate │
│  • No LLM here — pure function dispatch                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓ imports
┌─────────────────────────────────────────────────────────────────┐
│  EXISTING ENGINE FUNCTIONS (UNCHANGED)                          │
│  src/lib/{onPageEngine,topicalMapEngine,brandSerpEngine,...}.ts │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Why direct imports, not HTTP

Tools call engine functions directly via TypeScript imports (Decision 5). This:

- Bypasses the unauthenticated main route.
- Avoids HTTP serialization overhead inside Vercel functions.
- Gives the tool registry compile-time type safety.
- Means tools can only wrap functions that exist as exports in `src/lib/*.ts`. Inline-in-route handlers must be extracted first (see Section 6).

### 3.3 Why no super-agent

A single LLM with all 22 tools would technically work but conflates planning (which goal? in what order?) with execution (which tool inside this domain?). Splitting Strategist from Captains keeps each prompt focused, reduces hallucinated plans, and lets each Captain enforce its own data contract.

---

## 4. New Tables

Three new tables. All include `agency_id` and `client_id`. All include RLS policies matching the `kotoiq_client_activity` pattern (JWT claim check).

### 4.1 `kotoiq_agent_goals`

A goal is a durable intent. The Strategist instantiates a `kotoiq_agent_run` to pursue it.

```sql
CREATE TABLE kotoiq_agent_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN (
    'recover_decaying_content',
    'close_topical_gap',
    'defend_brand_serp'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  trigger text NOT NULL CHECK (trigger IN ('manual','schedule','threshold','bot')),
  schedule_cron text,                          -- e.g., '0 6 * * *' for nightly
  threshold_config jsonb,                      -- e.g., {"decay_score_lt": 60}
  scope jsonb NOT NULL DEFAULT '{}',           -- {urls?, topics?, cluster_ids?}
  budget_usd numeric(8,2) NOT NULL DEFAULT 5.00,
  budget_tokens int NOT NULL DEFAULT 200000,
  budget_actions int NOT NULL DEFAULT 10,
  requires_approval boolean NOT NULL DEFAULT true,
  created_by uuid,                             -- user_id who created the goal
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_goals_active ON kotoiq_agent_goals(client_id, status) WHERE status = 'active';
CREATE INDEX idx_agent_goals_agency ON kotoiq_agent_goals(agency_id);
```

### 4.2 `kotoiq_agent_runs`

A run is one Strategist invocation against a goal. It produces a plan and a sequence of actions.

```sql
CREATE TABLE kotoiq_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES kotoiq_agent_goals(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  trigger text NOT NULL,                       -- 'manual' | 'cron' | 'threshold' | 'bot'
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','awaiting_approval','executing','verifying','completed','failed','cancelled')),
  state_snapshot jsonb,                        -- output of Captain.assess()
  plan jsonb,                                  -- ordered list of intended actions
  outcome jsonb,                               -- final state + verification result
  cost_usd numeric(8,4) NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  actions_taken int NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_agent_runs_goal ON kotoiq_agent_runs(goal_id, started_at DESC);
CREATE INDEX idx_agent_runs_client ON kotoiq_agent_runs(client_id, started_at DESC);
```

### 4.3 `kotoiq_agent_actions`

One row per tool invocation within a run. This is the audit trail.

```sql
CREATE TABLE kotoiq_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES kotoiq_agent_runs(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  sequence int NOT NULL,                       -- order within the run
  captain text NOT NULL CHECK (captain IN ('content','semantic','authority')),
  tool_name text NOT NULL,                     -- matches registry entry name
  input jsonb NOT NULL,
  output jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','executing','succeeded','failed','skipped')),
  approval_required boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  result_ref_table text,                       -- e.g., 'kotoiq_pipeline_runs'
  result_ref_id uuid,                          -- pointer to existing engine output
  cost_usd numeric(8,4) NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  duration_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_agent_actions_run ON kotoiq_agent_actions(run_id, sequence);
CREATE INDEX idx_agent_actions_pending_approval
  ON kotoiq_agent_actions(client_id, status)
  WHERE status = 'pending' AND approval_required = true;
```

RLS policies for all three tables: `USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid)`.

---

## 5. Module Layout

All new code under `src/lib/agent/` and `src/app/api/kotoiq/agent/`. Nothing edited outside these paths except for the Vercel cron config and the few engine extractions noted in Section 6.

```
src/lib/agent/
├── types.ts                         # Goal, Run, Action, Plan, State, Outcome
├── strategist.ts                    # Tier 1
├── captains/
│   ├── base.ts                      # Captain interface
│   ├── content.ts                   # Content Captain
│   ├── semantic.ts                  # Semantic Captain
│   └── authority.ts                 # Authority Captain
├── tools/
│   ├── registry.ts                  # 22-entry tool registry
│   ├── schemas.ts                   # zod input/output schemas per tool
│   └── invoker.ts                   # tool dispatch + cost tracking
├── budget.ts                        # Budget enforcement
├── ledger.ts                        # Read/write kotoiq_agent_*
├── llm.ts                           # LLM wrapper (uses adsLLM pattern)
└── goals/
    ├── recoverDecayingContent.ts    # Goal-specific assess+plan logic
    ├── closeTopicalGap.ts
    └── defendBrandSerp.ts

src/app/api/kotoiq/agent/
├── goals/route.ts                   # POST/GET/PATCH goals
├── runs/route.ts                    # POST start, GET list, GET status
└── actions/route.ts                 # GET pending, POST approve/reject

supabase/migrations/
└── 20260601_kotoiq_agent_layer.sql  # The three new tables + RLS

src/app/api/cron/
└── agent-evaluator/route.ts         # Nightly: read active goals, trigger runs
```

---

## 6. Engine Extractions Required

Per Decision 5, the agent imports engine functions directly. A few of the 22 chosen actions are currently inline in `route.ts` rather than extracted to `src/lib/*.ts`. These need extraction before the agent can call them. Keep the existing route handler intact — extract the logic to a sibling lib file and have the route delegate to it.

| Action | Currently | Required |
|---|---|---|
| `generate_brief` | Inline in `route.ts` | Extract to `src/lib/contentBriefEngine.ts`, export `generateBrief(s, ai, body)` |
| `find_backlinks` | Inline in `route.ts` | Already in `backlinkOpportunityEngine.ts` — confirm export name |
| `brand_serp_scan` | `brandSerpEngine.scanBrandSERP` exists | No extraction needed |
| `audit_eeat` | `eeatEngine.auditEEAT` exists | No extraction needed |
| `audit_schema` | `schemaEngine.auditSchema` exists | No extraction needed |
| `generate_schema` | `schemaEngine.generateSchemaForUrl` exists | No extraction needed |
| `knowledge_graph_export` | `knowledgeGraphExporter.exportKnowledgeGraph` exists | No extraction needed |
| `analyze_backlinks` | `backlinkEngine.analyzeBacklinks` exists | No extraction needed |
| All others | Already extracted | No extraction needed |

Estimated extraction work: 1 file, ~2 hours including tests.

---

## 7. Contracts (TypeScript Interfaces)

### 7.1 The four primitives

```typescript
// src/lib/agent/types.ts

export type GoalType =
  | 'recover_decaying_content'
  | 'close_topical_gap'
  | 'defend_brand_serp';

export type CaptainName = 'content' | 'semantic' | 'authority';

export interface Goal {
  id: string;
  agency_id: string;
  client_id: string;
  goal_type: GoalType;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  scope: GoalScope;
  budget: Budget;
  requires_approval: boolean;
}

export interface GoalScope {
  urls?: string[];
  topics?: string[];
  cluster_ids?: string[];
}

export interface Budget {
  budget_usd: number;
  budget_tokens: number;
  budget_actions: number;
}

export interface State {
  goal_type: GoalType;
  client_id: string;
  // Goal-specific shape — see goals/*.ts
  data: unknown;
  captured_at: string;
}

export interface PlannedAction {
  sequence: number;
  captain: CaptainName;
  tool_name: string;
  input: unknown;
  approval_required: boolean;
  reason: string;            // Why the planner chose this — for audit + UI
  est_cost_usd: number;
  est_tokens: number;
}

export interface Plan {
  goal_id: string;
  run_id: string;
  actions: PlannedAction[];
  total_est_cost_usd: number;
  total_est_tokens: number;
  reasoning: string;         // High-level "why this plan"
}

export interface ActionOutcome {
  action_id: string;
  status: 'succeeded' | 'failed' | 'skipped';
  output: unknown;
  result_ref?: { table: string; id: string };
  cost_usd: number;
  tokens_used: number;
  duration_ms: number;
  error?: string;
}

export interface RunOutcome {
  run_id: string;
  goal_id: string;
  status: 'completed' | 'failed' | 'cancelled';
  actions: ActionOutcome[];
  verification: VerificationResult;
  total_cost_usd: number;
  total_tokens: number;
}

export interface VerificationResult {
  passed: boolean;
  metric: string;            // e.g., 'decay_score'
  before: number;
  after: number;
  delta: number;
  notes: string;
}
```

### 7.2 Captain interface

```typescript
// src/lib/agent/captains/base.ts

export interface Captain {
  name: CaptainName;
  ownedTools: string[];      // names from tool registry

  /** Read current state relevant to a goal. No side effects. */
  assess(args: {
    s: SupabaseClient;
    goal: Goal;
  }): Promise<State>;

  /** Produce a plan. No side effects. LLM call OK. */
  plan(args: {
    s: SupabaseClient;
    goal: Goal;
    state: State;
  }): Promise<PlannedAction[]>;

  /** Execute one planned action. Side effects allowed. */
  execute(args: {
    s: SupabaseClient;
    ai: Anthropic;
    action: PlannedAction;
    runContext: { run_id: string; goal_id: string };
  }): Promise<ActionOutcome>;
}
```

### 7.3 Strategist interface

```typescript
// src/lib/agent/strategist.ts

export interface Strategist {
  /** End-to-end: assess → plan → (approve?) → execute → verify → record. */
  runGoal(args: {
    s: SupabaseClient;
    ai: Anthropic;
    goal: Goal;
    trigger: 'manual' | 'cron' | 'threshold' | 'bot';
  }): Promise<RunOutcome>;

  /** Just plan. Used for "preview before executing" flows. */
  previewPlan(args: {
    s: SupabaseClient;
    ai: Anthropic;
    goal: Goal;
  }): Promise<Plan>;
}
```

### 7.4 Tool registry entry

```typescript
// src/lib/agent/tools/registry.ts

import { z } from 'zod';

export interface ToolEntry<TInput = unknown, TOutput = unknown> {
  name: string;                          // 'analyze_on_page'
  captain: CaptainName;                  // 'content'
  description: string;                   // For planner LLM
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  invoke: (args: {
    s: SupabaseClient;
    ai: Anthropic;
    input: TInput;
    runContext: { run_id: string; client_id: string; agency_id: string };
  }) => Promise<TOutput>;
  estCostUsd: (input: TInput) => number;
  estTokens: (input: TInput) => number;
  approvalRequired: boolean;             // Destructive actions = true
  externalApis: string[];                // ['anthropic', 'dataforseo']
  writesToTables: string[];              // For audit
}
```

### 7.5 Goal definition

```typescript
// src/lib/agent/goals/base.ts

export interface GoalDefinition<TStateData = unknown> {
  goal_type: GoalType;
  description: string;

  /** Default budget if user doesn't specify. */
  defaultBudget: Budget;

  /** Captains involved in this goal type. */
  captains: CaptainName[];

  /** Read state relevant to this goal. Combines reads from all involved captains. */
  assess(args: { s: SupabaseClient; goal: Goal }): Promise<State & { data: TStateData }>;

  /** Decide if the state warrants action. Used by threshold triggers. */
  shouldAct(state: State & { data: TStateData }): boolean;

  /** Verify the goal's success after execution. */
  verify(args: {
    s: SupabaseClient;
    goal: Goal;
    beforeState: State & { data: TStateData };
    actions: ActionOutcome[];
  }): Promise<VerificationResult>;
}
```

---

## 8. The Three MVP Goals — Specs

### 8.1 `recover_decaying_content`

**Trigger:** schedule (nightly cron) or threshold (on `kotoiq_content_inventory.refresh_priority` change).

**Assess (Content Captain):**
1. Read `kotoiq_content_inventory` filtered by `client_id`, ordered by `refresh_priority` desc.
2. For top 20, call `runContentDecayPredictor` (already in `kotoiqAdvancedAgents.ts`).
3. State = list of `{url, current_position, predicted_position_30d, decay_score, recommended_refresh_type}`.

**Plan (Strategist):** For each item with `decay_score < threshold`, decide:
- Light refresh → `analyze_on_page` + manual edits suggestion (no auto-publish)
- Full rewrite → `generate_brief` → `run_autonomous_pipeline`
- Skip → out of scope

Hard cap: `budget_actions` (default 10) most-decayed items per run.

**Verify:** 7 days post-execution, re-run decay predictor on the same URLs. Pass if avg `decay_score` improved ≥ 5 points OR `current_position` improved.

### 8.2 `close_topical_gap`

**Trigger:** manual (user clicks "find and fill gaps" in Topical Map UI).

**Assess (Semantic Captain):**
1. Read `kotoiq_topical_maps` for client (latest, status='active').
2. Read `kotoiq_topical_nodes` where `status='gap'`, ordered by `relevance_to_central` desc.
3. State = list of gap nodes with their `suggested_url`, `suggested_title`, `priority`.

**Plan (Strategist):** For top N nodes (where N = `budget_actions`):
1. `generate_brief` for the gap topic
2. `run_autonomous_pipeline` to produce content (defaults to `auto_publish=false`)

**Verify:** 24h post-execution, count `kotoiq_topical_nodes` rows where `status` flipped from `gap` to `covered` and `existing_url` populated. Pass if delta ≥ 50% of attempted nodes.

### 8.3 `defend_brand_serp`

**Trigger:** manual or threshold (on `kotoiq_brand_serp.brand_serp_score` decline).

**Assess (Authority Captain):**
1. Read latest `kotoiq_brand_serp` for client.
2. State = `{brand_serp_score, knowledge_panel_present, owned_pct, negative_results, paa_sentiment}`.

**Plan (Strategist):** Conditional on findings:
- No knowledge panel → `knowledge_graph_export` (always requires approval before submission)
- Schema gaps → `audit_schema` then `generate_schema` per missing type
- E-E-A-T deficits → `audit_eeat` (read-only — produces a recommendation rather than auto-fixing)
- Negative results → `find_backlinks` to drown out (recommendation, not auto-action)

**Verify:** 7 days post-execution, re-run `brand_serp_scan`. Pass if `brand_serp_score` improved ≥ 3 points.

---

## 9. The Tool Registry — Full MVP Set

22 entries across three captains. Format: `tool_name` → engine function.

### Content Captain (8 tools)

| Tool | Engine function | File | Approval? |
|---|---|---|---|
| `predict_content_decay` | `runContentDecayPredictor` | `kotoiqAdvancedAgents.ts` | no |
| `get_content_inventory` | `getContentInventory` | `contentRefreshEngine.ts` | no |
| `build_content_inventory` | `buildContentInventory` | `contentRefreshEngine.ts` | no |
| `analyze_on_page` | `analyzeOnPage` | `onPageEngine.ts` | no |
| `get_refresh_plan` | `getRefreshPlan` | `contentRefreshEngine.ts` | no |
| `generate_brief` | `generateBrief` | `contentBriefEngine.ts` (NEW) | no |
| `run_autonomous_pipeline` | `runAutonomousPipeline` | `autonomousPipeline.ts` | yes (when auto_publish=true) |
| `get_pipeline_run` | `getPipelineRun` | `autonomousPipeline.ts` | no |

### Semantic Captain (7 tools)

| Tool | Engine function | File | Approval? |
|---|---|---|---|
| `generate_topical_map` | `generateTopicalMap` | `topicalMapEngine.ts` | no |
| `get_topical_map` | `getTopicalMap` | `topicalMapEngine.ts` | no |
| `analyze_topical_coverage` | `analyzeTopicalCoverage` | `topicalMapEngine.ts` | no |
| `audit_topical_authority` | `runTopicalAuthorityAuditor` | `kotoiqAdvancedAgents.ts` | no |
| `analyze_query_paths` | `analyzeQueryPaths` | `queryPathEngine.ts` | no |
| `analyze_semantic_network` | `analyzeSemanticNetwork` | `semanticAnalyzer.ts` | no |
| `update_topical_node` | `updateTopicalNode` | `topicalMapEngine.ts` | yes |

### Authority Captain (7 tools)

| Tool | Engine function | File | Approval? |
|---|---|---|---|
| `brand_serp_scan` | `scanBrandSERP` | `brandSerpEngine.ts` | no |
| `get_brand_serp` | `getBrandSERP` | `brandSerpEngine.ts` | no |
| `audit_eeat` | `auditEEAT` | `eeatEngine.ts` | no |
| `audit_schema` | `auditSchema` | `schemaEngine.ts` | no |
| `generate_schema` | `generateSchemaForUrl` | `schemaEngine.ts` | yes |
| `knowledge_graph_export` | `exportKnowledgeGraph` | `knowledgeGraphExporter.ts` | yes (Wikidata submission gate) |
| `analyze_backlinks` | `analyzeBacklinks` | `backlinkEngine.ts` | no |

**Approval policy:** any tool that submits to external systems (Wikidata, WordPress publish), modifies user-visible records (`update_topical_node`), or produces auto-published content has `approval_required: true`. The tool runs all the way up to the side-effect boundary and pauses with status `awaiting_approval`. The user approves via `/api/kotoiq/agent/actions` POST.

---

## 10. Budget Enforcement

Reuse the existing pattern from `src/lib/ads/llmRouter.ts`. The agent's `budget.ts`:

```typescript
export async function checkAndReserveBudget(args: {
  s: SupabaseClient;
  goal_id: string;
  est_cost_usd: number;
  est_tokens: number;
}): Promise<{ ok: true } | { ok: false; reason: 'cost' | 'tokens' | 'actions' }>;
```

Reads the goal's budget. Reads sum of completed/in-progress run costs. Returns whether the next action fits. If not, the run pauses with status `failed` and `error: "budget_exceeded:cost"` (or tokens/actions).

LLM cost calculation: reuse `tokenTracker.ts` rates. New table column on `kotoiq_agent_actions.cost_usd` records actual.

---

## 11. The Cron Trigger

```typescript
// src/app/api/cron/agent-evaluator/route.ts

export async function GET(req: Request) {
  // Verify Vercel cron secret
  // Read all kotoiq_agent_goals where status='active' AND trigger IN ('schedule','threshold')
  // For each goal:
  //   - If trigger='schedule', check schedule_cron matches now
  //   - If trigger='threshold', call goal definition's shouldAct(state)
  //   - If yes, enqueue strategist.runGoal()
  // Return summary of triggered runs
}
```

`vercel.json` addition:

```json
{ "path": "/api/cron/agent-evaluator", "schedule": "0 6 * * *" }
```

---

## 12. The Approval UI Surface

Reuse the recommendations queue pattern from Ads (`kotoiq_ads_rec_*` tables, `ads_approve_rec` action). A new tab `agent_queue` in the KotoIQPage sidebar:

- Lists `kotoiq_agent_actions` where `status='pending'` and `approval_required=true`.
- For each: tool name, input summary, planner reasoning, estimated cost.
- Approve / Reject / Edit & Approve buttons.
- POST `/api/kotoiq/agent/actions` with `{ action_id, decision: 'approve' | 'reject', edited_input? }`.

This is roughly 1 React component + 1 API route. Out of scope for the lib/agent build — flagged as immediate follow-up but can be tested via direct DB updates first.

---

## 13. Phased Build Plan

**Phase 0 — Preconditions (~half day, manual):**
- Confirm production Supabase has the missing tables (`kotoiq_keywords`, `kotoiq_snapshots`, etc.) — even without local migrations the agent will read from them.
- Confirm `verifySession` works for the new `/api/kotoiq/agent/*` routes.
- Capture baseline of `kotoiq_brand_serp.brand_serp_score`, `kotoiq_content_inventory.refresh_priority` distribution for one test client (the one we'll demo on).

**Phase 1 — Tables + types (~1 day):**
- Migration: `20260601_kotoiq_agent_layer.sql`.
- File: `src/lib/agent/types.ts`.
- File: `src/lib/agent/ledger.ts` — read/write helpers for the three tables.
- Smoke test: create a goal row, fetch it back.

**Phase 2 — Tool registry (~1.5 days):**
- File: `src/lib/agent/tools/schemas.ts` — 22 zod input/output schemas (derived from each engine function's actual signature).
- File: `src/lib/agent/tools/registry.ts` — 22 entries wrapping the engine imports.
- File: `src/lib/agent/tools/invoker.ts` — dispatch with cost tracking.
- Engine extraction: `generate_brief` from `route.ts` → `src/lib/contentBriefEngine.ts`.
- Test: invoke each tool registry entry against a test client, confirm output matches schema.

**Phase 3 — Captains (~2 days):**
- File: `src/lib/agent/captains/base.ts`.
- File: `src/lib/agent/captains/content.ts`.
- File: `src/lib/agent/captains/semantic.ts`.
- File: `src/lib/agent/captains/authority.ts`.
- Each captain implements `assess` (no LLM) and `execute` (just calls registry).
- `plan` deferred to Strategist for now.
- Test: each captain's `assess()` returns valid State for the test client.

**Phase 4 — Strategist + one goal (~2 days):**
- File: `src/lib/agent/strategist.ts`.
- File: `src/lib/agent/goals/recoverDecayingContent.ts`.
- File: `src/lib/agent/llm.ts` — wrapper around Anthropic (reuse adsLLM pattern).
- Strategist's `previewPlan()` works end-to-end for `recover_decaying_content`.
- Test: trigger a manual run, observe ledger entries, no execution yet.

**Phase 5 — Execution + verification (~1.5 days):**
- Strategist's `runGoal()` end-to-end including approval gates.
- Verification logic for `recover_decaying_content`.
- Test: run on test client, verify `kotoiq_agent_actions` records, verify outcome stored.

**Phase 6 — API routes + cron (~1 day):**
- `/api/kotoiq/agent/goals` — POST, GET, PATCH.
- `/api/kotoiq/agent/runs` — POST start, GET list, GET status.
- `/api/kotoiq/agent/actions` — GET pending, POST approve/reject.
- `/api/cron/agent-evaluator` — nightly evaluator.
- `vercel.json` updated.

**Phase 7 — Goals 2 and 3 (~2 days):**
- `closeTopicalGap.ts`.
- `defendBrandSerp.ts`.
- Each follows the same pattern as goal 1; mostly schema and verification logic.

**Phase 8 — Approval UI + demo (~1.5 days):**
- New tab `agent_queue` in KotoIQPage sidebar.
- Goal management UI (create/edit goals).
- Demo run: trigger `recover_decaying_content` on real client data, walk through approval, show before/after verification.

**Total: ~12 working days. Realistic calendar: 3–4 weeks accounting for review and revisions.**

---

## 14. Out of Scope — Explicit Backlog

These come up while reading this document. They are real but not part of this build.

1. Auth on `src/app/api/kotoiq/route.ts` (the 5200-line monolith).
2. Backfill the ~11 missing migrations.
3. Reconcile the two pipeline systems (`autonomousPipeline.ts` vs `builder/pipelineOrchestrator.ts`).
4. Reconcile 12-vs-32 semantic agents in marketing materials.
5. Generalize the ads LLM router to all features.
6. Replace in-memory `Map<string, PipelineRun>` with durable queue.
7. Add per-client cost tracking for DataForSEO and Moz.
8. Add ~108 more goal-relevant actions to the tool registry.
9. Integrate with the bot — `run_conversational_bot` could trigger Strategist for goal-shaped intents.
10. Cross-client learning — feeding successful action patterns back into the KotoIQ Network module.

Item 9 is the highest-leverage follow-up: today the bot only invokes individual actions, but it could detect goal intent and dispatch the agent instead.
Item 10 is the long-term moat — but it requires the agent to be running successfully on multiple clients before there's anything to learn from.

---

## 15. Acceptance Criteria for the MVP

The build is done when all of the following are true:

- A user can create a goal via API for any of the three goal types.
- A nightly cron correctly identifies clients with active scheduled goals and triggers runs.
- A run produces a plan recorded in `kotoiq_agent_runs.plan` with at least one action.
- Actions requiring approval pause the run and surface in a queryable list.
- After approval, the run resumes and executes the action via the tool registry.
- The verification step writes a `VerificationResult` to `kotoiq_agent_runs.outcome`.
- Total cost for a typical run on the test client is under $1 USD.
- All three goal types pass an end-to-end test on real client data.
- No edits to `src/app/api/kotoiq/route.ts`, `src/lib/autonomousPipeline.ts`, or `src/lib/builder/pipelineOrchestrator.ts` beyond the one extraction noted in Section 6.

---

*End of architecture decision document.*
