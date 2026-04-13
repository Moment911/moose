import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// Plugin calls POST /api/seo/wp-register when saving settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = req.headers.get('x-koto-key') || req.headers.get('authorization')?.replace('Bearer ', '') || ''
    const s = sb()

    const { site_url, site_name, wp_version, php_version, client_id, plugin_version } = body

    if (!site_url) return NextResponse.json({ error: 'site_url required' }, { status: 400 })

    // Find the site by API key or URL
    let site = null
    if (apiKey) {
      const { data } = await s.from('koto_wp_sites').select('*').eq('api_key', apiKey).maybeSingle()
      site = data
    }
    if (!site && site_url) {
      const cleanUrl = site_url.replace(/\/$/, '')
      const { data } = await s.from('koto_wp_sites').select('*').or(`site_url.eq.${cleanUrl},site_url.eq.${cleanUrl}/,url.eq.${cleanUrl},url.eq.${cleanUrl}/`).maybeSingle()
      site = data
    }

    if (site) {
      // Update existing site
      await s.from('koto_wp_sites').update({
        site_name: site_name || site.site_name,
        wp_version, plugin_version,
        connected: true,
        last_ping: new Date().toISOString(),
        ...(client_id ? { client_id } : {}),
      }).eq('id', site.id)

      return NextResponse.json({
        success: true,
        message: 'Site registered successfully',
        site_id: site.id,
        agency_id: site.agency_id,
      })
    }

    // Site not found — try to create if we have enough info
    // Find agency by API key pattern
    const { data: allSites } = await s.from('koto_wp_sites').select('agency_id').limit(1)
    const agencyId = allSites?.[0]?.agency_id || null

    if (agencyId) {
      const cleanUrl = site_url.replace(/\/$/, '')
      const { data: newSite } = await s.from('koto_wp_sites').insert({
        site_url: cleanUrl,
        site_name: site_name || cleanUrl,
        api_key: apiKey || `koto_auto_${Date.now()}`,
        agency_id: agencyId,
        wp_version, plugin_version,
        connected: true,
        last_ping: new Date().toISOString(),
        ...(client_id ? { client_id } : {}),
      }).select().single()

      return NextResponse.json({
        success: true,
        message: 'Site registered (new)',
        site_id: newSite?.id,
        agency_id: agencyId,
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Could not find matching agency. Please check your API key in the plugin settings.',
    }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
