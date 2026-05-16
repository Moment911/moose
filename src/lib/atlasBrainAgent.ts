// ─────────────────────────────────────────────────────────────
// Atlas Brain — Ask KotoIQ as a tool-using agent.
// Wraps a curated subset of /api/kotoiq actions as Claude tools
// and runs a tool-use loop. The agent plans, runs audits, fetches
// data, and synthesizes a grounded answer with a full trace.
//
// Sister to askKotoIQEngine.ts: that one is one-shot context+LLM.
// This one chains real engine work via tool calls.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
const MAX_ITERATIONS = 8
const TOOL_OUTPUT_BUDGET = 3000   // chars per tool result fed back to Claude
const TRACE_OUTPUT_BUDGET = 280   // chars per tool output shown in UI trace

interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface AgentBody {
  client_id?: string
  agency_id?: string
  message: string
  conversation_id?: string
  conversation_history?: ChatMessage[]
}
interface TraceStep {
  tool: string
  input: Record<string, any>
  output_summary: string
  ok: boolean
  ms: number
}
interface SuggestedAction {
  label: string
  action_name: string
  params: Record<string, any>
}

interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, any>
  action: string
}

// ── Curated tool catalog ─────────────────────────────────────
// Each tool maps to an existing /api/kotoiq action. Keep this
// list tight: every additional tool is more decision surface
// the agent has to navigate.
const TOOLS: ToolDef[] = [
  // ── Read / lookup ─────────────────────────────────────────
  {
    name: 'get_dashboard',
    description: 'Fetch this client\'s SEO dashboard — keyword overview, top quick-win opportunities, AI visibility score, traffic snapshot. Use first to orient yourself before recommending actions.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'dashboard',
  },
  {
    name: 'get_keywords',
    description: 'List tracked keywords for this client with position, volume, and opportunity score. Optionally filter to a single category (e.g. striking_distance, quick_win).',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter, e.g. striking_distance, quick_win, money, branded' },
      },
      required: [],
    },
    action: 'keywords',
  },
  {
    name: 'get_recommendations',
    description: 'List open recommendations for this client, ordered by priority. Use to see what\'s already been queued before proposing new actions.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'recommendations',
  },
  {
    name: 'get_content_inventory',
    description: 'Fetch the client\'s content inventory — pages with freshness, priority, position trend, and trajectory.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'get_content_inventory',
  },

  // ── Audits ───────────────────────────────────────────────
  {
    name: 'audit_technical_deep',
    description: 'Run a deep technical SEO audit. Returns crawl issues, render-diff problems, redirect chains, and a numeric score. Use when diagnosing structural problems.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'audit_technical_deep',
  },
  {
    name: 'audit_eeat',
    description: 'Audit the client site for E-E-A-T (Experience, Expertise, Authoritativeness, Trust) signals. Important for YMYL pages and post-update recoveries.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'audit_eeat',
  },
  {
    name: 'audit_schema',
    description: 'Audit Schema.org markup across the client site — finds missing, broken, or weak schema.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'audit_schema',
  },
  {
    name: 'analyze_competitors',
    description: 'Run a competitor analysis comparing this client to tracked competitors across SEO dimensions.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'analyze_competitors',
  },
  {
    name: 'analyze_backlinks',
    description: 'Analyze the client\'s backlink profile — referring domains, anchor distribution, toxic links.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'analyze_backlinks',
  },
  {
    name: 'aeo_research',
    description: 'Deep AEO (answer-engine-optimization) research on a specific user prompt. Probes the 5 LLM engines and returns who got cited and why. Use when the user asks about visibility in AI answers.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The user-facing prompt to probe, e.g. "best emergency plumber in boca raton"' },
      },
      required: ['query'],
    },
    action: 'aeo_research',
  },
  {
    name: 'scan_brand_serp',
    description: 'Scan the Google SERP for the client\'s brand name itself — knowledge panel, sitelinks, reputation surface.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'scan_brand_serp',
  },
  {
    name: 'gmb_health',
    description: 'Check Google Business Profile health — categories, posts, Q&A, reviews, image freshness.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'gmb_health',
  },

  // ── Generate / write ─────────────────────────────────────
  {
    name: 'generate_brief',
    description: 'Generate a full content brief (target keyword, outline, word count, internal links). Use after identifying a worthwhile keyword opportunity.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Target keyword' },
        page_type: { type: 'string', enum: ['service_page', 'location_page', 'blog_post', 'landing_page'], description: 'Page type — defaults to service_page if omitted' },
      },
      required: ['keyword'],
    },
    action: 'generate_brief',
  },
  {
    name: 'generate_schema_for_url',
    description: 'Generate Schema.org JSON-LD markup for a specific URL on the client site.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to generate schema for' },
      },
      required: ['url'],
    },
    action: 'generate_schema_for_url',
  },
  {
    name: 'roi_projections',
    description: 'Generate ROI projections under multiple growth scenarios. Useful for client reporting or proving the value of SEO work.',
    input_schema: { type: 'object', properties: {}, required: [] },
    action: 'roi_projections',
  },
  {
    name: 'recommend_local_strategy',
    description: 'Generate a complete 2026 hyperlocal SEO/AEO strategy: URL structure, topic clusters (pillar + service×city + neighborhood), schema plan (Service/Place/LocalBusiness for service-area businesses), AEO entity strategy for AI Overviews, internal linking pattern, and a phased multi-week attack plan. Persists every cluster as a page suggestion in Page Factory. Use when the user wants to design a local service business\'s page architecture from scratch, or expand into new service areas.',
    input_schema: {
      type: 'object',
      properties: {
        business_name: { type: 'string', description: 'Client business name, e.g. "Acme Plumbing & Heating"' },
        business_model: {
          type: 'string',
          enum: ['service_area', 'storefront', 'hybrid', 'multi_location'],
          description: 'service_area = SAB driving to customers; storefront = single brick-and-mortar; hybrid = both; multi_location = chain with multiple physical locations',
        },
        services: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of services offered, e.g. ["water heater repair", "drain cleaning"]',
        },
        areas: {
          type: 'array',
          description: 'Target cities/areas. Each requires city + state (2-letter); is_primary flags the HQ city.',
          items: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              state: { type: 'string', description: '2-letter state code' },
              is_primary: { type: 'boolean' },
            },
            required: ['city', 'state'],
          },
        },
        notes: { type: 'string', description: 'Optional context — voice, ranking pain points, brands to avoid.' },
      },
      required: ['business_name', 'business_model', 'services', 'areas'],
    },
    action: 'recommend_local_strategy',
  },
]

