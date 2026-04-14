import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { identifyVisitor } from '@/lib/reverseIPLookup'
import { calculateIntentScore } from '@/lib/visitorIntentScorer'
import { fireToAllPlatforms } from '@/lib/pixelEventFiring'
import { createNotification } from '@/lib/notifications'
import { enrichDomain } from '@/lib/domainEnrichment'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── GA4 data pull — uses existing Google OAuth credentials ──
async function fetchGA4Analytics(propertyId: string): Promise<any> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || ''
  const refreshToken = (process.env.GOOGLE_ADS_REFRESH_TOKEN || '').replace(/\\n/g, '').trim()

  if (!clientId || !clientSecret || !refreshToken) return null

  try {
    // Get fresh access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return null

    const accessToken = tokenData.access_token
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]
    const endDate = today.toISOString().split('T')[0]

    // Pull multiple reports in parallel
    const [pageReport, trafficReport, geoReport, deviceReport] = await Promise.all([
      // Top pages
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }],
          limit: 50, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      // Traffic sources
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'conversions' }],
          limit: 20,
        }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      // Geography
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'city' }, { name: 'region' }, { name: 'country' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          limit: 30, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      // Devices
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'deviceCategory' }, { name: 'operatingSystem' }, { name: 'browser' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          limit: 20,
        }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    return {
      fetched_at: new Date().toISOString(),
      property_id: propertyId,
      date_range: { start: startDate, end: endDate },
      pages: pageReport?.rows?.map((r: any) => ({
        path: r.dimensionValues?.[0]?.value,
        title: r.dimensionValues?.[1]?.value,
        views: parseInt(r.metricValues?.[0]?.value || '0'),
        avg_duration: parseFloat(r.metricValues?.[1]?.value || '0'),
        bounce_rate: parseFloat(r.metricValues?.[2]?.value || '0'),
      })) || [],
      traffic_sources: trafficReport?.rows?.map((r: any) => ({
        channel: r.dimensionValues?.[0]?.value,
        source: r.dimensionValues?.[1]?.value,
        sessions: parseInt(r.metricValues?.[0]?.value || '0'),
        users: parseInt(r.metricValues?.[1]?.value || '0'),
        conversions: parseInt(r.metricValues?.[2]?.value || '0'),
      })) || [],
      geography: geoReport?.rows?.map((r: any) => ({
        city: r.dimensionValues?.[0]?.value,
        region: r.dimensionValues?.[1]?.value,
        country: r.dimensionValues?.[2]?.value,
        users: parseInt(r.metricValues?.[0]?.value || '0'),
        sessions: parseInt(r.metricValues?.[1]?.value || '0'),
      })) || [],
      devices: deviceReport?.rows?.map((r: any) => ({
        category: r.dimensionValues?.[0]?.value,
        os: r.dimensionValues?.[1]?.value,
        browser: r.dimensionValues?.[2]?.value,
        sessions: parseInt(r.metricValues?.[0]?.value || '0'),
        users: parseInt(r.metricValues?.[1]?.value || '0'),
      })) || [],
    }
  } catch (e) {
    console.warn('[pixel] GA4 fetch error:', e)
    return null
  }
}

// ── Auto-enrich domain + generate AI persona (fire-and-forget) ──
async function autoEnrichAndPersona(s: any, profileId: string, domain: string | null) {
  try {
    // Step 1: Enrich domain if available
    if (domain) {
      const enrichment = await enrichDomain(domain)
      const updates: any = {
        enrichment_data: enrichment,
        updated_at: new Date().toISOString(),
      }
      if (enrichment.company_name) updates.identified_company = enrichment.company_name
      await s.from('koto_visitor_profiles').update(updates).eq('id', profileId)
    }

    // Step 2: Generate AI persona
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
    if (!ANTHROPIC_KEY) return

    const { data: profile } = await s.from('koto_visitor_profiles').select('*').eq('id', profileId).single()
    if (!profile) return

    const { data: sessions } = await s.from('koto_visitor_sessions')
      .select('landing_page, referrer, utm_source, utm_medium, utm_campaign, device_type, browser, os, time_on_site_seconds, pages_viewed, submitted_form, clicked_cta, viewed_pricing, intent_score, identified_company, started_at')
      .eq('visitor_profile_id', profileId)
      .order('started_at', { ascending: false })
      .limit(20)

    const profileSummary = `Visitor Profile:
- Device: ${profile.device_type || 'unknown'} | Browser: ${profile.browser || '?'} ${profile.browser_version || ''} | OS: ${profile.os || '?'}
- Screen: ${profile.screen_resolution || '?'} | Hardware: ${profile.hardware_concurrency || '?'} cores
- Location: ${[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'unknown'}
- Company: ${profile.identified_company || 'unknown'} | Domain: ${profile.identified_domain || 'unknown'}
- Sessions: ${profile.total_sessions} | Pageviews: ${profile.total_pageviews} | Time: ${Math.round((profile.total_time_seconds || 0) / 60)} min
- Forms: ${profile.total_form_submits} | CTAs: ${profile.total_cta_clicks} | Max intent: ${profile.max_intent_score}
- Top pages: ${(profile.top_pages || []).slice(0, 5).map((p: any) => `${p.url} (${p.views}x)`).join(', ') || 'none'}
${profile.enrichment_data ? `- Tech stack: ${(profile.enrichment_data as any).tech_stack?.join(', ') || 'unknown'}
- Email provider: ${(profile.enrichment_data as any).email_provider || 'unknown'}
- Emails found: ${(profile.enrichment_data as any).emails?.join(', ') || 'none'}
- Social: ${Object.entries((profile.enrichment_data as any).social_links || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || 'none'}` : ''}

Recent Sessions (${(sessions || []).length}):
${(sessions || []).slice(0, 5).map((s: any, i: number) => `  ${i + 1}. ${s.started_at} | ${s.landing_page} | score: ${s.intent_score} | ${s.submitted_form ? 'FORM' : ''} ${s.clicked_cta ? 'CTA' : ''} ${s.viewed_pricing ? 'PRICING' : ''}`).join('\n')}
`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: `Analyze this website visitor and build a behavioral persona. Return JSON only.\n\n${profileSummary}\n\nReturn this exact JSON structure:\n{"summary":"2-3 sentence persona summary","likely_role":"job title guess","buying_stage":"awareness|consideration|decision|loyalty","engagement_level":"cold|warming|engaged|hot","segments":["tag1","tag2"],"interests":["interest1"],"behavior_pattern":"description","best_time_to_reach":"time window","device_persona":"power user|casual browser|mobile-first","traffic_quality":"organic|paid|referral|direct","predicted_value":"high|medium|low","recommended_action":"specific next step"}` }],
      }),
    })

    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const text = aiData?.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const persona = JSON.parse(jsonMatch[0])
        await s.from('koto_visitor_profiles').update({
          ai_persona: persona,
          ai_persona_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', profileId)
      }
    }
  } catch (e) {
    console.warn('[pixel] autoEnrichAndPersona error:', e)
  }
}

