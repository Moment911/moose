import { NextRequest, NextResponse } from 'next/server'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const NAV_PAGES = [
  { label: 'Dashboard', path: '/' },
  { label: 'Clients', path: '/clients' },
  { label: 'Reviews', path: '/reviews' },
  { label: 'SEO Hub', path: '/seo' },
  { label: 'Scout', path: '/scout' },
  { label: 'Page Builder', path: '/page-builder' },
  { label: 'WordPress', path: '/wordpress' },
  { label: 'Voice Agent', path: '/voice' },
  { label: 'Performance', path: '/perf' },
  { label: 'KotoDesk', path: '/desk' },
  { label: 'Tasks', path: '/tasks' },
  { label: 'Proposals', path: '/proposals' },
  { label: 'Automations', path: '/automations' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Integrations', path: '/integrations' },
  { label: 'Agency Settings', path: '/agency-settings' },
  { label: 'Billing', path: '/billing' },
  { label: 'Help Center', path: '/help' },
  { label: 'Debug Console', path: '/debug' },
  { label: 'Uptime Monitor', path: '/uptime' },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const agencyId = searchParams.get('agency_id')

    if (!q) {
      return NextResponse.json(
        { error: 'Missing search query' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()
    const pattern = `%${q}%`

    // Search nav pages (static, no DB call needed)
    const pages = NAV_PAGES.filter((p) =>
      p.label.toLowerCase().includes(q.toLowerCase())
    )

    // Run all DB searches in parallel
    const [clientsRes, wpPagesRes, sitesRes, proposalsRes] = await Promise.all([
      // Clients
      supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId)
        .or(`name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(20),

      // WP Pages
      supabase
        .from('koto_wp_pages')
        .select('*')
        .or(`title.ilike.${pattern},keyword.ilike.${pattern}`)
        .limit(20),

      // Sites
      supabase
        .from('koto_wp_sites')
        .select('*')
        .or(`site_name.ilike.${pattern},site_url.ilike.${pattern}`)
        .limit(20),

      // Proposals
      supabase
        .from('proposals')
        .select('*')
        .ilike('title', pattern)
        .limit(20),
    ])

    return NextResponse.json({
      pages,
      clients: clientsRes.data ?? [],
      wpPages: wpPagesRes.data ?? [],
      sites: sitesRes.data ?? [],
      proposals: proposalsRes.data ?? [],
    })
  } catch (error) {
    console.error('[search] error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
