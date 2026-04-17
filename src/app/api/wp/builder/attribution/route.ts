import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../../lib/kotoiqDb'
import { fetchCruxData } from '../../../../../lib/builder/cruxClient'
import { submitIndexNow, pingGSCSitemap } from '../../../../../lib/builder/indexnow'
import { matchCallToPage } from '../../../../../lib/builder/attributionLinker'
import { getPageKPIs, getCampaignKPIs } from '../../../../../lib/builder/kpiRollup'

/**
 * Attribution API Route — ATTR-01 through ATTR-08
 *
 * Actions:
 *   fetch_cwv      — fetch CrUX data for a published URL
 *   submit_indexnow — submit URLs to IndexNow + GSC ping
 *   match_call     — run attribution linker for an inbound call
 *   page_kpis      — per-page KPI rollup
 *   campaign_kpis  — campaign-level KPI rollup
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const session = await verifySession(req, body)

    if (!session.agencyId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = body
    const agencyId = session.agencyId

    switch (action) {
      case 'fetch_cwv':
        return handleFetchCwv(body, agencyId)
      case 'submit_indexnow':
        return handleSubmitIndexNow(body, agencyId)
      case 'match_call':
        return handleMatchCall(body, agencyId)
      case 'page_kpis':
        return handlePageKpis(body, agencyId)
      case 'campaign_kpis':
        return handleCampaignKpis(body, agencyId)
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[attribution route] Error:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

// ── fetch_cwv ───────────────────────────────────────────────────────────────

async function handleFetchCwv(body: any, agencyId: string) {
  const { publish_id, site_id } = body
  if (!publish_id || !site_id) {
    return NextResponse.json({ ok: false, error: 'publish_id and site_id required' }, { status: 400 })
  }

  const db = getKotoIQDb(agencyId)

  // Get publish record
  const { data: pub } = await db.from('kotoiq_publishes')
    .select('id, url')
    .eq('id', publish_id)
    .single()

  if (!pub?.url) {
    return NextResponse.json({ ok: false, error: 'Publish not found or missing URL' }, { status: 404 })
  }

  // Get site's CrUX API key
  const { data: site } = await db.from('kotoiq_builder_sites')
    .select('crux_api_key')
    .eq('site_id', site_id)
    .single()

  if (!site?.crux_api_key) {
    return NextResponse.json({ ok: false, error: 'No CrUX API key configured for this site' }, { status: 400 })
  }

  // Fetch from CrUX
  const result = await fetchCruxData(pub.url, site.crux_api_key)

  if (!result) {
    return NextResponse.json({ ok: true, data: null, message: 'No CrUX data available (insufficient traffic)' })
  }

  // Store reading
  const { error: insertErr } = await db.insert('kotoiq_cwv_readings', {
    publish_id,
    url: pub.url,
    source: result.source,
    device: 'phone',
    lcp_p75_ms: result.lcp_p75_ms,
    cls_p75: result.cls_p75,
    inp_p75_ms: result.inp_p75_ms,
    fcp_p75_ms: result.fcp_p75_ms,
    ttfb_p75_ms: result.ttfb_p75_ms,
    fetched_at: result.fetched_at,
    source_url: result.source_url,
    raw: result.raw,
  })

  if (insertErr) {
    console.error('[attribution] CWV insert error:', insertErr)
    return NextResponse.json({ ok: false, error: 'Failed to store CWV reading' }, { status: 500 })
  }

  // Update first_cwv_read_at on the publish record if not already set
  await db.from('kotoiq_publishes')
    .update({ first_cwv_read_at: result.fetched_at })
    .eq('id', publish_id)
    .is('first_cwv_read_at', null)

  return NextResponse.json({ ok: true, data: result })
}

// ── submit_indexnow ─────────────────────────────────────────────────────────

async function handleSubmitIndexNow(body: any, agencyId: string) {
  const { publish_id, site_id } = body
  if (!publish_id || !site_id) {
    return NextResponse.json({ ok: false, error: 'publish_id and site_id required' }, { status: 400 })
  }

  const db = getKotoIQDb(agencyId)

  // Get publish record
  const { data: pub } = await db.from('kotoiq_publishes')
    .select('id, url')
    .eq('id', publish_id)
    .single()

  if (!pub?.url) {
    return NextResponse.json({ ok: false, error: 'Publish not found or missing URL' }, { status: 404 })
  }

  // Get site config
  const { data: site } = await db.from('kotoiq_builder_sites')
    .select('indexnow_key')
    .eq('site_id', site_id)
    .single()

  if (!site?.indexnow_key) {
    return NextResponse.json({ ok: false, error: 'No IndexNow key configured for this site' }, { status: 400 })
  }

  // Check recent submissions for rate limiting
  const { data: recentSubs } = await db.from('kotoiq_indexnow_submissions')
    .select('url, submitted_at')
    .eq('publish_id', publish_id)
    .gte('submitted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const lastSubmitted = new Map<string, string>()
  if (recentSubs) {
    for (const s of recentSubs) {
      const existing = lastSubmitted.get(s.url)
      if (!existing || s.submitted_at > existing) {
        lastSubmitted.set(s.url, s.submitted_at)
      }
    }
  }

  const siteHost = new URL(pub.url).hostname
  const siteOrigin = new URL(pub.url).origin
  const results: any[] = []

  // Submit to IndexNow
  const indexnowRecords = await submitIndexNow(
    [pub.url],
    site.indexnow_key,
    siteHost,
    publish_id,
    lastSubmitted
  )

  for (const rec of indexnowRecords) {
    const { error } = await db.insert('kotoiq_indexnow_submissions', rec)
    if (!error) results.push(rec)
  }

  // Ping GSC sitemap
  const gscRecord = await pingGSCSitemap(siteOrigin, publish_id, lastSubmitted)
  if (gscRecord) {
    const { error } = await db.insert('kotoiq_indexnow_submissions', gscRecord)
    if (!error) results.push(gscRecord)
  }

  // Update indexnow_submitted_at on the publish record
  if (results.length > 0) {
    await db.from('kotoiq_publishes')
      .update({ indexnow_submitted_at: new Date().toISOString() })
      .eq('id', publish_id)
  }

  return NextResponse.json({ ok: true, data: { submissions: results, count: results.length } })
}

// ── match_call ──────────────────────────────────────────────────────────────

async function handleMatchCall(body: any, agencyId: string) {
  const { call } = body
  if (!call?.id || !call?.dialed_number) {
    return NextResponse.json({ ok: false, error: 'call.id and call.dialed_number required' }, { status: 400 })
  }

  const match = await matchCallToPage(call, agencyId)
  if (!match) {
    return NextResponse.json({ ok: true, data: null, message: 'No attribution match found' })
  }

  // Store attribution record
  const db = getKotoIQDb(agencyId)
  const { error } = await db.insert('kotoiq_call_attribution', {
    publish_id: match.publish_id,
    variant_id: match.variant_id,
    inbound_call_id: call.id,
    match_method: match.match_method,
    confidence: match.confidence,
    matched_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[attribution] Call attribution insert error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to store attribution' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: match })
}

// ── page_kpis ───────────────────────────────────────────────────────────────

async function handlePageKpis(body: any, agencyId: string) {
  const { publish_id } = body
  if (!publish_id) {
    return NextResponse.json({ ok: false, error: 'publish_id required' }, { status: 400 })
  }

  const kpis = await getPageKPIs(publish_id, agencyId)
  if (!kpis) {
    return NextResponse.json({ ok: false, error: 'Publish not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: kpis })
}

// ── campaign_kpis ───────────────────────────────────────────────────────────

async function handleCampaignKpis(body: any, agencyId: string) {
  const { campaign_id } = body
  if (!campaign_id) {
    return NextResponse.json({ ok: false, error: 'campaign_id required' }, { status: 400 })
  }

  const kpis = await getCampaignKPIs(campaign_id, agencyId)
  if (!kpis) {
    return NextResponse.json({ ok: false, error: 'Campaign not found or has no variants' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: kpis })
}
