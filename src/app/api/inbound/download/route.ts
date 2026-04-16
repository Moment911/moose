import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// GET /api/inbound/download?call_id=UUID&kind=recording|summary|transcript
// Streams the asset back with a Content-Disposition so the browser saves it.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const callId = searchParams.get('call_id')
  const kind = searchParams.get('kind') || 'recording'
  if (!callId) return new Response('call_id required', { status: 400 })

  const { data: row } = await sb()
    .from('koto_inbound_calls')
    .select('*')
    .eq('id', callId)
    .maybeSingle()
  if (!row) return new Response('not_found', { status: 404 })

  const base = (row.caller_name || row.caller_number || 'call').replace(/[^a-z0-9_-]+/gi, '_')
  const date = row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : 'undated'

  if (kind === 'transcript') {
    const text = (row.transcript || '').trim() || 'No transcript available.'
    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}_${date}_transcript.txt"`,
      },
    })
  }

  const url: string = kind === 'summary'
    ? row.summary_audio_url
    : (row.recording_archive_url || row.recording_url)
  if (!url) return new Response('asset_not_available', { status: 404 })

  const upstream = await fetch(url)
  if (!upstream.ok || !upstream.body) return new Response('upstream_fetch_failed', { status: 502 })

  const contentType = kind === 'summary' ? 'audio/mpeg' : (upstream.headers.get('content-type') || 'audio/wav')
  const ext = kind === 'summary' ? 'mp3' : (contentType.includes('mpeg') ? 'mp3' : 'wav')
  const filename = `${base}_${date}_${kind}.${ext}`

  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}
