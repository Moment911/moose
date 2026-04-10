import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { identifyVisitor } from '@/lib/reverseIPLookup'
import { calculateIntentScore } from '@/lib/visitorIntentScorer'
import { fireToAllPlatforms } from '@/lib/pixelEventFiring'
import { createNotification } from '@/lib/notifications'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
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
        .select('agency_id, client_id, is_active, auto_create_lead, auto_add_to_campaign_id')
        .eq('pixel_id', data.pixel_id)
        .eq('is_active', true)
        .maybeSingle()

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

      // Async: reverse IP lookup
      if (ip) {
        identifyVisitor(ip).then(async (result) => {
          if (result.confidence > 30) {
            await s.from('koto_visitor_sessions').update({
              identified_company: result.company,
              identified_domain: result.domain,
              identified_city: result.city,
              identified_state: result.state,
              identified_country: result.country,
              identification_confidence: result.confidence,
            }).eq('session_id', data.session_id)
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

    // Track individual events
    if (['pageview', 'scroll', 'cta_click', 'form_submit', 'time_milestone', 'pricing_view'].includes(action)) {
      const sessionId = body.session_id
      const pixelId = body.pixel_id

      if (!sessionId || !pixelId) return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })

      // Insert event
      const { data: pixel } = await s.from('koto_tracking_pixels').select('agency_id').eq('pixel_id', pixelId).maybeSingle()
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
            }
          }

          // Fire form_submit to all platforms
          if (action === 'form_submit') {
            fireToAllPlatforms(pixel.agency_id, null, 'form_submit', { session_id: sessionId }).catch(() => {})
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
  return `(function(){var P='${pixelId}',A='https://hellokoto.com/api/pixel',S=localStorage.getItem('koto_sid')||('koto_'+Math.random().toString(36).substr(2,9)+Date.now());localStorage.setItem('koto_sid',S);var D={session_id:S,pixel_id:P,landing_page:location.href,referrer:document.referrer,utm_source:new URLSearchParams(location.search).get('utm_source')||'',utm_medium:new URLSearchParams(location.search).get('utm_medium')||'',utm_campaign:new URLSearchParams(location.search).get('utm_campaign')||'',device_type:/Mobile/i.test(navigator.userAgent)?'mobile':'desktop',browser:navigator.userAgent.includes('Chrome')?'Chrome':navigator.userAgent.includes('Safari')?'Safari':navigator.userAgent.includes('Firefox')?'Firefox':'Other',started_at:new Date().toISOString()};function send(t,d){fetch(A,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:t,session_id:S,pixel_id:P,data:d}),keepalive:true}).catch(function(){});}fetch(A,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'session_start',data:D}),keepalive:true}).catch(function(){});send('pageview',{url:location.href,title:document.title});var mx=0;window.addEventListener('scroll',function(){var p=Math.round((window.scrollY/(document.body.scrollHeight-window.innerHeight))*100);if(p>mx){mx=p;if(p%25===0)send('scroll',{depth:p});}});document.addEventListener('click',function(e){var el=e.target.closest('a,button');if(!el)return;var t=(el.innerText||'').slice(0,50),h=el.href||'';if(/call|contact|get|schedule|book|quote|free|start|demo/i.test(t+h))send('cta_click',{text:t,href:h.slice(0,100)});});document.addEventListener('submit',function(e){send('form_submit',{form_id:e.target.id||''});});if(/pricing|plans|cost|rates/i.test(location.href+document.title))send('pricing_view',{url:location.href});[30,60,120,300].forEach(function(s){setTimeout(function(){send('time_milestone',{seconds:s});},s*1000);});})();`
}

function generateInstallSnippet(pixelId: string): string {
  return `<script src="https://hellokoto.com/api/pixel?id=${pixelId}" async></script>`
}