// GET — serve the tracking pixel script or manage pixels
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pixelId = searchParams.get('id')
  const action = searchParams.get('action')
  const s = sb()

  // Serve the pixel JavaScript
  if (pixelId && !action) {
    const script = generatePixelScript(pixelId)
    return new Response(script, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // API actions
  const agencyId = searchParams.get('agency_id') || ''

  if (action === 'get_pixels') {
    const { data } = await s.from('koto_tracking_pixels').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
    return Response.json({ data: data || [] })
  }

  if (action === 'get_sessions') {
    const pid = searchParams.get('pixel_id') || ''
    let query = s.from('koto_visitor_sessions').select('*')
    if (pid) query = query.eq('pixel_id', pid)
    else query = query.eq('agency_id', agencyId)
    const { data } = await query.order('last_seen_at', { ascending: false }).limit(100)
    return Response.json({ data: data || [] })
  }

  if (action === 'get_live') {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await s.from('koto_visitor_sessions').select('*')
      .eq('agency_id', agencyId)
      .gte('last_seen_at', fiveMinAgo)
      .order('intent_score', { ascending: false })
    return Response.json({ data: data || [], live_count: data?.length || 0 })
  }

  if (action === 'get_alerts') {
    const { data } = await s.from('koto_pixel_alerts').select('*')
      .eq('agency_id', agencyId)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(20)
    return Response.json({ data: data || [] })
  }

  if (action === 'get_stats') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [{ count: visitsToday }, { count: identified }, { count: hotVisitors }, { count: leadsCreated }] = await Promise.all([
      s.from('koto_visitor_sessions').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).gte('started_at', today.toISOString()),
      s.from('koto_visitor_sessions').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).gte('identification_confidence', 40),
      s.from('koto_visitor_sessions').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).gte('intent_score', 70),
      s.from('koto_visitor_sessions').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('lead_created', true),
    ])
    return Response.json({ visits_today: visitsToday || 0, identified: identified || 0, hot_visitors: hotVisitors || 0, leads_created: leadsCreated || 0 })
  }

  if (action === 'get_integrations') {
    const { data } = await s.from('koto_pixel_integrations').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
    return Response.json({ data: data || [] })
  }

  // ── GA4 Analytics Data ────────────────────────────────────────
  if (action === 'get_ga4_data') {
    const propertyId = searchParams.get('property_id') || process.env.GA4_PROPERTY_ID || '529449358'
    const data = await fetchGA4Analytics(propertyId)
    if (!data) return Response.json({ error: 'Failed to fetch GA4 data — check OAuth credentials' }, { status: 500 })
    return Response.json(data)
  }

  // ── Backfill profiles from existing sessions ──────────────────
  if (action === 'backfill_profiles') {
    // Get all sessions for this agency that don't have a profile yet
    const { data: sessions } = await s.from('koto_visitor_sessions')
      .select('*')
      .eq('agency_id', agencyId)
      .is('visitor_profile_id', null)
      .order('started_at', { ascending: false })
      .limit(500)

    if (!sessions?.length) return Response.json({ created: 0, message: 'No sessions to backfill' })

    let created = 0
    // Group sessions by a pseudo-fingerprint (browser + os + device_type + screen combo)
    const groups: Record<string, any[]> = {}
    for (const sess of sessions) {
      const key = `${sess.browser || '?'}_${sess.os || '?'}_${sess.device_type || '?'}`
      if (!groups[key]) groups[key] = []
      groups[key].push(sess)
    }

    for (const [key, groupSessions] of Object.entries(groups)) {
      const first = groupSessions[0]
      const fingerprint = `backfill_${key}_${first.agency_id?.slice(0,8)}`

      // Check if profile already exists
      const { data: existing } = await s.from('koto_visitor_profiles')
        .select('id')
        .eq('fingerprint', fingerprint)
        .eq('agency_id', agencyId)
        .maybeSingle()

      let profileId = existing?.id

      if (!profileId) {
        // Create profile from aggregated session data
        const totalSessions = groupSessions.length
        const totalPageviews = groupSessions.reduce((sum, s) => sum + (s.pages_viewed?.length || 0), 0)
        const totalTime = groupSessions.reduce((sum, s) => sum + (s.time_on_site_seconds || 0), 0)
        const totalForms = groupSessions.filter(s => s.submitted_form).length
        const totalCtas = groupSessions.filter(s => s.clicked_cta).length
        const maxIntent = Math.max(...groupSessions.map(s => s.intent_score || 0))
        const latest = groupSessions[0]

        const { data: newProf } = await s.from('koto_visitor_profiles').insert({
          fingerprint,
          agency_id: agencyId,
          total_sessions: totalSessions,
          total_pageviews: totalPageviews,
          total_time_seconds: totalTime,
          total_form_submits: totalForms,
          total_cta_clicks: totalCtas,
          max_intent_score: maxIntent,
          latest_intent_score: latest.intent_score || 0,
          browser: latest.browser,
          browser_version: latest.browser_version,
          os: latest.os,
          os_version: latest.os_version,
          device_type: latest.device_type,
          city: latest.identified_city,
          state: latest.identified_state,
          country: latest.identified_country,
          identified_company: latest.identified_company,
          identified_domain: latest.identified_domain,
          first_seen_at: groupSessions[groupSessions.length - 1].started_at,
          last_seen_at: latest.last_seen_at || latest.started_at,
        }).select('id').single()

        profileId = newProf?.id
        created++

        // Auto-enrich + persona for backfilled profiles (fire-and-forget)
        if (profileId && first.identified_domain) {
          autoEnrichAndPersona(s, profileId, first.identified_domain).catch(() => {})
        }
      }

      // Link all sessions to this profile
      if (profileId) {
        const sessionIds = groupSessions.map(s => s.session_id)
        await s.from('koto_visitor_sessions')
          .update({ visitor_profile_id: profileId })
          .in('session_id', sessionIds)
      }
    }

    return Response.json({ created, total_sessions: sessions.length, groups: Object.keys(groups).length })
  }

  // ── Visitor Profiles ──────────────────────────────────────────
  if (action === 'get_profiles') {
    const sort = searchParams.get('sort') || 'last_seen_at'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const { data } = await s.from('koto_visitor_profiles').select('*')
      .eq('agency_id', agencyId)
      .order(sort, { ascending: false })
      .limit(limit)
    return Response.json({ data: data || [] })
  }

  if (action === 'get_profile') {
    const profileId = searchParams.get('profile_id')
    if (!profileId) return Response.json({ error: 'profile_id required' }, { status: 400 })
    const [{ data: profile }, { data: sessions }] = await Promise.all([
      s.from('koto_visitor_profiles').select('*').eq('id', profileId).single(),
      s.from('koto_visitor_sessions').select('*').eq('visitor_profile_id', profileId).order('started_at', { ascending: false }).limit(50),
    ])
    // Get events for all sessions
    const sessionIds = (sessions || []).map((s: any) => s.session_id)
    const { data: events } = sessionIds.length > 0
      ? await s.from('koto_visitor_events').select('*').in('session_id', sessionIds).order('created_at', { ascending: false }).limit(200)
      : { data: [] }
    return Response.json({ profile, sessions: sessions || [], events: events || [] })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

// POST — receive tracking events + manage pixels
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action || body.type
    const s = sb()

    // ── Track event from pixel ───────────────────────────────────────────────
    if (action === 'session_start') {
      const data = body.data || body
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || ''

      // Get pixel config
      const { data: pixel } = await s.from('koto_tracking_pixels')
        .select('agency_id, client_id, is_active, auto_create_lead, auto_add_to_campaign_id, total_leads_created')
        .eq('pixel_id', data.pixel_id)
        .eq('is_active', true)
        .maybeSingle() as { data: { agency_id: string; client_id: string | null; is_active: boolean; auto_create_lead: boolean; auto_add_to_campaign_id: string | null; total_leads_created: number } | null }

      if (!pixel) return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })

      // Create session
      await s.from('koto_visitor_sessions').upsert({
        session_id: data.session_id,
        pixel_id: data.pixel_id,
        agency_id: pixel.agency_id,
        client_id: pixel.client_id,
        visitor_ip: ip,
        visitor_ip_masked: ip ? ip.replace(/\.\d+$/, '.xxx') : null,
        landing_page: data.landing_page,
        referrer: data.referrer,
        utm_source: data.utm_source,
        utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign,
        device_type: data.device_type,
        browser: data.browser,
        started_at: data.started_at || new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })

      // Async: reverse IP lookup + auto-enrich domain
      if (ip) {
        identifyVisitor(ip).then(async (result) => {
          // Always store location — even residential IPs have a city/state
          const sessionUpdate: any = {
            identified_city: result.city,
            identified_state: result.state,
            identified_country: result.country,
            identification_confidence: result.confidence,
          }
          // Only store company/domain if confidence is meaningful
          if (result.confidence > 30) {
            sessionUpdate.identified_company = result.company
            sessionUpdate.identified_domain = result.domain
          }
          await s.from('koto_visitor_sessions').update(sessionUpdate).eq('session_id', data.session_id)

          // Auto-enrich domain (fire-and-forget)
          if (result.domain && result.confidence > 30) {
            enrichDomain(result.domain).then(async (enrichment) => {
              const { data: sess } = await s.from('koto_visitor_sessions').select('visitor_profile_id').eq('session_id', data.session_id).maybeSingle()
              if (sess?.visitor_profile_id) {
                const { data: prof } = await s.from('koto_visitor_profiles').select('enrichment_data').eq('id', sess.visitor_profile_id).maybeSingle()
                const existingEnrichment = prof?.enrichment_data as any
                const enrichedRecently = existingEnrichment?.enriched_at && (Date.now() - new Date(existingEnrichment.enriched_at).getTime()) < 7 * 86400000
                if (!enrichedRecently) {
                  await s.from('koto_visitor_profiles').update({
                    enrichment_data: enrichment,
                    identified_company: enrichment.company_name || undefined,
                    updated_at: new Date().toISOString(),
                  }).eq('id', sess.visitor_profile_id)
                }
              }
            }).catch(() => {})
          }
        }).catch(() => {})
      }

      // Update pixel stats
      await s.from('koto_tracking_pixels').update({
        total_visits: (await s.from('koto_visitor_sessions').select('*', { count: 'exact', head: true }).eq('pixel_id', data.pixel_id)).count || 0,
      }).eq('pixel_id', data.pixel_id)

      // Fire to connected platforms
      fireToAllPlatforms(pixel.agency_id, pixel.client_id, 'page_view', { session_id: data.session_id }).catch(() => {})

      return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // ── Fingerprint event — link session to persistent visitor profile ──
    if (action === 'fingerprint') {
      const sessionId = body.session_id
      const pixelId = body.pixel_id
      const fp = body.data?.fingerprint
      if (!sessionId || !pixelId || !fp) return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })

      const { data: pixel } = await s.from('koto_tracking_pixels').select('agency_id, client_id').eq('pixel_id', pixelId).maybeSingle()
      if (!pixel) return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })

      // Update session with fingerprint data
      await s.from('koto_visitor_sessions').update({
        fingerprint: fp,
        canvas_hash: body.data?.canvas_hash || null,
        webgl_hash: body.data?.webgl_hash || null,
        gpu_renderer: body.data?.gpu_renderer || null,
      }).eq('session_id', sessionId)

      // Upsert visitor profile — create if new fingerprint, update if returning
      void (async () => {
        try {
          const { data: session } = await s.from('koto_visitor_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle()
          if (!session) return

          const nowIso = new Date().toISOString()

          // Check if profile exists
          const { data: existing } = await s.from('koto_visitor_profiles')
            .select('id, total_sessions, total_pageviews, total_time_seconds, total_form_submits, total_cta_clicks, pages_visited, referral_sources, utm_history, visit_times, max_intent_score')
            .eq('agency_id', pixel.agency_id)
            .eq('fingerprint', fp)
            .maybeSingle()

          if (existing) {
            // Update existing profile with new session data
            const pages = existing.pages_visited || []
            if (session.landing_page && !pages.includes(session.landing_page)) pages.push(session.landing_page)

            const referrers = existing.referral_sources || []
            if (session.referrer && !referrers.includes(session.referrer)) referrers.push(session.referrer)

            const utmHistory = existing.utm_history || []
            if (session.utm_source || session.utm_medium || session.utm_campaign) {
              const utmKey = `${session.utm_source || ''}|${session.utm_medium || ''}|${session.utm_campaign || ''}`
              if (!utmHistory.some((u: any) => `${u.source || ''}|${u.medium || ''}|${u.campaign || ''}` === utmKey)) {
                utmHistory.push({ source: session.utm_source, medium: session.utm_medium, campaign: session.utm_campaign, seen_at: nowIso })
              }
            }

            // Track visit hour distribution
            const visitTimes = existing.visit_times || []
            const hour = new Date().getHours()
            visitTimes.push(hour)

            await s.from('koto_visitor_profiles').update({
              total_sessions: (existing.total_sessions || 0) + 1,
              pages_visited: pages,
              referral_sources: referrers,
              utm_history: utmHistory,
              visit_times: visitTimes.slice(-100), // keep last 100
              last_seen_at: nowIso,
              // Update device/browser info (latest wins)
              device_type: session.device_type || undefined,
              browser: session.browser || undefined,
              browser_version: session.browser_version || undefined,
              os: session.os || undefined,
              os_version: session.os_version || undefined,
              screen_resolution: session.screen_resolution || undefined,
              color_depth: session.color_depth || undefined,
              hardware_concurrency: session.hardware_concurrency || undefined,
              touch_support: session.touch_support || false,
              gpu_renderer: session.gpu_renderer || body.data?.gpu_renderer || undefined,
              connection_type: session.connection_type || undefined,
              timezone: session.timezone || undefined,
              language: session.language || undefined,
              platform: session.platform || undefined,
              // Carry over geo from session if available
              ...(session.identified_company ? { identified_company: session.identified_company } : {}),
              ...(session.identified_domain ? { identified_domain: session.identified_domain } : {}),
              ...(session.identified_city ? { city: session.identified_city } : {}),
              ...(session.identified_state ? { state: session.identified_state } : {}),
              ...(session.identified_country ? { country: session.identified_country } : {}),
              updated_at: nowIso,
            }).eq('id', existing.id)

            // Link session to profile
            await s.from('koto_visitor_sessions').update({ visitor_profile_id: existing.id }).eq('session_id', sessionId)
          } else {
            // Create new profile
            const { data: profile } = await s.from('koto_visitor_profiles').insert({
              agency_id: pixel.agency_id,
              fingerprint: fp,
              device_type: session.device_type,
              browser: session.browser,
              browser_version: session.browser_version,
              os: session.os,
              os_version: session.os_version,
              screen_resolution: session.screen_resolution,
              color_depth: session.color_depth,
              hardware_concurrency: session.hardware_concurrency,
              touch_support: session.touch_support || false,
              gpu_renderer: body.data?.gpu_renderer || null,
              connection_type: session.connection_type,
              timezone: session.timezone,
              language: session.language,
              platform: session.platform,
              total_sessions: 1,
              pages_visited: session.landing_page ? [session.landing_page] : [],
              referral_sources: session.referrer ? [session.referrer] : [],
              utm_history: (session.utm_source || session.utm_medium) ? [{ source: session.utm_source, medium: session.utm_medium, campaign: session.utm_campaign, seen_at: nowIso }] : [],
              visit_times: [new Date().getHours()],
              identified_company: session.identified_company,
              identified_domain: session.identified_domain,
              city: session.identified_city,
              state: session.identified_state,
              country: session.identified_country,
              first_seen_at: nowIso,
              last_seen_at: nowIso,
            }).select('id').single()

            if (profile) {
              await s.from('koto_visitor_sessions').update({ visitor_profile_id: profile.id }).eq('session_id', sessionId)

              // Auto-enrich + auto-generate persona (fire-and-forget)
              autoEnrichAndPersona(s, profile.id, session.identified_domain).catch(() => {})
            }
          }
        } catch (e) {
          console.error('[pixel fingerprint] profile upsert failed:', e)
        }
      })()

      return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Track individual events
    if (['pageview', 'scroll', 'click', 'cta_click', 'form_submit', 'time_milestone', 'pricing_view', 'exit_intent', 'tab_return'].includes(action)) {
      const sessionId = body.session_id
      const pixelId = body.pixel_id

      if (!sessionId || !pixelId) return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })

      // Insert event
      const { data: pixel } = await s.from('koto_tracking_pixels').select('agency_id, auto_create_lead, total_leads_created').eq('pixel_id', pixelId).maybeSingle() as { data: { agency_id: string; auto_create_lead: boolean; total_leads_created: number } | null }
      if (pixel) {
        await s.from('koto_visitor_events').insert({
          session_id: sessionId,
          pixel_id: pixelId,
          agency_id: pixel.agency_id,
          event_type: action,
          event_data: body.data || {},
          page_url: body.data?.url,
          page_title: body.data?.title,
        })

        // Update session
        const updates: any = { last_seen_at: new Date().toISOString() }
        if (action === 'form_submit') updates.submitted_form = true
        if (action === 'cta_click') updates.clicked_cta = true
        if (action === 'pricing_view') updates.viewed_pricing = true
        if (action === 'scroll' && body.data?.depth) updates.scroll_depth_percent = body.data.depth
        if (action === 'time_milestone' && body.data?.seconds) updates.time_on_site_seconds = body.data.seconds
        if (action === 'pageview') {
          // Append to pages_viewed
          const { data: session } = await s.from('koto_visitor_sessions').select('pages_viewed').eq('session_id', sessionId).single()
          const pages = session?.pages_viewed || []
          pages.push({ url: body.data?.url, title: body.data?.title, at: new Date().toISOString() })
          updates.pages_viewed = pages
        }
        await s.from('koto_visitor_sessions').update(updates).eq('session_id', sessionId)

        // Recalculate intent score
        const { data: session } = await s.from('koto_visitor_sessions').select('*').eq('session_id', sessionId).single()
        const { data: events } = await s.from('koto_visitor_events').select('*').eq('session_id', sessionId)
        if (session) {
          const { score, signals } = calculateIntentScore(session, events || [])
          await s.from('koto_visitor_sessions').update({ intent_score: score, intent_signals: signals }).eq('session_id', sessionId)

          // Fire-and-forget: upsert opportunity from visitor session
          try {
            const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/api\/.*/, '') || ''
            fetch(`${origin}/api/opportunities`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
              body: JSON.stringify({
                action: 'upsert_from_visitor', session_id: sessionId,
                company_name: session.identified_company, contact_email: session.identified_email,
                website: session.landing_page, intent_score: score, intent_signals: signals,
                page_url: session.current_page, page_title: session.current_page_title,
              }),
            }).catch(() => {})
          } catch {}

          // Alert if hot visitor
          if (score >= 70) {
            const { data: existing } = await s.from('koto_pixel_alerts')
              .select('id').eq('session_id', sessionId).eq('alert_type', 'hot_visitor').maybeSingle()
            if (!existing) {
              await s.from('koto_pixel_alerts').insert({
                pixel_id: pixelId,
                agency_id: pixel.agency_id,
                session_id: sessionId,
                alert_type: score >= 90 ? 'hot_visitor' : 'high_intent',
                alert_message: `${session.identified_company || 'Unknown visitor'} on your site - intent score ${score}`,
                company_name: session.identified_company,
                intent_score: score,
              })

              // Notification — only on the first hot detection per session
              createNotification(
                s, pixel.agency_id, 'hot_visitor',
                '🔥 Hot visitor detected',
                `${session.identified_company || 'Unknown company'} on your site — score ${score}`,
                '/pixels', '🔥',
                { session_id: sessionId, score, company: session.identified_company },
              ).catch(() => {})

              // Auto-create lead if pixel has auto_create_lead enabled
              if (pixel.auto_create_lead && !session.lead_created) {
                void (async () => {
                  try {
                    await s.from('koto_visitor_sessions').update({ lead_created: true }).eq('session_id', sessionId)
                    // Create a client/lead record from visitor data
                    const leadData: any = {
                      agency_id: pixel.agency_id,
                      name: session.identified_company || 'Website Visitor',
                      status: 'prospect',
                      source: 'pixel_tracking',
                      website: session.identified_domain ? `https://${session.identified_domain}` : session.landing_page,
                      industry: null,
                      notes: `Auto-created from Visitor Intelligence — intent score ${score}. ` +
                        `${session.pages_viewed?.length || 0} pages viewed, ${Math.round((session.time_on_site_seconds || 0) / 60)}m on site. ` +
                        `${session.submitted_form ? 'Submitted form. ' : ''}${session.viewed_pricing ? 'Viewed pricing. ' : ''}` +
                        `Signals: ${(session.intent_signals || []).join(', ')}`,
                    }
                    if (session.identified_city) leadData.city = session.identified_city
                    if (session.identified_state) leadData.state = session.identified_state
                    await s.from('clients').insert(leadData)
                    // Increment pixel lead count
                    await s.from('koto_tracking_pixels').update({
                      total_leads_created: (pixel.total_leads_created || 0) + 1,
                    }).eq('pixel_id', pixelId)
                  } catch (e) { console.warn('[pixel] auto-lead error:', e) }
                })()
              }
            }
          }

          // Fire form_submit to all platforms
          if (action === 'form_submit') {
            fireToAllPlatforms(pixel.agency_id, null, 'form_submit', { session_id: sessionId }).catch(() => {})
          }

          // Update visitor profile aggregates (fire-and-forget)
          if (session.visitor_profile_id) {
            void (async () => {
              try {
                // Read current profile to increment
                const { data: prof } = await s.from('koto_visitor_profiles')
                  .select('total_pageviews, total_time_seconds, total_form_submits, total_cta_clicks, max_intent_score, latest_intent_score, intent_signals, pages_visited, top_pages')
                  .eq('id', session.visitor_profile_id)
                  .single()
                if (!prof) return

                const updates: any = {
                  latest_intent_score: score,
                  intent_signals: signals,
                  last_seen_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
                if (score > (prof.max_intent_score || 0)) updates.max_intent_score = score
                if (action === 'pageview') {
                  updates.total_pageviews = (prof.total_pageviews || 0) + 1
                  // Add to pages_visited if new
                  const pagesVisited = prof.pages_visited || []
                  const pageUrl = body.data?.url
                  if (pageUrl && !pagesVisited.includes(pageUrl)) {
                    pagesVisited.push(pageUrl)
                    updates.pages_visited = pagesVisited
                  }
                  // Update top_pages
                  const topPages: any[] = prof.top_pages || []
                  const existingPage = topPages.find((p: any) => p.url === pageUrl)
                  if (existingPage) {
                    existingPage.views = (existingPage.views || 0) + 1
                  } else if (pageUrl) {
                    topPages.push({ url: pageUrl, title: body.data?.title || '', views: 1 })
                  }
                  topPages.sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
                  updates.top_pages = topPages.slice(0, 20)
                }
                if (action === 'form_submit') updates.total_form_submits = (prof.total_form_submits || 0) + 1
                if (action === 'cta_click') updates.total_cta_clicks = (prof.total_cta_clicks || 0) + 1
                if (action === 'time_milestone' && body.data?.seconds) {
                  updates.total_time_seconds = (prof.total_time_seconds || 0) + (body.data.seconds - (session.time_on_site_seconds || 0))
                }

                await s.from('koto_visitor_profiles').update(updates).eq('id', session.visitor_profile_id)
              } catch (e) { console.error('[pixel] profile aggregate update failed:', e) }
            })()
          }
        }
      }

      return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // ── Pixel management ─────────────────────────────────────────────────────
    if (action === 'create_pixel') {
      const { agency_id, client_id, pixel_name, domain, settings } = body
      const pixelId = 'koto_' + Math.random().toString(36).substring(2, 10)

      const { data, error } = await s.from('koto_tracking_pixels').insert({
        agency_id, client_id, pixel_id: pixelId, pixel_name, domain,
        ...(settings || {}),
      }).select('*').single()

      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, pixel: data, install_code: generateInstallSnippet(pixelId) })
    }

    if (action === 'update_pixel') {
      const { pixel_id, ...updates } = body
      delete updates.action
      await s.from('koto_tracking_pixels').update({ ...updates, updated_at: new Date().toISOString() }).eq('pixel_id', pixel_id)
      return Response.json({ success: true })
    }

    if (action === 'delete_pixel') {
      await s.from('koto_tracking_pixels').update({ is_active: false }).eq('pixel_id', body.pixel_id)
      return Response.json({ success: true })
    }

    if (action === 'dismiss_alert') {
      await s.from('koto_pixel_alerts').update({ dismissed: true }).eq('id', body.alert_id)
      return Response.json({ success: true })
    }

    // ── Integration management ───────────────────────────────────────────────
    if (action === 'add_integration') {
      const { agency_id, client_id, platform, platform_pixel_id, platform_name, config } = body
      const { data, error } = await s.from('koto_pixel_integrations').insert({
        agency_id, client_id, platform, platform_pixel_id,
        platform_name: platform_name || platform,
        config: config || {},
        status: 'active',
        connected_at: new Date().toISOString(),
      }).select('*').single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, integration: data })
    }

    if (action === 'remove_integration') {
      await s.from('koto_pixel_integrations').update({ status: 'disconnected' }).eq('id', body.integration_id)
      return Response.json({ success: true })
    }

    // ── Generate AI persona for a visitor profile ────────────────
    if (action === 'generate_persona') {
      const { profile_id } = body
      if (!profile_id) return Response.json({ error: 'profile_id required' }, { status: 400 })

      const { data: profile } = await s.from('koto_visitor_profiles').select('*').eq('id', profile_id).single()
      if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

      // Get all sessions for context
      const { data: sessions } = await s.from('koto_visitor_sessions')
        .select('landing_page, referrer, utm_source, utm_medium, utm_campaign, device_type, browser, os, time_on_site_seconds, pages_viewed, submitted_form, clicked_cta, viewed_pricing, intent_score, identified_company, started_at')
        .eq('visitor_profile_id', profile_id)
        .order('started_at', { ascending: false })
        .limit(20)

      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
      if (!ANTHROPIC_KEY) return Response.json({ error: 'AI not configured' }, { status: 500 })

      const profileSummary = `
Visitor Profile:
- Fingerprint: ${profile.fingerprint}
- Device: ${profile.device_type} | ${profile.browser} ${profile.browser_version} | ${profile.os} ${profile.os_version}
- Screen: ${profile.screen_resolution} | Color depth: ${profile.color_depth} | GPU: ${profile.gpu_renderer || 'unknown'}
- Hardware: ${profile.hardware_concurrency} cores | Touch: ${profile.touch_support ? 'yes' : 'no'} | Connection: ${profile.connection_type || 'unknown'}
- Location: ${[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'unknown'} | Timezone: ${profile.timezone || 'unknown'} | Language: ${profile.language || 'unknown'}
- Company: ${profile.identified_company || 'unknown'} | Domain: ${profile.identified_domain || 'unknown'}
- Sessions: ${profile.total_sessions} total | Pageviews: ${profile.total_pageviews} | Time: ${Math.round((profile.total_time_seconds || 0) / 60)} min total
- Forms submitted: ${profile.total_form_submits} | CTAs clicked: ${profile.total_cta_clicks}
- Max intent: ${profile.max_intent_score} | Latest intent: ${profile.latest_intent_score}
- First seen: ${profile.first_seen_at} | Last seen: ${profile.last_seen_at}
- Top pages: ${(profile.top_pages || []).slice(0, 5).map((p: any) => `${p.url} (${p.views}x)`).join(', ') || 'none'}
- Referral sources: ${(profile.referral_sources || []).slice(0, 5).join(', ') || 'none'}
- UTM history: ${(profile.utm_history || []).slice(0, 3).map((u: any) => `${u.source}/${u.medium}/${u.campaign}`).join(', ') || 'none'}
- Visit hours: ${(profile.visit_times || []).length > 0 ? `Active hours: ${[...new Set(profile.visit_times)].sort().join(', ')}` : 'unknown'}
- Tags: ${(profile.tags || []).join(', ') || 'none'}

Recent Sessions (${(sessions || []).length}):
${(sessions || []).slice(0, 10).map((s: any, i: number) => `  ${i + 1}. ${s.started_at} | ${s.landing_page} | referrer: ${s.referrer || 'direct'} | ${s.time_on_site_seconds}s | score: ${s.intent_score} | ${s.submitted_form ? 'FORM' : ''} ${s.clicked_cta ? 'CTA' : ''} ${s.viewed_pricing ? 'PRICING' : ''}`).join('\n')}
`

      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1200,
            messages: [{ role: 'user', content: `Analyze this website visitor and build a behavioral persona. Return JSON only.

${profileSummary}

Return this exact JSON structure:
{
  "summary": "2-3 sentence persona summary",
  "likely_role": "job title or role guess",
  "buying_stage": "awareness | consideration | decision | loyalty",
  "engagement_level": "cold | warming | engaged | hot",
  "segments": ["tag1", "tag2", "tag3"],
  "interests": ["inferred interest based on pages visited"],
  "behavior_pattern": "description of their browsing pattern",
  "best_time_to_reach": "time window based on visit patterns",
  "device_persona": "power user | casual browser | mobile-first | multi-device",
  "traffic_quality": "organic | paid | referral | direct | social",
  "recommended_action": "what should the sales team do",
  "lead_score_reason": "why they scored high or low",
  "predicted_value": "low | medium | high | very_high"
}` }],
          }),
          signal: AbortSignal.timeout(15000),
        })

        const aiData = await aiRes.json()
        const text = aiData.content?.[0]?.text || '{}'
        const match = text.match(/\{[\s\S]*\}/)
        const persona = match ? JSON.parse(match[0]) : { summary: 'Unable to generate persona', error: true }

        // Save persona to profile
        await s.from('koto_visitor_profiles').update({
          ai_persona: persona,
          ai_persona_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', profile_id)

        return Response.json({ success: true, persona })
      } catch (e: any) {
        return Response.json({ error: e?.message || 'AI generation failed' }, { status: 500 })
      }
    }

    // ── Update profile (label, tags) ─────────────────────────────
    if (action === 'update_profile') {
      const { profile_id, label, tags, identified_email, identified_phone, identified_domain, identified_company } = body
      const updates: any = { updated_at: new Date().toISOString() }
      if (label !== undefined) updates.label = label
      if (tags !== undefined) updates.tags = tags
      if (identified_email !== undefined) updates.identified_email = identified_email
      if (identified_phone !== undefined) updates.identified_phone = identified_phone
      if (identified_domain !== undefined) updates.identified_domain = identified_domain
      if (identified_company !== undefined) updates.identified_company = identified_company
      await s.from('koto_visitor_profiles').update(updates).eq('id', profile_id)
      return Response.json({ success: true })
    }

    // ── Clear/reset a visitor profile ──────────────────────────────
    if (action === 'clear_profile') {
      const { profile_id, mode } = body // mode: 'reset' (clear data, keep profile) or 'delete' (remove entirely)
      if (!profile_id) return Response.json({ error: 'profile_id required' }, { status: 400 })

      if (mode === 'delete') {
        // Unlink all sessions from this profile
        await s.from('koto_visitor_sessions').update({ visitor_profile_id: null }).eq('visitor_profile_id', profile_id)
        // Delete all events for those sessions
        // Delete the profile
        await s.from('koto_visitor_profiles').delete().eq('id', profile_id)
        return Response.json({ success: true, deleted: true })
      }

      // Default: reset — zero out stats but keep the profile so new visits re-accumulate
      await s.from('koto_visitor_sessions').update({ visitor_profile_id: null }).eq('visitor_profile_id', profile_id)
      await s.from('koto_visitor_profiles').update({
        total_sessions: 0,
        total_pageviews: 0,
        total_time_seconds: 0,
        total_form_submits: 0,
        total_cta_clicks: 0,
        max_intent_score: 0,
        latest_intent_score: 0,
        intent_signals: [],
        pages_visited: [],
        referral_sources: [],
        utm_history: [],
        visit_times: [],
        top_pages: [],
        ai_persona: null,
        ai_persona_generated_at: null,
        enrichment_data: null,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile_id)
      return Response.json({ success: true, reset: true })
    }

    // ── Enrich profile — scrape domain for company data ──────────
    if (action === 'enrich_profile') {
      const { profile_id } = body
      if (!profile_id) return Response.json({ error: 'profile_id required' }, { status: 400 })

      const { data: profile } = await s.from('koto_visitor_profiles').select('id, identified_domain, identified_company, enrichment_data').eq('id', profile_id).single() as { data: any }
      if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

      const domain = profile.identified_domain
      if (!domain) return Response.json({ error: 'No domain identified for this visitor' }, { status: 400 })

      try {
        const enrichment = await enrichDomain(domain)

        // Update profile with enrichment data + any discovered contact info
        const updates: any = {
          enrichment_data: enrichment,
          updated_at: new Date().toISOString(),
        }
        // Auto-fill identified fields if not already set
        if (enrichment.company_name && !profile.identified_company) {
          updates.identified_company = enrichment.company_name
        }

        await s.from('koto_visitor_profiles').update(updates).eq('id', profile_id)
        return Response.json({ success: true, enrichment })
      } catch (e: any) {
        return Response.json({ error: e?.message || 'Enrichment failed' }, { status: 500 })
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    // Return 200 for tracking events to not break client sites
    return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}

// CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// ── Pixel Script Generator ───────────────────────────────────────────────────

function generatePixelScript(pixelId: string): string {
  // Minified pixel script with browser fingerprinting + behavioral tracking
  return `(function(){
var P='${pixelId}',A='https://hellokoto.com/api/pixel';
var S=localStorage.getItem('koto_sid')||('koto_'+Math.random().toString(36).substr(2,9)+Date.now());
localStorage.setItem('koto_sid',S);
var ua=navigator.userAgent;
function getBrowser(){if(ua.includes('Edg/'))return['Edge',ua.match(/Edg\\/(\\d+)/)?.[1]||''];if(ua.includes('Chrome'))return['Chrome',ua.match(/Chrome\\/(\\d+)/)?.[1]||''];if(ua.includes('Safari'))return['Safari',ua.match(/Version\\/(\\d+)/)?.[1]||''];if(ua.includes('Firefox'))return['Firefox',ua.match(/Firefox\\/(\\d+)/)?.[1]||''];return['Other',''];}
function getOS(){if(ua.includes('Windows'))return['Windows',ua.match(/Windows NT (\\d+\\.\\d+)/)?.[1]||''];if(ua.includes('Mac OS'))return['macOS',ua.match(/Mac OS X ([\\d_]+)/)?.[1]?.replace(/_/g,'.')||''];if(ua.includes('Android'))return['Android',ua.match(/Android ([\\d.]+)/)?.[1]||''];if(ua.includes('iPhone')||ua.includes('iPad'))return['iOS',ua.match(/OS ([\\d_]+)/)?.[1]?.replace(/_/g,'.')||''];if(ua.includes('Linux'))return['Linux',''];return['Other',''];}
function getDevice(){if(/Mobile|Android.*Mobile|iPhone/i.test(ua))return'mobile';if(/iPad|Android(?!.*Mobile)|Tablet/i.test(ua))return'tablet';return'desktop';}
var br=getBrowser(),os=getOS();
var D={session_id:S,pixel_id:P,landing_page:location.href,referrer:document.referrer,
utm_source:new URLSearchParams(location.search).get('utm_source')||'',
utm_medium:new URLSearchParams(location.search).get('utm_medium')||'',
utm_campaign:new URLSearchParams(location.search).get('utm_campaign')||'',
device_type:getDevice(),browser:br[0],browser_version:br[1],os:os[0],os_version:os[1],
screen_resolution:screen.width+'x'+screen.height,color_depth:screen.colorDepth,
hardware_concurrency:navigator.hardwareConcurrency||0,
touch_support:'ontouchstart' in window||navigator.maxTouchPoints>0,
timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',
language:navigator.language||'',platform:navigator.platform||'',
connection_type:(navigator.connection&&navigator.connection.effectiveType)||'',
started_at:new Date().toISOString()};
function send(t,d){fetch(A,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:t,session_id:S,pixel_id:P,data:d}),keepalive:true}).catch(function(){});}
fetch(A,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'session_start',data:D}),keepalive:true}).catch(function(){});
send('pageview',{url:location.href,title:document.title});
/* Browser fingerprint — canvas + WebGL + fonts */
setTimeout(function(){try{
var c=document.createElement('canvas'),x=c.getContext('2d');c.width=200;c.height=50;
x.textBaseline='top';x.font='14px Arial';x.fillStyle='#f60';x.fillRect(0,0,200,50);
x.fillStyle='#069';x.fillText('Koto.fp" + String.fromCharCode(55356,57331) + "',2,15);
x.fillStyle='rgba(102,204,0,0.7)';x.fillText('Koto.fp" + String.fromCharCode(55356,57331) + "',4,17);
var ch=c.toDataURL().split(',')[1]||'';
var wh='',gr='';try{var g=document.createElement('canvas').getContext('webgl');
if(g){var di=g.getExtension('WEBGL_debug_renderer_info');
gr=di?g.getParameter(di.UNMASKED_RENDERER_WEBGL):'';
wh=(g.getParameter(g.VERSION)||'')+(g.getParameter(g.SHADING_LANGUAGE_VERSION)||'')+gr;}
}catch(e){}
/* Simple hash */
function h(s){for(var i=0,h=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return(h>>>0).toString(36);}
var fp=h(ch+'|'+wh+'|'+screen.width+'x'+screen.height+'|'+screen.colorDepth+'|'+(navigator.hardwareConcurrency||0)+'|'+(Intl.DateTimeFormat().resolvedOptions().timeZone||'')+'|'+navigator.platform);
send('fingerprint',{fingerprint:fp,canvas_hash:h(ch),webgl_hash:h(wh),gpu_renderer:gr.slice(0,200)});
}catch(e){}},500);
/* Scroll tracking */
var mx=0;window.addEventListener('scroll',function(){var p=Math.round((window.scrollY/(document.body.scrollHeight-window.innerHeight))*100);if(p>mx){mx=p;if(p%25===0)send('scroll',{depth:p});}});
/* Click tracking — all clicks with coordinates for heatmap */
document.addEventListener('click',function(e){var x=Math.round(e.pageX/document.documentElement.scrollWidth*100),y=Math.round(e.pageY/Math.max(document.body.scrollHeight,1)*100);var el=e.target.closest('a,button,input,select,textarea,[onclick]')||e.target;var tag=el.tagName||'',t=(el.innerText||el.value||'').slice(0,50),h=el.href||'';send('click',{x:x,y:y,tag:tag,text:t,href:h.slice(0,100),selector:(el.id?'#'+el.id:el.className?'.'+el.className.split(' ')[0]:tag).slice(0,60),url:location.href});if(/call|contact|get|schedule|book|quote|free|start|demo|pricing|signup|register/i.test(t+h))send('cta_click',{text:t,href:h.slice(0,100)});});
/* Form submissions */
document.addEventListener('submit',function(e){send('form_submit',{form_id:e.target.id||'',form_action:e.target.action||''});});
/* Pricing page detection */
if(/pricing|plans|cost|rates|packages/i.test(location.href+document.title))send('pricing_view',{url:location.href});
/* Time milestones */
[30,60,120,300,600].forEach(function(s){setTimeout(function(){send('time_milestone',{seconds:s});},s*1000);});
/* Page visibility tracking */
var hiddenAt=0;document.addEventListener('visibilitychange',function(){if(document.hidden)hiddenAt=Date.now();
else if(hiddenAt)send('tab_return',{away_seconds:Math.round((Date.now()-hiddenAt)/1000)});});
/* Exit intent on desktop */
if(getDevice()==='desktop'){document.addEventListener('mouseout',function(e){
if(e.clientY<5&&!window._koto_exit){window._koto_exit=1;send('exit_intent',{time_on_page:Math.round((Date.now()-new Date(D.started_at).getTime())/1000)});}});}
/* SPA navigation detection */
var lastUrl=location.href;setInterval(function(){if(location.href!==lastUrl){lastUrl=location.href;send('pageview',{url:location.href,title:document.title});}},1000);
})();`
}

function generateInstallSnippet(pixelId: string): string {
  return `<script src="https://hellokoto.com/api/pixel?id=${pixelId}" async></script>`
}
