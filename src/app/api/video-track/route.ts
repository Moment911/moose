import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

// Track video engagement events
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vmId = searchParams.get('vm')
  const event = searchParams.get('event') || 'open'
  const s = sb()

  if (!vmId) return new Response('', { status: 200 })

  if (event === 'open') {
    await s.from('koto_video_voicemails').update({
      email_opened: true,
      email_opened_at: new Date().toISOString(),
    }).eq('id', vmId).eq('email_opened', false)
  }

  if (event === 'play') {
    const { data: vm } = await s.from('koto_video_voicemails').select('video_play_count').eq('id', vmId).single()
    await s.from('koto_video_voicemails').update({
      video_played: true,
      video_played_at: new Date().toISOString(),
      video_play_count: (vm?.video_play_count || 0) + 1,
    }).eq('id', vmId)
  }

  if (event === 'cta') {
    await s.from('koto_video_voicemails').update({
      cta_clicked: true,
      cta_clicked_at: new Date().toISOString(),
    }).eq('id', vmId)
  }

  // Return 1x1 transparent pixel for email open tracking
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  return new Response(pixel, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  })
}
