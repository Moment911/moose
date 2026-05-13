/**
 * Page Factory: Style Profile API
 *
 * POST /api/builder/style
 *   action=extract_url  — fetch URL + extract style profile
 *   action=extract_html — extract from raw HTML body
 *   action=list         — list style profiles for a client
 *   action=delete       — delete a style profile
 *
 * GET /api/builder/style?agency_id=...&client_id=...
 *   — list style profiles
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractFromUrl, extractFromHtml, saveStyleProfile } from '@/lib/builder/styleExtractor'
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
      case 'extract_url': {
        const { url, name } = body
        if (!url || !client_id) {
          return NextResponse.json({ error: 'url and client_id required' }, { status: 400 })
        }

        const result = await extractFromUrl(url)
        const profileId = await saveStyleProfile(db, agency_id, client_id, result, name || 'From URL')

        return NextResponse.json({
          ok: true,
          profile_id: profileId,
          profile: result.profile,
          source_url: url,
        })
      }

      case 'extract_html': {
        const { html, name } = body
        if (!html || !client_id) {
          return NextResponse.json({ error: 'html and client_id required' }, { status: 400 })
        }

        if (html.length > 500_000) {
          return NextResponse.json({ error: 'HTML too large (max 500KB)' }, { status: 400 })
        }

        const result = await extractFromHtml(html)
        const profileId = await saveStyleProfile(db, agency_id, client_id, result, name || 'From HTML')

        return NextResponse.json({
          ok: true,
          profile_id: profileId,
          profile: result.profile,
        })
      }

      case 'list': {
        if (!client_id) {
          return NextResponse.json({ error: 'client_id required' }, { status: 400 })
        }

        const { data } = await db.from('kotoiq_style_profiles')
          .select('id, name, source_url, tone, content_density, word_count_target, heading_pattern, section_structure, created_at')
          .eq('client_id', client_id)
          .order('created_at', { ascending: false })

        return NextResponse.json({ profiles: data || [] })
      }

      case 'delete': {
        const { profile_id } = body
        if (!profile_id) {
          return NextResponse.json({ error: 'profile_id required' }, { status: 400 })
        }

        await db.from('kotoiq_style_profiles')
          .delete()
          .eq('id', profile_id)

        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    console.error('[builder/style]', e)
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
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

  const { data } = await db.from('kotoiq_style_profiles')
    .select('id, name, source_url, tone, content_density, word_count_target, heading_pattern, section_structure, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ profiles: data || [] })
}
