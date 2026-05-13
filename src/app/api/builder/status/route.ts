/**
 * Page Factory: Client Data Status API
 *
 * GET /api/builder/status?agency_id=...&client_id=...
 *   Returns what KotoIQ data has been ingested for this client
 *   so Page Factory knows what intelligence is available.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const agencyId = params.get('agency_id')
  const clientId = params.get('client_id')

  if (!agencyId || !clientId) {
    return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
  }

  const sb = getSb()

  // Run all checks in parallel
  const [
    sitemapResult,
    keywordsResult,
    topicalMapResult,
    semanticResult,
    competitorResult,
    gscResult,
    gridScanResult,
    wpSiteResult,
    styleProfileResult,
    suggestionsResult,
  ] = await Promise.all([
    // Sitemap crawl
    sb.from('kotoiq_sitemap_crawls')
      .select('id, status, urls_discovered, created_at', { count: 'exact', head: false })
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),

    // Keywords tracked
    sb.from('kotoiq_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),

    // Topical map
    sb.from('kotoiq_topical_maps')
      .select('id, central_entity, topical_coverage, created_at', { count: 'exact', head: false })
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),

    // Semantic analysis
    sb.from('kotoiq_semantic_analysis')
      .select('id, overall_score, created_at', { count: 'exact', head: false })
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),

    // Competitor watches
    sb.from('kotoiq_competitor_watches')
      .select('id, competitor_domains', { count: 'exact', head: false })
      .eq('client_id', clientId)
      .limit(1),

    // GSC connection
    sb.from('seo_connections')
      .select('id, provider, site_url, created_at')
      .eq('client_id', clientId)
      .eq('provider', 'search_console')
      .limit(1),

    // Grid scans
    sb.from('kotoiq_grid_scans_pro')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),

    // Connected WP sites
    sb.from('koto_wp_sites')
      .select('id, site_url, connected')
      .eq('agency_id', agencyId)
      .eq('connected', true)
      .limit(5),

    // Style profiles
    sb.from('kotoiq_style_profiles')
      .select('id, name')
      .eq('client_id', clientId)
      .limit(5),

    // Existing page suggestions
    sb.from('kotoiq_page_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),
  ])

  const sitemap = sitemapResult.data?.[0]
  const topicalMap = topicalMapResult.data?.[0]
  const semantic = semanticResult.data?.[0]
  const competitor = competitorResult.data?.[0]
  const gsc = gscResult.data?.[0]

  const status = {
    sitemap: {
      ready: !!sitemap,
      urls: sitemap?.urls_discovered || 0,
      status: sitemap?.status || null,
      last_crawl: sitemap?.created_at || null,
    },
    keywords: {
      ready: (keywordsResult.count || 0) > 0,
      count: keywordsResult.count || 0,
    },
    topical_map: {
      ready: !!topicalMap,
      entity: topicalMap?.central_entity || null,
      coverage: topicalMap?.topical_coverage || null,
      last_run: topicalMap?.created_at || null,
    },
    semantic: {
      ready: !!semantic,
      score: semantic?.overall_score || null,
      last_run: semantic?.created_at || null,
    },
    competitors: {
      ready: !!competitor,
      domains: competitor?.competitor_domains?.length || 0,
    },
    gsc: {
      ready: !!gsc,
      site_url: gsc?.site_url || null,
    },
    grid_scans: {
      ready: (gridScanResult.count || 0) > 0,
      count: gridScanResult.count || 0,
    },
    wp_sites: {
      ready: (wpSiteResult.data?.length || 0) > 0,
      sites: wpSiteResult.data || [],
    },
    style_profiles: {
      ready: (styleProfileResult.data?.length || 0) > 0,
      profiles: styleProfileResult.data || [],
    },
    suggestions: {
      count: suggestionsResult.count || 0,
    },
  }

  // Overall readiness score (0-100)
  const checks = [
    status.sitemap.ready,
    status.keywords.ready,
    status.topical_map.ready,
    status.semantic.ready,
    status.competitors.ready,
    status.gsc.ready,
    status.wp_sites.ready,
  ]
  const readiness = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  return NextResponse.json({ status, readiness })
}
