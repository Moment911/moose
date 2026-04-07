import { NextRequest, NextResponse } from 'next/server'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agencyId = searchParams.get('agency_id')
    const unreadOnly = searchParams.get('unread_only') === 'true'

    if (!agencyId) {
      return NextResponse.json(
        { error: 'Missing agency_id' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('koto_system_logs')
      .select('*')
      .eq('agency_id', agencyId)
      .in('level', ['error', 'warn', 'notification'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[notifications] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const notifications = (data ?? []).map((row) => ({
      id: row.id,
      type: row.service,
      level: row.level,
      title: row.message,
      message: row.metadata?.body ?? null,
      link: row.metadata?.link ?? null,
      is_read: row.metadata?.read === true,
      metadata: row.metadata,
      created_at: row.created_at,
    }))

    const filtered = unreadOnly
      ? notifications.filter((n) => !n.is_read)
      : notifications

    const unreadCount = notifications.filter((n) => !n.is_read).length

    return NextResponse.json({
      notifications: filtered,
      unread_count: unreadCount,
    })
  } catch (error) {
    console.error('[notifications] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agency_id, type, title, message, link, metadata } = body

    if (!agency_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: agency_id, title' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('koto_system_logs')
      .insert({
        agency_id,
        level: 'notification',
        service: type ?? 'system',
        message: title,
        metadata: {
          body: message ?? null,
          link: link ?? null,
          read: false,
          ...(metadata ?? {}),
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error('[notifications] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (error) {
    console.error('[notifications] error:', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ids, mark_all_read, agency_id } = body

    const supabase = getSupabase()

    if (mark_all_read && agency_id) {
      // Fetch all unread notifications for this agency
      const { data: unread, error: fetchErr } = await supabase
        .from('koto_system_logs')
        .select('id, metadata')
        .eq('agency_id', agency_id)
        .in('level', ['error', 'warn', 'notification'])

      if (fetchErr) {
        console.error('[notifications] fetch error:', fetchErr)
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
      }

      const toUpdate = (unread ?? []).filter(
        (row) => row.metadata?.read !== true
      )

      // Update each row's metadata to set read=true
      await Promise.all(
        toUpdate.map((row) =>
          supabase
            .from('koto_system_logs')
            .update({ metadata: { ...row.metadata, read: true } })
            .eq('id', row.id)
        )
      )

      return NextResponse.json({ ok: true })
    }

    // Single id or array of ids
    const targetIds: string[] = ids ?? (id ? [id] : [])

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing id, ids, or mark_all_read' },
        { status: 400 }
      )
    }

    // Fetch current metadata for each target
    const { data: rows, error: fetchErr } = await supabase
      .from('koto_system_logs')
      .select('id, metadata')
      .in('id', targetIds)

    if (fetchErr) {
      console.error('[notifications] fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    await Promise.all(
      (rows ?? []).map((row) =>
        supabase
          .from('koto_system_logs')
          .update({ metadata: { ...row.metadata, read: true } })
          .eq('id', row.id)
      )
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[notifications] error:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
