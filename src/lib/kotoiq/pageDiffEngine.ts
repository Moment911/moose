// ─────────────────────────────────────────────────────────────
// Page Diff Engine — Phase B orchestrator
//
// Fetches a tracked URL, extracts structured content, compares
// against the prior snapshot, has Claude Haiku classify the
// diff as meaningful vs noise, persists everything, and fires
// alerts when a meaningful change is detected.
//
// Public entrypoints:
//   - trackPage(s, body)            — start watching a URL
//   - untrackPage(s, body)          — stop
//   - listTrackedPages(s, body)     — for the UI
//   - runPageDiffNow(s, body)       — manual scan one page or all for a client
//   - getPageChanges(s, body)       — paginated timeline for the UI
//   - getPageSnapshot(s, body)      — single snapshot detail
//   - reclassifyChange(s, body)     — user correction (training signal)
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAndExtract, urlDomain, inferPageType, type ExtractedPage } from './pageContentExtractor'
import { classifyChange, computeFieldDiff, type ClassifiedChange } from './changeClassifier'
import { extractPricing } from './pricingExtractor'
import { detectTechStack, type DetectedTech } from './techStackDetector'
import { sendSlackAlert, sendTeamsAlert } from '@/lib/slackTeamsIntegration'

const RAW_HTML_CACHE = new Map<string, string>()   // per-call cache so we don't re-fetch when re-extracting

// ─────────────────────────────────────────────────────────────
// 1. Track / untrack / list
// ─────────────────────────────────────────────────────────────
export async function trackPage(
  s: SupabaseClient,
  body: {
    client_id: string
    url: string
    page_type?: string
    check_frequency?: 'daily' | 'weekly'
    added_by?: string
  },
): Promise<{ tracked_page: any; error?: string }> {
  const { client_id, url, page_type, check_frequency, added_by } = body
  if (!client_id || !url) throw new Error('client_id and url required')

  const competitor_domain = urlDomain(url)
  if (!competitor_domain) throw new Error('invalid url')

  const finalType = page_type || inferPageType(url)

  const { data, error } = await s.from('kotoiq_tracked_pages')
    .upsert({
      client_id,
      competitor_domain,
      url,
      page_type: finalType,
      check_frequency: check_frequency || 'daily',
      is_active: true,
      added_by: added_by || null,
    }, { onConflict: 'client_id,url' })
    .select()
    .single()

  if (error) return { tracked_page: null, error: error.message }
  return { tracked_page: data }
}

