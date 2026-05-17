// ─────────────────────────────────────────────────────────────────────────
// Plan Builder — converts a goal into a structured, executable plan.
//
// The system prompt is built around the FULL KotoIQ tool catalog so the
// model knows what each step can dispatch. Output is a strict JSON Plan
// with a numbered list of steps, each tied to a real /api/kotoiq action,
// with dispatch params and explicit dependencies. Status starts 'draft'
// and progresses through review → approval → execution by planExecutor.
//
// 2026 SEO/AEO best practices baked into the prompt so plans are
// genuinely strategic, not generic.
// ─────────────────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ──────────────────────────────────────────────────────────────
export interface PlanBuilderInput {
  client_id: string
  agency_id?: string
  goal: string                            // user-facing prompt: "Grow Acme's local visibility in Austin"
  context?: Record<string, unknown>       // optional: services, areas, business_model, brand_voice, deadlines, etc.
}

export interface PlanStepDraft {
  sequence: number
  kind:
    | 'research'      // dashboard / keywords / audits — read state
    | 'strategy'      // recommend_local_strategy — design URL/cluster plan
    | 'analyze'       // analyze_competitors / dfs_compare — competitive intel
    | 'brief'         // generate_brief — single brief
    | 'page'          // bulk_generate_pages — N pages
    | 'publish'       // publish_brief_to_wp — WP deploy
    | 'audit'         // audit_technical_deep / audit_eeat / audit_schema
    | 'approval'      // human gate
    | 'manual'        // human work, no automated dispatch
  label: string
  description: string
  action?: string                         // /api/kotoiq action key (omit for approval/manual)
  params?: Record<string, unknown>        // dispatch payload
  depends_on?: number[]                   // sequence numbers that must complete first
}

export interface PlanDraft {
  goal: string
  summary: string                         // 2-3 sentence rationale
  steps: PlanStepDraft[]
  context: Record<string, unknown>
  meta: {
    model: string
    cost_usd: number
    generated_at: string
  }
}

// ── 2026 SEO/AEO genius system prompt ─────────────────────────────────
const SYSTEM_PROMPT = `You are KotoIQ's planning intelligence as of 2026-05.

Your job: take a user's goal for an agency client and produce a precise,
executable plan that uses the platform's tools to actually move the needle.
You think like a senior strategist who knows the 2026 landscape (AI Overviews
on ~40% of local intent, Service+Place schema + WikiData sameAs as table
stakes, LLM citations as a real ranking signal alongside Google).

You write plans that are STRONG and PRECISE — not generic checklists. Every
step must be a real action against a real tool with concrete dispatch params.
No fluff steps like "review the dashboard." If you can't tie a step to a
tool action below, drop it.

═══ AVAILABLE TOOL ACTIONS (/api/kotoiq?action=…) ═══════════════════════

RESEARCH / READ
  • get_dashboard            — keyword overview, quick wins, AI visibility (no params)
  • get_keywords             — tracked keywords w/ position+volume (optional: category)
  • get_recommendations      — open recommendations
  • get_content_inventory    — pages w/ freshness, trajectory

AUDIT
  • audit_technical_deep     — render diff, canonical, mobile, sitemap
  • audit_eeat               — E-E-A-T signals across pages
  • audit_schema             — schema.org audit
  • gsc_audit                — Search Console deep dive

COMPETITIVE INTEL
  • analyze_competitors      — params: { keyword } OR { urls: [...] } OR { market: { service, city, state } }
  • dfs_compare              — params: { domain1, domain2 } — what competitor ranks for + gaps
  • scan_brand_serp          — Google SERP for the brand name itself
  • aeo_research             — params: { query } — probe 5 LLM engines for who got cited

LOCAL / GBP
  • gmb_health               — Google Business Profile health

STRATEGY + BUILD
  • recommend_local_strategy — params: { business_name, business_model, services:[], areas:[{city,state,is_primary}] }
                                returns: URL pattern, topic clusters, schema plan, AEO entities, phased
                                attack — AUTO-PERSISTS clusters to Page Factory queue
  • generate_brief           — params: { keyword, page_type? } — single content brief
  • generate_schema_for_url  — params: { url } — JSON-LD generation
  • bulk_generate_pages      — params: { limit?, words_target?, campaign_label? } — loops generate_brief
                                across approved suggestions, marks built; sequential under Vercel cap;
                                returns counts.remaining — caller schedules re-runs

DEPLOY
  • publish_brief_to_wp      — params: { brief_id, site_id? } — WordPress publish via /api/wp

REPORTING
  • roi_projections          — multi-scenario ROI

═══ PLAN STRUCTURE ═════════════════════════════════════════════════════

For each plan, produce 5-15 steps that form a coherent strategy. Common
patterns to compose from:

  GROWTH / VISIBILITY ROLLOUT:
    research → competitive_audit → strategy → bulk_brief → publish → report

  AEO ATTACK:
    aeo_research(top prompts) → recommend_local_strategy → bulk_generate → publish

  RANKINGS RECOVERY:
    audit_technical_deep → audit_schema → analyze_competitors → targeted briefs → publish

  COMPETITIVE GAP CLOSE:
    dfs_compare(top 3 competitors) → strategy → bulk briefs → publish

Steps that need ARG inputs should include them concretely in 'params'. If
the user's goal mentions services + areas, populate recommend_local_strategy
params from that input. Don't ask the user for things they already said.

Use 'approval' steps to gate destructive or expensive actions (e.g. before
publish_brief_to_wp loops, insert an 'approval' step labeled "User reviews
generated briefs"). Use 'manual' for things the user must do (e.g.
"Connect Google Search Console" if connections gaps are detected).

═══ OUTPUT — STRICT JSON ════════════════════════════════════════════════

Return ONLY a JSON object, no markdown fences, no prose:

{
  "goal": "string — restate the user's goal sharply",
  "summary": "2-3 sentence rationale for this plan in particular",
  "context": { /* normalized: services, areas, business_model, deadline, focus */ },
  "steps": [
    {
      "sequence": 1,
      "kind": "research|strategy|analyze|brief|page|publish|audit|approval|manual",
      "label": "Short imperative",
      "description": "1-2 sentence reason this step exists and what it produces",
      "action": "/api/kotoiq action key OR null for approval/manual",
      "params": { /* concrete dispatch payload */ },
      "depends_on": [/* sequence numbers */]
    }
    // … 5-15 steps total
  ]
}

CONSTRAINTS:
  • Sequences are 1..N and unique
  • depends_on may only reference earlier sequence numbers (no cycles)
  • At least one 'approval' step before any 'publish' step
  • Don't propose tools/actions not in the catalog above
  • Don't invent params not documented in the tool catalog
`