const TOOL_BY_NAME: Record<string, ToolDef> = Object.fromEntries(TOOLS.map(t => [t.name, t]))

// ── Helpers ──────────────────────────────────────────────────
function clipJson(obj: unknown, maxChars: number): string {
  let s: string
  try { s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }
  catch { s = String(obj) }
  if (s.length <= maxChars) return s
  return s.slice(0, maxChars) + `\n\n…[truncated ${s.length - maxChars} chars]`
}

async function dispatchTool(
  toolName: string,
  input: Record<string, any>,
  clientId: string | undefined,
  agencyId: string | undefined,
): Promise<{ ok: boolean; json: any; ms: number }> {
  const meta = TOOL_BY_NAME[toolName]
  if (!meta) {
    return { ok: false, json: { error: `Unknown tool: ${toolName}` }, ms: 0 }
  }
  const t0 = Date.now()
  try {
    const res = await fetch(`${APP_URL}/api/kotoiq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: meta.action,
        client_id: clientId,
        agency_id: agencyId,
        ...(input || {}),
      }),
    })
    const json = await res.json()
    return { ok: res.ok && !json?.error, json, ms: Date.now() - t0 }
  } catch (e: any) {
    return { ok: false, json: { error: String(e?.message || e) }, ms: Date.now() - t0 }
  }
}

// ── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Atlas — KotoIQ's autonomous AI search-intelligence analyst. You answer questions about a client's SEO, AEO, content, authority, and PPC by USING TOOLS to fetch real data and run audits.

CORE RULES:
- Always ground your answer in real tool output. Never invent numbers.
- Plan first: think briefly about which 1-3 tools you need, then run them. Prefer running tools in parallel within a single turn when they don't depend on each other.
- If a tool errors or returns empty data, try a different angle or acknowledge the gap honestly.
- Hard limit: 6 tool calls per question. Be efficient.
- After gathering data, write a concise expert answer: lead with the conclusion, then bullet the supporting evidence with specific numbers from the tool output.
- For follow-up actions the user could click to run, append a JSON block at the very end:
  <ACTIONS>[{"label":"...","action_name":"<existing /api/kotoiq action>","params":{...}}]</ACTIONS>
- Voice: concise, expert, practical. No fluff, no hedging filler, no "I'd be happy to help" preambles.`

// ── Main entrypoint ──────────────────────────────────────────
export async function runAtlasBrain(s: SupabaseClient, ai: Anthropic, body: AgentBody) {
  const { client_id, agency_id, message, conversation_id, conversation_history } = body
  if (!message?.trim()) throw new Error('message required')

  const history = (conversation_history || [])
    .slice(-10)
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }))

  const messages: any[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const trace: TraceStep[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let finalText = ''
  let stopReason = ''

  const anthropicTools = TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as any,
  }))

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const resp = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    })
    totalInputTokens += resp.usage?.input_tokens || 0
    totalOutputTokens += resp.usage?.output_tokens || 0
    stopReason = resp.stop_reason || ''

    // Append assistant turn (preserves both text + tool_use blocks)
    messages.push({ role: 'assistant', content: resp.content })

    const toolUses = (resp.content as any[]).filter(c => c.type === 'tool_use')

    if (toolUses.length === 0) {
      const textBlocks = (resp.content as any[]).filter(c => c.type === 'text')
      finalText = textBlocks.map(b => b.text).join('\n').trim()
      break
    }

    // Run tools in parallel
    const results = await Promise.all(
      toolUses.map(async (tu: any) => {
        const { ok, json, ms } = await dispatchTool(tu.name, tu.input || {}, client_id, agency_id)
        const fullSummary = clipJson(json, TOOL_OUTPUT_BUDGET)
        trace.push({
          tool: tu.name,
          input: tu.input || {},
          output_summary: fullSummary.length > TRACE_OUTPUT_BUDGET ? fullSummary.slice(0, TRACE_OUTPUT_BUDGET) + '…' : fullSummary,
          ok,
          ms,
        })
        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: fullSummary,
          is_error: !ok,
        }
      })
    )

    messages.push({ role: 'user', content: results })
  }

  if (!finalText) {
    finalText = stopReason === 'max_tokens'
      ? '(Atlas reached its token budget mid-thought. The trace above shows what it explored. Try a tighter question.)'
      : '(Atlas hit the iteration cap before producing a final answer. The tool trace above shows what it explored.)'
  }

  void logTokenUsage({
    feature: 'kotoiq_atlas_agent',
    model: 'claude-sonnet-4-6',
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    agencyId: agency_id,
  })

  // Parse <ACTIONS> follow-ups (mirrors askKotoIQ contract)
  let assistantText = finalText
  let suggestedActions: SuggestedAction[] = []
  const actionsMatch = finalText.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/)
  if (actionsMatch) {
    try {
      const parsed = JSON.parse(actionsMatch[1].trim())
      if (Array.isArray(parsed)) {
        suggestedActions = parsed
          .filter(a => a && a.label && a.action_name)
          .map(a => ({
            label: String(a.label),
            action_name: String(a.action_name),
            params: a.params || {},
          }))
      }
    } catch { /* ignore malformed */ }
    assistantText = finalText.replace(/<ACTIONS>[\s\S]*?<\/ACTIONS>/, '').trim()
  }

  // Embed trace as a hidden marker block — UI extracts on render.
  // Zero schema migration needed; reuses existing content column.
  const contentForStorage = trace.length
    ? `${assistantText}\n\n<AGENT_TRACE>${JSON.stringify(trace)}</AGENT_TRACE>`
    : assistantText

  // Persist conversation (retry-tolerant — schema drift safety)
  let convId = conversation_id
  try {
    if (!convId) {
      const title = message.length > 80 ? message.slice(0, 80) + '...' : message
      const { data: conv } = await s.from('kotoiq_chat_conversations').insert({
        client_id: client_id || null,
        agency_id: agency_id || null,
        title,
      }).select().single()
      convId = conv?.id
    } else {
      await s.from('kotoiq_chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
    }

    if (convId) {
      await s.from('kotoiq_chat_messages').insert([
        { conversation_id: convId, role: 'user', content: message },
        {
          conversation_id: convId,
          role: 'assistant',
          content: contentForStorage,
          data_used: trace.map(t => t.tool),
          suggested_actions: suggestedActions,
          tokens_input: totalInputTokens,
          tokens_output: totalOutputTokens,
        },
      ])
    }
  } catch { /* non-fatal */ }

  return {
    conversation_id: convId,
    message: assistantText,
    trace,
    suggested_actions: suggestedActions,
    iterations: trace.length,
    tokens_input: totalInputTokens,
    tokens_output: totalOutputTokens,
  }
}
