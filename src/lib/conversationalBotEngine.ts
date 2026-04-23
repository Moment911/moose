// ─────────────────────────────────────────────────────────────
// KotoIQ Conversational Bot Engine
// Natural-language assistant that maps user intent to KotoIQ
// actions, asks clarifying questions, and emits a structured
// <ACTION> block the UI parses to pre-fill forms or execute.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-20250514'

interface BotMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AvailableClient {
  id: string
  name: string
  website?: string
  primary_service?: string
  location?: string
}

interface BotBody {
  client_id?: string
  agency_id?: string
  conversation_id?: string
  message: string
  conversation_history?: BotMessage[]
  current_tab?: string
  current_form_state?: Record<string, any>
  available_clients?: AvailableClient[]
}

interface BotAction {
  intent: string
  tab_to_open: string
  form_fields: Record<string, any>
  should_execute: boolean
  next_question?: string
  client_id?: string
}

// ── System Prompt — the brain of the assistant ─────────────────────────────
const SYSTEM_PROMPT = `You are KotoIQ Assistant — a friendly, expert SEO co-pilot inside the KotoIQ platform.

YOUR JOB
Help the user accomplish SEO/content/local tasks through natural conversation. You map what they ask for to the right KotoIQ tool, ask only the questions you truly need, then output a structured <ACTION> block the UI uses to pre-fill the form or execute it.

TONE
Friendly expert. Plain language. No SEO jargon unless the user uses it first. Keep responses short — 1–3 sentences plus the action block. Never use the word "Koray".

AVAILABLE INTENTS (map user goals → these)
- generate_brief — write/draft new content (blog, page, article). tab: "briefs". fields: keyword (required), page_type (blog_post|service_page|location_page|home|about), target_url (optional), notes (optional)
- run_on_page_audit — analyze existing page on-page SEO. tab: "on_page". fields: url (required), target_keyword (optional)
- score_aeo — AI/answer-engine optimization scoring (single engine). tab: "aeo". fields: url (required), target_query (required)
- aeo_multi_engine — multi-engine AEO (ChatGPT, Perplexity, Gemini). tab: "aeo". fields: url (required), target_query (required)
- build_topical_map — generate topical authority map for a niche. tab: "topical_map". fields: seed_topic (required), industry (optional), location (optional)
- check_plagiarism — check content originality. tab: "plagiarism". fields: content (required) OR url (required)
- analyze_competitor — extract competitor's topical map. tab: "competitor_map". fields: competitor_url (required)
- geo_tag_image — add EXIF/geo metadata to GMB images. tab: "gmb_images". fields: image_url (optional), location (optional)
- crawl_sitemap — crawl a site's sitemap. tab: "sitemap_crawler". fields: domain (required)
- generate_strategic_plan — multi-week SEO strategic plan. tab: "strategy". fields: focus_area (optional)
- audit_eeat — Experience, Expertise, Authority, Trust audit. tab: "eeat". fields: url (required)
- find_backlinks — discover backlink opportunities. tab: "backlink_opps". fields: domain (optional), niche (optional)
- analyze_reviews — review intelligence + sentiment. tab: "reviews". fields: (none — uses client GBP)
- run_pipeline — autonomous full-pipeline run. tab: "autopilot". fields: focus (optional)
- analyze_backlinks — existing backlink profile audit. tab: "backlinks". fields: domain (required)
- audit_schema — schema markup audit. tab: "schema". fields: url (required)
- scan_internal_links — internal link audit. tab: "internal_links". fields: domain (optional)
- analyze_query_paths — user-query journey clustering. tab: "query_path". fields: (none)
- analyze_semantic_network — semantic network analysis. tab: "semantic". fields: url (required)
- audit_technical_deep — deep technical SEO audit. tab: "technical_deep". fields: url (required)
- build_content_calendar — content calendar planning. tab: "calendar". fields: weeks (optional, default 12)
- content_refresh_plan — find pages needing refresh. tab: "content_refresh". fields: domain (optional)
- run_rank_grid — local rank grid scan. tab: "rankgrid". fields: keyword (required), business_name (optional)
- gsc_audit — Google Search Console audit. tab: "gsc_audit". fields: (none — uses connected GSC)
- bing_audit — Bing Webmaster Tools audit. tab: "bing_audit". fields: domain (optional)
- brand_serp_scan — brand SERP defense scan. tab: "brand_serp". fields: brand_name (required)
- generate_schema — generate JSON-LD schema for a page. tab: "schema". fields: url (required), schema_type (optional)
- knowledge_graph_export — export entity knowledge graph. tab: "knowledge_graph". fields: (none)
- hyperlocal_content — hyperlocal content from grid scan. tab: "hyperlocal". fields: keyword (required), location (required)
- watermark_remove — remove AI watermarks from image. tab: "watermark". fields: image_url (required)
- upwork_checklist — analyze Upwork SEO job posting. tab: "upwork". fields: job_url (required) OR job_text (required)
- passage_optimize — optimize content passages for ranking. tab: "passage". fields: url (required), target_query (required)
- context_align — align content with search intent context. tab: "context_aligner". fields: url (required), target_query (required)
- topical_authority — measure topical authority score. tab: "topical_authority". fields: domain (optional)
- content_decay — predict content decay. tab: "content_decay". fields: domain (optional)
- ask_kotoiq — open-ended question about the data. tab: "ask". fields: question (required)
- competitor_watch — set up competitor monitoring. tab: "competitor_watch". fields: competitor_domain (required)
- bulk_operation — bulk action across many keywords/pages. tab: "bulk". fields: operation (required)
- pick_client — user has no active client; show a client-picker UI so they can choose or create one. tab: "picker". fields: suggestions (array of {id, name, reason} — up to 3, ranked by relevance from AVAILABLE CLIENTS), original_intent (string — the intent they were trying to do, e.g. "generate_brief"), original_fields (object — their partial form_fields so far, e.g. { keyword: "autism treatment", page_type: "blog_post" }), prompt (short string — what you're asking, e.g. "Which client is this for?"). should_execute MUST be false for this intent (the UI runs the picker, not the API).

DECISION LOGIC

1. If the user gives you everything you need to act → output the action block with should_execute: true.
2. If you need ONE more piece of info → ask exactly one short question and output the action block with should_execute: false plus next_question.
3. If the request is vague ("help me rank") → ask what topic/keyword/page they care about.
4. If the user asks something not in the intent list → suggest the closest intent and confirm.
5. Multi-step ("write a brief then audit it") → handle the FIRST step now, mention you'll do the next once this finishes.
6. When there is NO active client AND an AVAILABLE CLIENTS list is shown:
   a. If the user names a client (fuzzy match their words against the client's name or website/domain) → set "client_id" to that client's id and fill form_fields using that client's info. should_execute may be true if you have everything.
   b. If the user does NOT name a client but HAS given you enough else (a topic, keyword, URL, etc.) → emit a pick_client action. First scan the AVAILABLE CLIENTS list for names, websites, or primary_service fields that SEMANTICALLY match the user's topic (e.g. "autism treatment" → clients with ABA/therapy/autism in name or primary_service; "plumbing" → plumbing/HVAC clients). Rank up to 3 suggestions by relevance and include a short "reason" for each (e.g. "primary service: ABA therapy"). If nothing semantically matches, return an empty suggestions array — the picker will still let them search/create. Include original_intent (what they were trying to do, e.g. "generate_brief") and original_fields (their partial form_fields). Phrase the message as "Is this for <Name1>, <Name2>, or <Name3>? Or pick a different client / add a new one."
   c. If the user has given you NOTHING usable yet ("help me", "audit my homepage") → ask one short clarifying question first (what topic/URL/keyword), then on the next turn follow rule 6b.
7. "my", "our", "the", "this" + a page/site/brand reference:
   - With an active client → resolve to that client's website/name.
   - Without an active client → do NOT guess. Apply rule 6 (ask for clarification first if needed, then emit pick_client).
8. HARD CORRECTNESS GUARD (never violate): If there is no active client selected AND you are not setting "client_id" in the ACTION block to a real id from AVAILABLE CLIENTS, then "should_execute" MUST be false. PERIOD. No exceptions. Every tool in the intent list requires a client context; running without one produces a "client_id required" API error and a broken UX. When in doubt, emit pick_client with should_execute: false rather than any other intent with should_execute: true.

OUTPUT FORMAT (STRICT)
ALWAYS reply with: a short conversational message, then on a new line the action block.

<ACTION>
{
  "intent": "generate_brief",
  "tab_to_open": "briefs",
  "form_fields": { "keyword": "emergency plumbing boca raton", "page_type": "service_page" },
  "should_execute": true,
  "next_question": null,
  "client_id": null
}
</ACTION>

"client_id" is ONLY used when there is no active client selected AND the user named a client from the AVAILABLE CLIENTS list. In that case, set "client_id" to the matched client's id so the UI can switch. Otherwise omit it or set to null.

MULTIPLE-CHOICE QUESTIONS — CHOICES BLOCK
When you ask a multiple-choice question (the user's answer is one of a small fixed set, e.g. "Blog post or service page?", "Homepage or specific page?", "Which URL: https://x.com or https://y.com?"), ALWAYS append a <CHOICES> block AFTER the <ACTION> block with a JSON array of the choice strings. The UI will render them as clickable buttons. Each choice should be 1-5 words, exactly matching how the user would answer (so the next turn sees their choice verbatim). Do NOT emit <CHOICES> for the pick_client intent — the client-picker UI handles that case. Do NOT emit <CHOICES> for open-ended questions ("What topic?", "What keyword?"). Only emit it when you're asking the user to choose between a small enumerable set.

<CHOICES>
["Blog post", "Service page", "Location page", "Home page"]
</CHOICES>

pick_client EXAMPLE (use when you need a client and none is active):

<ACTION>
{
  "intent": "pick_client",
  "tab_to_open": "picker",
  "form_fields": {
    "suggestions": [
      { "id": "abc-123", "name": "Innovative ABA Therapy", "reason": "primary service: ABA therapy" },
      { "id": "def-456", "name": "Bright Futures Pediatrics", "reason": "healthcare / pediatrics" }
    ],
    "original_intent": "generate_brief",
    "original_fields": { "keyword": "autism treatment", "page_type": "blog_post" },
    "prompt": "Which client is this for?"
  },
  "should_execute": false,
  "next_question": null,
  "client_id": null
}
</ACTION>

If you don't yet have an intent (pure chit-chat or clarification needed first), omit the <ACTION> block entirely.
Use double quotes only, valid JSON, no comments inside the block. The UI parses this — malformed JSON breaks the experience.

FINAL REMINDER — BEFORE YOU EMIT YOUR ACTION BLOCK, CHECK:
- Is there an active client in CONTEXT? If yes → proceed.
- If no → is "client_id" set to a real id from AVAILABLE CLIENTS? If yes → proceed.
- If still no → "should_execute" MUST be false. If the user has given a topic/keyword/URL, use intent "pick_client". Otherwise ask a clarifying question and omit the action block.`

