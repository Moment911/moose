// ─────────────────────────────────────────────────────────────
// /api/reddit-leads
//
// Reddit lead-gen v0 (dogfood). Find buyer-intent threads, AI-score them,
// AI-draft a reply on demand. A HUMAN reviews + posts manually.
//
// Actions:
//   - save_config    { agency_id, client_id, subreddits[], keywords[] }
//   - get_config     { agency_id, client_id }
//   - refresh_feed   { agency_id, client_id }   → search + score NEW threads, upsert, return all
//   - list           { agency_id, client_id }   → stored leads, ranked
//   - draft          { agency_id, id }           → lazy draft (reuses stored draft if present)
//   - update_status  { agency_id, id, status }
//
// Every query is scoped by agency_id (agency isolation). client_id points at
// the agency's own client row (Momenta dogfooding its own brand).
//
//   refresh_feed pipeline:
//     config ─> searchReddit(sort=new) ─> filter to NEW (not already stored)
//            ─> scoreThreads (1 Claude call) ─> batch upsert ─> ranked return
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pick } from '@/lib/kotoClientPick'
import { searchReddit, RedditRateLimitError, type RedditThread } from '@/lib/redditLeads/redditClient'
import { scoreThreads, type ClientContext } from '@/lib/redditLeads/intentScorer'
import { draftReply } from '@/lib/redditLeads/draftGenerator'

export const maxDuration = 120

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const VALID_STATUS = ['new', 'drafted', 'posted', 'skipped']

