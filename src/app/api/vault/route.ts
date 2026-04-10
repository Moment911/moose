import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'
const VAULT_TABLE = 'koto_data_vault'
const SNAP_TABLE = 'koto_data_vault_snapshots'

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list'
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    if (action === 'list') {
      const recordType = searchParams.get('record_type')
      const source = searchParams.get('source')
      const clientId = searchParams.get('client_id')
      const search = searchParams.get('q')
      const includeDeleted = searchParams.get('include_deleted') === 'true'
      const dateFrom = searchParams.get('date_from')
      const dateTo = searchParams.get('date_to')
      const limit = Math.min(Number(searchParams.get('limit') || 200), 1000)

      let q = s.from(VAULT_TABLE)
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!includeDeleted) q = q.eq('is_deleted', false)
      if (recordType) q = q.eq('record_type', recordType)
      if (source) q = q.eq('source', source)
      if (clientId) q = q.eq('client_id', clientId)
      if (dateFrom) q = q.gte('created_at', dateFrom)
      if (dateTo) q = q.lte('created_at', dateTo)
      if (search) q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%`)

      const { data, error } = await q
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ data: data || [] })
    }

    if (action === 'get_engagement') {
      const sourceId = searchParams.get('source_id')
      if (!sourceId) return Response.json({ error: 'Missing source_id' }, { status: 400 })
      const { data } = await s.from(VAULT_TABLE).select('*')
        .eq('agency_id', agencyId)
        .eq('source_id', sourceId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      return Response.json({ data: data || [] })
    }

    if (action === 'history') {
      const sourceId = searchParams.get('source_id')
      const recordType = searchParams.get('record_type')
      if (!sourceId) return Response.json({ error: 'Missing source_id' }, { status: 400 })
      let q = s.from(VAULT_TABLE).select('*')
        .eq('agency_id', agencyId)
        .eq('source_id', sourceId)
        .order('created_at', { ascending: true })
      if (recordType) q = q.eq('record_type', recordType)
      const { data } = await q
      return Response.json({ data: data || [] })
    }

    if (action === 'snapshots') {
      const sourceId = searchParams.get('source_id')
      const sourceType = searchParams.get('source_type')
      let q = s.from(SNAP_TABLE).select('id, agency_id, source_type, source_id, label, created_at, created_by')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (sourceId) q = q.eq('source_id', sourceId)
      if (sourceType) q = q.eq('source_type', sourceType)
      const { data } = await q
      return Response.json({ data: data || [] })
    }

    if (action === 'get_snapshot') {
      const id = searchParams.get('id')
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      const { data } = await s.from(SNAP_TABLE).select('*').eq('id', id).maybeSingle()
      if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({ data })
    }

    if (action === 'search') {
      const q = searchParams.get('q') || ''
      if (!q) return Response.json({ data: [] })
      const { data } = await s.from(VAULT_TABLE).select('*')
        .eq('agency_id', agencyId)
        .eq('is_deleted', false)
        .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(100)
      return Response.json({ data: data || [] })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    if (action === 'write') {
      const row = {
        agency_id: agencyId,
        client_id: body.client_id || null,
        record_type: body.record_type,
        source: body.source || null,
        source_id: body.source_id || null,
        title: body.title || null,
        summary: body.summary || null,
        data: body.data || {},
        source_meta: body.source_meta || {},
      }
      if (!row.record_type) return Response.json({ error: 'Missing record_type' }, { status: 400 })
      const { data, error } = await s.from(VAULT_TABLE).insert(row).select('*').maybeSingle()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ data })
    }

    if (action === 'write_batch') {
      const rows = Array.isArray(body.entries) ? body.entries : []
      if (rows.length === 0) return Response.json({ data: [] })
      const prepared = rows
        .filter((r: any) => r?.record_type)
        .map((r: any) => ({
          agency_id: agencyId,
          client_id: r.client_id || null,
          record_type: r.record_type,
          source: r.source || null,
          source_id: r.source_id || null,
          title: r.title || null,
          summary: r.summary || null,
          data: r.data || {},
          source_meta: r.source_meta || {},
        }))
      const { data, error } = await s.from(VAULT_TABLE).insert(prepared).select('id')
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ data: data || [] })
    }

    if (action === 'snapshot') {
      const { source_type, source_id, label, payload } = body
      if (!source_type || !source_id || !payload) {
        return Response.json({ error: 'Missing source_type/source_id/payload' }, { status: 400 })
      }
      const { data, error } = await s.from(SNAP_TABLE).insert({
        agency_id: agencyId,
        source_type,
        source_id,
        label: label || null,
        payload,
        created_by: body.created_by || null,
      }).select('*').maybeSingle()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ data })
    }

    if (action === 'restore_snapshot') {
      const { snapshot_id } = body
      if (!snapshot_id) return Response.json({ error: 'Missing snapshot_id' }, { status: 400 })
      const { data: snap } = await s.from(SNAP_TABLE).select('*').eq('id', snapshot_id).maybeSingle()
      if (!snap) return Response.json({ error: 'Snapshot not found' }, { status: 404 })

      // Restore is type-specific. For now we support discovery_engagement.
      if (snap.source_type === 'discovery_engagement') {
        const payload = snap.payload || {}
        const updates: any = {}
        if (payload.sections) updates.sections = payload.sections
        if (payload.executive_summary !== undefined) updates.executive_summary = payload.executive_summary
        if (payload.intel_cards) updates.intel_cards = payload.intel_cards
        if (Object.keys(updates).length > 0) {
          await s.from('koto_discovery_engagements').update(updates).eq('id', snap.source_id)
        }
        return Response.json({ ok: true, restored: snap.source_type })
      }
      return Response.json({ error: `Restore not supported for type ${snap.source_type}` }, { status: 400 })
    }

    if (action === 'delete_entry') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s.from(VAULT_TABLE).delete().eq('id', id).eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    if (action === 'soft_delete') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s.from(VAULT_TABLE).update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: body.deleted_by || null,
      }).eq('id', id).eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    if (action === 'hard_delete') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s.from(VAULT_TABLE).delete().eq('id', id).eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    if (action === 'delete_snapshot') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s.from(SNAP_TABLE).delete().eq('id', id).eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    if (action === 'bulk_soft_delete') {
      const ids = Array.isArray(body.ids) ? body.ids : []
      if (ids.length === 0) return Response.json({ error: 'No ids' }, { status: 400 })
      await s.from(VAULT_TABLE).update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: body.deleted_by || null,
      }).in('id', ids).eq('agency_id', agencyId)
      return Response.json({ ok: true, count: ids.length })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
