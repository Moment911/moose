// ─────────────────────────────────────────────────────────────
// Backlink Intelligence Engine — Feature #5
// Moz API v2 integration, backlink analysis, competitor comparison
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

const MOZ_BASE = 'https://lsapi.seomoz.com/v2'

function getMozAuth(): string {
  return process.env.MOZ_API_KEY || ''
}

function extractDomain(website: string): string {
  if (!website) return ''
  try {
    const w = website.startsWith('http') ? website : `https://${website}`
    return new URL(w).hostname.replace(/^www\./, '')
  } catch { return website.replace(/^www\./, '') }
}

async function mozPost(endpoint: string, body: any): Promise<any> {
  const auth = getMozAuth()
  if (!auth) throw new Error('MOZ_API_KEY not configured')

  const res = await fetch(`${MOZ_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
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

// ── Analyze Backlinks ───────────────────────────────────────────────────────
export async function analyzeBacklinks(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  // Get client website
  const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).single()
  if (!client?.website) throw new Error('Client not found or missing website')

  const domain = extractDomain(client.website)

  // 1. Fetch URL metrics (DA, PA, spam score)
  const urlMetrics = await mozPost('/url_metrics', {
    targets: [domain],
  })
  const metrics = urlMetrics?.results?.[0] || {}
  const domain_authority = metrics.domain_authority || 0
  const page_authority = metrics.page_authority || 0
  const spam_score = metrics.spam_score || 0
  const total_referring_domains = metrics.root_domains_to_root_domain || 0
  const total_backlinks_from_api = metrics.external_pages_to_root_domain || 0

  // 2. Fetch backlink data
  let links: any[] = []
  try {
    const linksRes = await mozPost('/links', {
      target: domain,
      target_type: 'root_domain',
      limit: 500,
      link_columns: ['source_domain', 'source_page', 'anchor_text', 'domain_authority'],
      source_columns: ['domain_authority', 'page_authority', 'spam_score'],
    })
    links = linksRes?.results || []
  } catch {
    // Links endpoint may fail on free plans — proceed with what we have
  }

  // 3. Build DR distribution bins (0-10, 11-20, ..., 91-100)
  const dr_distribution: Record<string, number> = {}
  for (let i = 0; i < 10; i++) {
    const label = `${i * 10}-${i * 10 + 10}`
    dr_distribution[label] = 0
  }
  for (const link of links) {
    const da = link.source_domain_authority || link.domain_authority || 0
    const bin = Math.min(Math.floor(da / 10), 9)
    const label = `${bin * 10}-${bin * 10 + 10}`
    dr_distribution[label] = (dr_distribution[label] || 0) + 1
  }

  // 4. Classify anchor types
  const anchorCounts: Record<string, number> = { exact_match: 0, partial_match: 0, branded: 0, naked_url: 0, generic: 0 }
  const anchorMap = new Map<string, number>()
  const brandTerms = (client.name || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)

  for (const link of links) {
    const anchor = (link.anchor_text || '').trim()
    const anchorLc = anchor.toLowerCase()
    if (!anchor || anchor === '') {
      anchorCounts.generic++
    } else if (/^https?:\/\//.test(anchor) || /^www\./.test(anchor)) {
      anchorCounts.naked_url++
    } else if (brandTerms.some((t: string) => anchorLc.includes(t))) {
      anchorCounts.branded++
    } else if (anchorLc.includes(domain.split('.')[0])) {
      anchorCounts.branded++
    } else if (/^(click here|read more|learn more|visit|website|here|this|link|source)$/i.test(anchor)) {
      anchorCounts.generic++
    } else {
      // Could be exact or partial keyword match — classify as partial
      anchorCounts.partial_match++
    }

    // Track individual anchors
    anchorMap.set(anchor || '(empty)', (anchorMap.get(anchor || '(empty)') || 0) + 1)
  }

  const anchor_distribution = anchorCounts
  const top_anchors = [...anchorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([anchor, count]) => ({ anchor, count }))

  // 5. Identify toxic links (spam_score > 7)
  const toxic_links = links
    .filter(l => (l.source_spam_score || l.spam_score || 0) > 7)
    .slice(0, 30)
    .map(l => ({
      source_domain: l.source_domain || '',
      source_page: l.source_page || '',
      spam_score: l.source_spam_score || l.spam_score || 0,
      anchor_text: l.anchor_text || '',
      da: l.source_domain_authority || l.domain_authority || 0,
    }))

  // 6. Identify high-quality links (DA > 50)
  const high_quality_links = links
    .filter(l => (l.source_domain_authority || l.domain_authority || 0) > 50)
    .slice(0, 30)
    .map(l => ({
      source_domain: l.source_domain || '',
      source_page: l.source_page || '',
      da: l.source_domain_authority || l.domain_authority || 0,
      anchor_text: l.anchor_text || '',
    }))

  // 7. Count .edu/.gov links
  const edu_gov_links = links.filter(l => {
    const sd = (l.source_domain || '').toLowerCase()
    return sd.endsWith('.edu') || sd.endsWith('.gov')
  }).length

  // 8. Estimate TrustRank
  const highDACount = links.filter(l => (l.source_domain_authority || l.domain_authority || 0) > 40).length
  const trust_rank_estimate = links.length > 0
    ? Math.round(((highDACount / links.length) * 70 + (edu_gov_links > 0 ? 15 : 0) + Math.min(domain_authority, 15)) * 100) / 100
    : domain_authority * 0.8

  // 9. Competitor backlink comparison
  let competitor_comparison: any[] = []
  try {
    const { data: compKeywords } = await s.from('kotoiq_keywords')
      .select('competitor_domains')
      .eq('client_id', client_id)
      .not('competitor_domains', 'is', null)
      .limit(50)

    const compDomainsSet = new Set<string>()
    for (const row of compKeywords || []) {
      const domains = row.competitor_domains
      if (Array.isArray(domains)) {
        domains.forEach((d: string) => compDomainsSet.add(d))
      }
    }

    const topCompetitors = [...compDomainsSet].slice(0, 5)
    for (const compDomain of topCompetitors) {
      try {
        const compMetrics = await mozPost('/url_metrics', { targets: [compDomain] })
        const cm = compMetrics?.results?.[0] || {}
        competitor_comparison.push({
          domain: compDomain,
          domain_authority: cm.domain_authority || 0,
          referring_domains: cm.root_domains_to_root_domain || 0,
          total_backlinks: cm.external_pages_to_root_domain || 0,
          spam_score: cm.spam_score || 0,
        })
      } catch { /* skip failed competitor */ }
    }
  } catch { /* no competitor data available */ }

  // 10. Use Claude for link building opportunities
  let unlinked_mentions: any[] = []
  let broken_link_opportunities: any[] = []
  let competitor_common_links: any[] = []

  try {
    const prompt = `You are a backlink strategist. Analyze this backlink profile and generate link building recommendations.

Domain: ${domain}
Industry: ${client.primary_service || 'Unknown'}
Domain Authority: ${domain_authority}
Total Referring Domains: ${total_referring_domains}
Total Backlinks: ${total_backlinks_from_api}
Spam Score: ${spam_score}%
Edu/Gov Links: ${edu_gov_links}
Toxic Links: ${toxic_links.length}
High Quality Links (DA>50): ${high_quality_links.length}

Top Anchors: ${top_anchors.slice(0, 10).map(a => `"${a.anchor}" (${a.count})`).join(', ')}

Anchor Distribution: Branded=${anchorCounts.branded}, Partial=${anchorCounts.partial_match}, Naked URL=${anchorCounts.naked_url}, Generic=${anchorCounts.generic}

Competitors: ${competitor_comparison.map(c => `${c.domain} (DA:${c.domain_authority}, RD:${c.referring_domains})`).join(', ') || 'None analyzed'}

Return JSON:
{
  "unlinked_mentions": [
    { "opportunity": "description of where brand is mentioned without a link", "source_type": "directory|press|blog|forum", "priority": "high|medium|low" }
  ],
  "broken_link_opportunities": [
    { "strategy": "specific broken link building tactic", "target_type": "resource|blog|directory", "priority": "high|medium|low" }
  ],
  "competitor_common_links": [
    { "opportunity": "site/type that links to competitors but not to this domain", "source_type": "directory|association|publication", "priority": "high|medium|low" }
  ],
  "recommendations": [
    { "action": "specific link building task", "impact": "high|medium|low", "effort": "easy|moderate|hard", "timeline": "1-4 weeks" }
  ],
  "health_assessment": "1-2 sentence summary of backlink profile health"
}

Generate 3-5 items per array. Return ONLY valid JSON, no markdown.`

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_backlinks',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    unlinked_mentions = parsed.unlinked_mentions || []
    broken_link_opportunities = parsed.broken_link_opportunities || []
    competitor_common_links = parsed.competitor_common_links || []
  } catch { /* non-fatal */ }

  // 11. Calculate overall score (0-100)
  const daScore = Math.min(domain_authority, 30) // up to 30 pts
  const rdScore = Math.min((total_referring_domains / 100) * 20, 20) // up to 20 pts
  const qualityScore = links.length > 0 ? Math.min((high_quality_links.length / links.length) * 40, 20) : 10 // up to 20 pts
  const toxicPenalty = links.length > 0 ? Math.min((toxic_links.length / links.length) * 30, 15) : 0 // penalty up to 15
  const eduGovBonus = edu_gov_links > 0 ? Math.min(edu_gov_links * 2, 10) : 0 // up to 10 pts
  const anchorDiversity = Object.values(anchorCounts).filter(v => v > 0).length >= 3 ? 5 : 0 // 5 pts for diversity
  const spamPenalty = spam_score > 5 ? Math.min(spam_score, 15) : 0

  const overall_score = Math.max(0, Math.min(100,
    Math.round(daScore + rdScore + qualityScore + eduGovBonus + anchorDiversity - toxicPenalty - spamPenalty)
  ))

  // Save to DB
  const row = {
    client_id,
    agency_id: agency_id || null,
    total_backlinks: total_backlinks_from_api || links.length,
    total_referring_domains: total_referring_domains,
    domain_authority,
    spam_score,
    dr_distribution,
    anchor_distribution,
    top_anchors,
    toxic_links,
    high_quality_links,
    edu_gov_links,
    trust_rank_estimate,
    unlinked_mentions,
    competitor_common_links,
    broken_link_opportunities,
    competitor_comparison,
    overall_score,
    updated_at: new Date().toISOString(),
  }

  // Upsert
  const { data: existing } = await s.from('kotoiq_backlink_profile').select('id').eq('client_id', client_id).limit(1)
  if (existing?.length) {
    await s.from('kotoiq_backlink_profile').update(row).eq('id', existing[0].id)
  } else {
    await s.from('kotoiq_backlink_profile').insert(row)
  }

  return row
}

// ── Get Backlink Profile ────────────────────────────────────────────────────
export async function getBacklinkProfile(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data } = await s.from('kotoiq_backlink_profile')
    .select('*')
    .eq('client_id', client_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return data || null
}
