import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// Plugin calls POST /api/seo/wp-ping on post publish and other events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = req.headers.get('x-koto-key') || req.headers.get('authorization')?.replace('Bearer ', '') || ''
    const s = sb()

    const { event, post_id, site_url } = body

    // Update last_ping on the site
    if (apiKey) {
      await s.from('koto_wp_sites').update({ last_ping: new Date().toISOString() }).eq('api_key', apiKey)
    }

    // Log the event
    await s.from('koto_system_logs').insert({
      level: 'info',
      service: 'wp_plugin',
      action: event || 'ping',
      message: `WP plugin event: ${event || 'ping'} from ${site_url || 'unknown'}`,
      metadata: { event, post_id, site_url, api_key_prefix: apiKey?.slice(0, 10) },
    })

    return NextResponse.json({ success: true, received: event || 'ping' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
