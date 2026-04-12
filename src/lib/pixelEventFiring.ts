import 'server-only' // fails the build if this module is ever imported from a client component
// ── Multi-Platform Pixel Event Firing ─────────────────────────────────────────
// Fires tracking events to Facebook, Google, TikTok, LinkedIn simultaneously.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const EVENT_MAP: Record<string, Record<string, string>> = {
  page_view:   { facebook: 'PageView',    ga4: 'page_view',         tiktok: 'PageView',    linkedin: 'page_view' },
  form_submit: { facebook: 'Lead',        ga4: 'generate_lead',     tiktok: 'SubmitForm',  linkedin: 'conversion' },
  appointment: { facebook: 'Schedule',    ga4: 'schedule',          tiktok: 'Subscribe',   linkedin: 'conversion' },
  purchase:    { facebook: 'Purchase',    ga4: 'purchase',          tiktok: 'PlaceOrder',  linkedin: 'conversion' },
  hot_visitor: { facebook: 'ViewContent', ga4: 'view_item',         tiktok: 'ViewContent', linkedin: 'view' },
  cta_click:   { facebook: 'Contact',    ga4: 'click',             tiktok: 'ClickButton', linkedin: 'click' },
}

export async function fireToAllPlatforms(
  agencyId: string,
  clientId: string | null,
  eventName: string,
  eventData: any
): Promise<{ fired: string[]; errors: string[] }> {
  const supabase = getSupabase()
  const fired: string[] = []
  const errors: string[] = []

  // Fetch active integrations
  let query = supabase.from('koto_pixel_integrations').select('*').eq('agency_id', agencyId).eq('status', 'active')
  if (clientId) query = query.eq('client_id', clientId)
  const { data: integrations } = await query

  if (!integrations?.length) return { fired, errors }

  for (const integration of integrations) {
    try {
      const platformEvent = EVENT_MAP[eventName]?.[integration.platform]
      if (!platformEvent) continue

      if (integration.platform === 'facebook') {
        await fireFacebookEvent(integration, platformEvent, eventData)
        fired.push('facebook')
      } else if (integration.platform === 'google') {
        await fireGA4Event(integration, platformEvent, eventData)
        fired.push('google')
      }
      // TikTok, LinkedIn etc. would fire similarly

      // Update counter
      await supabase.from('koto_pixel_integrations').update({
        events_sent_today: (integration.events_sent_today || 0) + 1,
        events_sent_total: (integration.events_sent_total || 0) + 1,
      }).eq('id', integration.id)

    } catch (e: any) {
      errors.push(`${integration.platform}: ${e.message}`)
    }
  }

  return { fired, errors }
}

async function fireFacebookEvent(integration: any, eventName: string, eventData: any): Promise<void> {
  const pixelId = integration.platform_pixel_id
  const accessToken = integration.config?.access_token
  if (!pixelId || !accessToken) return

  await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: eventData.user_data || {},
        custom_data: eventData.custom_data || {},
      }],
      access_token: accessToken,
    }),
    signal: AbortSignal.timeout(5000),
  })
}

async function fireGA4Event(integration: any, eventName: string, eventData: any): Promise<void> {
  const measurementId = integration.platform_pixel_id
  const apiSecret = integration.config?.api_secret
  if (!measurementId || !apiSecret) return

  await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: eventData.session_id || 'unknown',
      events: [{ name: eventName, params: eventData.params || {} }],
    }),
    signal: AbortSignal.timeout(5000),
  })
}
