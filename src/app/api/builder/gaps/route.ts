/**
 * Page Factory: Gap Analysis API
 *
 * POST /api/builder/gaps
 *   action=analyze   — run gap analysis for a client
 *   action=list      — list existing suggestions
 *   action=dismiss   — dismiss a suggestion
 *   action=accept    — accept suggestions for generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzePageGaps, saveSuggestions } from '@/lib/builder/pageGapEngine'
import { getKotoIQDb } from '@/lib/kotoiqDb'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, client_id } = body

    if (!agency_id) {
      return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    }

    const db = getKotoIQDb(agency_id)

    switch (action) {
      case 'analyze': {
        const { services, state, counties, city_limit } = body

        if (!services?.length || !state) {
          return NextResponse.json({ error: 'services[] and state required' }, { status: 400 })
        }

        const result = await analyzePageGaps({
          agencyId: agency_id,
          clientId: client_id,
          services,
          state,
          counties,
          cityLimit: city_limit || 100,
        })

        // Save suggestions to DB
        const { saved } = await saveSuggestions(agency_id, client_id, result.suggestions)

        return NextResponse.json({
          suggestions: result.suggestions,
          stats: { ...result.stats, saved },
        })
      }

      case 'list': {
        const { status, limit = 100 } = body

        let query = db.from('kotoiq_page_suggestions')
          .select('*')
          .eq('client_id', client_id)
          .order('priority', { ascending: false })
          .limit(limit)

        if (status) {
          query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ suggestions: data || [] })
      }

      case 'dismiss': {
        const { suggestion_ids } = body
        if (!suggestion_ids?.length) {
          return NextResponse.json({ error: 'suggestion_ids[] required' }, { status: 400 })
        }

        await db.from('kotoiq_page_suggestions')
          .update({ status: 'dismissed', updated_at: new Date().toISOString() })
          .in('id', suggestion_ids)

        return NextResponse.json({ ok: true, dismissed: suggestion_ids.length })
      }

      case 'accept': {
        const { suggestion_ids } = body
        if (!suggestion_ids?.length) {
          return NextResponse.json({ error: 'suggestion_ids[] required' }, { status: 400 })
        }

        await db.from('kotoiq_page_suggestions')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .in('id', suggestion_ids)

        return NextResponse.json({ ok: true, accepted: suggestion_ids.length })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    console.error('[builder/gaps]', e)
    const msg = e.message || 'Internal error'
    // If the error message contains HTML, it's likely an upstream API returning a page instead of JSON
    const cleanMsg = msg.includes('<html>') || msg.includes('<!DOCTYPE')
      ? 'Upstream API returned HTML instead of JSON. Census API may be temporarily unavailable.'
      : msg
    return NextResponse.json({ error: cleanMsg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const agencyId = params.get('agency_id')
  const clientId = params.get('client_id')

  if (!agencyId || !clientId) {
    return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
  }

  const db = getKotoIQDb(agencyId)
  const status = params.get('status') || 'suggested'

  const { data } = await db.from('kotoiq_page_suggestions')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', status)
    .order('priority', { ascending: false })
    .limit(200)

  return NextResponse.json({ suggestions: data || [] })
}
