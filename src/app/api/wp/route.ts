import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../lib/apiAuth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function proxyToWPSC(site: any, endpoint: string, body: any = {}) {
  // WPSimpleCode plugin proxy — separate namespace + key from the koto plugin.
  const start = Date.now()
  const sb = getSupabase()
  const key = site.wpsc_api_key || ''
  const { data: cmd } = await sb.from('koto_wp_commands').insert({
    site_id: site.id, agency_id: site.agency_id, command: `wpsc:${endpoint}`, payload: body, status: 'pending',
  }).select().single()
  try {
    const url = `${site.site_url}/wp-json/wpsimplecode/v1/${endpoint}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'X-WPSC-Key': key,
        'X-WPSC-Source': APP_URL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(45000),
    })
    const responseData = res.ok ? await res.json().catch(() => ({})) : await res.text().then(t => ({ error: t })).catch(() => ({}))
    const duration = Date.now() - start
    await sb.from('koto_wp_commands').update({
      status: res.ok ? 'success' : 'error',
      response: responseData,
      error: res.ok ? null : `HTTP ${res.status}`,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)
    return { ok: res.ok, data: responseData, status: res.status, duration }
  } catch (e: any) {
    const duration = Date.now() - start
    await sb.from('koto_wp_commands').update({
      status: 'error', error: e.message, duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)
    return { ok: false, data: {}, error: e.message, duration }
  }
}

async function proxyToWPSCMethod(site: any, method: 'GET'|'POST'|'PUT'|'DELETE', endpoint: string, body: any = {}) {
  // Method-aware variant of proxyToWPSC — needed because the KotoIQ plugin's
  // builder + SEO modules expose several GET / DELETE endpoints (builder/pages,
  // agency/test, /pages, rotation-cache/{id}).
  const start = Date.now()
  const sb = getSupabase()
  const key = site.wpsc_api_key || ''
  const { data: cmd } = await sb.from('koto_wp_commands').insert({
    site_id: site.id, agency_id: site.agency_id, command: `wpsc:${method}:${endpoint}`, payload: body, status: 'pending',
  }).select().single()
  try {
    const url = `${site.site_url}/wp-json/wpsimplecode/v1/${endpoint}`
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${key}`,
        'X-WPSC-Key': key,
        'X-WPSC-Source': APP_URL,
        'Content-Type': 'application/json',
      },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body || {}),
      signal: AbortSignal.timeout(45000),
    })
    const responseData = res.ok ? await res.json().catch(() => ({})) : await res.text().then(t => ({ error: t })).catch(() => ({}))
    const duration = Date.now() - start
    await sb.from('koto_wp_commands').update({
      status: res.ok ? 'success' : 'error',
      response: responseData,
      error: res.ok ? null : `HTTP ${res.status}`,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)
    return { ok: res.ok, data: responseData, status: res.status, duration }
  } catch (e: any) {
    const duration = Date.now() - start
    await sb.from('koto_wp_commands').update({
      status: 'error', error: e.message, duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)
    return { ok: false, data: {}, error: e.message, duration }
  }
}