// ── Parse <ACTION> block from Claude response ──────────────────────────────
function parseActionBlock(text: string): { message: string; action: BotAction | null } {
  const match = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i)
  if (!match) return { message: text.trim(), action: null }
  const message = text.replace(match[0], '').trim()
  try {
    const action = JSON.parse(match[1]) as BotAction
    if (!action.intent || !action.tab_to_open) return { message, action: null }
    if (!action.form_fields) action.form_fields = {}
    return { message, action }
  } catch {
    return { message: text.trim(), action: null }
  }
}

// ── Parse <CHOICES> block — optional sibling of <ACTION> that offers the user
// a small fixed set of clickable replies. Stripped from the visible message.
function parseChoicesBlock(text: string): { choices: string[] | null; cleaned: string } {
  const match = text.match(/<CHOICES>\s*([\s\S]*?)\s*<\/CHOICES>/i)
  if (!match) return { choices: null, cleaned: text }
  try {
    const arr = JSON.parse(match[1])
    if (Array.isArray(arr) && arr.length > 0 && arr.every(x => typeof x === 'string')) {
      return { choices: arr, cleaned: text.replace(match[0], '').trim() }
    }
  } catch {}
  return { choices: null, cleaned: text.replace(match[0], '').trim() }
}

// ── Build first-line conversation title from a message ─────────────────────
function deriveTitle(message: string): string {
  const t = message.trim().replace(/\s+/g, ' ')
  return t.length > 80 ? t.slice(0, 77) + '...' : t
}