// ── Public entrypoint ──────────────────────────────────────────────────
export async function buildPlan(
  s: SupabaseClient,
  body: PlanBuilderInput,
): Promise<{ plan_id: string; draft: PlanDraft }> {
  const { client_id, agency_id, goal, context } = body
  if (!client_id) throw new Error('client_id required')
  if (!goal?.trim()) throw new Error('goal required')

  // Pull lightweight client context so the model can reference real services / website
  const { data: client } = await s.from('clients')
    .select('name, website, primary_service, target_customer, marketing_budget, onboarding_answers, state, city')
    .eq('id', client_id)
    .maybeSingle()

  const userPrompt = JSON.stringify({
    goal,
    client: client ? {
      name: client.name,
      website: client.website,
      primary_service: client.primary_service,
      target_customer: client.target_customer,
      marketing_budget: client.marketing_budget,
      state: client.state,
      city: client.city,
    } : null,
    extra_context: context || {},
  })

  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-6-20250627',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('').trim()
  const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: Omit<PlanDraft, 'meta'>
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    const err = e as Error
    throw new Error(`Planner returned non-JSON: ${err.message}. First 200 chars: ${jsonStr.slice(0, 200)}`)
  }

  const inputTokens  = msg.usage?.input_tokens  || 0
  const outputTokens = msg.usage?.output_tokens || 0
  const cost_usd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15

  void logTokenUsage({
    feature: 'kotoiq_plan_builder',
    model: 'claude-sonnet-4-6',
    inputTokens, outputTokens,
    agencyId: agency_id,
  })

  const meta = {
    model: 'claude-sonnet-4-6-20250627',
    cost_usd: Math.round(cost_usd * 10000) / 10000,
    generated_at: new Date().toISOString(),
  }
  const draft: PlanDraft = {
    goal: parsed.goal || goal,
    summary: parsed.summary || '',
    steps: parsed.steps || [],
    context: parsed.context || context || {},
    meta,
  }

  // Persist as a DRAFT plan
  const { data: planRow, error: planErr } = await s.from('kotoiq_plans').insert({
    client_id, agency_id: agency_id || null,
    goal: draft.goal,
    summary: draft.summary,
    status: 'draft',
    context: draft.context,
    meta,
  }).select('id').single()
  if (planErr) throw new Error(`plan insert: ${planErr.message}`)
  const plan_id = (planRow as { id: string }).id

  // Insert steps
  if (draft.steps.length > 0) {
    const stepRows = draft.steps.map(st => ({
      plan_id,
      sequence: st.sequence,
      kind: st.kind,
      label: st.label,
      description: st.description || null,
      action: st.action || null,
      params: st.params || {},
      depends_on: st.depends_on || [],
      status: 'pending' as const,
    }))
    const { error: stErr } = await s.from('kotoiq_plan_steps').insert(stepRows)
    if (stErr) throw new Error(`steps insert: ${stErr.message}`)
  }

  return { plan_id, draft }
}