async function proxyToPlugin(site: any, endpoint: string, method = 'POST', body: any = {}) {
  const start = Date.now()
  const sb = getSupabase()
  const { data: cmd } = await sb.from('koto_wp_commands').insert({
    site_id: site.id, agency_id: site.agency_id, command: endpoint, payload: body, status: 'pending',
  }).select().single()
  try {
    const url = `${site.site_url}/wp-json/koto/v1/${endpoint}`
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${site.api_key}`,
        'X-KOTO-Key': site.api_key,
        'X-Koto-API-Key': site.api_key,
        'Content-Type': 'application/json',
        'X-Koto-Source': APP_URL,
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    })
    const responseData = res.ok ? await res.json().catch(() => ({})) : {}
    const duration = Date.now() - start
    await sb.from('koto_wp_commands').update({
      status: res.ok ? 'success' : 'error', response: responseData,
      error: res.ok ? null : `HTTP ${res.status}`, duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)
    await sb.from('koto_wp_sites').update({
      connected: res.ok, last_ping: new Date().toISOString(),
    }).eq('id', site.id)
    return { ok: res.ok, data: responseData, status: res.status, duration }
  } catch (e: any) {
    const duration = Date.now() - start
    await sb.from('koto_wp_commands').update({
      status: 'error', error: e.message, duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)
    return { ok: false, data: {}, error: e.message, duration }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agency_id = resolveAgencyId(req, searchParams)
  const sb = getSupabase()

  // Plugin welcome page — returns HTML content for the WP plugin dashboard
  if (action === 'plugin_welcome') {
    const { data: content } = await sb.from('koto_platform_settings').select('value').eq('key', 'plugin_welcome_html').maybeSingle()
    if (content?.value) {
      return NextResponse.json({ html: content.value, source: 'custom' })
    }
    // Default welcome content
    const defaultHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#cb1c6b;border-radius:14px;margin-bottom:12px;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    </div>
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#111;">Welcome to HelloKoto</h1>
    <p style="color:#6b7280;font-size:14px;margin:6px 0 0;">Your AI-powered marketing platform</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
      <div style="font-size:20px;margin-bottom:6px;">📞</div>
      <strong style="font-size:13px;color:#111;">AI Front Desk</strong>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Virtual receptionist that answers calls, books appointments, and transfers to your team.</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
      <div style="font-size:20px;margin-bottom:6px;">📈</div>
      <strong style="font-size:13px;color:#111;">SEO & Content</strong>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">AI-generated pages, rank tracking, sitemap management, and monthly reporting.</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
      <div style="font-size:20px;margin-bottom:6px;">⭐</div>
      <strong style="font-size:13px;color:#111;">Review Management</strong>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Automated review campaigns, monitoring, and response management across platforms.</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
      <div style="font-size:20px;margin-bottom:6px;">🎯</div>
      <strong style="font-size:13px;color:#111;">Scout Intelligence</strong>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">AI-powered lead research, prospect reports, and competitive analysis.</p>
    </div>
  </div>
  <div style="text-align:center;">
    <a href="https://hellokoto.com" target="_blank" style="display:inline-block;background:#cb1c6b;color:#fff;padding:10px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">Visit hellokoto.com →</a>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">Powered by Koto · AI Marketing Platform for Agencies</p>
</div>`
    return NextResponse.json({ html: defaultHtml, source: 'default' })
  }

  // Plugin welcome content editor — save custom HTML
  if (action === 'get_welcome_content') {
    const { data } = await sb.from('koto_platform_settings').select('value').eq('key', 'plugin_welcome_html').maybeSingle()
    return NextResponse.json({ html: data?.value || '' })
  }

  const site_id = searchParams.get('site_id')
  if (site_id) {
    const [{ data: site }, { data: commands }, { data: pages }, { data: rankings }] = await Promise.all([
      sb.from('koto_wp_sites').select('*').eq('id', site_id).single(),
      sb.from('koto_wp_commands').select('*').eq('site_id', site_id).order('created_at', { ascending: false }).limit(20),
      sb.from('koto_wp_pages').select('*').eq('site_id', site_id).order('created_at', { ascending: false }).limit(50),
      sb.from('koto_wp_rankings').select('*').eq('site_id', site_id).order('synced_at', { ascending: false }).limit(100),
    ])
    return NextResponse.json({ site, commands: commands || [], pages: pages || [], rankings: rankings || [] })
  }
  const query = sb.from('koto_wp_sites').select('*')
  if (agency_id) query.eq('agency_id', agency_id)
  query.order('created_at', { ascending: false })
  const { data: sites, error: sitesError } = await query
  if (sitesError) return NextResponse.json({ sites: [], error: sitesError.message, debug: { agency_id, hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL, hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } })
  return NextResponse.json({ sites: sites || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, site_id } = body
    const sb = getSupabase()

    // Save plugin welcome page content (with AI design)
    if (action === 'save_welcome_content') {
      const { html } = body
      await sb.from('koto_platform_settings').upsert({ key: 'plugin_welcome_html', value: html, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      return NextResponse.json({ ok: true })
    }

    // AI-design the welcome page
    if (action === 'design_welcome') {
      const { prompt: userPrompt, current_html } = body
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })

      const systemPrompt = `You are a world-class HTML/CSS designer. You create beautiful, modern HTML layouts for a WordPress plugin welcome page.

The brand is "HelloKoto" — an AI-powered marketing platform for agencies. Brand color is #cb1c6b (pink/magenta). Secondary color is #00C2CB (teal).

Rules:
- Output ONLY the HTML. No markdown, no code fences, no explanation.
- Use inline styles only (no external CSS, no <style> tags).
- Use system fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Max width 600px, clean whitespace, rounded corners, modern card-based layout
- Include the HelloKoto lightning bolt logo icon (pink square with white SVG lightning)
- Make it look premium and professional
- Keep content concise and punchy
- Include a "Visit hellokoto.com" CTA button
- Include "Powered by Koto" footer`

      const messages = [
        { role: 'user', content: current_html
          ? `Here is the current welcome page HTML:\n\n${current_html}\n\nThe user wants these changes: ${userPrompt}\n\nReturn the complete updated HTML.`
          : `Create a beautiful welcome page for the HelloKoto WordPress plugin. ${userPrompt}\n\nReturn only the HTML.`
        }
      ]

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: systemPrompt, messages }),
        signal: AbortSignal.timeout(30000),
      })
      const aiData = await aiRes.json()
      const html = aiData.content?.[0]?.text || ''

      // Strip any markdown code fences if present
      const cleaned = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()

      return NextResponse.json({ html: cleaned })
    }

    // Register site (alternative endpoint for plugin compatibility)
    if (action === 'register') {
      const { site_url, site_name, wp_version, plugin_version, client_id } = body
      const apiKey = req.headers.get('x-koto-key') || req.headers.get('authorization')?.replace('Bearer ', '') || ''
      if (!site_url) return NextResponse.json({ error: 'site_url required' }, { status: 400 })

      const cleanUrl = site_url.replace(/\/$/, '')
      const { data: existing } = await sb.from('koto_wp_sites').select('id, agency_id').or(`site_url.eq.${cleanUrl},api_key.eq.${apiKey}`).maybeSingle()
      if (existing) {
        await sb.from('koto_wp_sites').update({ site_name, wp_version, plugin_version, connected: true, last_ping: new Date().toISOString(), ...(client_id ? { client_id } : {}) }).eq('id', existing.id)
        return NextResponse.json({ success: true, site_id: existing.id, agency_id: existing.agency_id })
      }
      return NextResponse.json({ success: false, error: 'Site not found. Add the site in your Koto dashboard first.' }, { status: 404 })
    }

    if (action === 'connect') {
      const { site_url, api_key, client_id, site_name } = body
      const cleanUrl = site_url.replace(/\/$/, '').toLowerCase()
      const testRes = await fetch(`${cleanUrl}/wp-json/koto/v1/agency/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'X-KOTO-Key': api_key,
          'X-Koto-API-Key': api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ koto_url: APP_URL }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => null)
      const connected = testRes?.ok || false
      const siteInfo = connected ? await testRes!.json().catch(() => ({})) : {}
      const { data: site, error } = await sb.from('koto_wp_sites').upsert({
        agency_id, client_id: client_id || null, site_url: cleanUrl, api_key,
        site_name: siteInfo.site_name || site_name || cleanUrl, connected,
        wp_version: siteInfo.wp_version, plugin_version: siteInfo.plugin_version || siteInfo.version,
        theme_name: siteInfo.theme, pages_count: siteInfo.pages || 0,
        posts_count: siteInfo.posts || 0, last_ping: new Date().toISOString(),
      }, { onConflict: 'agency_id,site_url' }).select().single()
      if (error) throw error
      return NextResponse.json({ site, connected, site_info: siteInfo })
    }

    // Agency-wide S&R job history — joins koto_search_replace_jobs to
    // koto_wp_sites + clients so the panel can show "site X · client Y" per row.
    if (action === 'sr_list_all_jobs') {
      const finalAgency = agency_id || body?.agency_id
      if (!finalAgency) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      const { data: jobs } = await sb
        .from('koto_search_replace_jobs')
        .select('*')
        .eq('agency_id', finalAgency)
        .order('created_at', { ascending: false })
        .limit(200)
      const siteIds = Array.from(new Set((jobs || []).map(j => j.site_id).filter(Boolean)))
      const clientIds = Array.from(new Set((jobs || []).map(j => j.client_id).filter(Boolean)))
      const [{ data: sites }, { data: clients }] = await Promise.all([
        siteIds.length
          ? sb.from('koto_wp_sites').select('id, site_url, site_name, client_id').in('id', siteIds)
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? sb.from('clients').select('id, name').in('id', clientIds)
          : Promise.resolve({ data: [] }),
      ])
      const siteMap = new Map((sites || []).map(s => [s.id, s]))
      const clientMap = new Map((clients || []).map(c => [c.id, c]))
      const enriched = (jobs || []).map(j => {
        const s = siteMap.get(j.site_id)
        const c = clientMap.get(j.client_id) || (s?.client_id ? clientMap.get(s.client_id) : null)
        return {
          ...j,
          site_url: s?.site_url || null,
          site_name: s?.site_name || null,
          client_name: c?.name || null,
        }
      })
      return NextResponse.json({ jobs: enriched })
    }

    // ─── Actions that DON'T require an existing site (run before the site guard) ──

    // Client-aware listing — clients in the agency joined to their koto_wp_sites row (if any).
    if (action === 'wpsc_list_clients') {
      const finalAgency = agency_id || body?.agency_id
      if (!finalAgency) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      const [{ data: clients }, { data: allSites }] = await Promise.all([
        sb.from('clients')
          .select('id, name, website, status, logo_url')
          .eq('agency_id', finalAgency)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        sb.from('koto_wp_sites')
          .select('*')
          .eq('agency_id', finalAgency)
          .order('created_at', { ascending: false }),
      ])
      const siteByClient = new Map<string, any>()
      const orphans: any[] = []
      for (const s of allSites || []) {
        if (s.client_id) siteByClient.set(s.client_id, s)
        else orphans.push(s)
      }
      const rows = (clients || []).map(c => ({
        client: c,
        site: siteByClient.get(c.id) || null,
      }))
      return NextResponse.json({ rows, orphans })
    }

    if (action === 'wpsc_add_site') {
      const { site_url, site_name, wpsc_api_key, koto_api_key, client_id } = body
      const finalAgency = agency_id
      if (!site_url || !wpsc_api_key) return NextResponse.json({ error: 'site_url and wpsc_api_key required' }, { status: 400 })
      if (!finalAgency) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      const cleanUrl = String(site_url).replace(/\/$/, '').toLowerCase()

      let detected = false; let version: string | null = null; let pluginIdentity: string = 'wpsimplecode'
      try {
        const r = await fetch(`${cleanUrl}/wp-json/wpsimplecode/v1/meta`, { signal: AbortSignal.timeout(8000) })
        if (r.ok) {
          const m = await r.json().catch(() => ({}))
          detected = true
          version = m?.version || null
          // KotoIQ 2.0+ returns plugin: 'kotoiq'. Legacy WPSimpleCode 1.x omits the field.
          pluginIdentity = m?.plugin === 'kotoiq' ? 'kotoiq' : 'wpsimplecode'
        }
      } catch {}
      if (!detected) return NextResponse.json({ error: `KotoIQ / WPSimpleCode plugin not detected at ${cleanUrl}/wp-json/wpsimplecode/v1/meta` }, { status: 400 })

      const verifyRes = await fetch(`${cleanUrl}/wp-json/wpsimplecode/v1/access/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wpsc_api_key}`,
          'X-WPSC-Key': wpsc_api_key,
          'X-WPSC-Source': APP_URL,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      })
      if (!verifyRes.ok) {
        const txt = await verifyRes.text().catch(() => '')
        return NextResponse.json({ error: `Auth failed (${verifyRes.status}). Make sure "Enable remote control" is checked in WPSimpleCode → Settings. ${txt.slice(0, 200)}` }, { status: 400 })
      }

      const { data: existing } = await sb.from('koto_wp_sites').select('id').eq('site_url', cleanUrl).maybeSingle()
      let row: any
      if (existing) {
        const { data, error } = await sb.from('koto_wp_sites').update({
          site_name: site_name || cleanUrl,
          agency_id: finalAgency,
          client_id: client_id || null,
          wpsc_api_key,
          wpsc_detected: true,
          wpsc_version: version,
          wpsc_plugin: pluginIdentity,
          wpsc_last_seen_at: new Date().toISOString(),
          ...(koto_api_key ? { api_key: koto_api_key } : {}),
        }).eq('id', existing.id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        row = data
      } else {
        const { data, error } = await sb.from('koto_wp_sites').insert({
          site_url: cleanUrl,
          site_name: site_name || cleanUrl,
          agency_id: finalAgency,
          client_id: client_id || null,
          api_key: koto_api_key || '',
          wpsc_api_key,
          wpsc_detected: true,
          wpsc_version: version,
          wpsc_plugin: pluginIdentity,
          wpsc_last_seen_at: new Date().toISOString(),
          connected: false,
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        row = data
      }
      return NextResponse.json({ site: row, version })
    }

    // ─── Actions below require an existing site ───
    const { data: site } = await sb.from('koto_wp_sites').select('*').eq('id', site_id).single()
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    if (action === 'ping') {
      const result = await proxyToPlugin(site, 'agency/test', 'POST', { koto_url: APP_URL })
      if (result.ok && result.data) {
        await sb.from('koto_wp_sites').update({
          plugin_version: result.data.version, theme_name: result.data.theme,
          pages_count: result.data.pages || 0, posts_count: result.data.posts || 0,
          connected: true, last_ping: new Date().toISOString(),
        }).eq('id', site_id)
      }
      return NextResponse.json(result)
    }

    if (action === 'get_locations') {
      const { state, county } = body
      const qs = county ? `state=${state}&county=${county}` : `state=${state}`
      const result = await proxyToPlugin(site, `locations/cities?${qs}`, 'GET')
      return NextResponse.json(result)
    }

    if (action === 'generate_pages') {
      const { keyword_template, topic, location_ids, page_type, schema_type, aeo_enabled, additional_keywords, template, status: pageStatus } = body
      const locations = Array.isArray(location_ids)
        ? location_ids.map((id: any) => typeof id === 'string' ? { city: id.split('_')[0], state: id.split('_')[1] || body.state || '' } : id)
        : []
      const result = await proxyToPlugin(site, 'generate/batch', 'POST', {
        keyword: topic || keyword_template, service: topic || keyword_template,
        locations, template: template || '', schema: schema_type || 'LocalBusiness',
        aeo: aeo_enabled !== false, status: pageStatus || 'draft',
        page_type, additional_keywords, keyword_template,
      })
      if (result.ok && Array.isArray(result.data?.pages) && result.data.pages.length) {
        const rows = result.data.pages.map((p: any) => ({
          site_id, agency_id: site.agency_id, wp_post_id: p.id, title: p.title || '',
          slug: p.slug || '', url: p.url || '', keyword: topic || keyword_template || '',
          location: p.location || '', seo_score: p.seo_score || null,
          word_count: p.word_count || null, status: p.status || 'draft',
          synced_at: new Date().toISOString(),
        }))
        await sb.from('koto_wp_pages').upsert(rows, { onConflict: 'site_id,wp_post_id' })
        await sb.from('koto_wp_sites').update({
          pages_generated: (site.pages_generated || 0) + rows.length,
        }).eq('id', site_id)
      }
      return NextResponse.json(result)
    }

    if (action === 'sync_pages') {
      const result = await proxyToPlugin(site, 'content', 'GET')
      if (result.ok && Array.isArray(result.data?.content) && result.data.content.length) {
        const rows = result.data.content.map((p: any) => ({
          site_id, agency_id: site.agency_id, wp_post_id: p.id, title: p.title || '',
          slug: p.slug || '', url: p.url || '', keyword: p.focus_kw || '',
          meta_desc: p.meta_desc || '', seo_score: p.seo_score || null,
          word_count: p.word_count || null, status: p.status || 'draft',
          post_type: p.type || 'page', synced_at: new Date().toISOString(),
        }))
        await sb.from('koto_wp_pages').upsert(rows, { onConflict: 'site_id,wp_post_id' })
      }
      return NextResponse.json(result)
    }

    if (action === 'sync_rankings') {
      const result = await proxyToPlugin(site, 'rankings/sync', 'POST')
      const rankResult = await proxyToPlugin(site, 'rankings', 'GET')
      if (rankResult.ok && Array.isArray(rankResult.data?.rankings) && rankResult.data.rankings.length) {
        const rows = rankResult.data.rankings.map((r: any) => ({
          site_id, agency_id: site.agency_id, keyword: r.keyword || '',
          position: r.position || null, clicks: r.clicks || 0,
          impressions: r.impressions || 0, ctr: r.ctr || 0,
          city: r.city || '', state: r.state || '',
          page_url: r.page_url || '', synced_at: new Date().toISOString(),
        }))
        await sb.from('koto_wp_rankings').upsert(rows, { onConflict: 'site_id,keyword' })
      }
      return NextResponse.json(result)
    }

    if (action === 'generate_blog') {
      const { topic, keyword, city, state: blogState, length, status: blogStatus } = body
      return NextResponse.json(await proxyToPlugin(site, 'blog/generate', 'POST', {
        topic, keyword: keyword || topic, city,
        state: blogState, length: length || 800, status: blogStatus || 'draft',
      }))
    }

    if (action === 'run_automation') {
      return NextResponse.json(await proxyToPlugin(site, 'automation/run-now', 'POST', { task: body.task || 'all' }))
    }

    if (action === 'rebuild_sitemap') {
      return NextResponse.json(await proxyToPlugin(site, 'sitemap/rebuild', 'POST'))
    }

    if (action === 'get_settings') {
      return NextResponse.json(await proxyToPlugin(site, 'settings', 'GET'))
    }

    if (action === 'update_settings') {
      return NextResponse.json(await proxyToPlugin(site, 'settings', 'POST', body.settings || {}))
    }

    if (action === 'list_content') {
      return NextResponse.json(await proxyToPlugin(site, 'content', 'GET'))
    }

    if (action === 'get_content') {
      return NextResponse.json(await proxyToPlugin(site, `content/${body.id}`, 'GET'))
    }

    if (action === 'create_content') {
      return NextResponse.json(await proxyToPlugin(site, 'content', 'POST', body))
    }

    if (action === 'update_content') {
      return NextResponse.json(await proxyToPlugin(site, `content/${body.id}`, 'PUT', body))
    }

    if (action === 'delete_content') {
      return NextResponse.json(await proxyToPlugin(site, `content/${body.id}`, 'DELETE'))
    }

    if (action === 'get_styles') {
      return NextResponse.json(await proxyToPlugin(site, 'styles', 'GET'))
    }

    if (action === 'get_rankings') {
      return NextResponse.json(await proxyToPlugin(site, 'rankings', 'GET'))
    }

    // ── KotoIQ Builder Read Endpoints (ELEM-01, ELEM-02, ELEM-03) ──────

    if (action === 'detect_builder') {
      const result = await proxyToPlugin(site, 'builder/detect', 'POST')
      if (result.ok && result.data) {
        // Upsert kotoiq_builder_sites with detected info
        await sb.from('kotoiq_builder_sites').upsert({
          site_id, agency_id: site.agency_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'site_id' })
      }
      return NextResponse.json(result)
    }

    if (action === 'list_elementor_pages') {
      const result = await proxyToPlugin(site, 'builder/pages', 'GET')
      return NextResponse.json(result)
    }

    if (action === 'get_elementor_data') {
      const { post_id } = body
      if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })
      const result = await proxyToPlugin(site, `builder/elementor/${post_id}`, 'GET')
      return NextResponse.json(result)
    }

    if (action === 'capture_elementor_schema') {
      // ELEM-05: Capture live Elementor v4 schema from a page on the connected site
      const { post_id } = body
      if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

      // 1. Fetch the raw elementor data via the plugin
      const result = await proxyToPlugin(site, `builder/elementor/${post_id}`, 'GET')
      if (!result.ok || !result.data?.elementor_data) {
        return NextResponse.json({ error: 'Failed to fetch Elementor data', detail: result }, { status: 502 })
      }

      // 2. Capture schema from the live JSON
      const { captureSchema, diffSchemas, detectSlots } = await import('../../../lib/builder/elementorAdapter')
      const schema = captureSchema(
        result.data.elementor_data,
        result.data.elementor_version || 'unknown',
        post_id
      )

      // 3. Check for existing pinned schema (ELEM-06: drift detection)
      const { data: existingPinned } = await sb.from('kotoiq_elementor_schema_versions')
        .select('*')
        .eq('site_id', site_id)
        .eq('is_pinned', true)
        .maybeSingle()

      let drift = null
      if (existingPinned?.widget_schema) {
        drift = diffSchemas(existingPinned.widget_schema, schema)
      }

      // 4. Persist the captured schema
      const { data: schemaRow, error: schemaError } = await sb.from('kotoiq_elementor_schema_versions').upsert({
        site_id,
        elementor_version: schema.elementorVersion,
        captured_from_post_id: post_id,
        widget_schema: schema,
        is_pinned: !existingPinned, // auto-pin if first capture
        drift_status: drift?.status || 'clean',
        drift_details: drift,
        captured_at: new Date().toISOString(),
      }, { onConflict: 'site_id,elementor_version' }).select().single()

      if (schemaError) {
        return NextResponse.json({ error: schemaError.message }, { status: 500 })
      }

      // 5. Also detect slots (preview for template ingest)
      const slots = detectSlots(result.data.elementor_data)

      return NextResponse.json({
        ok: true,
        schema: {
          id: schemaRow.id,
          elementor_version: schema.elementorVersion,
          total_elements: schema.totalElements,
          total_widgets: schema.totalWidgets,
          widget_types: Object.keys(schema.widgets),
          css_classes_count: schema.cssClasses.length,
          is_pinned: schemaRow.is_pinned,
        },
        drift,
        slots: {
          count: slots.length,
          items: slots,
        },
        page: {
          post_id,
          title: result.data.title,
          url: result.data.url,
        },
      })
    }

    // ── KotoIQ Builder Write Endpoints (ELEM-04, ELEM-07, ELEM-08) ─────

    if (action === 'put_elementor_data') {
      // ELEM-04: Write Elementor data via Document::save()
      const { post_id, elementor_data, page_settings, status: postStatus, idempotency_key } = body
      if (!post_id) return NextResponse.json({ error: 'post_id required (int or "new")' }, { status: 400 })
      if (!elementor_data) return NextResponse.json({ error: 'elementor_data required' }, { status: 400 })
      const result = await proxyToPlugin(site, `builder/elementor/${post_id}`, 'PUT', {
        elementor_data, page_settings, status: postStatus, idempotency_key,
      })
      return NextResponse.json(result)
    }

    if (action === 'clone_elementor_page') {
      // Clone an existing Elementor page as a new draft
      const { source_post_id, title, slug, status: cloneStatus, elementor_data, idempotency_key } = body
      if (!source_post_id) return NextResponse.json({ error: 'source_post_id required' }, { status: 400 })
      const result = await proxyToPlugin(site, 'builder/clone', 'POST', {
        source_post_id, title, slug, status: cloneStatus || 'draft',
        elementor_data, idempotency_key,
      })
      return NextResponse.json(result)
    }

    if (action === 'ingest_template') {
      // ELEM-07 + ELEM-08: Pull a page, store as master template, auto-detect slots
      const { post_id } = body
      if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

      // 1. Fetch the raw Elementor data
      const pageResult = await proxyToPlugin(site, `builder/elementor/${post_id}`, 'GET')
      if (!pageResult.ok || !pageResult.data?.elementor_data) {
        return NextResponse.json({ error: 'Failed to fetch page', detail: pageResult }, { status: 502 })
      }

      const { elementor_data, elementor_version, page_settings, title, url } = pageResult.data

      // 2. Capture/check schema
      const { captureSchema, diffSchemas, detectSlots } = await import('../../../lib/builder/elementorAdapter')
      const schema = captureSchema(elementor_data, elementor_version || 'unknown', post_id)

      // Check for existing pinned schema
      const { data: pinnedSchema } = await sb.from('kotoiq_elementor_schema_versions')
        .select('*').eq('site_id', site_id).eq('is_pinned', true).maybeSingle()

      let schemaVersionId = pinnedSchema?.id
      if (!pinnedSchema) {
        // First capture — persist and pin
        const { data: newSchema } = await sb.from('kotoiq_elementor_schema_versions').insert({
          site_id, elementor_version: schema.elementorVersion,
          captured_from_post_id: post_id, widget_schema: schema,
          is_pinned: true, drift_status: 'clean',
        }).select().single()
        schemaVersionId = newSchema?.id
      }

      // 3. Auto-detect slots
      const slots = detectSlots(elementor_data)

      // 4. Store as master template in kotoiq_templates
      const { data: template, error: templateError } = await sb.from('kotoiq_templates').insert({
        agency_id: site.agency_id,
        client_id: body.client_id || site.client_id || null,
        site_id,
        source_post_id: post_id,
        source_title: title,
        schema_version_id: schemaVersionId,
        elementor_data,
        elementor_version: elementor_version || 'unknown',
        page_settings: page_settings || {},
        status: 'draft',
        slot_count: slots.length,
        token_estimate: JSON.stringify(elementor_data).length, // rough byte count
      }).select().single()

      if (templateError) {
        return NextResponse.json({ error: templateError.message }, { status: 500 })
      }

      // 5. Persist auto-detected slots
      if (slots.length > 0) {
        const slotRows = slots.map(s => ({
          template_id: template.id,
          json_path: s.jsonPath,
          slot_kind: s.slotKind,
          label: s.suggestedLabel,
          required: true,
        }))
        await sb.from('kotoiq_template_slots').insert(slotRows)
      }

      return NextResponse.json({
        ok: true,
        template: {
          id: template.id,
          source_title: title,
          source_url: url,
          slot_count: slots.length,
          elementor_version,
          status: 'draft',
        },
        slots: slots.map(s => ({
          json_path: s.jsonPath,
          slot_kind: s.slotKind,
          label: s.suggestedLabel,
          current_value: s.currentValue,
          widget_type: s.widgetType,
        })),
      })
    }

    if (action === 'update_template_slots') {
      // ELEM-09: Update slots (rename, add, remove, constrain)
      const { template_id, slots: slotUpdates } = body
      if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

      // Verify template belongs to this agency
      const { data: tmpl } = await sb.from('kotoiq_templates')
        .select('id, agency_id').eq('id', template_id).single()
      if (!tmpl || tmpl.agency_id !== site.agency_id) {
        return NextResponse.json({ error: 'Template not found or not yours' }, { status: 404 })
      }

      if (Array.isArray(slotUpdates)) {
        for (const slot of slotUpdates) {
          if (slot.delete && slot.id) {
            await sb.from('kotoiq_template_slots').delete().eq('id', slot.id)
          } else if (slot.id) {
            // Update existing
            const { id, delete: _, ...updates } = slot
            await sb.from('kotoiq_template_slots').update(updates).eq('id', id)
          } else {
            // Add new slot
            await sb.from('kotoiq_template_slots').insert({
              template_id,
              json_path: slot.json_path,
              slot_kind: slot.slot_kind,
              label: slot.label,
              wildcard_key: slot.wildcard_key,
              constraints: slot.constraints || {},
              required: slot.required ?? true,
            })
          }
        }
      }

      // Update slot count
      const { count } = await sb.from('kotoiq_template_slots')
        .select('*', { count: 'exact', head: true }).eq('template_id', template_id)
      await sb.from('kotoiq_templates').update({
        slot_count: count || 0, updated_at: new Date().toISOString(),
      }).eq('id', template_id)

      // Fetch updated slots
      const { data: updatedSlots } = await sb.from('kotoiq_template_slots')
        .select('*').eq('template_id', template_id).order('created_at')

      return NextResponse.json({ ok: true, slots: updatedSlots, slot_count: count })
    }

    if (action === 'delete_template') {
      const { template_id } = body
      if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })
      // Delete slots first, then template
      await sb.from('kotoiq_template_slots').delete().eq('template_id', template_id)
      await sb.from('kotoiq_templates').delete().eq('id', template_id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'get_template') {
      // Fetch template + its slots
      const { template_id } = body
      if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

      const [templateRes, slotsRes] = await Promise.all([
        sb.from('kotoiq_templates').select('*').eq('id', template_id).eq('agency_id', site.agency_id).single(),
        sb.from('kotoiq_template_slots').select('*').eq('template_id', template_id).order('created_at'),
      ])

      if (!templateRes.data) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      return NextResponse.json({
        template: templateRes.data,
        slots: slotsRes.data || [],
      })
    }

    if (action === 'list_templates') {
      const { data: templates } = await sb.from('kotoiq_templates')
        .select('id, source_title, elementor_version, status, slot_count, site_id, ingested_at')
        .eq('agency_id', site.agency_id)
        .order('ingested_at', { ascending: false })
      return NextResponse.json({ templates: templates || [] })
    }

    // ── Phase 3: Engine → Publish Adapter (ADAPT-01 through ADAPT-06) ───

    if (action === 'generate_variants') {
      const { campaign_id } = body
      if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

      const { getKotoIQDb } = await import('../../../lib/kotoiqDb')
      const db = getKotoIQDb(site.agency_id)

      const { data: campaign, error: campErr } = await db.campaigns.get(campaign_id)
      if (campErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

      const { data: template } = await db.templates.get(campaign.template_id)
      if (!template) return NextResponse.json({ error: 'Template not found for campaign' }, { status: 404 })

      const { data: slotRows } = await db.from('kotoiq_template_slots')
        .select('*').eq('template_id', template.id)
      if (!slotRows?.length) return NextResponse.json({ error: 'No slots defined for template' }, { status: 400 })

      const seedRows = campaign.seed_rows || []
      if (!seedRows.length) return NextResponse.json({ error: 'No seed rows in campaign' }, { status: 400 })

      const { generateVariants } = await import('../../../lib/builder/variantGenerator')

      const slots = slotRows.map((s: any) => ({
        json_path: s.json_path,
        slot_kind: s.slot_kind,
        label: s.label,
        required: s.required,
        constraints: s.constraints,
      }))

      const variants = await generateVariants(template.elementor_data, slots, seedRows, {
        agencyId: site.agency_id,
        clientId: campaign.client_id,
        campaignId: campaign_id,
        templateId: template.id,
      })

      const variantRows = variants.map(v => ({
        campaign_id,
        template_id: template.id,
        seed_row: v.seed_row,
        rendered_elementor_data: v.rendered_elementor_data,
        body_hash: v.body_hash,
        idempotency_key: v.idempotency_key,
        filled_slots: v.filled_slots,
        status: 'draft',
      }))

      const { data: inserted, error: insertErr } = await db.from('kotoiq_variants')
        .upsert(variantRows, { onConflict: 'idempotency_key' }).select()

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

      return NextResponse.json({
        ok: true,
        variant_count: inserted?.length || 0,
        variants: (inserted || []).map((v: any) => ({
          id: v.id,
          idempotency_key: v.idempotency_key,
          body_hash: v.body_hash,
          status: v.status,
        })),
      })
    }

    if (action === 'preflight_check') {
      const { campaign_id } = body
      if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

      const { getKotoIQDb } = await import('../../../lib/kotoiqDb')
      const db = getKotoIQDb(site.agency_id)

      const { data: variants } = await db.from('kotoiq_variants')
        .select('*').eq('campaign_id', campaign_id)
      if (!variants?.length) return NextResponse.json({ error: 'No variants found for campaign' }, { status: 404 })

      const { data: campaign } = await db.campaigns.get(campaign_id)
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

      const { data: template } = await db.templates.get(campaign.template_id)
      const { data: slotRows } = await db.from('kotoiq_template_slots')
        .select('*').eq('template_id', campaign.template_id)

      const requiredPaths = new Set<string>(
        (slotRows || []).filter((s: any) => s.required).map((s: any) => s.json_path)
      )

      let pinnedSchema = null
      if (template?.schema_version_id) {
        const { data: schemaRow } = await sb.from('kotoiq_elementor_schema_versions')
          .select('widget_schema').eq('id', template.schema_version_id).single()
        pinnedSchema = schemaRow?.widget_schema || null
      }

      const { runPreflight } = await import('../../../lib/builder/preflightGate')

      const variantInputs = variants.map((v: any) => ({
        seed_row: v.seed_row,
        rendered_elementor_data: v.rendered_elementor_data,
        body_text: '',
        body_hash: v.body_hash,
        idempotency_key: v.idempotency_key,
        filled_slots: v.filled_slots || [],
      }))

      const result = runPreflight(variantInputs, pinnedSchema, requiredPaths)

      await db.campaigns.update(campaign_id, {
        preflight_status: result.passed ? 'passed' : 'failed',
        preflight_result: result,
      })

      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'preview_variant') {
      const { variant_id } = body
      if (!variant_id) return NextResponse.json({ error: 'variant_id required' }, { status: 400 })

      const { data: variant } = await sb.from('kotoiq_variants')
        .select('*, kotoiq_campaigns!inner(template_id, agency_id)')
        .eq('id', variant_id)
        .single()
      if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })

      const campaign = (variant as any).kotoiq_campaigns
      if (campaign.agency_id !== site.agency_id) {
        return NextResponse.json({ error: 'Variant does not belong to this agency' }, { status: 403 })
      }

      const { data: template } = await sb.from('kotoiq_templates')
        .select('source_post_id, page_settings')
        .eq('id', campaign.template_id)
        .single()
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const seedLabel = variant.seed_row?.city || variant.seed_row?.neighborhood || variant.seed_row?.name || 'preview'
      const result = await proxyToPlugin(site, 'builder/clone', 'POST', {
        source_post_id: template.source_post_id,
        title: `[Preview] ${seedLabel}`,
        slug: `preview-${variant.idempotency_key.slice(0, 12)}`,
        status: 'draft',
        elementor_data: variant.rendered_elementor_data,
        idempotency_key: variant.idempotency_key,
      })

      if (result.ok && result.data?.post_id) {
        await sb.from('kotoiq_variants').update({
          preview_post_id: result.data.post_id,
          preview_url: result.data.url || null,
        }).eq('id', variant_id)
      }

      return NextResponse.json(result)
    }

    if (action === 'proxy') {
      return NextResponse.json(await proxyToPlugin(site, body.endpoint, body.method || 'POST', body.payload || {}))
    }

    // ─── Search & Replace ──────────────────────────────────────────────────
    // Multi-tenant Better-Search-Replace clone. Drives the wp-plugin koto-search-replace.php
    // endpoints, persists undo journal in Supabase.

    if (action === 'sr_list_tables') {
      const result = await proxyToWPSC(site, 'search-replace/tables', {})
      return NextResponse.json(result)
    }

    if (action === 'sr_list_jobs') {
      const { data: jobs } = await sb
        .from('koto_search_replace_jobs')
        .select('*')
        .eq('site_id', site_id)
        .order('created_at', { ascending: false })
        .limit(50)
      return NextResponse.json({ jobs: jobs || [] })
    }

    if (action === 'sr_get_job') {
      const { job_id } = body
      const { data: job } = await sb.from('koto_search_replace_jobs').select('*').eq('id', job_id).single()
      const { count: change_count } = await sb
        .from('koto_search_replace_changes')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job_id)
      return NextResponse.json({ job, change_count: change_count || 0 })
    }

    if (action === 'sr_get_samples') {
      const { job_id, limit = 30 } = body
      const { data: samples } = await sb
        .from('koto_search_replace_changes')
        .select('id, table_name, column_name, primary_key_value, before_value, after_value, is_restored')
        .eq('job_id', job_id)
        .order('id', { ascending: true })
        .limit(limit)
      return NextResponse.json({ samples: samples || [] })
    }

    if (action === 'sr_create_job') {
      const { search, replace_with, options, scope, is_dry_run, client_id } = body
      if (!search) return NextResponse.json({ error: 'search required' }, { status: 400 })
      const { data: job, error } = await sb
        .from('koto_search_replace_jobs')
        .insert({
          site_id,
          agency_id: site.agency_id,
          client_id: client_id || site.client_id || null,
          search,
          replace_with: replace_with || '',
          options: options || {},
          scope: scope || { tables: [] },
          status: is_dry_run ? 'preview' : 'running',
          is_dry_run: !!is_dry_run,
          total_tables: Array.isArray(scope?.tables) ? scope.tables.length : 0,
          started_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ job })
    }

    if (action === 'sr_run_chunk') {
      const { job_id, chunk_size = 200, sample_cap = 25 } = body
      const { data: job } = await sb.from('koto_search_replace_jobs').select('*').eq('id', job_id).single()
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      if (job.status === 'complete' || job.status === 'undone' || job.status === 'failed') {
        return NextResponse.json({ ok: true, done: true, job })
      }

      const tables: Array<{ name: string; primary_key: string; columns: string[] }> = job.scope?.tables || []
      if (!tables.length) {
        await sb.from('koto_search_replace_jobs').update({
          status: 'failed', error: 'No tables in scope', completed_at: new Date().toISOString(),
        }).eq('id', job_id)
        return NextResponse.json({ error: 'No tables in scope' }, { status: 400 })
      }

      let tableIdx = job.current_table_index || 0
      if (tableIdx >= tables.length) {
        await sb.from('koto_search_replace_jobs').update({
          status: 'complete', completed_at: new Date().toISOString(),
        }).eq('id', job_id)
        return NextResponse.json({ ok: true, done: true })
      }

      const t = tables[tableIdx]
      const offset = job.current_offset || 0

      const result = await proxyToWPSC(site, 'search-replace/scan', {
        table: t.name,
        primary_key: t.primary_key,
        columns: t.columns,
        search: job.search,
        replace: job.replace_with,
        options: job.options || {},
        dry_run: job.is_dry_run,
        offset,
        limit: chunk_size,
        sample_cap,
      })

      if (!result.ok) {
        // Surface the actual cause — network/timeout from the proxy, or the
        // WP plugin's own error payload (data.error, data.message, or
        // data.code).
        const pluginErr = result.data?.message || result.data?.error || result.data?.code || null
        const transportErr = result.error || null
        const realErr = pluginErr || transportErr || `HTTP ${result.status || '?'} on ${t.name}`
        await sb.from('koto_search_replace_jobs').update({
          status: 'failed', error: realErr,
          completed_at: new Date().toISOString(),
        }).eq('id', job_id)
        return NextResponse.json({ error: realErr, table: t.name, status: result.status }, { status: 500 })
      }

      const d = result.data || {}
      const changes: Array<any> = Array.isArray(d.changes) ? d.changes : []
      const samples: Array<any> = Array.isArray(d.sample) ? d.sample : []

      // Persist undo journal (apply mode) — store full before/after
      if (!job.is_dry_run && changes.length) {
        const rows = changes.map((c: any) => ({
          job_id,
          agency_id: site.agency_id,
          table_name: t.name,
          primary_key_column: t.primary_key,
          primary_key_value: String(c.pk),
          column_name: c.column,
          before_value: c.before ?? '',
          after_value: c.after ?? '',
        }))
        const BATCH = 500
        for (let i = 0; i < rows.length; i += BATCH) {
          await sb.from('koto_search_replace_changes').insert(rows.slice(i, i + BATCH))
        }
      }
      // Persist preview samples (dry-run mode) so the UI has something to show after page refresh
      if (job.is_dry_run && samples.length) {
        const rows = samples.map((s: any) => ({
          job_id,
          agency_id: site.agency_id,
          table_name: t.name,
          primary_key_column: t.primary_key,
          primary_key_value: String(s.pk),
          column_name: s.column,
          before_value: s.before ?? '',
          after_value: s.after ?? '',
        }))
        await sb.from('koto_search_replace_changes').insert(rows)
      }

      const hasMore = !!d.has_more
      const nextOffset = Number(d.next_offset || 0)
      const tableDone = !hasMore
      const newTableIdx = tableDone ? tableIdx + 1 : tableIdx
      const newOffset = tableDone ? 0 : nextOffset
      const allDone = newTableIdx >= tables.length

      await sb.from('koto_search_replace_jobs').update({
        current_table: t.name,
        current_table_index: newTableIdx,
        current_offset: newOffset,
        tables_completed: tableDone ? tableIdx + 1 : tableIdx,
        total_rows_scanned: (job.total_rows_scanned || 0) + Number(d.scanned || 0),
        total_matches: (job.total_matches || 0) + Number(d.matches || 0),
        total_replacements: (job.total_replacements || 0) + Number(d.replacements || 0),
        total_rows_changed: (job.total_rows_changed || 0) + Number(d.rows_changed || 0),
        status: allDone ? 'complete' : 'running',
        completed_at: allDone ? new Date().toISOString() : null,
      }).eq('id', job_id)

      return NextResponse.json({
        ok: true,
        table: t.name,
        scanned: d.scanned,
        matches: d.matches,
        replacements: d.replacements,
        rows_changed: d.rows_changed,
        has_more: hasMore,
        next_offset: newOffset,
        next_table_index: newTableIdx,
        done: allDone,
        samples,
      })
    }

    if (action === 'sr_pause_job') {
      const { job_id } = body
      await sb.from('koto_search_replace_jobs').update({ status: 'paused' }).eq('id', job_id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'sr_resume_job') {
      const { job_id } = body
      await sb.from('koto_search_replace_jobs').update({ status: 'running' }).eq('id', job_id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'sr_undo_job') {
      const { job_id, batch_size = 200 } = body
      const { data: job } = await sb.from('koto_search_replace_jobs').select('*').eq('id', job_id).single()
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      if (job.is_dry_run) return NextResponse.json({ error: 'Preview jobs have no undo journal' }, { status: 400 })

      await sb.from('koto_search_replace_jobs').update({ status: 'undoing' }).eq('id', job_id)

      // Stream changes in batches, restore each batch via the plugin.
      let totalRestored = 0
      let lastId = 0
      let batchN = 0
      const maxBatches = 500 // safety cap; UI can call again if hit
      while (batchN < maxBatches) {
        const { data: batch } = await sb
          .from('koto_search_replace_changes')
          .select('id, table_name, primary_key_column, primary_key_value, column_name, before_value')
          .eq('job_id', job_id)
          .eq('is_restored', false)
          .gt('id', lastId)
          .order('id', { ascending: true })
          .limit(batch_size)
        if (!batch || !batch.length) break

        const payload = batch.map((c: any) => ({
          table: c.table_name,
          pk_column: c.primary_key_column,
          pk_value: c.primary_key_value,
          column: c.column_name,
          before_value: c.before_value,
        }))
        const r = await proxyToWPSC(site, 'search-replace/restore', { changes: payload })
        if (!r.ok) {
          await sb.from('koto_search_replace_jobs').update({
            status: 'failed', error: r.error || 'Restore failed',
          }).eq('id', job_id)
          return NextResponse.json({ error: r.error || 'Restore failed', restored_so_far: totalRestored }, { status: 500 })
        }
        const ids = batch.map((c: any) => c.id)
        await sb.from('koto_search_replace_changes').update({ is_restored: true }).in('id', ids)
        totalRestored += Number(r.data?.restored || 0)
        lastId = batch[batch.length - 1].id
        batchN++
        if (batch.length < batch_size) break
      }

      await sb.from('koto_search_replace_jobs').update({
        status: 'undone', completed_at: new Date().toISOString(),
      }).eq('id', job_id)
      return NextResponse.json({ ok: true, restored: totalRestored })
    }

    if (action === 'sr_delete_job') {
      const { job_id } = body
      await sb.from('koto_search_replace_jobs').delete().eq('id', job_id)
      return NextResponse.json({ ok: true })
    }

    // ─── /Search & Replace ─────────────────────────────────────────────────

    // ─── WPSimpleCode pairing + detection ──────────────────────────────────

    if (action === 'wpsc_detect') {
      // GET /wp-json/wpsimplecode/v1/meta is public — no auth needed
      try {
        const url = `${site.site_url}/wp-json/wpsimplecode/v1/meta?nocache=${Date.now()}`
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) {
          await sb.from('koto_wp_sites').update({ wpsc_detected: false }).eq('id', site_id)
          return NextResponse.json({ detected: false, status: res.status })
        }
        const meta = await res.json().catch(() => ({}))
        // v1.0.x reports modules as ['search-replace','access','snippets'] (strings).
        // v1.1.x reports modules as objects [{slug, name, version, enabled, ...}].
        // Normalize to the object shape for storage either way.
        const rawModules = Array.isArray(meta?.modules) ? meta.modules : []
        const modules = rawModules.map((m: any) =>
          typeof m === 'string'
            ? { slug: m, name: m, enabled: true, version: meta?.version || null }
            : m
        )
        // KotoIQ 2.0+ returns plugin: 'kotoiq' in /meta. Legacy WPSimpleCode
        // 1.x omits the field — default to 'wpsimplecode'. Controls which
        // /api/*-manifest the Control Center fetches for this site.
        const pluginIdentity = meta?.plugin === 'kotoiq' ? 'kotoiq' : 'wpsimplecode'
        await sb.from('koto_wp_sites').update({
          wpsc_detected: true,
          wpsc_version: meta?.version || null,
          wpsc_plugin: pluginIdentity,
          wpsc_last_seen_at: new Date().toISOString(),
          wpsc_modules: modules,
        }).eq('id', site_id)
        return NextResponse.json({ detected: true, meta, modules })
      } catch (e: any) {
        await sb.from('koto_wp_sites').update({ wpsc_detected: false }).eq('id', site_id)
        return NextResponse.json({ detected: false, error: e.message })
      }
    }

    if (action === 'wpsc_modules_list') {
      const result = await proxyToWPSC(site, 'modules/list', {})
      if (result.ok && Array.isArray(result.data?.modules)) {
        await sb.from('koto_wp_sites').update({ wpsc_modules: result.data.modules }).eq('id', site_id)
      }
      return NextResponse.json(result)
    }

    if (action === 'wpsc_update_plugin') {
      // Pull the manifest matching the site's plugin identity, then proxy
      // to the site. Sites on KotoIQ 2.x fetch /api/kotoiq-manifest; legacy
      // WPSimpleCode 1.x sites keep using /api/wpsc-manifest. Prevents the
      // KotoIQ fleet from being prompted to "update" to wpsimplecode-1.2.0.
      const manifestPath = site?.wpsc_plugin === 'kotoiq' ? '/api/kotoiq-manifest' : '/api/wpsc-manifest'
      try {
        const mres = await fetch(`${APP_URL}${manifestPath}`, { signal: AbortSignal.timeout(10000) })
        if (!mres.ok) return NextResponse.json({ error: `Manifest fetch failed: HTTP ${mres.status}` }, { status: 500 })
        const manifest = await mres.json()
        const result = await proxyToWPSC(site, 'self-update', {
          download_url: manifest.download_url,
          sha256: manifest.sha256,
          version: manifest.latest_version,
        })
        if (result.ok) {
          // Give the WP site a beat to settle, then re-detect to confirm the
          // new version landed
          await new Promise(r => setTimeout(r, 1500))
          try {
            const detectRes = await fetch(`${site.site_url}/wp-json/wpsimplecode/v1/meta?nocache=${Date.now()}`, { signal: AbortSignal.timeout(8000) })
            if (detectRes.ok) {
              const meta = await detectRes.json()
              const modules = Array.isArray(meta?.modules)
                ? meta.modules.map((m: any) => typeof m === 'string' ? { slug: m, name: m, enabled: true } : m)
                : []
              const newPluginIdentity = meta?.plugin === 'kotoiq' ? 'kotoiq' : 'wpsimplecode'
              await sb.from('koto_wp_sites').update({
                wpsc_version: meta?.version || null,
                wpsc_plugin: newPluginIdentity,
                wpsc_modules: modules,
                wpsc_last_seen_at: new Date().toISOString(),
              }).eq('id', site_id)
              return NextResponse.json({ ...result.data, new_version: meta?.version, manifest_version: manifest.latest_version })
            }
          } catch {}
        }
        return NextResponse.json({
          ok: result.ok,
          ...(result.data || {}),
          manifest_version: manifest.latest_version,
          status: result.status,
          error: result.ok ? null : (result.data?.message || result.data?.error || result.error || `HTTP ${result.status}`),
        }, { status: result.ok ? 200 : 500 })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    if (action === 'wpsc_modules_toggle') {
      const { slug, enabled } = body
      if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
      const result = await proxyToWPSC(site, 'modules/toggle', { slug, enabled: !!enabled })
      if (result.ok) {
        // Refresh stored module state
        const listed = await proxyToWPSC(site, 'modules/list', {})
        if (listed.ok && Array.isArray(listed.data?.modules)) {
          await sb.from('koto_wp_sites').update({ wpsc_modules: listed.data.modules }).eq('id', site_id)
        }
      }
      return NextResponse.json(result)
    }

    if (action === 'wpsc_pair') {
      const { wpsc_api_key } = body
      if (!wpsc_api_key) return NextResponse.json({ error: 'wpsc_api_key required' }, { status: 400 })
      await sb.from('koto_wp_sites').update({ wpsc_api_key }).eq('id', site_id)
      // Verify the key by hitting an authenticated endpoint
      const verify = await proxyToWPSC({ ...site, wpsc_api_key }, 'access/roles', {})
      if (!verify.ok) {
        return NextResponse.json({ paired: false, error: verify.data?.error || `HTTP ${verify.status}` }, { status: 400 })
      }
      return NextResponse.json({ paired: true })
    }

    if (action === 'wpsc_clear_key') {
      await sb.from('koto_wp_sites').update({ wpsc_api_key: null }).eq('id', site_id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'wpsc_disconnect') {
      // Full remote disconnect: tell the plugin to disable remote control, then clear all keys.
      const { also_clear_koto_key = false } = body
      // Best-effort: tell the plugin first (even if it fails, we still clear locally)
      let pluginDisabled = false
      if (site?.wpsc_api_key) {
        const r = await proxyToWPSC(site, 'disable-remote', {})
        pluginDisabled = !!r.ok
      }
      const updates: any = {
        wpsc_api_key: null,
        wpsc_detected: false,
        wpsc_version: null,
      }
      if (also_clear_koto_key) {
        updates.api_key = ''
        updates.connected = false
      }
      await sb.from('koto_wp_sites').update(updates).eq('id', site_id)
      return NextResponse.json({ ok: true, plugin_disabled: pluginDisabled })
    }

    // ─── KotoIQ panel actions (per-site Builder / Rotation / SEO) ──────────

    if (action === 'kotoiq_builder_pages') {
      // GET /wpsimplecode/v1/builder/pages → list Elementor-edited pages.
      // Also fires /builder/detect (POST) so the panel can show Elementor +
      // Pro version + theme inline.
      const [pages, detect] = await Promise.all([
        proxyToWPSCMethod(site, 'GET',  'builder/pages'),
        proxyToWPSCMethod(site, 'POST', 'builder/detect', {}),
      ])
      return NextResponse.json({ ok: pages.ok, data: pages.data, detect: detect.ok ? detect.data : null, status: pages.status })
    }

    if (action === 'kotoiq_rotation_cache_get') {
      const post_id = Number(body.post_id || 0)
      if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' })
      const r = await proxyToWPSCMethod(site, 'GET', `builder/rotation-cache/${post_id}`)
      return NextResponse.json({ ok: r.ok, data: r.data, status: r.status })
    }

    if (action === 'kotoiq_rotation_cache_del') {
      const post_id = Number(body.post_id || 0)
      if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' })
      const r = await proxyToWPSCMethod(site, 'DELETE', `builder/rotation-cache/${post_id}`)
      return NextResponse.json({ ok: r.ok, data: r.data, status: r.status })
    }

    if (action === 'kotoiq_seo_agency_test') {
      const r = await proxyToWPSCMethod(site, 'GET', 'agency/test')
      return NextResponse.json({ ok: r.ok, data: r.data, status: r.status })
    }

    if (action === 'kotoiq_seo_pages') {
      const r = await proxyToWPSCMethod(site, 'GET', 'pages')
      return NextResponse.json({ ok: r.ok, data: r.data, status: r.status })
    }

    if (action === 'kotoiq_seo_sitemap_rebuild') {
      // POST — works with the existing proxyToWPSC, but keep the method-aware
      // call for consistency with the other panel actions.
      const r = await proxyToWPSCMethod(site, 'POST', 'sitemap/rebuild', {})
      return NextResponse.json({ ok: r.ok, data: r.data, status: r.status })
    }

    // ─── Access Management ─────────────────────────────────────────────────

    if (action === 'am_load') {
      const remoteRes = await proxyToWPSC(site, 'access/roles', {})
      const remote = remoteRes.ok ? remoteRes.data : { roles: {}, policy: {}, global_disable_file_edit: false }
      const { data: stored } = await sb
        .from('koto_access_policies')
        .select('*')
        .eq('site_id', site_id)
        .maybeSingle()
      return NextResponse.json({
        roles: remote?.roles || {},
        live_policy: remote?.policy || {},
        global_disable_file_edit: !!remote?.global_disable_file_edit,
        stored,
        remote_ok: remoteRes.ok,
        error: remoteRes.ok ? null : (remoteRes.data?.error || `HTTP ${remoteRes.status}`),
      })
    }

    if (action === 'am_save') {
      const { policy, snippet_overrides, file_editor_disabled_globally, client_id } = body
      const { data, error } = await sb
        .from('koto_access_policies')
        .upsert({
          site_id,
          agency_id: site.agency_id,
          client_id: client_id || site.client_id || null,
          policy: policy || {},
          snippet_overrides: snippet_overrides || {},
          file_editor_disabled_globally: !!file_editor_disabled_globally,
        }, { onConflict: 'site_id' })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ policy: data })
    }

    if (action === 'am_apply') {
      const { data: stored } = await sb
        .from('koto_access_policies')
        .select('*')
        .eq('site_id', site_id)
        .maybeSingle()
      if (!stored) return NextResponse.json({ error: 'No saved policy. Save first.' }, { status: 400 })
      const result = await proxyToWPSC(site, 'access/apply', {
        policy: stored.policy || {},
        global_disable_file_edit: !!stored.file_editor_disabled_globally,
      })
      if (!result.ok) return NextResponse.json({ error: result.data?.error || `HTTP ${result.status}` }, { status: 500 })
      await sb.from('koto_access_policies').update({
        last_applied_at: new Date().toISOString(),
      }).eq('id', stored.id)
      return NextResponse.json({ ok: true, applied: result.data?.applied || {} })
    }

    if (action === 'am_snapshot') {
      const { note } = body
      const result = await proxyToWPSC(site, 'access/snapshot', {})
      if (!result.ok) return NextResponse.json({ error: result.data?.error || `HTTP ${result.status}` }, { status: 500 })
      const { data: stored } = await sb.from('koto_access_policies').select('id').eq('site_id', site_id).maybeSingle()
      const { data: snap, error } = await sb
        .from('koto_access_snapshots')
        .insert({
          site_id,
          agency_id: site.agency_id,
          policy_id: stored?.id || null,
          snapshot: result.data?.snapshot || {},
          note: note || null,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ snapshot: snap })
    }

    if (action === 'am_list_snapshots') {
      const { data: snaps } = await sb
        .from('koto_access_snapshots')
        .select('id, created_at, note')
        .eq('site_id', site_id)
        .order('created_at', { ascending: false })
        .limit(20)
      return NextResponse.json({ snapshots: snaps || [] })
    }

    if (action === 'am_revert') {
      const { snapshot_id } = body
      const { data: snap } = await sb
        .from('koto_access_snapshots')
        .select('*')
        .eq('id', snapshot_id)
        .single()
      if (!snap) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
      const result = await proxyToWPSC(site, 'access/revert', { snapshot: snap.snapshot })
      if (!result.ok) return NextResponse.json({ error: result.data?.error || `HTTP ${result.status}` }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ─── Snippets ──────────────────────────────────────────────────────────

    if (action === 'snip_list') {
      const result = await proxyToWPSC(site, 'snippets/list', {})
      return NextResponse.json(result)
    }

    if (action === 'snip_save') {
      const { snippet } = body
      if (!snippet) return NextResponse.json({ error: 'snippet required' }, { status: 400 })
      const result = await proxyToWPSC(site, 'snippets/save', snippet)
      return NextResponse.json(result)
    }

    if (action === 'snip_delete') {
      const { id } = body
      const result = await proxyToWPSC(site, 'snippets/delete', { id })
      return NextResponse.json(result)
    }

    if (action === 'snip_toggle') {
      const { id, active } = body
      const result = await proxyToWPSC(site, 'snippets/toggle', { id, active })
      return NextResponse.json(result)
    }

    // ─── /WPSimpleCode ─────────────────────────────────────────────────────

    if (action === 'delete') {
      await sb.from('koto_wp_sites').delete().eq('id', site_id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'connect_site') {
      const { site_url, site_name, agency_id, client_id } = body
      if (!site_url || !agency_id) return NextResponse.json({ error: 'site_url and agency_id required' }, { status: 400 })
      // Test connection
      try {
        const testRes = await fetch(`${site_url.replace(/\/$/, '')}/wp-json/wp/v2/posts?per_page=1`, { signal: AbortSignal.timeout(8000) })
        const isWP = testRes.ok
        const { data, error } = await sb.from('koto_wp_sites').upsert({
          site_url: site_url.replace(/\/$/, ''), site_name: site_name || site_url,
          agency_id, client_id: client_id || null,
          connected: isWP, last_connected_at: isWP ? new Date().toISOString() : null,
        }, { onConflict: 'site_url' }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, connected: isWP, site: data })
      } catch (e: any) {
        return NextResponse.json({ error: `Connection failed: ${e.message}`, connected: false }, { status: 200 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[WP API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
