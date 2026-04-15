import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSERPResults, runGMBGridScan, getKeywordRankings, getBalance } from '@/lib/dataforseo'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ─────────────────────────────────────────────────────────────
// GET — read actions
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agencyId = searchParams.get('agency_id')
  const clientId = searchParams.get('client_id')
  const s = sb()

  // ── Get clients for this agency ──
  if (action === 'get_clients') {
    const { data } = await s.from('clients').select('id, name, website, industry, logo_url, status')
      .eq('agency_id', agencyId).is('deleted_at', null).order('name')
    return Response.json({ data: data || [] })
  }

  // ── Get keywords for a client ──
  if (action === 'get_keywords') {
    const { data } = await s.from('kotoiq_keywords').select('*')
      .eq('client_id', clientId).order('position', { ascending: true }).limit(200)
    return Response.json({ data: data || [] })
  }

  // ── Get SERP snapshots ──
  if (action === 'get_snapshots') {
    const { data } = await s.from('kotoiq_snapshots').select('*')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(50)
    return Response.json({ data: data || [] })
  }

  // ── Get GMB grid scans ──
  if (action === 'get_grid_scans') {
    const { data } = await s.from('kotoiq_gmb_grid').select('*')
      .eq('client_id', clientId).order('scanned_at', { ascending: false }).limit(20)
    return Response.json({ data: data || [] })
  }

  // ── Get DataForSEO balance ──
  if (action === 'get_balance') {
    try {
      const balance = await getBalance()
      return Response.json(balance)
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Dashboard stats ──
  if (action === 'get_stats') {
    const [{ count: kwCount }, { count: snapCount }, { count: gridCount }] = await Promise.all([
      s.from('kotoiq_keywords').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
      s.from('kotoiq_snapshots').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
      s.from('kotoiq_gmb_grid').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
    ])
    return Response.json({
      keywords: kwCount || 0,
      snapshots: snapCount || 0,
      grid_scans: gridCount || 0,
    })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

// ─────────────────────────────────────────────────────────────
// POST — write actions + DataForSEO calls
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, client_id } = body
    const s = sb()

    // ── SERP scan for a keyword ──
    if (action === 'serp_scan') {
      const { keyword, location } = body
      if (!keyword) return Response.json({ error: 'keyword required' }, { status: 400 })

      const result = await getSERPResults(keyword, location || 'United States')

      // Save snapshot
      if (client_id) {
        await s.from('kotoiq_snapshots').insert({
          client_id, agency_id,
          keyword,
          snapshot_type: 'serp',
          data: result,
          ai_overview_present: !!result.ai_overview?.present,
          featured_snippet_present: !!result.featured_snippet,
          local_pack_present: result.local_pack.length > 0,
          paa_count: result.people_also_ask.length,
        })
      }

      return Response.json({ success: true, result })
    }

    // ── Bulk SERP scan — multiple keywords ──
    if (action === 'bulk_serp_scan') {
      const { keywords, location, domain } = body
      if (!keywords?.length) return Response.json({ error: 'keywords array required' }, { status: 400 })

      const results: any[] = []
      for (const kw of keywords.slice(0, 20)) {
        try {
          const result = await getSERPResults(kw, location || 'United States')

          // Find domain position
          let position: number | null = null
          let url: string | null = null
          if (domain) {
            const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
            for (const item of result.items) {
              if (item.domain?.toLowerCase().includes(cleanDomain)) {
                position = item.rank_group
                url = item.url
                break
              }
            }
          }

          // Save keyword
          if (client_id) {
            await s.from('kotoiq_keywords').upsert({
              client_id, agency_id,
              keyword: kw,
              position,
              url,
              ai_overview: !!result.ai_overview?.present,
              featured_snippet: !!result.featured_snippet,
              local_pack: result.local_pack.length > 0,
              paa_count: result.people_also_ask.length,
              serp_features: {
                ai_overview: result.ai_overview,
                featured_snippet: result.featured_snippet,
                local_pack: result.local_pack,
                paa: result.people_also_ask,
                related: result.related_searches,
                knowledge_graph: result.knowledge_graph,
              },
              total_results: result.total_results,
              last_checked: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'client_id,keyword' })
          }

          // Save snapshot
          if (client_id) {
            await s.from('kotoiq_snapshots').insert({
              client_id, agency_id, keyword: kw,
              snapshot_type: 'serp',
              data: result,
              ai_overview_present: !!result.ai_overview?.present,
              featured_snippet_present: !!result.featured_snippet,
              local_pack_present: result.local_pack.length > 0,
              paa_count: result.people_also_ask.length,
            })
          }

          results.push({ keyword: kw, position, ai_overview: !!result.ai_overview?.present, featured_snippet: !!result.featured_snippet, local_pack: result.local_pack.length > 0 })
        } catch (e: any) {
          results.push({ keyword: kw, error: e.message })
        }
      }

      return Response.json({ success: true, results, scanned: results.length })
    }

    // ── GMB Grid Scan ──
    if (action === 'gmb_grid_scan') {
      const { keyword, business_name, lat, lng, grid_size, spacing_km } = body
      if (!keyword || !business_name || !lat || !lng) {
        return Response.json({ error: 'keyword, business_name, lat, lng required' }, { status: 400 })
      }

      const result = await runGMBGridScan(keyword, business_name, lat, lng, grid_size || 5, spacing_km || 1.5)

      // Save to DB
      if (client_id) {
        await s.from('kotoiq_gmb_grid').insert({
          client_id, agency_id,
          keyword,
          business_name,
          center_lat: lat,
          center_lng: lng,
          grid_size: grid_size || 5,
          spacing_km: spacing_km || 1.5,
          grid_data: result,
          avg_rank: result.avg_rank,
          best_rank: result.best_rank,
          worst_rank: result.worst_rank,
          ranked_cells: result.ranked_cells,
          total_cells: result.total_cells,
          coverage_pct: result.coverage_pct,
          scanned_at: new Date().toISOString(),
        })
      }

      return Response.json({ success: true, result })
    }

    // ── Keyword rank check (bulk) ──
    if (action === 'rank_check') {
      const { domain, keywords } = body
      if (!domain || !keywords?.length) return Response.json({ error: 'domain and keywords required' }, { status: 400 })

      const results = await getKeywordRankings(domain, keywords.slice(0, 50))

      // Update keywords in DB
      if (client_id) {
        for (const r of results) {
          await s.from('kotoiq_keywords').upsert({
            client_id, agency_id,
            keyword: r.keyword,
            position: r.position,
            url: r.url,
            last_checked: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'client_id,keyword' })
        }
      }

      return Response.json({ success: true, results })
    }

    // ── Add keywords manually ──
    if (action === 'add_keywords') {
      const { keywords } = body
      if (!keywords?.length || !client_id) return Response.json({ error: 'keywords and client_id required' }, { status: 400 })

      for (const kw of keywords) {
        await s.from('kotoiq_keywords').upsert({
          client_id, agency_id,
          keyword: typeof kw === 'string' ? kw : kw.keyword,
          position: typeof kw === 'string' ? null : kw.position,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,keyword' })
      }

      return Response.json({ success: true, added: keywords.length })
    }

    // ── Delete keyword ──
    if (action === 'delete_keyword') {
      const { keyword_id } = body
      await s.from('kotoiq_keywords').delete().eq('id', keyword_id)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
