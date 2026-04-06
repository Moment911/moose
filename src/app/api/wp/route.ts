import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
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
  const agency_id = searchParams.get('agency_id')
  const site_id = searchParams.get('site_id')
  const sb = getSupabase()
  if (site_id) {
    const [{ data: site }, { data: commands }, { data: pages }, { data: rankings }] = await Promise.all([
      sb.from('koto_wp_sites').select('*,clients(name)').eq('id', site_id).single(),
      sb.from('koto_wp_commands').select('*').eq('site_id', site_id).order('created_at', { ascending: false }).limit(20),
      sb.from('koto_wp_pages').select('*').eq('site_id', site_id).order('created_at', { ascending: false }).limit(50),
      sb.from('koto_wp_rankings').select('*').eq('site_id', site_id).order('synced_at', { ascending: false }).limit(100),
    ])
    return NextResponse.json({ site, commands: commands || [], pages: pages || [], rankings: rankings || [] })
  }
  const query = sb.from('koto_wp_sites').select('*,clients(name,industry)')
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

    if (action === 'proxy') {
      return NextResponse.json(await proxyToPlugin(site, body.endpoint, body.method || 'POST', body.payload || {}))
    }

    if (action === 'delete') {
      await sb.from('koto_wp_sites').delete().eq('id', site_id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[WP API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
