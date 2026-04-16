// ─────────────────────────────────────────────────────────────
// Competitor Watch Engine
// Daily monitoring of competitor sites — new content, ranking gains,
// new backlinks, SERP movement. Fires alerts via Slack/Teams/Email.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getDomainRankedKeywords, getSERPResults } from '@/lib/dataforseo'
import { sendSlackAlert, sendTeamsAlert } from '@/lib/slackTeamsIntegration'

// ── helpers ─────────────────────────────────────────────────────────────────
function normalizeDomain(d: string): string {
  if (!d) return ''
  try {
    const w = d.startsWith('http') ? d : `https://${d}`
    return new URL(w).hostname.replace(/^www\./, '')
  } catch { return d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] }
}

async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const candidates = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/sitemap.xml`,
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const urls: string[] = []

      // Collect sub-sitemaps and follow up to 3
      const subMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || []
      if (subMatches.length > 0) {
        for (const sm of subMatches.slice(0, 3)) {
          const loc = sm.match(/<loc>([^<]+)<\/loc>/)?.[1]
          if (!loc) continue
          try {
            const subRes = await fetch(loc, { signal: AbortSignal.timeout(8000) })
            if (!subRes.ok) continue
            const subXml = await subRes.text()
            const matches = subXml.match(/<loc>([^<]+)<\/loc>/g) || []
            for (const m of matches) {
              const u = m.replace(/<\/?loc>/g, '').trim()
              if (u && !u.endsWith('.xml')) urls.push(u)
            }
          } catch {}
        }
      } else {
        const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || []
        for (const m of matches) {
          const u = m.replace(/<\/?loc>/g, '').trim()
          if (u && !u.endsWith('.xml')) urls.push(u)
        }
      }
      return Array.from(new Set(urls)).slice(0, 500)
    } catch {}
  }
  return []
}

// ── Setup a Competitor Watch ────────────────────────────────────────────────
export async function setupCompetitorWatch(
  s: SupabaseClient,
  body: {
    client_id: string
    competitor_domains: string[]
    alert_channels?: { email?: string; slack_webhook?: string; teams_webhook?: string }
    check_frequency?: 'daily' | 'weekly'
  }
) {
  const { client_id, competitor_domains, alert_channels, check_frequency } = body
  if (!client_id) throw new Error('client_id required')
  if (!competitor_domains?.length) throw new Error('competitor_domains required')

  const domains = competitor_domains.map(normalizeDomain).filter(Boolean)

  const { data, error } = await s.from('kotoiq_competitor_watches').insert({
    client_id,
    competitor_domains: domains,
    alert_channels: alert_channels || {},
    check_frequency: check_frequency || 'daily',
    active: true,
  }).select().single()

  if (error) throw error
  return { watch: data }
}

// ── Run a single watch check ────────────────────────────────────────────────
export async function runCompetitorWatchCheck(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id?: string; watch_id?: string; agency_id?: string }
) {
  const { client_id, watch_id, agency_id } = body

  // Fetch watch(es)
  let q = s.from('kotoiq_competitor_watches').select('*').eq('active', true)
  if (watch_id) q = q.eq('id', watch_id)
  else if (client_id) q = q.eq('client_id', client_id)
  const { data: watches } = await q
  if (!watches?.length) return { checked: 0, events: [] }

  const allEvents: any[] = []

  for (const watch of watches) {
    const competitors: string[] = Array.isArray(watch.competitor_domains)
      ? watch.competitor_domains
      : []
    // Fetch client website for SERP context
    const { data: client } = await s.from('clients').select('website, name').eq('id', watch.client_id).single()

    // Top client keywords for SERP movement detection
    const { data: clientKeywords } = await s.from('kotoiq_keywords')
      .select('keyword')
      .eq('client_id', watch.client_id)
      .order('sc_clicks', { ascending: false })
      .limit(5)
    const topKeywords = (clientKeywords || []).map((k: any) => k.keyword).filter(Boolean)

    for (const competitor_domain of competitors) {
      try {
        // --- Previous snapshot ---
        const { data: prevSnap } = await s.from('kotoiq_competitor_url_snapshots')
          .select('*')
          .eq('watch_id', watch.id)
          .eq('competitor_domain', competitor_domain)
          .order('snapshot_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // --- Sitemap → new URLs ---
        const currentUrls = await fetchSitemapUrls(competitor_domain)
        const prevUrls: string[] = Array.isArray(prevSnap?.urls) ? prevSnap.urls : []
        const newUrls = currentUrls.filter(u => !prevUrls.includes(u))

        // --- Ranking keywords (top 50) ---
        let rankingKeywords: any[] = []
        try {
          const rk = await getDomainRankedKeywords(competitor_domain, 'United States', 50)
          rankingKeywords = rk.keywords || []
        } catch {}
        const prevRanking: any[] = Array.isArray(prevSnap?.ranking_keywords) ? prevSnap.ranking_keywords : []
        const prevByKw = new Map<string, number>()
        for (const k of prevRanking) prevByKw.set((k.keyword || '').toLowerCase(), k.position || 99)

        const rankingGains: any[] = []
        for (const k of rankingKeywords) {
          const key = (k.keyword || '').toLowerCase()
          const prevPos = prevByKw.get(key)
          // New to top 10
          if (!prevPos && k.position && k.position <= 10) {
            rankingGains.push({ keyword: k.keyword, position: k.position, change: 'new_top_10' })
          }
          // Improved by 5+ positions
          else if (prevPos && k.position && prevPos - k.position >= 5) {
            rankingGains.push({ keyword: k.keyword, from: prevPos, to: k.position, change: 'improved' })
          }
        }

        // --- SERP movement on client's keywords ---
        const serpMovement: any[] = []
        for (const kw of topKeywords.slice(0, 5)) {
          try {
            const serp = await getSERPResults(kw, 'United States', 'en')
            const idx = (serp.items || []).findIndex((it: any) => (it.domain || '').replace(/^www\./, '') === competitor_domain)
            if (idx >= 0 && idx < 10) {
              serpMovement.push({ keyword: kw, position: idx + 1, url: serp.items[idx].url })
            }
          } catch {}
        }

        // --- Moz backlinks (new referring domains) ---
        let newBacklinks: any[] = []
        let currentBacklinks: any[] = []
        try {
          if (process.env.MOZ_API_KEY) {
            const res = await fetch('https://lsapi.seomoz.com/v2/links', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${process.env.MOZ_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                target: competitor_domain,
                target_type: 'root_domain',
                limit: 50,
                link_columns: ['source_domain', 'source_page', 'anchor_text', 'domain_authority', 'date_first_detected'],
              }),
              signal: AbortSignal.timeout(15000),
            })
            if (res.ok) {
              const data = await res.json()
              currentBacklinks = (data?.results || []).map((r: any) => ({
                source: r.source?.page || r.source?.root_domain || '',
                source_domain: r.source?.root_domain || '',
                anchor: r.anchor_text || '',
                da: r.source?.domain_authority || 0,
                first_seen: r.date_first_detected || null,
              }))
            }
          }
        } catch {}

        const prevBacklinkDomains = new Set(
          (Array.isArray(prevSnap?.backlinks) ? prevSnap.backlinks : [])
            .map((b: any) => b.source_domain || '')
        )
        newBacklinks = currentBacklinks.filter(b => b.source_domain && !prevBacklinkDomains.has(b.source_domain))

        // --- Save fresh snapshot ---
        await s.from('kotoiq_competitor_url_snapshots').insert({
          watch_id: watch.id,
          competitor_domain,
          urls: currentUrls,
          ranking_keywords: rankingKeywords,
          backlinks: currentBacklinks,
        })

        // --- Build events + persist ---
        const eventsToInsert: any[] = []
        if (prevSnap && newUrls.length > 0) {
          eventsToInsert.push({
            watch_id: watch.id,
            client_id: watch.client_id,
            competitor_domain,
            event_type: 'new_content',
            event_data: { count: newUrls.length, urls: newUrls.slice(0, 20) },
            severity: newUrls.length >= 5 ? 'warning' : 'info',
          })
        }
        if (prevSnap && rankingGains.length > 0) {
          eventsToInsert.push({
            watch_id: watch.id,
            client_id: watch.client_id,
            competitor_domain,
            event_type: 'ranking_gains',
            event_data: { gains: rankingGains.slice(0, 20), count: rankingGains.length },
            severity: rankingGains.length >= 10 ? 'critical' : rankingGains.length >= 3 ? 'warning' : 'info',
          })
        }
        if (prevSnap && newBacklinks.length > 0) {
          eventsToInsert.push({
            watch_id: watch.id,
            client_id: watch.client_id,
            competitor_domain,
            event_type: 'new_backlinks',
            event_data: { count: newBacklinks.length, backlinks: newBacklinks.slice(0, 20) },
            severity: newBacklinks.length >= 10 ? 'warning' : 'info',
          })
        }
        if (serpMovement.length > 0) {
          eventsToInsert.push({
            watch_id: watch.id,
            client_id: watch.client_id,
            competitor_domain,
            event_type: 'serp_movement',
            event_data: { appearances: serpMovement },
            severity: serpMovement.some(s => s.position <= 3) ? 'critical' : 'warning',
          })
        }

        let insertedEvents: any[] = []
        if (eventsToInsert.length > 0) {
          const { data: inserted } = await s.from('kotoiq_competitor_events').insert(eventsToInsert).select()
          insertedEvents = inserted || []
          allEvents.push(...insertedEvents)
        }

        // --- AI summary + alerts ---
        const hasSignificant = insertedEvents.some(e => e.severity !== 'info')
        const channels = watch.alert_channels || {}

        if (hasSignificant && (channels.slack_webhook || channels.teams_webhook || channels.email)) {
          let summary = ''
          try {
            const msg = await ai.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 600,
              messages: [{
                role: 'user',
                content: `Summarize these competitor events for ${client?.name || 'this client'} about ${competitor_domain} into a concise 2-3 sentence alert. Focus on what matters for the agency.\n\n${JSON.stringify(insertedEvents.map(e => ({ type: e.event_type, data: e.event_data, severity: e.severity })), null, 2)}`,
              }],
            })
            summary = (msg.content[0] as any)?.text || ''
            await logTokenUsage({
              feature: 'competitor_watch_summary',
              model: 'claude-sonnet-4-20250514',
              inputTokens: msg.usage.input_tokens,
              outputTokens: msg.usage.output_tokens,
              agencyId: agency_id,
            })
          } catch (e: any) {
            summary = `${insertedEvents.length} competitor events detected for ${competitor_domain}.`
          }

          const title = `Competitor Watch: ${competitor_domain}`
          const fields = [
            { title: 'New Content', value: String(newUrls.length) },
            { title: 'Ranking Gains', value: String(rankingGains.length) },
            { title: 'New Backlinks', value: String(newBacklinks.length) },
            { title: 'SERP Appearances', value: String(serpMovement.length) },
          ]

          if (channels.slack_webhook) {
            try {
              await sendSlackAlert(channels.slack_webhook, { title, body: summary, color: '#f59e0b', fields })
            } catch {}
          }
          if (channels.teams_webhook) {
            try {
              await sendTeamsAlert(channels.teams_webhook, { title, body: summary, color: 'f59e0b', fields })
            } catch {}
          }
          if (channels.email && process.env.RESEND_API_KEY) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Koto <alerts@hellokoto.com>',
                  to: channels.email,
                  subject: title,
                  html: `<h2>${title}</h2><p>${summary}</p><ul>${fields.map(f => `<li><b>${f.title}:</b> ${f.value}</li>`).join('')}</ul>`,
                }),
              })
            } catch {}
          }

          // mark events alerted
          if (insertedEvents.length > 0) {
            await s.from('kotoiq_competitor_events').update({ alerted: true }).in('id', insertedEvents.map(e => e.id))
          }
        }
      } catch (err: any) {
        console.error(`competitor_watch ${competitor_domain} failed:`, err.message)
      }
    }

    await s.from('kotoiq_competitor_watches').update({ last_checked_at: new Date().toISOString() }).eq('id', watch.id)
  }

  return { checked: watches.length, events: allEvents.length, details: allEvents.slice(0, 25) }
}

// ── Get events (for dashboard) ──────────────────────────────────────────────
export async function getCompetitorEvents(
  s: SupabaseClient,
  body: { client_id: string; watch_id?: string; limit?: number }
) {
  const { client_id, watch_id, limit } = body
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_competitor_events').select('*').eq('client_id', client_id)
  if (watch_id) q = q.eq('watch_id', watch_id)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit || 50)
  if (error) throw error

  const { data: watches } = await s.from('kotoiq_competitor_watches').select('*').eq('client_id', client_id)

  return { events: data || [], watches: watches || [] }
}
