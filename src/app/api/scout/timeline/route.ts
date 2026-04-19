import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../../lib/apiAuth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// Unified merged timeline for a single opportunity.
// Pulls activities, page views, and documents into one chronological feed.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const opportunity_id = searchParams.get('opportunity_id')
    const limit = parseInt(searchParams.get('limit') || '200', 10)

    if (!opportunity_id) {
      return NextResponse.json({ error: 'Missing opportunity_id' }, { status: 400 })
    }

    const agency_id = await resolveAgencyId(req)
    if (!agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = getSupabase()

    const { data: opp, error: oppErr } = await sb
      .from('koto_opportunities')
      .select('id, agency_id, company_name, contact_name, stage, created_at')
      .eq('id', opportunity_id)
      .eq('agency_id', agency_id)
      .single()

    if (oppErr || !opp) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const [activitiesRes, viewsRes, docsRes] = await Promise.all([
      sb.from('koto_opportunity_activities')
        .select('id, activity_type, description, metadata, created_at')
        .eq('opportunity_id', opportunity_id)
        .order('created_at', { ascending: false })
        .limit(limit),
      sb.from('koto_opportunity_page_views')
        .select('id, url, page_title, duration_seconds, referrer, viewed_at')
        .eq('opportunity_id', opportunity_id)
        .order('viewed_at', { ascending: false })
        .limit(100),
      sb.from('koto_opportunity_documents')
        .select('id, document_type, document_id, external_url, title, status, sent_at, viewed_at, accepted_at, total_value, metadata, created_at')
        .eq('opportunity_id', opportunity_id)
        .order('created_at', { ascending: false }),
    ])

    const items: Array<{
      kind: 'activity' | 'page_view' | 'document'
      at: string
      id: string
      [key: string]: any
    }> = []

    for (const a of activitiesRes.data || []) {
      items.push({
        kind: 'activity',
        at: a.created_at,
        id: a.id,
        activity_type: a.activity_type,
        description: a.description,
        metadata: a.metadata || {},
      })
    }

    for (const v of viewsRes.data || []) {
      items.push({
        kind: 'page_view',
        at: v.viewed_at,
        id: v.id,
        url: v.url,
        page_title: v.page_title,
        duration_seconds: v.duration_seconds,
        referrer: v.referrer,
      })
    }

    for (const d of docsRes.data || []) {
      const at = d.accepted_at || d.viewed_at || d.sent_at || d.created_at
      items.push({
        kind: 'document',
        at,
        id: d.id,
        document_type: d.document_type,
        document_id: d.document_id,
        external_url: d.external_url,
        title: d.title,
        status: d.status,
        total_value: d.total_value,
        sent_at: d.sent_at,
        viewed_at: d.viewed_at,
        accepted_at: d.accepted_at,
        metadata: d.metadata || {},
      })
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    return NextResponse.json({
      opportunity: opp,
      items: items.slice(0, limit),
      counts: {
        activities: activitiesRes.data?.length || 0,
        page_views: viewsRes.data?.length || 0,
        documents: docsRes.data?.length || 0,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
