import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseNaturalLanguageQuery } from '@/lib/scoutQueryParser'
import { runScoutSearch, runScoutSweep, generateOpeningLine } from '@/lib/scoutEngine'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_searches'
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'get_searches') {
      const { data } = await s
        .from('koto_scout_searches')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(20)
      return Response.json({ data: data || [] })
    }

    if (action === 'get_leads') {
      const searchId = searchParams.get('search_id') || ''
      const minScore = searchParams.get('min_score') ? parseInt(searchParams.get('min_score')!) : 0
      const sortBy = searchParams.get('sort') || 'opportunity_score'
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100

      let query = s.from('koto_scout_leads').select('*')
      if (searchId) query = query.eq('search_id', searchId)
      else query = query.eq('agency_id', agencyId)
      if (minScore > 0) query = query.gte('opportunity_score', minScore)

      const ascending = sortBy === 'google_rating' || sortBy === 'business_name'
      query = query.order(sortBy, { ascending: sortBy === 'business_name' ? true : false }).limit(limit)

      const { data } = await query
      return Response.json({ data: data || [] })
    }

    if (action === 'get_lead_detail') {
      const leadId = searchParams.get('lead_id') || ''
      const { data } = await s.from('koto_scout_leads').select('*').eq('id', leadId).single()
      return Response.json({ data })
    }

    if (action === 'get_stats') {
      const [{ count: totalLeads }, { count: importedLeads }] = await Promise.all([
        s.from('koto_scout_leads').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        s.from('koto_scout_leads').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('imported_to_campaign', true),
      ])
      return Response.json({
        total_leads: totalLeads || 0,
        imported: importedLeads || 0,
      })
    }

    if (action === 'get_search_status') {
      const searchId = searchParams.get('search_id') || ''
      const { data } = await s.from('koto_scout_searches').select('status, total_found').eq('id', searchId).single()
      return Response.json({ data })
    }

    if (action === 'export_csv') {
      const searchId = searchParams.get('search_id') || ''
      const minScore = searchParams.get('min_score') ? parseInt(searchParams.get('min_score')!) : 0

      let query = s.from('koto_scout_leads').select('*')
      if (searchId) query = query.eq('search_id', searchId)
      else query = query.eq('agency_id', agencyId)
      if (minScore > 0) query = query.gte('opportunity_score', minScore)

      const { data } = await query.order('opportunity_score', { ascending: false }).limit(5000)

      const headers = 'business_name,phone,website,address,city,state,google_rating,google_reviews,opportunity_score,industry'
      const rows = (data || []).map((l: any) =>
        `"${(l.business_name || '').replace(/"/g, '""')}","${l.phone || ''}","${l.website || ''}","${(l.address || '').replace(/"/g, '""')}","${l.city || ''}","${l.state || ''}",${l.google_rating || ''},${l.google_review_count || ''},${l.opportunity_score || ''},"${l.industry_name || ''}"`
      ).join('\n')

      return new Response(`${headers}\n${rows}`, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="scout-leads.csv"' },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action
    const s = sb()

    // ── run_sweep ────────────────────────────────────────────────────────────
    // Multi-city sweep mode. Instead of issuing a single query and capping at
    // Google's ~60-result limit, this iterates every municipality in the
    // target state (via Census API) and runs a search per city. Much slower
    // but gives complete coverage. Use this for county-level or state-wide
    // prospecting.
    //
    // Body: { action: 'run_sweep', query, state, agency_id,
    //         industry_keywords?, industry_sic_code?, counties?,
    //         max_results?, max_municipalities?, incorporated_only?,
    //         min_rating?, max_rating?, min_reviews?, max_reviews?,
    //         has_website?, campaign_id? }
    if (action === 'run_sweep') {
      const {
        query, state, agency_id, campaign_id, counties,
        industry_keywords, industry_sic_code,
        max_results, max_municipalities, incorporated_only,
        min_rating, max_rating, min_reviews, max_reviews, has_website,
      } = body

      if (!state) return Response.json({ error: 'state required for sweep' }, { status: 400 })

      // Derive industry keywords from the natural-language query if the
      // caller didn't pass them directly.
      let keywords: string[] = industry_keywords
      if (!keywords?.length && query) {
        const parsed = await parseNaturalLanguageQuery(query)
        keywords = parsed.industry_keywords || []
      }
      if (!keywords?.length) {
        return Response.json({ error: 'industry_keywords or query required' }, { status: 400 })
      }

      const { data: search } = await s.from('koto_scout_searches').insert({
        agency_id: agency_id || '00000000-0000-0000-0000-000000000099',
        natural_language_query: query || `sweep: ${keywords.join(' ')} in ${state}`,
        parsed_criteria: { industry_keywords: keywords, state, sweep: true },
        industry_sic_code: industry_sic_code || null,
        industry_name: keywords[0] || null,
        location_state: state,
        min_rating, max_rating, min_reviews, max_reviews,
        has_website,
        status: 'pending',
        campaign_id: campaign_id || null,
      }).select('id').single()

      if (!search) return Response.json({ error: 'Failed to create search' }, { status: 500 })

      const result = await runScoutSweep({
        state,
        counties: Array.isArray(counties) ? counties : counties ? [counties] : undefined,
        industryKeywords: keywords,
        industrySicCode: industry_sic_code || null,
        agencyId: agency_id || '00000000-0000-0000-0000-000000000099',
        searchId: search.id,
        maxResults: max_results || 500,
        maxMunicipalities: max_municipalities || 150,
        incorporatedOnly: !!incorporated_only,
        minRating: min_rating,
        maxRating: max_rating,
        minReviews: min_reviews,
        maxReviews: max_reviews,
        hasWebsite: has_website,
      })

      return Response.json({
        success: true,
        search_id: search.id,
        found: result.found,
        leads: result.leads,
        municipalities_searched: result.municipalities_searched,
        municipalities_total: result.municipalities_total,
        geo_provenance: result.geo_provenance,
      })
    }

    if (action === 'run_search') {
      const { query, agency_id, max_results, campaign_id } = body
      if (!query) return Response.json({ error: 'query required' }, { status: 400 })

      // Parse natural language query
      const criteria = await parseNaturalLanguageQuery(query)

      // Create search record
      const { data: search } = await s.from('koto_scout_searches').insert({
        agency_id: agency_id || '00000000-0000-0000-0000-000000000099',
        natural_language_query: query,
        parsed_criteria: criteria,
        industry_sic_code: criteria.industry_sic_code,
        industry_name: criteria.industry_keywords?.[0] || null,
        location_city: criteria.city,
        location_state: criteria.state,
        min_rating: criteria.min_rating,
        max_rating: criteria.max_rating,
        min_reviews: criteria.min_reviews,
        max_reviews: criteria.max_reviews,
        has_website: criteria.has_website,
        status: 'pending',
        campaign_id: campaign_id || null,
      }).select('id').single()

      if (!search) return Response.json({ error: 'Failed to create search' }, { status: 500 })

      // Run search (this takes time but we run it now for simplicity)
      const result = await runScoutSearch(
        search.id,
        criteria,
        agency_id || '00000000-0000-0000-0000-000000000099',
        max_results || 60
      )

      return Response.json({
        success: true,
        search_id: search.id,
        criteria,
        found: result.found,
        leads: result.leads,
      })
    }

    if (action === 'import_to_campaign') {
      const { lead_ids, campaign_id, agency_id } = body
      if (!lead_ids?.length || !campaign_id) return Response.json({ error: 'lead_ids and campaign_id required' }, { status: 400 })

      let imported = 0
      let skipped = 0

      for (const leadId of lead_ids) {
        const { data: lead } = await s.from('koto_scout_leads').select('*').eq('id', leadId).single()
        if (!lead) { skipped++; continue }

        // Check duplicate
        if (lead.phone) {
          const { data: existing } = await s.from('koto_voice_leads')
            .select('id')
            .eq('campaign_id', campaign_id)
            .eq('prospect_phone', lead.phone)
            .maybeSingle()
          if (existing) { skipped++; continue }
        }

        // Insert into voice leads
        await s.from('koto_voice_leads').insert({
          agency_id: agency_id || lead.agency_id,
          campaign_id,
          prospect_name: lead.business_name,
          prospect_phone: lead.phone || '',
          prospect_company: lead.business_name,
          prospect_email: lead.email || '',
          city: lead.city,
          state: lead.state,
          industry_sic_code: lead.industry_sic_code,
          lead_score: lead.lead_score || 50,
          status: 'pending',
        })

        // Mark as imported
        await s.from('koto_scout_leads').update({
          imported_to_campaign: true,
          imported_at: new Date().toISOString(),
          campaign_id,
          status: 'contacted',
        }).eq('id', leadId)

        imported++
      }

      return Response.json({ success: true, imported, skipped })
    }

    if (action === 'generate_opening_line') {
      const { lead_id } = body
      if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 })
      const line = await generateOpeningLine(lead_id)
      return Response.json({ opening_line: line })
    }

    if (action === 'skip_lead') {
      await s.from('koto_scout_leads').update({ status: 'skipped' }).eq('id', body.lead_id)
      return Response.json({ success: true })
    }

    if (action === 'dnc_lead') {
      await s.from('koto_scout_leads').update({ status: 'dnc' }).eq('id', body.lead_id)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
