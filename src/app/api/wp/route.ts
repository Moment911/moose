import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Proxy a command to the plugin and log it ─────────────────────────────────
async function proxyToPlugin(site: any, endpoint: string, method = 'POST', body: any = {}) {
  const start = Date.now()
  const sb = getSupabase()

  // Create command log entry
  const { data: cmd } = await sb.from('koto_wp_commands').insert({
    site_id:   site.id,
    agency_id: site.agency_id,
    command:   endpoint,
    payload:   body,
    status:    'pending',
  }).select().single()

  try {
    const url = `${site.site_url}/wp-json/koto/v1/${endpoint}`
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${site.api_key}`,
        'X-KOTO-Key':    site.api_key,
        'Content-Type':  'application/json',
        'X-Koto-Source': APP_URL,
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    })

    const responseData = res.ok ? await res.json().catch(() => ({})) : {}
    const duration = Date.now() - start

    // Update command log
    await sb.from('koto_wp_commands').update({
      status:       res.ok ? 'success' : 'error',
      response:     responseData,
      error:        res.ok ? null : `HTTP ${res.status}`,
      duration_ms:  duration,
      completed_at: new Date().toISOString(),
    }).eq('id', cmd?.id)

    // Update site last_ping
    await sb.from('koto_wp_sites').update({
      connected: res.ok,
      last_ping: new Date().toISOString(),
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
  const site_id   = searchParams.get('site_id')
  const sb = getSupabase()

  if (site_id) {
    // Get single site with recent commands + pages + rankings
    const [{ data: site }, { data: commands }, { data: pages }, { data: rankings }] = await Promise.all([
      sb.from('koto_wp_sites').select('*,clients(name)').eq('id', site_id).single(),
      sb.from('koto_wp_commands').select('*').eq('site_id', site_id).order('created_at',{ascending:false}).limit(20),
      sb.from('koto_wp_pages').select('*').eq('site_id', site_id).order('created_at',{ascending:false}).limit(50),
      sb.from('koto_wp_rankings').select('*').eq('site_id', site_id).order('synced_at',{ascending:false}).limit(100),
    ])
    return NextResponse.json({ site, commands: commands||[], pages: pages||[], rankings: rankings||[] })
  }

  // Get all sites for agency
  const { data: sites } = await sb.from('koto_wp_sites')
    .select('*,clients(name,industry)').eq('agency_id', agency_id).order('created_at',{ascending:false})
  return NextResponse.json({ sites: sites || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, site_id } = body
    const sb = getSupabase()

    // ── Connect / register a new site ────────────────────────────────────────
    if (action === 'connect') {
      const { site_url, api_key, client_id, site_name } = body
      const cleanUrl = site_url.replace(/\/$/, '').toLowerCase()

      // Test the connection first
      const testRes = await fetch(`${cleanUrl}/wp-json/koto/v1/agency/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${api_key}`, 'X-KOTO-Key': api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ koto_url: APP_URL }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => null)

      const connected  = testRes?.ok || false
      const siteInfo   = connected ? await testRes!.json().catch(() => ({})) : {}

      const { data: site, error } = await sb.from('koto_wp_sites').upsert({
        agency_id,
        client_id:      client_id || null,
        site_url:       cleanUrl,
        api_key,
        site_name:      siteInfo.site_name || site_name || cleanUrl,
        connected,
        wp_version:     siteInfo.wp_version,
        plugin_version: siteInfo.plugin_version,
        last_ping:      new Date().toISOString(),
      }, { onConflict: 'agency_id,site_url' }).select().single()

      if (error) throw error
      return NextResponse.json({ site, connected, site_info: siteInfo })
    }

    // ── Load site for commands ────────────────────────────────────────────────
    const { data: site } = await sb.from('koto_wp_sites').select('*').eq('id', site_id).single()
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    // ── Ping / test connection ────────────────────────────────────────────────
    if (action === 'ping') {
      const result = await proxyToPlugin(site, 'agency/test', 'POST', { koto_url: APP_URL })
      return NextResponse.json(result)
    }

    // ── Generate local pages ──────────────────────────────────────────────────
    if (action === 'generate_pages') {
      const { keyword_template, location_ids, page_type, topic, aeo_enabled,
              schema_type, additional_keywords, client_id } = body
      const result = await proxyToPlugin(site, 'generate/batch', 'POST', {
        keyword:             keyword_template,
        topic,
        location_ids:        location_ids || [],
        page_type:           page_type || 'service',
        aeo_enabled:         aeo_enabled !== false,
        schema_type:         schema_type || 'LocalBusiness',
        additional_keywords: additional_keywords || [],
        client_id:           client_id || site.client_id,
        koto_source:         APP_URL,
      })
      // Cache generated pages if successful
      if (result.ok && result.data?.pages?.length) {
        const rows = result.data.pages.map((p: any) => ({
          site_id:   site.id,
          client_id: site.client_id,
          wp_post_id: p.post_id,
          title:     p.title,
          slug:      p.slug,
          url:       p.url,
          keyword:   p.keyword,
          location:  p.location,
          page_type: page_type || 'service',
          status:    p.status,
          word_count: p.word_count,
          seo_score:  p.seo_score,
        }))
        await sb.from('koto_wp_pages').insert(rows)
        await sb.from('koto_wp_sites').update({ pages_generated: (site.pages_generated||0) + rows.length }).eq('id', site.id)
      }
      return NextResponse.json(result)
    }

    // ── Sync GSC rankings back to Koto ───────────────────────────────────────
    if (action === 'sync_rankings') {
      const result = await proxyToPlugin(site, 'gsc/overview', 'GET')
      if (result.ok && result.data?.keywords?.length) {
        // Delete old rankings for this site
        await sb.from('koto_wp_rankings').delete().eq('site_id', site.id)
        const rows = result.data.keywords.map((k: any) => ({
          site_id:     site.id,
          keyword:     k.query || k.keyword,
          position:    k.position,
          clicks:      k.clicks,
          impressions: k.impressions,
          ctr:         k.ctr,
          url:         k.page,
        }))
        await sb.from('koto_wp_rankings').insert(rows)
        await sb.from('koto_wp_sites').update({ last_sync: new Date().toISOString(), gsc_connected: true }).eq('id', site.id)
      }
      return NextResponse.json(result)
    }

    // ── Sync all pages from plugin ────────────────────────────────────────────
    if (action === 'sync_pages') {
      const result = await proxyToPlugin(site, 'pages', 'GET')
      if (result.ok && result.data?.pages?.length) {
        await sb.from('koto_wp_pages').delete().eq('site_id', site.id)
        const rows = result.data.pages.map((p: any) => ({
          site_id:    site.id,
          client_id:  site.client_id,
          wp_post_id: p.ID || p.id,
          title:      p.post_title || p.title,
          url:        p.url,
          keyword:    p.keyword,
          location:   p.location,
          status:     p.post_status || p.status || 'published',
          word_count: p.word_count,
          seo_score:  p.seo_score,
        }))
        await sb.from('koto_wp_pages').insert(rows)
        await sb.from('koto_wp_sites').update({ pages_generated: rows.length, last_sync: new Date().toISOString() }).eq('id', site.id)
      }
      return NextResponse.json(result)
    }

    // ── Get locations from plugin ─────────────────────────────────────────────
    if (action === 'get_locations') {
      const { state, county } = body
      let endpoint = 'locations/states'
      if (state) {
        endpoint = `locations/cities?state=${encodeURIComponent(state)}`
        if (county) endpoint += `&county=${encodeURIComponent(county)}`
      }
      const result = await proxyToPlugin(site, endpoint, 'GET')
      return NextResponse.json(result)
    }

    // ── Generate blog posts ───────────────────────────────────────────────────
    if (action === 'generate_blog') {
      const result = await proxyToPlugin(site, 'blog/generate', 'POST', body)
      return NextResponse.json(result)
    }

    // ── Run automation ────────────────────────────────────────────────────────
    if (action === 'run_automation') {
      const result = await proxyToPlugin(site, 'automation/run-now', 'POST', {})
      return NextResponse.json(result)
    }

    // ── Rebuild sitemap ───────────────────────────────────────────────────────
    if (action === 'rebuild_sitemap') {
      const result = await proxyToPlugin(site, 'sitemap/rebuild', 'POST', {})
      return NextResponse.json(result)
    }

    // ── Generic proxy ─────────────────────────────────────────────────────────
    if (action === 'proxy') {
      const { endpoint, method, payload } = body
      const result = await proxyToPlugin(site, endpoint, method || 'POST', payload || {})
      return NextResponse.json(result)
    }

    // ── Delete site ───────────────────────────────────────────────────────────
    if (action === 'delete') {
      await sb.from('koto_wp_sites').delete().eq('id', site_id)
      return NextResponse.json({ ok: true })
    }


    // ── List all pages/posts from site ───────────────────────────────────────
    if (action === 'list_content') {
      const { post_type = 'page' } = body
      const result = await proxyToPlugin(site, `content/list?type=${post_type}`, 'GET')
      return NextResponse.json(result)
    }

    // ── Get single page/post content for editing ──────────────────────────────
    if (action === 'get_content') {
      const { post_id } = body
      const result = await proxyToPlugin(site, `content/${post_id}`, 'GET')
      return NextResponse.json(result)
    }

    // ── Create or update a page/post ──────────────────────────────────────────
    if (action === 'save_content') {
      const { post_id, title, content, meta_description, focus_keyword,
              post_type, status, slug, featured_image_url } = body
      const endpoint = post_id ? `content/${post_id}` : 'content/create'
      const method   = post_id ? 'PUT' : 'POST'
      const result   = await proxyToPlugin(site, endpoint, method, {
        title, content, meta_description, focus_keyword,
        post_type: post_type || 'page', status: status || 'draft',
        slug, featured_image_url,
      })
      // Update cached pages in Supabase if published
      if (result.ok && result.data?.post_id) {
        const sb2 = getSupabase()
        await sb2.from('koto_wp_pages').upsert({
          site_id:    site.id,
          client_id:  site.client_id,
          wp_post_id: result.data.post_id,
          title,
          slug:       result.data.slug || slug,
          url:        result.data.url,
          status:     status || 'draft',
          keyword:    focus_keyword,
        }, { onConflict: 'site_id,wp_post_id' })
      }
      return NextResponse.json(result)
    }

    // ── Delete a page/post ─────────────────────────────────────────────────────
    if (action === 'delete_content') {
      const { post_id } = body
      const result = await proxyToPlugin(site, `content/${post_id}`, 'DELETE')
      if (result.ok) {
        const sb2 = getSupabase()
        await sb2.from('koto_wp_pages').delete()
          .eq('site_id', site.id).eq('wp_post_id', post_id)
      }
      return NextResponse.json(result)
    }

    // ── Fetch site styles for preview (CSS + fonts) ───────────────────────────
    if (action === 'get_styles') {
      const result = await proxyToPlugin(site, 'styles', 'GET')
      return NextResponse.json(result)
    }

    // ── AI-generate content for a page ────────────────────────────────────────
    if (action === 'ai_generate_content') {
      const { title, keyword, location, page_type, tone, word_count, schema_type, aeo } = body
      const result = await proxyToPlugin(site, 'content/ai-generate', 'POST', {
        title, keyword, location, page_type, tone,
        word_count: word_count || 800,
        schema_type: schema_type || 'LocalBusiness',
        aeo: aeo !== false,
        site_url: site.site_url,
        client_id: site.client_id,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
