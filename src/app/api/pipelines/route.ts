import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../lib/apiAuth'

function sb() {
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

    const s = sb()

    // ── List pipelines (with their stages) for the agency ──
    if (action === 'list') {
      const client_id = searchParams.get('client_id')
      let pipeQuery = s.from('koto_pipelines').select('*').eq('agency_id', agency_id).eq('archived', false)
      if (client_id) pipeQuery = pipeQuery.or(`client_id.eq.${client_id},client_id.is.null`)
      const { data: pipelines, error: pErr } = await pipeQuery.order('is_default', { ascending: false }).order('created_at', { ascending: true })
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

      const pipelineIds = (pipelines || []).map(p => p.id)
      const { data: stages, error: sErr } = pipelineIds.length
        ? await s.from('koto_pipeline_stages').select('*').in('pipeline_id', pipelineIds).eq('archived', false).order('sort_order', { ascending: true })
        : { data: [], error: null }
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

      const withStages = (pipelines || []).map(p => ({ ...p, stages: (stages || []).filter(st => st.pipeline_id === p.id) }))
      return NextResponse.json({ pipelines: withStages })
    }

    // ── Get one pipeline with stages ──
    if (action === 'get') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const [pRes, sRes] = await Promise.all([
        s.from('koto_pipelines').select('*').eq('id', id).eq('agency_id', agency_id).single(),
        s.from('koto_pipeline_stages').select('*').eq('pipeline_id', id).eq('archived', false).order('sort_order', { ascending: true }),
      ])
      if (pRes.error) return NextResponse.json({ error: pRes.error.message }, { status: 404 })
      return NextResponse.json({ pipeline: pRes.data, stages: sRes.data || [] })
    }

    // ── Board view — pipeline + stages + opps grouped by stage_id ──
    if (action === 'board') {
      const pipeline_id = searchParams.get('pipeline_id')
      const client_id = searchParams.get('client_id')

      // Pick pipeline (explicit id → default → first)
      let pipeline: any = null
      if (pipeline_id) {
        const r = await s.from('koto_pipelines').select('*').eq('id', pipeline_id).eq('agency_id', agency_id).single()
        if (r.error) return NextResponse.json({ error: r.error.message }, { status: 404 })
        pipeline = r.data
      } else {
        const r = await s.from('koto_pipelines').select('*').eq('agency_id', agency_id).eq('archived', false)
          .order('is_default', { ascending: false }).order('created_at', { ascending: true }).limit(1).maybeSingle()
        pipeline = r.data
      }
      if (!pipeline) return NextResponse.json({ pipeline: null, stages: [], opportunities: [] })

      const [stagesRes, oppsRes] = await Promise.all([
        s.from('koto_pipeline_stages').select('*').eq('pipeline_id', pipeline.id).eq('archived', false).order('sort_order', { ascending: true }),
        (() => {
          let q = s.from('koto_opportunities').select('*').eq('agency_id', agency_id).eq('pipeline_id', pipeline.id).order('sort_order', { ascending: true }).order('created_at', { ascending: false })
          if (client_id) q = q.eq('client_id', client_id)
          return q
        })(),
      ])

      return NextResponse.json({
        pipeline,
        stages: stagesRes.data || [],
        opportunities: oppsRes.data || [],
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

    const s = sb()

    // ── Create pipeline (and seed default stages if stages not provided) ──
    if (action === 'create_pipeline') {
      const { name, client_id, stages } = body
      if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

      const { data: pipeline, error } = await s.from('koto_pipelines').insert({
        agency_id, client_id: client_id || null, name, is_default: false, source_system: 'koto',
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const seed = Array.isArray(stages) && stages.length
        ? stages.map((st: any, i: number) => ({
            pipeline_id: pipeline.id,
            name: st.name || `Stage ${i + 1}`,
            sort_order: (i + 1) * 10,
            color: st.color || '#6B7280',
            is_won: !!st.is_won, is_lost: !!st.is_lost,
          }))
        : [
            { pipeline_id: pipeline.id, name: 'New',       sort_order: 10, color: '#6B7280' },
            { pipeline_id: pipeline.id, name: 'Qualified', sort_order: 20, color: '#3B82F6' },
            { pipeline_id: pipeline.id, name: 'Proposal',  sort_order: 30, color: '#F59E0B' },
            { pipeline_id: pipeline.id, name: 'Closed Won', sort_order: 40, color: '#10B981', is_won: true },
            { pipeline_id: pipeline.id, name: 'Closed Lost', sort_order: 50, color: '#EF4444', is_lost: true },
          ]

      const { data: seeded } = await s.from('koto_pipeline_stages').insert(seed).select()
      return NextResponse.json({ pipeline, stages: seeded || [] })
    }

    // ── Rename / update pipeline ──
    if (action === 'update_pipeline') {
      const { id, name, is_default } = body
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const patch: any = { updated_at: new Date().toISOString() }
      if (name !== undefined) patch.name = name
      if (is_default === true) {
        // atomically clear other defaults, then set this one
        await s.from('koto_pipelines').update({ is_default: false }).eq('agency_id', agency_id)
        patch.is_default = true
      }
      const { error } = await s.from('koto_pipelines').update(patch).eq('id', id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Archive pipeline (soft delete) ──
    if (action === 'delete_pipeline') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const { error } = await s.from('koto_pipelines').update({ archived: true }).eq('id', id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Add stage (column) to a pipeline ──
    if (action === 'add_stage') {
      const { pipeline_id, name, color, is_won, is_lost } = body
      if (!pipeline_id || !name) return NextResponse.json({ error: 'Missing pipeline_id or name' }, { status: 400 })

      // ownership check
      const { data: pipe } = await s.from('koto_pipelines').select('id').eq('id', pipeline_id).eq('agency_id', agency_id).maybeSingle()
      if (!pipe) return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })

      // next sort_order = max + 10
      const { data: last } = await s.from('koto_pipeline_stages').select('sort_order').eq('pipeline_id', pipeline_id).order('sort_order', { ascending: false }).limit(1).maybeSingle()
      const sort_order = ((last?.sort_order as number | undefined) ?? 0) + 10

      const { data, error } = await s.from('koto_pipeline_stages').insert({
        pipeline_id, name, sort_order, color: color || '#6B7280', is_won: !!is_won, is_lost: !!is_lost,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ stage: data })
    }

    // ── Update stage (rename, color, win/lose flag) ──
    if (action === 'update_stage') {
      const { id, name, color, is_won, is_lost } = body
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      // ownership via pipeline
      const { data: st } = await s.from('koto_pipeline_stages').select('pipeline_id').eq('id', id).maybeSingle()
      if (!st) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
      const { data: pipe } = await s.from('koto_pipelines').select('id').eq('id', st.pipeline_id).eq('agency_id', agency_id).maybeSingle()
      if (!pipe) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const patch: any = { updated_at: new Date().toISOString() }
      if (name !== undefined) patch.name = name
      if (color !== undefined) patch.color = color
      if (is_won !== undefined) patch.is_won = !!is_won
      if (is_lost !== undefined) patch.is_lost = !!is_lost

      const { error } = await s.from('koto_pipeline_stages').update(patch).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Reorder stages (drag column header) ──
    if (action === 'reorder_stages') {
      const { pipeline_id, stage_ids } = body
      if (!pipeline_id || !Array.isArray(stage_ids)) return NextResponse.json({ error: 'Missing pipeline_id or stage_ids' }, { status: 400 })

      const { data: pipe } = await s.from('koto_pipelines').select('id').eq('id', pipeline_id).eq('agency_id', agency_id).maybeSingle()
      if (!pipe) return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })

      for (let i = 0; i < stage_ids.length; i++) {
        await s.from('koto_pipeline_stages').update({ sort_order: (i + 1) * 10 }).eq('id', stage_ids[i]).eq('pipeline_id', pipeline_id)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Archive stage ──
    if (action === 'delete_stage') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const { data: st } = await s.from('koto_pipeline_stages').select('pipeline_id').eq('id', id).maybeSingle()
      if (!st) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
      const { data: pipe } = await s.from('koto_pipelines').select('id').eq('id', st.pipeline_id).eq('agency_id', agency_id).maybeSingle()
      if (!pipe) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      // Move opps in this stage → to stage with lowest sort_order in same pipeline (or null)
      const { data: fallback } = await s.from('koto_pipeline_stages').select('id').eq('pipeline_id', st.pipeline_id).eq('archived', false).neq('id', id).order('sort_order', { ascending: true }).limit(1).maybeSingle()
      await s.from('koto_opportunities').update({ stage_id: fallback?.id || null }).eq('stage_id', id)
      await s.from('koto_pipeline_stages').update({ archived: true }).eq('id', id)
      return NextResponse.json({ ok: true })
    }

    // ── Move opportunity between stages (drag card) ──
    if (action === 'move_card') {
      const { opportunity_id, to_stage_id, to_index } = body
      if (!opportunity_id || !to_stage_id) return NextResponse.json({ error: 'Missing opportunity_id or to_stage_id' }, { status: 400 })

      // ownership + stage validity
      const { data: stage } = await s.from('koto_pipeline_stages').select('id, pipeline_id, name').eq('id', to_stage_id).maybeSingle()
      if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
      const { data: pipe } = await s.from('koto_pipelines').select('id').eq('id', stage.pipeline_id).eq('agency_id', agency_id).maybeSingle()
      if (!pipe) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      // Also keep the legacy stage text column roughly in sync (lowercase name)
      const legacyStage = String(stage.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32) || 'new'
      const { data: opp, error } = await s.from('koto_opportunities').update({
        stage_id: to_stage_id, pipeline_id: stage.pipeline_id, stage: legacyStage,
        sort_order: typeof to_index === 'number' ? to_index * 10 : 0,
        updated_at: new Date().toISOString(),
      }).eq('id', opportunity_id).eq('agency_id', agency_id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await s.from('koto_opportunity_activities').insert({
        opportunity_id, activity_type: 'stage_change', description: `Moved to ${stage.name}`,
      })
      return NextResponse.json({ opportunity: opp })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
