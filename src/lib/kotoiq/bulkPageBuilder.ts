// ─────────────────────────────────────────────────────────────────────────
// Bulk Page Builder — chain orchestration for Page Factory.
//
// Wraps the existing generateBrief() engine in two ways:
//
//   1) bulkGenerateBriefs(s, ai, { client_id, suggestion_ids? | limit, ... })
//        Pulls N approved page_suggestions (or specific IDs), generates a
//        brief for each, links the brief back to the suggestion via metadata,
//        and bumps each suggestion's status to 'built'. Sequential to stay
//        inside Vercel's 300s function cap — caller is expected to invoke
//        repeatedly until counts.remaining hits 0.
//
//   2) publishBriefToWp(s, { brief_id, site_id })
//        Calls the existing /api/wp generate_pages endpoint to render the
//        brief as a WordPress post and persist the publish record.
//
// Both functions return concise summaries so KotoIQ (or any chat
// orchestration) can iterate cleanly.
// ─────────────────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { generateBrief } from '@/lib/contentBriefEngine'
import { computeInternalLinks, type ComputeInternalLinksResult } from '@/lib/wp-shim/computeInternalLinks'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
const VERCEL_BUDGET_MS = 240_000   // 4 minutes; leaves headroom under the 300s cap
const BRIEF_BUDGET_MS  = 60_000    // a single brief takes ~30-50s typically

export interface BulkGenerateInput {
  client_id: string
  agency_id?: string
  suggestion_ids?: string[]          // explicit list; takes precedence over filter
  limit?: number                     // default 5, max 20
  words_target?: number              // optional override per brief
  campaign_label?: string            // human-friendly group name stored on metadata
}

export interface BulkGenerateOutput {
  ok: true
  campaign_label?: string
  generated: Array<{
    suggestion_id: string
    brief_id: string
    title: string
    url: string
    word_count_target: number
    ms: number
  }>
  failed: Array<{ suggestion_id: string; reason: string; ms: number }>
  remaining: number                  // how many approved suggestions still pending — re-call to continue
  total_ms: number
}

export async function bulkGenerateBriefs(
  s: SupabaseClient,
  ai: Anthropic,
  body: BulkGenerateInput,
): Promise<BulkGenerateOutput> {
  const { client_id, agency_id, suggestion_ids, words_target, campaign_label } = body
  if (!client_id) throw new Error('client_id required')

  const limit = Math.min(Math.max(body.limit ?? 5, 1), 20)

  // Pull the work queue: either explicit IDs, or the top-N approved
  // suggestions ordered by priority then age.
  let queue: Array<{
    id: string; service: string; city: string; state: string;
    priority: number; reason: string | null; metadata: Record<string, unknown> | null;
  }>
  if (suggestion_ids && suggestion_ids.length > 0) {
    const { data } = await s.from('kotoiq_page_suggestions')
      .select('id, service, city, state, priority, reason, metadata')
      .in('id', suggestion_ids)
      .eq('client_id', client_id)
    queue = (data || []) as typeof queue
  } else {
    const { data } = await s.from('kotoiq_page_suggestions')
      .select('id, service, city, state, priority, reason, metadata')
      .eq('client_id', client_id)
      .in('status', ['accepted', 'suggested'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)
    queue = (data || []) as typeof queue
  }

  if (queue.length === 0) {
    return { ok: true, campaign_label, generated: [], failed: [], remaining: 0, total_ms: 0 }
  }

  const t0 = Date.now()
  const generated: BulkGenerateOutput['generated'] = []
  const failed: BulkGenerateOutput['failed'] = []

  for (const row of queue) {
    // Respect the wall-clock budget so we don't 504 on Vercel
    if (Date.now() - t0 + BRIEF_BUDGET_MS > VERCEL_BUDGET_MS) break

    const sg0 = Date.now()
    try {
      // Build the keyword from the suggestion. Prefer reason if it contains
      // a real target query (e.g. "Water heater repair Austin"), otherwise
      // synthesize from service + city + state.
      const meta = row.metadata || {}
      const explicitH1 = typeof meta === 'object' && 'h1' in meta ? String((meta as { h1?: unknown }).h1 ?? '') : ''
      const keywordCore = row.service.replace(/-/g, ' ')
      const locationTail = [row.city, row.state].filter(Boolean).join(' ')
      const keyword = explicitH1 || `${keywordCore}${locationTail ? ' ' + locationTail : ''}`

      // Mark generating
      await s.from('kotoiq_page_suggestions')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', row.id)

      const brief = await generateBrief(s, ai, {
        client_id,
        agency_id,
        keyword,
        page_type: row.city ? 'location_page' : 'service_page',
        words_target,
      } as Parameters<typeof generateBrief>[2])

      const brief_id = (brief as { id?: string; brief_id?: string }).id || (brief as { brief_id?: string }).brief_id || ''
      const title    = (brief as { title?: string }).title || keyword

      // Link brief back to suggestion + mark built
      await s.from('kotoiq_page_suggestions').update({
        status: 'built',
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof row.metadata === 'object' && row.metadata ? row.metadata : {}),
          brief_id,
          built_at: new Date().toISOString(),
          campaign_label: campaign_label || null,
        },
      }).eq('id', row.id)

      generated.push({
        suggestion_id: row.id,
        brief_id,
        title,
        url: row.service ? `/${row.service}/${row.state}/${row.city}/`.toLowerCase() : '',
        word_count_target: (brief as { word_count_target?: number }).word_count_target ?? 0,
        ms: Date.now() - sg0,
      })
    } catch (e) {
      const err = e as Error
      failed.push({ suggestion_id: row.id, reason: err.message || 'unknown', ms: Date.now() - sg0 })
      // Reset status so a retry can pick it up
      await s.from('kotoiq_page_suggestions')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', row.id)
    }
  }

  // Count what's still pending across the whole approved queue
  const { count } = await s.from('kotoiq_page_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .in('status', ['accepted', 'suggested'])

  return {
    ok: true,
    campaign_label,
    generated,
    failed,
    remaining: count ?? 0,
    total_ms: Date.now() - t0,
  }
}