// ── Main entrypoint ────────────────────────────────────────────────────────
export async function runConversationalBot(s: SupabaseClient, ai: Anthropic, body: BotBody) {
  const { client_id, agency_id, message, conversation_history = [], current_tab, current_form_state, available_clients } = body
  if (!message || typeof message !== 'string') {
    return { error: 'message is required', status: 400 }
  }

  // Load client context so the AI knows *who* it is helping
  let clientContext: { name?: string; website?: string; primary_service?: string; industry?: string } = {}
  if (client_id && agency_id) {
    const { data: client } = await s.from('clients')
      .select('name, website, primary_service, industry')
      .eq('id', client_id).eq('agency_id', agency_id).single()
    if (client) clientContext = client
  }

  // Get or create conversation — always stamp with current client + agency so it stays siloed
  let conversationId = body.conversation_id
  if (conversationId) {
    // Verify this conversation belongs to the active client/agency — prevents cross-silo loads
    const { data: existing } = await s.from('kotoiq_bot_conversations')
      .select('id, client_id, agency_id').eq('id', conversationId).single()
    if (!existing || (client_id && existing.client_id !== client_id) || (agency_id && existing.agency_id !== agency_id)) {
      conversationId = undefined // treat as new — caller tried to attach to wrong silo
    }
  }
  if (!conversationId) {
    const { data: conv } = await s.from('kotoiq_bot_conversations')
      .insert({ client_id: client_id || null, agency_id: agency_id || null, title: deriveTitle(message) })
      .select('id').single()
    conversationId = conv?.id
  }

  // Persist user message
  if (conversationId) {
    await s.from('kotoiq_bot_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })
  }

  // Build messages for Claude — history + current
  const messages = [
    ...conversation_history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ]

  // Inject light context as a leading user note (system used for the prompt)
  const ctxPieces: string[] = []
  if (clientContext.name) ctxPieces.push(`Active client: ${clientContext.name}`)
  if (clientContext.website) ctxPieces.push(`Client website: ${clientContext.website}`)
  if (clientContext.primary_service) ctxPieces.push(`Primary service: ${clientContext.primary_service}`)
  if (clientContext.industry) ctxPieces.push(`Industry: ${clientContext.industry}`)
  if (clientContext.website) {
    ctxPieces.push(`When the user says "my homepage", "my site", "our page", or otherwise implies the active client's own URL, autofill form_fields.url with: ${clientContext.website}. Do not ask for the URL unless they clearly mean a different page.`)
  }
  if (clientContext.name) {
    ctxPieces.push(`When a tool needs a domain, brand_name, or business_name, use the client's name/website above — don't ask unless they clearly mean a different entity.`)
  }
  if (current_tab) ctxPieces.push(`User is currently on tab: ${current_tab}`)
  if (current_form_state && Object.keys(current_form_state).length) {
    ctxPieces.push(`Current form state: ${JSON.stringify(current_form_state).slice(0, 400)}`)
  }

  // If there's no active client but we have an agency client list, surface it to Claude
  // so it can match names and populate client_id in the ACTION block.
  let clientListBlock = ''
  if (!client_id && Array.isArray(available_clients) && available_clients.length) {
    const rows = available_clients.slice(0, 100).map(c => {
      const bits = [c.name]
      if (c.website) bits.push(`(${c.website})`)
      const tail: string[] = []
      if (c.primary_service) tail.push(c.primary_service)
      if (c.location) tail.push(c.location)
      const suffix = tail.length ? ` — ${tail.join(' · ')}` : ''
      return `- id=${c.id} | ${bits.join(' ')}${suffix}`
    }).join('\n')
    clientListBlock = `\n\nAVAILABLE CLIENTS (no active client selected — the user must name one or you must ask which)\n${rows}\n\nIf the user names one of these clients (fuzzy match on name or website/domain — e.g. "RDC" matches "RDC Construction", "innovative aba" matches "Innovative ABA Therapy"), emit an ACTION block with the matching client's id in the "client_id" field and populate form_fields using that client's website/service/location. If the user does NOT name one, set should_execute: false and ask which client in next_question.`
  } else if (!client_id) {
    clientListBlock = `\n\nNO ACTIVE CLIENT. There are no available clients for this agency, or the list was not provided. If the user references "my site" / "my homepage" / a specific page, ask which client they mean — do not guess.`
  }

  const systemPrompt = ctxPieces.length || clientListBlock
    ? `${SYSTEM_PROMPT}${ctxPieces.length ? `\n\nCONTEXT\n${ctxPieces.join('\n')}` : ''}${clientListBlock}`
    : SYSTEM_PROMPT

  let assistantText = ''
  let inputTokens = 0
  let outputTokens = 0
  try {
    const resp = await ai.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      messages: messages as any,
    })
    assistantText = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    inputTokens = resp.usage?.input_tokens || 0
    outputTokens = resp.usage?.output_tokens || 0
    void logTokenUsage({
      feature: 'kotoiq_conversational_bot',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: agency_id,
    })
  } catch (e: any) {
    return { error: 'AI call failed: ' + (e?.message || String(e)), status: 500 }
  }

  const { message: humanMessage, action } = parseActionBlock(assistantText)
  const { choices: parsedChoices, cleaned: cleanedMessage } = parseChoicesBlock(humanMessage)
  // Don't render choice chips for the pick_client flow — its picker UI handles selection.
  const choices = action?.intent === 'pick_client' ? null : parsedChoices

  // Server-side safety net — belt-and-braces correctness guard mirroring rule #8
  // in the system prompt. If the model ignored the rule and tried to execute a
  // tool without a client, we demote should_execute to false so the UI never
  // fires a broken API call.
  if (action && action.should_execute && !client_id && !action.client_id) {
    action.should_execute = false
    if (!action.next_question && action.intent !== 'pick_client') {
      action.next_question = 'Which client is this for?'
    }
  }

  // Persist assistant message. Choices are stashed in action_data so they survive
  // a round-trip, but history replay doesn't re-render them (clicking an old chip
  // in a reloaded convo is out of scope — the user can just type instead).
  if (conversationId) {
    const actionForPersist = action
      ? (choices ? { ...action, choices } : action)
      : (choices ? { choices } : null)
    await s.from('kotoiq_bot_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: cleanedMessage,
      action_intent: action?.intent || null,
      action_data: actionForPersist,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
    })
    await s.from('kotoiq_bot_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  return {
    conversation_id: conversationId,
    message: cleanedMessage,
    action: action || null,
    choices,
  }
}

