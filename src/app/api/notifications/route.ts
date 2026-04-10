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
      const { data } = await s.from('koto_notifications')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50)
      return Response.json({ data: data || [] })
    }

    if (action === 'all') {
      const { data } = await s.from('koto_notifications')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(100)
      return Response.json({ data: data || [] })
    }

    if (action === 'unread_count') {
      const { count } = await s.from('koto_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('is_read', false)
      return Response.json({ data: { count: count || 0 } })
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

    if (action === 'mark_read') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s.from('koto_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    if (action === 'mark_all_read') {
      await s.from('koto_notifications')
        .update({ is_read: true })
        .eq('agency_id', agencyId)
        .eq('is_read', false)
      return Response.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s.from('koto_notifications')
        .delete()
        .eq('id', id)
        .eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    if (action === 'create') {
      const { type, title, body: msgBody, link, icon, metadata } = body
      if (!type || !title) return Response.json({ error: 'Missing type or title' }, { status: 400 })
      const { data } = await s.from('koto_notifications').insert({
        agency_id: agencyId,
        type,
        title,
        body: msgBody || null,
        link: link || null,
        icon: icon || null,
        metadata: metadata || {},
      }).select('*').maybeSingle()
      return Response.json({ data })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
