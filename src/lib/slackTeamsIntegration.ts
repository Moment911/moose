// ─────────────────────────────────────────────────────────────
// Slack & Microsoft Teams Integration
// Webhook-based alerts + daily digest
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

export interface AlertParams {
  title: string
  body: string
  color?: string // hex without # for Teams, with # for Slack
  fields?: { title: string; value: string }[]
  actions?: { text: string; url: string }[]
}

// ── Slack (Block Kit) ───────────────────────────────────────────────────────
export async function sendSlackAlert(webhookUrl: string, params: AlertParams): Promise<void> {
  if (!webhookUrl) throw new Error('webhookUrl required')

  const color = params.color?.startsWith('#') ? params.color : (params.color ? `#${params.color}` : '#3b82f6')

  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: params.title.slice(0, 150) } },
    { type: 'section', text: { type: 'mrkdwn', text: params.body.slice(0, 2900) } },
  ]

  if (params.fields && params.fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: params.fields.slice(0, 10).map(f => ({
        type: 'mrkdwn',
        text: `*${f.title}*\n${f.value}`,
      })),
    })
  }

  if (params.actions && params.actions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: params.actions.slice(0, 5).map(a => ({
        type: 'button',
        text: { type: 'plain_text', text: a.text },
        url: a.url,
      })),
    })
  }

  const payload = {
    text: params.title, // fallback for notifications
    attachments: [{ color, blocks }],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Slack webhook ${res.status}: ${text.slice(0, 200)}`)
  }
}

// ── Microsoft Teams (MessageCard) ───────────────────────────────────────────
export async function sendTeamsAlert(webhookUrl: string, params: AlertParams): Promise<void> {
  if (!webhookUrl) throw new Error('webhookUrl required')

  const themeColor = (params.color || '3b82f6').replace(/^#/, '')

  const sections: any[] = [
    {
      activityTitle: params.title,
      text: params.body,
      facts: (params.fields || []).slice(0, 10).map(f => ({ name: f.title, value: f.value })),
    },
  ]

  const payload: any = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: params.title.slice(0, 150),
    title: params.title,
    sections,
  }

  if (params.actions && params.actions.length > 0) {
    payload.potentialAction = params.actions.slice(0, 5).map(a => ({
      '@type': 'OpenUri',
      name: a.text,
      targets: [{ os: 'default', uri: a.url }],
    }))
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Teams webhook ${res.status}: ${text.slice(0, 200)}`)
  }
}

// ── Setup / CRUD ────────────────────────────────────────────────────────────
export async function setupSlackIntegration(
  s: SupabaseClient,
  body: {
    client_id?: string
    agency_id?: string
    webhook_url: string
    channels?: string[]
    alert_types: string[]
  }
) {
  const { client_id, agency_id, webhook_url, channels, alert_types } = body
  if (!webhook_url) throw new Error('webhook_url required')
  if (!client_id && !agency_id) throw new Error('client_id or agency_id required')

  const { data, error } = await s.from('kotoiq_integrations').insert({
    client_id: client_id || null,
    agency_id: agency_id || null,
    integration_type: 'slack',
    webhook_url,
    channels: channels || [],
    alert_types: alert_types || [],
    active: true,
  }).select().single()

  if (error) throw error
  return { integration: data }
}

export async function setupTeamsIntegration(
  s: SupabaseClient,
  body: {
    client_id?: string
    agency_id?: string
    webhook_url: string
    channels?: string[]
    alert_types: string[]
  }
) {
  const { client_id, agency_id, webhook_url, channels, alert_types } = body
  if (!webhook_url) throw new Error('webhook_url required')
  if (!client_id && !agency_id) throw new Error('client_id or agency_id required')

  const { data, error } = await s.from('kotoiq_integrations').insert({
    client_id: client_id || null,
    agency_id: agency_id || null,
    integration_type: 'teams',
    webhook_url,
    channels: channels || [],
    alert_types: alert_types || [],
    active: true,
  }).select().single()

  if (error) throw error
  return { integration: data }
}