export async function untrackPage(s: SupabaseClient, body: { id: string }) {
  if (!body.id) throw new Error('id required')
  const { error } = await s.from('kotoiq_tracked_pages').update({ is_active: false }).eq('id', body.id)
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function listTrackedPages(s: SupabaseClient, body: { client_id: string }) {
  if (!body.client_id) throw new Error('client_id required')

  const { data: pages, error } = await s.from('kotoiq_tracked_pages')
    .select('id, competitor_domain, url, page_type, check_frequency, is_active, last_checked_at, fetch_blocked_until, added_at')
    .eq('client_id', body.client_id)
    .eq('is_active', true)
    .order('competitor_domain', { ascending: true })
    .order('page_type', { ascending: true })

  if (error) throw new Error(error.message)
  if (!pages?.length) return { pages: [] }

  // Annotate each page with its most-recent meaningful change (denormalized for UI speed)
  const ids = pages.map(p => p.id)
  const { data: changes } = await s.from('kotoiq_page_changes')
    .select('tracked_page_id, classification, severity, diff_summary, detected_at')
    .in('tracked_page_id', ids)
    .eq('classification', 'meaningful')
    .order('detected_at', { ascending: false })

  const latestByPage = new Map<string, any>()
  for (const c of changes || []) {
    if (!latestByPage.has(c.tracked_page_id)) latestByPage.set(c.tracked_page_id, c)
  }

  return {
    pages: pages.map(p => ({
      ...p,
      latest_change: latestByPage.get(p.id) || null,
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Run a scan
// ─────────────────────────────────────────────────────────────
export async function runPageDiffNow(
  s: SupabaseClient,
  body: {
    client_id?: string
    tracked_page_id?: string
    agency_id?: string | null
  },
): Promise<{
  pages_scanned: number
  changes_detected: number
  meaningful_changes: number
  errors: number
  cost_usd: number
  ran_at: string
}> {
  const { client_id, tracked_page_id, agency_id } = body

  let q = s.from('kotoiq_tracked_pages').select('*').eq('is_active', true)
  if (tracked_page_id) q = q.eq('id', tracked_page_id)
  else if (client_id) q = q.eq('client_id', client_id)
  else throw new Error('client_id or tracked_page_id required')

  // Skip pages still in fetch_blocked window
  const now = new Date().toISOString()
  const { data: pages, error } = await q
  if (error) throw new Error(error.message)
  const eligible = (pages || []).filter(p => !p.fetch_blocked_until || p.fetch_blocked_until < now)

  let pages_scanned = 0
  let changes_detected = 0
  let meaningful_changes = 0
  let errors = 0
  let cost_usd = 0
  const ran_at = new Date().toISOString()

  for (const page of eligible) {
    try {
      const result = await scanOnePage(s, page, agency_id || null)
      pages_scanned += 1
      if (result.change_detected) changes_detected += 1
      if (result.meaningful) meaningful_changes += 1
      cost_usd += result.cost_usd
    } catch (e: any) {
      errors += 1
      // eslint-disable-next-line no-console
      console.warn('[pageDiff] error scanning', page.url, e?.message)
    }
    // 2s stagger to be polite to remote servers + avoid bot blocks
    await new Promise(r => setTimeout(r, 2000))
  }

  return { pages_scanned, changes_detected, meaningful_changes, errors, cost_usd, ran_at }
}

// One page: fetch → extract → diff → classify → persist → alert
async function scanOnePage(
  s: SupabaseClient,
  page: any,
  agencyId: string | null,
): Promise<{ change_detected: boolean; meaningful: boolean; cost_usd: number }> {
  const extracted = await fetchAndExtract(page.url)
  let cost_usd = 0

  // If fetch failed with HTTP block, mark blocked for 7d so cron skips
  if (extracted.error && !extracted.content_hash) {
    const blocked = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await s.from('kotoiq_tracked_pages')
      .update({ fetch_blocked_until: blocked, last_checked_at: new Date().toISOString() })
      .eq('id', page.id)
    return { change_detected: false, meaningful: false, cost_usd: 0 }
  }

  // Run the cheap, free signal extractors on every snapshot:
  // tech stack (regex) + pricing (only when type='pricing')
  let pricing_extracted: any = null
  if (page.page_type === 'pricing' && extracted.body_text) {
    const pricing = await extractPricing({
      h1: extracted.h1,
      hero_copy: extracted.hero_copy,
      body_text: extracted.body_text,
      cta_list: extracted.cta_list,
      meta_title: extracted.meta_title,
    }, { url: page.url, clientId: page.client_id, agencyId })
    cost_usd += pricing.cost_usd
    if (pricing.is_pricing_page) pricing_extracted = pricing
  }

  // Tech stack — regex match against raw HTML for free instant detection
  const detected_tech = extracted.raw_html
    ? detectTechStack(extracted.raw_html)
    : null

  // Insert new snapshot
  const { data: newSnap, error: snapErr } = await s.from('kotoiq_page_snapshots').insert({
    tracked_page_id: page.id,
    content_hash: extracted.content_hash,
    http_status: extracted.http_status,
    fetch_ms: extracted.fetch_ms,
    h1: extracted.h1,
    h2_list: extracted.h2_list,
    cta_list: extracted.cta_list,
    hero_copy: extracted.hero_copy,
    body_text: extracted.body_text,
    meta_title: extracted.meta_title,
    meta_description: extracted.meta_description,
    schema_orgs: extracted.schema_orgs,
    word_count: extracted.word_count,
    detected_tech,
    pricing_extracted,
  }).select().single()

  // Always bump last_checked_at + clear any prior block on success
  await s.from('kotoiq_tracked_pages')
    .update({ last_checked_at: new Date().toISOString(), fetch_blocked_until: null })
    .eq('id', page.id)

  if (snapErr || !newSnap) {
    // eslint-disable-next-line no-console
    console.warn('[pageDiff] snapshot insert error', snapErr?.message)
    return { change_detected: false, meaningful: false, cost_usd }
  }

  // Fetch previous snapshot
  const { data: prevSnaps } = await s.from('kotoiq_page_snapshots')
    .select('*')
    .eq('tracked_page_id', page.id)
    .lt('captured_at', newSnap.captured_at)
    .order('captured_at', { ascending: false })
    .limit(1)

  const prev = prevSnaps?.[0]
  if (!prev) return { change_detected: false, meaningful: false, cost_usd }
  if (prev.content_hash === newSnap.content_hash) return { change_detected: false, meaningful: false, cost_usd }

  // Diff + classify
  const diff = computeFieldDiff(snapshotToExtracted(prev), snapshotToExtracted(newSnap))
  if (!diff.fields_changed.length) return { change_detected: false, meaningful: false, cost_usd }

  const classification = await classifyChange(diff, {
    url: page.url,
    page_type: page.page_type,
    competitor_domain: page.competitor_domain,
    clientId: page.client_id,
    agencyId,
  })
  cost_usd += classification.cost_usd

  // Persist change
  await s.from('kotoiq_page_changes').insert({
    client_id: page.client_id,
    tracked_page_id: page.id,
    from_snapshot_id: prev.id,
    to_snapshot_id: newSnap.id,
    diff_summary: classification.summary,
    classification: classification.category,
    classifier_confidence: classification.confidence,
    classifier_reason: classification.reason,
    fields_changed: diff.fields_changed,
    diff_details: {
      prev: { h1: prev.h1, hero_copy: prev.hero_copy, meta_title: prev.meta_title, cta_list: prev.cta_list },
      curr: { h1: newSnap.h1, hero_copy: newSnap.hero_copy, meta_title: newSnap.meta_title, cta_list: newSnap.cta_list },
    },
    severity: classification.severity,
  })

  // Fire alert only for meaningful changes
  if (classification.category === 'meaningful') {
    await fireAlert(s, page, classification, agencyId)
  }

  return {
    change_detected: true,
    meaningful: classification.category === 'meaningful',
    cost_usd,
  }
}

function snapshotToExtracted(s: any): ExtractedPage {
  return {
    url: '',
    http_status: s.http_status || 0,
    fetch_ms: s.fetch_ms || 0,
    content_hash: s.content_hash || '',
    h1: s.h1 || '',
    h2_list: s.h2_list || [],
    cta_list: s.cta_list || [],
    hero_copy: s.hero_copy || '',
    body_text: s.body_text || '',
    meta_title: s.meta_title || '',
    meta_description: s.meta_description || '',
    schema_orgs: s.schema_orgs || [],
    word_count: s.word_count || 0,
    raw_html_length: 0,
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Alerts — reuse the competitor-watch channel pattern
// ─────────────────────────────────────────────────────────────
async function fireAlert(s: SupabaseClient, page: any, c: ClassifiedChange, _agencyId: string | null) {
  // Look up alert channels via the existing kotoiq_competitor_watches row for
  // the same competitor_domain, if any. This is a pragmatic reuse — same
  // channels as the existing competitor watch alerts.
  const { data: watch } = await s.from('kotoiq_competitor_watches')
    .select('alert_channels')
    .eq('client_id', page.client_id)
    .contains('competitor_domains', [page.competitor_domain])
    .maybeSingle()

  const channels = watch?.alert_channels || {}
  const title = `Competitor change: ${page.competitor_domain}${page.page_type ? ` (${page.page_type})` : ''}`
  const severityColor = c.severity === 'high' ? '#DC2626' : c.severity === 'low' ? '#8A8580' : '#E6007E'
  const alertParams = {
    title,
    body: c.summary,
    color: severityColor,
    fields: [
      { title: 'URL', value: page.url },
      { title: 'Severity', value: c.severity || 'medium' },
      { title: 'Why', value: c.reason || '' },
    ],
    actions: [{ text: 'Open page', url: page.url }],
  }

  try {
    if (channels.slack_webhook) await sendSlackAlert(channels.slack_webhook, alertParams)
    if (channels.teams_webhook) await sendTeamsAlert(channels.teams_webhook, alertParams)
    await s.from('kotoiq_page_changes')
      .update({ alerted_at: new Date().toISOString() })
      .eq('tracked_page_id', page.id)
      .eq('to_snapshot_id', page.to_snapshot_id || '')
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[pageDiff] alert send failed', e?.message)
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Read APIs for the UI
// ─────────────────────────────────────────────────────────────
export async function getPageChanges(
  s: SupabaseClient,
  body: {
    client_id: string
    classification?: 'meaningful' | 'ab_test' | 'widget' | 'typo' | 'irrelevant' | 'all'
    tracked_page_id?: string
    days?: number
    limit?: number
  },
) {
  const { client_id, classification = 'meaningful', tracked_page_id, days = 30, limit = 100 } = body
  if (!client_id) throw new Error('client_id required')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  let q = s.from('kotoiq_page_changes')
    .select('id, tracked_page_id, diff_summary, classification, severity, classifier_confidence, classifier_reason, fields_changed, detected_at, user_reclassification, kotoiq_tracked_pages!inner(url, page_type, competitor_domain)')
    .eq('client_id', client_id)
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (classification !== 'all') q = q.eq('classification', classification)
  if (tracked_page_id) q = q.eq('tracked_page_id', tracked_page_id)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { changes: data || [] }
}

export async function getPageSnapshot(s: SupabaseClient, body: { id: string }) {
  const { data, error } = await s.from('kotoiq_page_snapshots').select('*').eq('id', body.id).single()
  if (error) throw new Error(error.message)
  return { snapshot: data }
}

export async function reclassifyChange(
  s: SupabaseClient,
  body: { id: string; user_reclassification: string },
) {
  if (!body.id || !body.user_reclassification) throw new Error('id and user_reclassification required')
  const valid = ['meaningful', 'noise', 'ab_test', 'widget', 'typo', 'irrelevant']
  if (!valid.includes(body.user_reclassification)) throw new Error('invalid reclassification')
  const { error } = await s.from('kotoiq_page_changes')
    .update({ user_reclassification: body.user_reclassification })
    .eq('id', body.id)
  if (error) throw new Error(error.message)
  return { ok: true }
}
