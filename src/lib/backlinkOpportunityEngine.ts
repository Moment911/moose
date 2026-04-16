// ─────────────────────────────────────────────────────────────
// Backlink Opportunity Engine — Moz + DataForSEO + Claude
// Identifies competitor-common links, unlinked mentions, directory &
// resource-page opportunities, and guest-post angles. Generates outreach
// templates per opportunity and ranks by DA × relevance × ease.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getSERPResults } from '@/lib/dataforseo'

type AnyRow = Record<string, any>

const MOZ_BASE = 'https://lsapi.seomoz.com/v2'

function extractDomain(website: string): string {
  if (!website) return ''
  try {
    const w = website.startsWith('http') ? website : `https://${website}`
    return new URL(w).hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^www\./, '')
  }
}

async function mozPost(endpoint: string, body: any): Promise<any> {
  const auth = process.env.MOZ_API_KEY || ''
  if (!auth) throw new Error('MOZ_API_KEY not configured')
  const res = await fetch(`${MOZ_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Moz ${endpoint} ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

interface Opportunity {
  type:
    | 'competitor_common'
    | 'unlinked_mention'
    | 'directory'
    | 'resource_page'
    | 'guest_post'
  target_domain: string
  target_url?: string
  domain_authority: number
  relevance_score: number
  ease_score: number
  priority: 'high' | 'medium' | 'low'
  outreach_template: string
  strategy_notes: string
}

function computePriority(da: number, rel: number, ease: number): 'high' | 'medium' | 'low' {
  const score = da * 0.45 + rel * 20 * 0.35 + ease * 20 * 0.2
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

// Helper to truncate / clean Moz link rows
function pickCompetitorLinks(links: any[]): AnyRow[] {
  return links.map((l: any) => ({
    source_domain:
      l.source?.root_domain ||
      l.source_domain ||
      l.root_domain ||
      '',
    source_page: l.source?.page || l.source_page || '',
    da:
      l.source?.domain_authority ||
      l.source_domain_authority ||
      l.domain_authority ||
      0,
    anchor: l.anchor_text || '',
  }))
}

async function generateOutreachTemplate(
  ai: Anthropic,
  opp: {
    type: string
    target_domain: string
    target_url?: string
    client_name: string
    client_website: string
    client_industry: string
    context: string
  },
  agency_id?: string
): Promise<{ template: string; notes: string }> {
  try {
    const prompt = `Write a concise, professional outreach email for a backlink opportunity.

Opportunity type: ${opp.type}
Target domain: ${opp.target_domain}${opp.target_url ? `\nTarget URL: ${opp.target_url}` : ''}
Client: ${opp.client_name} (${opp.client_website})
Industry: ${opp.client_industry}
Context: ${opp.context}

Constraints:
- Friendly, direct, no filler or flattery
- Under 120 words
- Include a clear ask and a specific reason the link/mention/inclusion would benefit the recipient
- Use placeholders like {RECIPIENT_NAME} and {SPECIFIC_PAGE_TITLE} where appropriate
- Do NOT mention SEO, backlinks, or rankings explicitly

Return JSON: { "subject": "...", "body": "...", "notes": "1-sentence strategy hint for the outreach operator" }
Return ONLY JSON, no markdown.`

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_backlink_opportunity_outreach',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id,
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const cleaned = raw
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    const subject = parsed.subject || 'Quick suggestion'
    const body = parsed.body || ''
    return {
      template: `Subject: ${subject}\n\n${body}`,
      notes: parsed.notes || '',
    }
  } catch {
    return {
      template: `Subject: Quick suggestion for ${opp.target_domain}\n\nHi {RECIPIENT_NAME},\n\nI came across ${opp.target_domain} while researching ${opp.client_industry}. We run ${opp.client_name} (${opp.client_website}) and would love to be considered for inclusion where relevant.\n\nHappy to share any supporting info that would help.\n\nThanks,\n{SENDER_NAME}`,
      notes: 'Template fallback — personalize before sending.',
    }
  }
}

// ── Main scanner ───────────────────────────────────────────────────────────
export async function scanAndGenerateBacklinks(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data: client } = await s
    .from('clients')
    .select('id, name, website, primary_service, target_customer')
    .eq('id', client_id)
    .single()
  if (!client) throw new Error('Client not found')
  if (!client.website) throw new Error('Client is missing a website')

  const clientDomain = extractDomain(client.website)
  const clientWebsite = client.website.startsWith('http')
    ? client.website
    : `https://${client.website}`
  const industry = client.primary_service || 'local services'

  // ── 1. Pull competitor domains from kotoiq_keywords ────────────────────
  const { data: keywordRows } = await s
    .from('kotoiq_keywords')
    .select('keyword, competitor_domains')
    .eq('client_id', client_id)
    .not('competitor_domains', 'is', null)
    .limit(200)

  const competitorCounts = new Map<string, number>()
  for (const r of keywordRows || []) {
    const doms = Array.isArray(r.competitor_domains) ? r.competitor_domains : []
    for (const d of doms) {
      if (!d || typeof d !== 'string') continue
      const norm = extractDomain(d)
      if (!norm || norm === clientDomain) continue
      competitorCounts.set(norm, (competitorCounts.get(norm) || 0) + 1)
    }
  }
  const topCompetitors = [...competitorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([d]) => d)

  // ── 2. Pull client's existing referring domains to exclude ─────────────
  const existingReferrers = new Set<string>()
  try {
    const clientLinksRes = await mozPost('/links', {
      target: clientDomain,
      target_type: 'root_domain',
      limit: 500,
      link_columns: ['source_domain'],
    })
    for (const l of clientLinksRes?.results || []) {
      const d = extractDomain(l.source?.root_domain || l.source_domain || '')
      if (d) existingReferrers.add(d)
    }
  } catch {
    /* non-fatal */
  }

  // ── 3. For each competitor, pull backlinks and tally common referrers ──
  const referrerCompetitorCount = new Map<
    string,
    { count: number; da: number; exampleAnchor: string; samplePage: string }
  >()

  for (const comp of topCompetitors) {
    try {
      const res = await mozPost('/links', {
        target: comp,
        target_type: 'root_domain',
        limit: 500,
        link_columns: ['source_domain', 'source_page', 'anchor_text'],
        source_columns: ['domain_authority', 'spam_score'],
      })
      const links = pickCompetitorLinks(res?.results || [])
      const perCompUnique = new Set<string>()
      for (const l of links) {
        const sd = extractDomain(l.source_domain)
        if (!sd || sd === clientDomain || existingReferrers.has(sd)) continue
        if (perCompUnique.has(sd)) continue
        perCompUnique.add(sd)
        const existing = referrerCompetitorCount.get(sd) || {
          count: 0,
          da: l.da || 0,
          exampleAnchor: l.anchor || '',
          samplePage: l.source_page || '',
        }
        existing.count += 1
        if ((l.da || 0) > existing.da) existing.da = l.da || 0
        if (!existing.exampleAnchor && l.anchor) existing.exampleAnchor = l.anchor
        if (!existing.samplePage && l.source_page) existing.samplePage = l.source_page
        referrerCompetitorCount.set(sd, existing)
      }
    } catch {
      /* skip failed competitor */
    }
  }

  // ── 4. Competitor-common opportunities: linking to 3+ competitors ──────
  const competitorCommonRaw = [...referrerCompetitorCount.entries()]
    .filter(([, info]) => info.count >= 3)
    .sort(
      (a, b) =>
        b[1].count * 10 + b[1].da - (a[1].count * 10 + a[1].da)
    )
    .slice(0, 25)

  // ── 5. Unlinked mentions via DataForSEO SERP ───────────────────────────
  let unlinkedMentions: AnyRow[] = []
  try {
    const mentionQuery = `"${client.name}" -site:${clientDomain}`
    const serp = await getSERPResults(mentionQuery).catch(() => null)
    if (serp) {
      for (const item of serp.items || []) {
        if ((item as any).type !== 'organic') continue
        const url = (item as any).url || ''
        if (!url) continue
        const srcDomain = extractDomain(url)
        if (
          !srcDomain ||
          srcDomain === clientDomain ||
          existingReferrers.has(srcDomain)
        )
          continue
        unlinkedMentions.push({
          target_domain: srcDomain,
          target_url: url,
          title: (item as any).title || '',
          snippet: (item as any).description || '',
        })
      }
    }
  } catch {
    /* non-fatal */
  }
  unlinkedMentions = unlinkedMentions.slice(0, 20)

  // ── 6. Directory opportunities via SERP ("best X directories" etc.) ───
  const directorySerpQuery = `${industry} directory submit listing`
  let directoryTargets: AnyRow[] = []
  try {
    const serp = await getSERPResults(directorySerpQuery).catch(() => null)
    if (serp) {
      for (const item of serp.items || []) {
        if ((item as any).type !== 'organic') continue
        const url = (item as any).url || ''
        const sd = extractDomain(url)
        if (!sd || sd === clientDomain || existingReferrers.has(sd)) continue
        directoryTargets.push({
          target_domain: sd,
          target_url: url,
          title: (item as any).title || '',
          snippet: (item as any).description || '',
        })
      }
    }
  } catch {
    /* non-fatal */
  }
  directoryTargets = directoryTargets.slice(0, 15)

  // ── 7. Resource-page opportunities ────────────────────────────────────
  const resourceSerpQuery = `${industry} "resources" OR "useful links" inurl:resources`
  let resourceTargets: AnyRow[] = []
  try {
    const serp = await getSERPResults(resourceSerpQuery).catch(() => null)
    if (serp) {
      for (const item of serp.items || []) {
        if ((item as any).type !== 'organic') continue
        const url = (item as any).url || ''
        const sd = extractDomain(url)
        if (!sd || sd === clientDomain || existingReferrers.has(sd)) continue
        resourceTargets.push({
          target_domain: sd,
          target_url: url,
          title: (item as any).title || '',
          snippet: (item as any).description || '',
        })
      }
    }
  } catch {
    /* non-fatal */
  }
  resourceTargets = resourceTargets.slice(0, 15)

  // ── 8. Guest-post angles via Claude ───────────────────────────────────
  let guestPostAngles: AnyRow[] = []
  try {
    const prompt = `You are a backlink outreach strategist. Suggest 5 specific guest post angles for this client that publications in their space would realistically accept.

Client: ${client.name}
Website: ${clientWebsite}
Industry: ${industry}
Audience: ${client.target_customer || 'not specified'}

Each angle should reference real publication types (not fake domains). Return JSON array shaped:
[ { "angle_title": "pitch headline", "target_publication_type": "industry trade journal|regional business pub|niche blog|podcast site|association newsletter", "hook": "why the publisher would run this", "ease": "easy|moderate|hard" } ]

Return ONLY a JSON array.`
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_backlink_opportunity_angles',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id,
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
    const cleaned = raw
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) guestPostAngles = parsed
  } catch {
    guestPostAngles = []
  }

  // ── 9. Enrich with DA where missing (Moz url_metrics batch) ───────────
  async function enrichDA(domains: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    const batch = domains.filter(Boolean).slice(0, 50)
    if (batch.length === 0) return out
    try {
      const res = await mozPost('/url_metrics', { targets: batch })
      for (const r of res?.results || []) {
        const d = extractDomain(r.root_domain || r.page || '')
        out.set(d, r.domain_authority || 0)
      }
    } catch {
      /* non-fatal */
    }
    return out
  }

  const mentionDAs = await enrichDA(unlinkedMentions.map((m) => m.target_domain))
  const directoryDAs = await enrichDA(
    directoryTargets.map((m) => m.target_domain)
  )
  const resourceDAs = await enrichDA(resourceTargets.map((m) => m.target_domain))

  // ── 10. Build opportunity objects ─────────────────────────────────────
  const opportunities: Opportunity[] = []

  // Competitor-common (highest intent)
  for (const [domain, info] of competitorCommonRaw) {
    const relevance = Math.min(info.count / 5, 1) // 5+ competitors = max relevance
    const ease = 0.55 // moderate — they link to similar brands already
    const template = await generateOutreachTemplate(
      ai,
      {
        type: 'competitor_common',
        target_domain: domain,
        target_url: info.samplePage,
        client_name: client.name || '',
        client_website: clientWebsite,
        client_industry: industry,
        context: `This site links to ${info.count} of your competitors. They clearly cover your space and are friendly to brand mentions in this category.`,
      },
      agency_id
    )
    opportunities.push({
      type: 'competitor_common',
      target_domain: domain,
      target_url: info.samplePage || undefined,
      domain_authority: info.da,
      relevance_score: Math.round(relevance * 100) / 100,
      ease_score: ease,
      priority: computePriority(info.da, relevance, ease),
      outreach_template: template.template,
      strategy_notes: `Links to ${info.count} competitor(s). ${template.notes}`,
    })
  }

  // Unlinked mentions (easiest wins)
  for (const m of unlinkedMentions) {
    const da = mentionDAs.get(m.target_domain) || 0
    const relevance = 0.85 // they already mentioned the brand
    const ease = 0.8
    const template = await generateOutreachTemplate(
      ai,
      {
        type: 'unlinked_mention',
        target_domain: m.target_domain,
        target_url: m.target_url,
        client_name: client.name || '',
        client_website: clientWebsite,
        client_industry: industry,
        context: `They already mention ${client.name} on ${m.target_url} without linking. Easy ask: add a link to the existing mention.`,
      },
      agency_id
    )
    opportunities.push({
      type: 'unlinked_mention',
      target_domain: m.target_domain,
      target_url: m.target_url,
      domain_authority: da,
      relevance_score: relevance,
      ease_score: ease,
      priority: computePriority(da, relevance, ease),
      outreach_template: template.template,
      strategy_notes: `Unlinked mention on "${m.title || m.target_url}". ${template.notes}`,
    })
  }

  // Directory opportunities
  for (const d of directoryTargets) {
    const da = directoryDAs.get(d.target_domain) || 0
    const relevance = 0.55
    const ease = 0.75
    const template = await generateOutreachTemplate(
      ai,
      {
        type: 'directory',
        target_domain: d.target_domain,
        target_url: d.target_url,
        client_name: client.name || '',
        client_website: clientWebsite,
        client_industry: industry,
        context: `Industry directory that accepts listings. Submit via their listing form or reach out to editor for inclusion.`,
      },
      agency_id
    )
    opportunities.push({
      type: 'directory',
      target_domain: d.target_domain,
      target_url: d.target_url,
      domain_authority: da,
      relevance_score: relevance,
      ease_score: ease,
      priority: computePriority(da, relevance, ease),
      outreach_template: template.template,
      strategy_notes: `Directory listing on ${d.title}. ${template.notes}`,
    })
  }

  // Resource page opportunities
  for (const r of resourceTargets) {
    const da = resourceDAs.get(r.target_domain) || 0
    const relevance = 0.65
    const ease = 0.5
    const template = await generateOutreachTemplate(
      ai,
      {
        type: 'resource_page',
        target_domain: r.target_domain,
        target_url: r.target_url,
        client_name: client.name || '',
        client_website: clientWebsite,
        client_industry: industry,
        context: `Resource page that curates useful links for ${industry}. Pitch a specific, useful piece of content or asset.`,
      },
      agency_id
    )
    opportunities.push({
      type: 'resource_page',
      target_domain: r.target_domain,
      target_url: r.target_url,
      domain_authority: da,
      relevance_score: relevance,
      ease_score: ease,
      priority: computePriority(da, relevance, ease),
      outreach_template: template.template,
      strategy_notes: `Resource page "${r.title}". ${template.notes}`,
    })
  }

  // Guest post angles (each angle = an abstract opportunity)
  for (const angle of guestPostAngles) {
    const da = 45 // assumed mid-DA target publication
    const relevance = 0.75
    const easeMap: Record<string, number> = {
      easy: 0.7,
      moderate: 0.5,
      hard: 0.3,
    }
    const ease = easeMap[String(angle.ease || 'moderate').toLowerCase()] || 0.5
    const template = await generateOutreachTemplate(
      ai,
      {
        type: 'guest_post',
        target_domain: angle.target_publication_type || 'industry publication',
        target_url: undefined,
        client_name: client.name || '',
        client_website: clientWebsite,
        client_industry: industry,
        context: `Pitch idea: "${angle.angle_title}". Hook: ${angle.hook || ''}`,
      },
      agency_id
    )
    opportunities.push({
      type: 'guest_post',
      target_domain: angle.target_publication_type || 'industry_publication',
      target_url: undefined,
      domain_authority: da,
      relevance_score: relevance,
      ease_score: ease,
      priority: computePriority(da, relevance, ease),
      outreach_template: template.template,
      strategy_notes: `Guest post pitch: "${angle.angle_title}" — ${template.notes}`,
    })
  }

  // ── 11. Rank opportunities ────────────────────────────────────────────
  opportunities.sort((a, b) => {
    const score = (o: Opportunity) =>
      o.domain_authority * 0.45 + o.relevance_score * 100 * 0.35 + o.ease_score * 100 * 0.2
    return score(b) - score(a)
  })

  // ── 12. Quick wins and long-term plays ────────────────────────────────
  const quick_wins = opportunities
    .filter((o) => o.ease_score >= 0.7 && o.priority !== 'low')
    .slice(0, 10)
  const long_term_plays = opportunities
    .filter((o) => o.priority === 'high' && o.ease_score < 0.6)
    .slice(0, 10)

  const total_estimated_da_gain = opportunities.reduce(
    (sum, o) =>
      sum +
      Math.round(
        o.domain_authority * o.relevance_score * o.ease_score * 0.15
      ),
    0
  )

  // ── 13. Persist opportunities (replace old set) ──────────────────────
  await s
    .from('kotoiq_backlink_opportunities')
    .delete()
    .eq('client_id', client_id)

  if (opportunities.length > 0) {
    const rows = opportunities.map((o) => ({
      client_id,
      opportunity_type: o.type,
      target_domain: o.target_domain,
      target_url: o.target_url || null,
      domain_authority: o.domain_authority,
      relevance_score: o.relevance_score,
      ease_score: o.ease_score,
      priority: o.priority,
      outreach_template: o.outreach_template,
      strategy_notes: o.strategy_notes,
      status: 'open',
    }))
    await s.from('kotoiq_backlink_opportunities').insert(rows)
  }

  return {
    opportunities,
    total_estimated_da_gain,
    quick_wins,
    long_term_plays,
  }
}

// ── Get Opportunities ──────────────────────────────────────────────────────
export async function getBacklinkOpportunities(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data } = await s
    .from('kotoiq_backlink_opportunities')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })

  return data || []
}