// ── Publish one brief to WordPress ──────────────────────────────────────
export interface PublishToWpInput {
  client_id: string
  agency_id?: string
  brief_id: string
  site_id?: string                   // optional override; otherwise resolve from client
}

export interface PublishToWpOutput {
  ok: boolean
  wp_post_id?: number
  url?: string
  publish_id?: string
  error?: string
}

/**
 * Compute the sibling / cross-campaign / hub internal links for a Page Factory
 * build (Phase 11 / WS6). Reuses the SAME computeInternalLinks helper that
 * deployCampaign uses — Page Factory pages get the same auto-linking as topic
 * campaigns, no new injector. Returns null when no topic campaign exists for the
 * brief's service on this site (nothing to cross-link yet) so the caller simply
 * publishes without links.
 *
 * The brief's service+city come from its linked page_suggestion (set in
 * bulkGenerateBriefs metadata.suggestion_id). The topic campaign for that
 * service supplies the campaignId/hub the helper reads against.
 */
async function computeFactoryInternalLinks(
  s: SupabaseClient,
  opts: { site_id: string; brief_id: string },
): Promise<{ links: ComputeInternalLinksResult; city: string } | null> {
  // Find the suggestion this brief was built from → service / city / state.
  const { data: brief } = await s.from('kotoiq_content_briefs')
    .select('id, semantic_data')
    .eq('id', opts.brief_id)
    .maybeSingle()
  if (!brief) return null

  const { data: suggestion } = await s.from('kotoiq_page_suggestions')
    .select('service, city, state, campaign_id')
    .contains('metadata', { brief_id: opts.brief_id })
    .maybeSingle()
  if (!suggestion || !suggestion.city) return null

  // The topic campaign on this site for the suggestion's service supplies the
  // campaignId + hub the link helper reads against. Match by topic ≈ service.
  const { data: campaign } = await s.from('koto_topic_campaigns')
    .select('id, hub_url, topic')
    .eq('site_id', opts.site_id)
    .ilike('topic', `%${String(suggestion.service || '').trim()}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // No campaign yet → nothing to sibling/cross-link against; publish plain.
  if (!campaign) return null

  const links = await computeInternalLinks(s as any, {
    siteId: opts.site_id,
    campaignId: campaign.id,
    // This factory page is the "new sibling" for its own city — prior published
    // siblings + cross-campaign come from the DB reads inside the helper.
    newSiblings: [],
    ...(campaign.hub_url
      ? { hub: { url: campaign.hub_url, title: String(campaign.topic || suggestion.service || '') } }
      : {}),
  })
  return { links, city: String(suggestion.city) }
}

export async function publishBriefToWp(
  s: SupabaseClient,
  body: PublishToWpInput,
): Promise<PublishToWpOutput> {
  const { client_id, agency_id, brief_id } = body
  if (!client_id) throw new Error('client_id required')
  if (!brief_id)  throw new Error('brief_id required')

  // Resolve the target site
  let site_id = body.site_id
  if (!site_id) {
    const { data: site } = await s.from('koto_wp_sites')
      .select('id')
      .eq('client_id', client_id)
      .eq('connected', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!site) return { ok: false, error: 'No connected WordPress site found for this client' }
    site_id = (site as { id: string }).id
  }

  // WS6: compute sibling + cross-campaign + hub internal links for this build so
  // the page is woven into the cluster — same machinery as deployCampaign. The
  // APPROVAL GATE is retained: publishBriefToWp only runs on operator-approved
  // briefs and the build publishes as a draft (no auto-publish — CONTEXT deferred).
  // Failures here never block the publish (best-effort linking).
  let internalLinks: { siblingLinks: unknown[]; relatedServices: unknown[]; hub?: unknown } | null = null
  try {
    const computed = await computeFactoryInternalLinks(s, { site_id: site_id!, brief_id })
    if (computed) {
      const cityKey = `${computed.city.toLowerCase().trim()}|`
      // crossByCity is keyed `city|STATE`; collect any state's bucket for this city.
      const related: unknown[] = []
      for (const [key, bucket] of computed.links.crossByCity.entries()) {
        if (key.startsWith(cityKey)) related.push(...bucket)
      }
      internalLinks = {
        siblingLinks: computed.links.siblingLinks,
        relatedServices: related,
        ...(computed.links.hub ? { hub: computed.links.hub } : {}),
      }
    }
  } catch {
    // Best-effort: linking failure must not block the page build.
  }

  // Delegate to the existing /api/wp endpoint
  try {
    const res = await fetch(`${APP_URL}/api/wp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_pages',
        client_id,
        agency_id,
        site_id,
        brief_ids: [brief_id],
        ...(internalLinks ? { internal_links: internalLinks } : {}),
      }),
    })
    const json = await res.json() as {
      error?: string
      pages?: Array<{ wp_post_id: number; url: string; publish_id?: string }>
    }
    if (!res.ok || json.error) {
      return { ok: false, error: json.error || `WP publish HTTP ${res.status}` }
    }
    const first = json.pages?.[0]
    if (!first) return { ok: false, error: 'WP responded ok but returned no pages' }
    return {
      ok: true,
      wp_post_id: first.wp_post_id,
      url: first.url,
      publish_id: first.publish_id,
    }
  } catch (e) {
    const err = e as Error
    return { ok: false, error: err.message || 'WP publish request failed' }
  }
}