// ── Get a single conversation with messages ────────────────────────────────
export async function getBotConversation(s: SupabaseClient, body: { conversation_id: string; client_id?: string; agency_id?: string }) {
  const { conversation_id, client_id, agency_id } = body
  if (!conversation_id) return { error: 'conversation_id required', status: 400 }
  const { data: conversation } = await s.from('kotoiq_bot_conversations')
    .select('*').eq('id', conversation_id).single()
  if (!conversation) return { error: 'not found', status: 404 }
  if (client_id && conversation.client_id !== client_id) return { error: 'not found', status: 404 }
  if (agency_id && conversation.agency_id !== agency_id) return { error: 'not found', status: 404 }
  const { data: messages } = await s.from('kotoiq_bot_messages')
    .select('*').eq('conversation_id', conversation_id).order('created_at', { ascending: true })
  return { conversation, messages: messages || [] }
}

// ── List conversations for client/agency ───────────────────────────────────
export async function listBotConversations(s: SupabaseClient, body: { client_id?: string; agency_id?: string; limit?: number }) {
  const { client_id, agency_id, limit = 50 } = body
  let q = s.from('kotoiq_bot_conversations').select('*').order('last_message_at', { ascending: false }).limit(limit)
  if (client_id) q = q.eq('client_id', client_id)
  else if (agency_id) q = q.eq('agency_id', agency_id)
  const { data } = await q
  return { conversations: data || [] }
}
