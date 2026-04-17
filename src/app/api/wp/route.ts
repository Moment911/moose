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
    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#E6007E;border-radius:14px;margin-bottom:12px;">
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
    <a href="https://hellokoto.com" target="_blank" style="display:inline-block;background:#E6007E;color:#fff;padding:10px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">Visit hellokoto.com →</a>
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

The brand is "HelloKoto" — an AI-powered marketing platform for agencies. Brand color is #E6007E (pink/magenta). Secondary color is #00C2CB (teal).

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

    if (action === 'proxy') {
      return NextResponse.json(await proxyToPlugin(site, body.endpoint, body.method || 'POST', body.payload || {}))
    }

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