// ── Daily Digest ────────────────────────────────────────────────────────────
export async function sendDailyDigest(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id?: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id && !agency_id) throw new Error('client_id or agency_id required')

  // Look up integrations for this scope
  let intQ = s.from('kotoiq_integrations').select('*').eq('active', true).in('integration_type', ['slack', 'teams'])
  if (client_id) intQ = intQ.eq('client_id', client_id)
  else if (agency_id) intQ = intQ.eq('agency_id', agency_id)
  const { data: integrations } = await intQ

  if (!integrations?.length) return { sent: 0, reason: 'no_active_integrations' }

  // Gather scope of clients to include
  let clientIds: string[] = []
  if (client_id) clientIds = [client_id]
  else if (agency_id) {
    const { data: clis } = await s.from('clients').select('id').eq('agency_id', agency_id).is('deleted_at', null)
    clientIds = (clis || []).map((c: any) => c.id)
  }

  if (clientIds.length === 0) return { sent: 0, reason: 'no_clients' }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [snapshots, compEvents, content, reviews] = await Promise.all([
    s.from('kotoiq_snapshots').select('*').in('client_id', clientIds).gte('created_at', since).order('created_at', { ascending: false }).limit(50),
    s.from('kotoiq_competitor_events').select('*').in('client_id', clientIds).gte('created_at', since).order('created_at', { ascending: false }).limit(30),
    s.from('kotoiq_content_inventory').select('url, published_date, client_id').in('client_id', clientIds).gte('published_date', since.slice(0, 10)).limit(30),
    s.from('reviews').select('*').in('client_id', clientIds).gte('created_at', since).order('created_at', { ascending: false }).limit(30),
  ])

  const digestContext = {
    ranking_snapshots: (snapshots.data || []).length,
    competitor_events: (compEvents.data || []).slice(0, 10).map((e: any) => ({ type: e.event_type, competitor: e.competitor_domain, severity: e.severity })),
    content_published: (content.data || []).length,
    reviews_received: (reviews.data || []).length,
    competitor_events_count: (compEvents.data || []).length,
  }

  let summary = ''
  try {
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Write a concise daily digest for an SEO agency. Keep it under 5 bullets. Lead with the most important item. Use Slack-friendly markdown (single asterisks for bold). Data from the last 24h:\n\n${JSON.stringify(digestContext, null, 2)}`,
      }],
    })
    summary = (msg.content[0] as any)?.text || ''
    await logTokenUsage({
      feature: 'daily_digest',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      agencyId: agency_id,
    })
  } catch (e: any) {
    summary = `Last 24h: ${digestContext.ranking_snapshots} ranking updates, ${digestContext.competitor_events_count} competitor events, ${digestContext.content_published} new pages, ${digestContext.reviews_received} reviews.`
  }

  const title = `Koto Daily Digest — ${new Date().toLocaleDateString()}`
  const fields = [
    { title: 'Ranking Updates', value: String(digestContext.ranking_snapshots) },
    { title: 'Competitor Events', value: String(digestContext.competitor_events_count) },
    { title: 'Content Published', value: String(digestContext.content_published) },
    { title: 'Reviews', value: String(digestContext.reviews_received) },
  ]

  let sent = 0
  for (const integ of integrations) {
    try {
      if (integ.integration_type === 'slack') {
        await sendSlackAlert(integ.webhook_url, { title, body: summary, color: '#10b981', fields })
      } else if (integ.integration_type === 'teams') {
        await sendTeamsAlert(integ.webhook_url, { title, body: summary, color: '10b981', fields })
      }
      sent++
      await s.from('kotoiq_integrations').update({ last_used_at: new Date().toISOString() }).eq('id', integ.id)
    } catch (err: any) {
      console.error(`digest send failed for ${integ.id}:`, err.message)
    }
  }

  return { sent, total: integrations.length, summary }
}
