import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { propagateGapsToOpportunity } from '../../../lib/scout/gapPropagator'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list'
    const agency_id = await resolveAgencyId(req)
    if (!agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = getSupabase()

    // ── List ──
    if (action === 'list') {
      const source = searchParams.get('source')
      const stage = searchParams.get('stage')
      const hot = searchParams.get('hot')
      const search = searchParams.get('search')
      const limit = parseInt(searchParams.get('limit') || '100', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)

      let q = sb.from('koto_opportunities').select('*').eq('agency_id', agency_id).order('created_at', { ascending: false }).range(offset, offset + limit - 1)

      if (source) q = q.eq('source', source)
      if (stage) q = q.eq('stage', stage)
      if (hot === 'true') q = q.eq('hot', true)
      if (search) q = q.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_phone.ilike.%${search}%`)

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ opportunities: data || [] })
    }

    // ── Get single ──
    if (action === 'get') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      const [oppRes, viewsRes, actRes] = await Promise.all([
        sb.from('koto_opportunities').select('*').eq('id', id).eq('agency_id', agency_id).single(),
        sb.from('koto_opportunity_page_views').select('*').eq('opportunity_id', id).order('viewed_at', { ascending: false }).limit(50),
        sb.from('koto_opportunity_activities').select('*').eq('opportunity_id', id).order('created_at', { ascending: false }).limit(100),
      ])

      if (oppRes.error) return NextResponse.json({ error: oppRes.error.message }, { status: 404 })

      // Gap auto-feed: if the opportunity has a scout_lead_id but no
      // biggest_gap yet, lazily backfill from koto_scout_leads.gaps. The
      // Queue-for-AI-call modal pre-fills with intel.biggest_gap, so this
      // is what makes the sales agent lead with a real observation.
      // Non-fatal: errors here never break the read.
      try {
        const opp = oppRes.data as any
        if (opp?.scout_lead_id && !opp?.intel?.biggest_gap) {
          const r = await propagateGapsToOpportunity(sb, opp.id)
          if (r.updated && r.biggest_gap) {
            opp.intel = { ...(opp.intel || {}), biggest_gap: r.biggest_gap }
            if (!opp.pain_point) opp.pain_point = r.biggest_gap
          }
        }
      } catch { /* non-fatal */ }

      return NextResponse.json({ opportunity: oppRes.data, page_views: viewsRes.data || [], activities: actRes.data || [] })
    }

    // ── Stats ──
    if (action === 'stats') {
      const { data: all } = await sb.from('koto_opportunities').select('source, stage, hot, score, ghl_pushed_at, created_at').eq('agency_id', agency_id)
      const opps = all || []
      const today = new Date().toISOString().slice(0, 10)

      return NextResponse.json({
        total: opps.length,
        hot: opps.filter(o => o.hot).length,
        today: opps.filter(o => o.created_at?.startsWith(today)).length,
        by_source: {
          web_visitor: opps.filter(o => o.source === 'web_visitor').length,
          scout: opps.filter(o => o.source === 'scout').length,
          voice_call: opps.filter(o => o.source === 'voice_call').length,
          inbound_call: opps.filter(o => o.source === 'inbound_call').length,
          import: opps.filter(o => o.source === 'import').length,
          manual: opps.filter(o => o.source === 'manual').length,
        },
        in_ghl: opps.filter(o => o.ghl_pushed_at).length,
        by_stage: {
          new: opps.filter(o => o.stage === 'new').length,
          engaged: opps.filter(o => o.stage === 'engaged').length,
          qualified: opps.filter(o => o.stage === 'qualified').length,
          proposal: opps.filter(o => o.stage === 'proposal').length,
          won: opps.filter(o => o.stage === 'won').length,
          lost: opps.filter(o => o.stage === 'lost').length,
        },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body
    const agency_id = await resolveAgencyId(req)
    if (!agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = getSupabase()

    // ── Create ──
    if (action === 'create') {
      const { source, company_name, contact_name, contact_email, contact_phone, website, industry, notes, score, tags } = body
      const hot = (score || 0) >= 70
      const { data, error } = await sb.from('koto_opportunities').insert({
        agency_id, source: source || 'manual', company_name, contact_name, contact_email, contact_phone, website, industry, notes, score: score || 0, hot, tags: tags || [],
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await sb.from('koto_opportunity_activities').insert({ opportunity_id: data.id, activity_type: 'created', description: `Opportunity created from ${source || 'manual'}` })
      return NextResponse.json({ opportunity: data })
    }

    // ── Upsert from visitor session ──
    if (action === 'upsert_from_visitor') {
      const { session_id, company_name, contact_email, contact_phone, website, intent_score, intent_signals, page_url, page_title, duration_seconds } = body
      const hot = (intent_score || 0) >= 70

      // Check if opp already exists for this session
      const { data: existing } = await sb.from('koto_opportunities').select('id, score').eq('visitor_session_id', session_id).eq('agency_id', agency_id).maybeSingle()

      let oppId: string
      if (existing) {
        const newScore = Math.max(existing.score || 0, intent_score || 0)
        await sb.from('koto_opportunities').update({
          score: newScore, hot: newScore >= 70, intent_signals: intent_signals || [], updated_at: new Date().toISOString(),
          ...(company_name ? { company_name } : {}), ...(contact_email ? { contact_email } : {}), ...(contact_phone ? { contact_phone } : {}), ...(website ? { website } : {}),
        }).eq('id', existing.id)
        oppId = existing.id
      } else {
        const { data: created, error } = await sb.from('koto_opportunities').insert({
          agency_id, source: 'web_visitor', visitor_session_id: session_id, company_name, contact_email, contact_phone, website, score: intent_score || 0, hot, intent_signals: intent_signals || [],
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        oppId = created.id
        await sb.from('koto_opportunity_activities').insert({ opportunity_id: oppId, activity_type: 'created', description: 'Auto-created from website visitor' })
      }

      // Add page view
      if (page_url) {
        await sb.from('koto_opportunity_page_views').insert({ opportunity_id: oppId, url: page_url, page_title, duration_seconds: duration_seconds || 0 })
      }

      return NextResponse.json({ opportunity_id: oppId, upserted: !!existing })
    }

    // ── Upsert from voice call ──
    if (action === 'upsert_from_voice') {
      const { call_id, lead_id, contact_name, contact_phone, company_name, score, sentiment, outcome } = body
      const hot = (score || 0) >= 70

      const { data: existing } = lead_id
        ? await sb.from('koto_opportunities').select('id').eq('voice_lead_id', lead_id).eq('agency_id', agency_id).maybeSingle()
        : { data: null }

      if (existing) {
        await sb.from('koto_opportunities').update({ score: score || 0, hot, voice_call_id: call_id, intel: { sentiment, outcome }, updated_at: new Date().toISOString() }).eq('id', existing.id)
        await sb.from('koto_opportunity_activities').insert({ opportunity_id: existing.id, activity_type: 'voice_call', description: `Voice call — ${outcome || 'completed'}`, metadata: { call_id, sentiment, outcome } })
        return NextResponse.json({ opportunity_id: existing.id, upserted: true })
      }

      const { data: created, error } = await sb.from('koto_opportunities').insert({
        agency_id, source: 'voice_call', voice_call_id: call_id, voice_lead_id: lead_id, contact_name, contact_phone, company_name, score: score || 0, hot, intel: { sentiment, outcome },
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await sb.from('koto_opportunity_activities').insert({ opportunity_id: created.id, activity_type: 'created', description: 'Auto-created from voice call' })
      return NextResponse.json({ opportunity_id: created.id, upserted: false })
    }

    // ── Upsert from scout ──
    if (action === 'upsert_from_scout') {
      const { scout_lead_id, company_name, contact_name, contact_email, contact_phone, website, industry, score } = body
      const hot = (score || 0) >= 70

      const { data: existing } = await sb.from('koto_opportunities').select('id').eq('scout_lead_id', scout_lead_id).eq('agency_id', agency_id).maybeSingle()

      if (existing) {
        await sb.from('koto_opportunities').update({ score: score || 0, hot, company_name, contact_name, contact_email, website, industry, updated_at: new Date().toISOString() }).eq('id', existing.id)
        return NextResponse.json({ opportunity_id: existing.id, upserted: true })
      }

      const { data: created, error } = await sb.from('koto_opportunities').insert({
        agency_id, source: 'scout', scout_lead_id, company_name, contact_name, contact_email, contact_phone, website, industry, score: score || 0, hot,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await sb.from('koto_opportunity_activities').insert({ opportunity_id: created.id, activity_type: 'created', description: 'Auto-created from Scout lead' })
      return NextResponse.json({ opportunity_id: created.id, upserted: false })
    }

    // ── Update stage ──
    if (action === 'update_stage') {
      const { id, stage } = body
      if (!id || !stage) return NextResponse.json({ error: 'Missing id or stage' }, { status: 400 })

      const { error } = await sb.from('koto_opportunities').update({ stage }).eq('id', id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await sb.from('koto_opportunity_activities').insert({ opportunity_id: id, activity_type: 'stage_change', description: `Stage changed to ${stage}` })
      return NextResponse.json({ ok: true })
    }

    // ── Add page view ──
    if (action === 'add_page_view') {
      const { opportunity_id, url, page_title, duration_seconds, referrer } = body
      if (!opportunity_id || !url) return NextResponse.json({ error: 'Missing opportunity_id or url' }, { status: 400 })

      const { error } = await sb.from('koto_opportunity_page_views').insert({ opportunity_id, url, page_title, duration_seconds: duration_seconds || 0, referrer })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Push to GHL ──
    if (action === 'push_to_ghl') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      const { data: opp, error: fetchErr } = await sb.from('koto_opportunities').select('*').eq('id', id).eq('agency_id', agency_id).single()
      if (fetchErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

      // Get GHL credentials
      const { data: integration } = await sb.from('integrations').select('access_token, location_id').eq('agency_id', agency_id).eq('provider', 'gohighlevel').maybeSingle()
      if (!integration?.access_token) return NextResponse.json({ error: 'GHL not connected — go to Integrations to connect' }, { status: 400 })

      const ghlHeaders = { Authorization: `Bearer ${integration.access_token}`, 'Content-Type': 'application/json', Version: '2021-07-28' }

      // Create or update contact
      const contactPayload: any = {
        locationId: integration.location_id,
        name: opp.contact_name || opp.company_name || 'Unknown',
        email: opp.contact_email || undefined,
        phone: opp.contact_phone || undefined,
        companyName: opp.company_name || undefined,
        website: opp.website || undefined,
        tags: ['koto-opportunity', `source-${opp.source}`, ...(opp.hot ? ['hot-lead'] : [])],
        customFields: [{ key: 'koto_score', value: String(opp.score || 0) }, { key: 'koto_source', value: opp.source }],
      }

      let ghlContactId = opp.ghl_contact_id
      try {
        if (ghlContactId) {
          await fetch(`https://services.leadconnectorhq.com/contacts/${ghlContactId}`, { method: 'PUT', headers: ghlHeaders, body: JSON.stringify(contactPayload) })
        } else {
          const res = await fetch('https://services.leadconnectorhq.com/contacts/', { method: 'POST', headers: ghlHeaders, body: JSON.stringify(contactPayload) })
          const data = await res.json()
          ghlContactId = data.contact?.id
        }
      } catch (e: any) {
        return NextResponse.json({ error: `GHL API error: ${e.message}` }, { status: 502 })
      }

      // Update opportunity with GHL IDs
      await sb.from('koto_opportunities').update({ ghl_contact_id: ghlContactId, ghl_pushed_at: new Date().toISOString() }).eq('id', id)
      await sb.from('koto_opportunity_activities').insert({ opportunity_id: id, activity_type: 'ghl_push', description: 'Pushed to GoHighLevel', metadata: { ghl_contact_id: ghlContactId } })

      return NextResponse.json({ ok: true, ghl_contact_id: ghlContactId })
    }

    // ── Add note ──
    if (action === 'add_note') {
      const { id, note } = body
      if (!id || !note) return NextResponse.json({ error: 'Missing id or note' }, { status: 400 })

      await sb.from('koto_opportunities').update({ notes: note }).eq('id', id).eq('agency_id', agency_id)
      await sb.from('koto_opportunity_activities').insert({ opportunity_id: id, activity_type: 'note', description: note })
      return NextResponse.json({ ok: true })
    }

    // ── Delete ──
    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      const { error } = await sb.from('koto_opportunities').delete().eq('id', id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Seed test data ──
    if (action === 'seed_test_data') {
      const samples = [
        { source: 'web_visitor', company_name: 'Sunrise Plumbing Co', contact_name: 'Mike Torres', contact_email: 'mike@sunriseplumbing.com', contact_phone: '(555) 234-5678', website: 'sunriseplumbing.com', industry: 'Plumbing', score: 82, stage: 'qualified', intent_signals: [{ signal: 'Visited pricing page 3x' }, { signal: 'Viewed case studies' }, { signal: 'Returned within 24h' }] },
        { source: 'scout', company_name: 'Elite Auto Body', contact_name: 'Sarah Chen', contact_email: 'sarah@eliteautobody.net', contact_phone: '(555) 876-5432', website: 'eliteautobody.net', industry: 'Auto Body', score: 65, stage: 'engaged', intel: { google_rating: 3.2, review_count: 18, competitor: 'Maaco' } },
        { source: 'voice_call', company_name: 'Peak Dental Group', contact_name: 'Dr. James Wright', contact_phone: '(555) 345-6789', industry: 'Dental', score: 91, stage: 'proposal', intel: { sentiment: 'positive', outcome: 'appointment', call_duration: 342 } },
        { source: 'import', company_name: 'Coastal Realty Partners', contact_name: 'Amanda Liu', contact_email: 'amanda@coastalrealty.com', contact_phone: '(555) 567-8901', website: 'coastalrealty.com', industry: 'Real Estate', score: 45, stage: 'new', import_source: 'CSV upload' },
        { source: 'inbound_call', company_name: 'GreenLeaf Landscaping', contact_name: 'Carlos Mendez', contact_phone: '(555) 789-0123', industry: 'Landscaping', score: 74, stage: 'engaged', intel: { sentiment: 'positive', outcome: 'callback_requested' } },
      ]

      const inserted = []
      for (const s of samples) {
        const hot = (s.score || 0) >= 70
        const { data, error } = await sb.from('koto_opportunities').insert({
          agency_id, ...s, hot, tags: [],
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        inserted.push(data)
        await sb.from('koto_opportunity_activities').insert({ opportunity_id: data.id, activity_type: 'created', description: `Seeded test opportunity from ${s.source}` })
      }

      return NextResponse.json({ ok: true, count: inserted.length, ids: inserted.map(i => i.id) })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
