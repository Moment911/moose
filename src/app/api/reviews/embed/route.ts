import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Public endpoint — returns reviews for a widget embed key
// Used by the WordPress plugin and the JS embed snippet
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  
  if (!key) return NextResponse.json({ error: 'Missing embed key' }, { status: 400 })

  // Load widget settings
  const { data: settings, error: settingsErr } = await supabase
    .from('review_widget_settings')
    .select('*, clients(name, industry)')
    .eq('embed_key', key)
    .single()

  if (settingsErr || !settings) {
    return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
  }

  // Check if widget is enabled (payment gate)
  if (!settings.widget_enabled) {
    return NextResponse.json({ error: 'Widget disabled', code: 'WIDGET_DISABLED' }, { status: 403 })
  }

  // Load reviews filtered by settings
  const query = supabase
    .from('moose_review_queue')
    .select('id, platform, reviewer_name, reviewer_avatar, star_rating, review_text, response_text, review_url, reviewed_at, is_featured')
    .eq('client_id', settings.client_id)
    .eq('status', 'approved')
    .gte('star_rating', settings.min_stars || 4)
    .order('reviewed_at', { ascending: false })
    .limit(settings.max_reviews || 20)

  if (settings.platforms?.length) {
    query.in('platform', settings.platforms)
  }

  const { data: reviews } = await query

  return NextResponse.json({
    settings: {
      display_mode:   settings.display_mode,
      badge_position: settings.badge_position,
      theme:          settings.theme,
      primary_color:  settings.primary_color,
      show_platform_icons: settings.show_platform_icons,
      show_reviewer_photo: settings.show_reviewer_photo,
      show_date:      settings.show_date,
      show_response:  settings.show_response,
      min_stars:      settings.min_stars,
      avg_rating:     settings.avg_rating,
      total_reviews:  settings.total_reviews,
      business_name:  settings.clients?.name,
    },
    reviews: reviews || [],
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*', // allow WordPress sites to embed
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, s-maxage=300', // cache 5 min
    }
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  })
}