async function loadClientContext(sb: any, agency_id: string, client_id: string): Promise<ClientContext | null> {
  const { data: client } = await sb
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .eq('agency_id', agency_id)
    .maybeSingle()
  if (!client) return null
  return {
    businessName: pick(client, 'business_name', 'name', 'company_name') || 'our company',
    primaryService: pick(client, 'primary_service', 'products_services', 'top_services'),
    targetCustomer: pick(client, 'target_customer', 'ideal_customer_desc', 'customer_types'),
    usp: pick(client, 'unique_selling_prop', 'unique_value_prop', 'why_choose_you'),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body
    const sb = getSupabase()

    // ── save_config ──────────────────────────────────────────
    if (action === 'save_config') {
      const { agency_id, client_id, subreddits, keywords } = body
      if (!agency_id || !client_id) {
        return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
      }
      const cleanSubs = (Array.isArray(subreddits) ? subreddits : [])
        .map((s: string) => String(s).replace(/^\/?r\//i, '').trim())
        .filter(Boolean)
      const cleanKw = (Array.isArray(keywords) ? keywords : []).map((k: string) => String(k).trim()).filter(Boolean)
      const { data, error } = await sb
        .from('koto_reddit_config')
        .upsert(
          { agency_id, client_id, subreddits: cleanSubs, keywords: cleanKw, updated_at: new Date().toISOString() },
          { onConflict: 'agency_id,client_id' },
        )
        .select()
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ config: data })
    }

    // ── get_config ───────────────────────────────────────────
    if (action === 'get_config') {
      const { agency_id, client_id } = body
      if (!agency_id || !client_id) {
        return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
      }
      const { data } = await sb
        .from('koto_reddit_config')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('client_id', client_id)
        .maybeSingle()
      return NextResponse.json({ config: data || null })
    }

    // ── refresh_feed ─────────────────────────────────────────
    if (action === 'refresh_feed') {
      const { agency_id, client_id } = body
      if (!agency_id || !client_id) {
        return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
      }
      const { data: config } = await sb
        .from('koto_reddit_config')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('client_id', client_id)
        .maybeSingle()
      if (!config || !config.subreddits?.length || !config.keywords?.length) {
        return NextResponse.json({ error: 'No config — add subreddits and keywords first' }, { status: 400 })
      }
      const ctx = await loadClientContext(sb, agency_id, client_id)
      if (!ctx) return NextResponse.json({ error: 'Client not found for this agency' }, { status: 404 })

      // Search Reddit (sort=new).
      let threads: RedditThread[]
      try {
        threads = await searchReddit({ subreddits: config.subreddits, keywords: config.keywords })
      } catch (e: any) {
        if (e instanceof RedditRateLimitError) {
          return NextResponse.json({ error: 'Reddit rate limited — try again in a minute' }, { status: 429 })
        }
        return NextResponse.json({ error: `Reddit search failed: ${e?.message || 'unknown'}` }, { status: 502 })
      }

      // Only score threads we haven't already stored (avoid re-paying Claude).
      const { data: existing } = await sb
        .from('koto_reddit_leads')
        .select('thread_url')
        .eq('agency_id', agency_id)
        .eq('client_id', client_id)
      const known = new Set((existing || []).map((r: any) => r.thread_url))
      const fresh = threads.filter((t) => !known.has(t.permalink))

      if (fresh.length) {
        const scored = await scoreThreads(fresh, ctx, { agencyId: agency_id, clientId: client_id })
        const scoreById = new Map(scored.map((s) => [s.id, s]))
        const now = new Date().toISOString()
        const rows = fresh.map((t) => {
          const s = scoreById.get(t.id)
          return {
            agency_id,
            client_id,
            thread_url: t.permalink,
            subreddit: t.subreddit,
            title: t.title,
            body_snippet: (t.selftext || '').slice(0, 500),
            intent_score: s?.intent_score ?? 0,
            intent_reason: s?.intent_reason ?? '',
            status: 'new',
            source_url: t.permalink, // provenance
            fetched_at: now,
          }
        })
        // Batch upsert (one round-trip), dedup on (agency_id, client_id, thread_url).
        const { error: upErr } = await sb
          .from('koto_reddit_leads')
          .upsert(rows, { onConflict: 'agency_id,client_id,thread_url', ignoreDuplicates: true })
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      const { data: leads } = await sb
        .from('koto_reddit_leads')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('client_id', client_id)
        .order('intent_score', { ascending: false })
        .limit(200)
      return NextResponse.json({ leads: leads || [], new_count: fresh.length })
    }

    // ── list ─────────────────────────────────────────────────
    if (action === 'list') {
      const { agency_id, client_id } = body
      if (!agency_id || !client_id) {
        return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
      }
      const { data: leads } = await sb
        .from('koto_reddit_leads')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('client_id', client_id)
        .order('intent_score', { ascending: false })
        .limit(200)
      return NextResponse.json({ leads: leads || [] })
    }

    // ── draft (lazy) ─────────────────────────────────────────
    if (action === 'draft') {
      const { agency_id, id } = body
      if (!agency_id || !id) {
        return NextResponse.json({ error: 'agency_id and id required' }, { status: 400 })
      }
      const { data: lead } = await sb
        .from('koto_reddit_leads')
        .select('*')
        .eq('id', id)
        .eq('agency_id', agency_id) // scope
        .maybeSingle()
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

      // Reuse a stored draft — never pay Claude twice for the same thread.
      if (lead.draft_reply) {
        return NextResponse.json({ draft: lead.draft_reply, reused: true })
      }
      const ctx = await loadClientContext(sb, agency_id, lead.client_id)
      if (!ctx) return NextResponse.json({ error: 'Client not found for this agency' }, { status: 404 })

      const threadLike: RedditThread = {
        id: lead.id,
        subreddit: lead.subreddit || '',
        title: lead.title || '',
        selftext: lead.body_snippet || '',
        permalink: lead.thread_url,
        created_utc: 0,
        num_comments: 0,
        score: 0,
      }
      const result = await draftReply(threadLike, ctx, { agencyId: agency_id, clientId: lead.client_id })
      if (!result.ok) return NextResponse.json({ error: 'Draft generation failed — try again' }, { status: 502 })

      await sb
        .from('koto_reddit_leads')
        .update({ draft_reply: result.draft, status: lead.status === 'new' ? 'drafted' : lead.status })
        .eq('id', id)
        .eq('agency_id', agency_id)
      return NextResponse.json({ draft: result.draft, reused: false })
    }

    // ── update_status ────────────────────────────────────────
    if (action === 'update_status') {
      const { agency_id, id, status } = body
      if (!agency_id || !id || !status) {
        return NextResponse.json({ error: 'agency_id, id, status required' }, { status: 400 })
      }
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: `status must be one of ${VALID_STATUS.join(', ')}` }, { status: 400 })
      }
      const { error } = await sb
        .from('koto_reddit_leads')
        .update({ status })
        .eq('id', id)
        .eq('agency_id', agency_id) // scope
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e: any) {
    console.error('[reddit-leads POST fatal]', e)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
