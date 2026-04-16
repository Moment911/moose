// ─────────────────────────────────────────────────────────────
// Topical Map Engine — KotoIQ Semantic SEO Knowledge Base
//
// Standalone module for generating, retrieving, updating,
// and analyzing topical maps for KotoIQ clients.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'
import { getSitemapUrls, getLatestCrawl } from '@/lib/sitemapCrawler'

type SB = any
type AI = import('@anthropic-ai/sdk').default

// ── Helpers ────────────────────────────────────────────────────

function cleanJSON(raw: string): string {
  return raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
}

async function fetchPage(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return ''
    return await r.text()
  } catch { return '' }
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1])
}

function extractPageTitles(html: string): string[] {
  return [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
}

function extractH1H2(html: string): string[] {
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
  return [...h1s, ...h2s]
}

// ── Generate Topical Map ──────────────────────────────────────

export async function generateTopicalMap(s: SB, ai: AI, body: any) {
  const { client_id, agency_id } = body
  if (!client_id || !agency_id) {
    return { error: 'client_id and agency_id required', status: 400 }
  }

  // url_limit body param — default 500, max 10,000
  const urlLimit = Math.min(Math.max(parseInt(body.url_limit) || 500, 1), 10000)

  // 1. Get client info
  const { data: client, error: clientErr } = await s
    .from('clients')
    .select('id, name, website, primary_service, target_customer, industry, welcome_statement, unique_selling_prop, onboarding_answers')
    .eq('id', client_id)
    .single()

  if (clientErr || !client) {
    return { error: 'Client not found', status: 404 }
  }

  // 2. Get existing keywords
  const { data: existingKws } = await s
    .from('kotoiq_keywords')
    .select('keyword, fingerprint, intent, kp_monthly_volume, sc_avg_position, sc_top_page, category, opportunity_score')
    .eq('client_id', client_id)

  const keywords = existingKws || []

  // 3. Fetch website content + sitemap
  let normalizedUrl = (client.website || '').trim()
  if (!normalizedUrl) {
    return { error: 'Client has no website configured', status: 400 }
  }
  if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl
  const origin = new URL(normalizedUrl).origin

  // Try cached sitemap URLs first (prioritize high priority + recent lastmod)
  let sitemapUrls: string[] = []
  try {
    const latestCrawl = await getLatestCrawl(s, client_id).catch(() => null)
    if (latestCrawl?.status === 'complete' && (latestCrawl.urls_saved || 0) > 0) {
      // Pull two sets — high priority for topical core + recently-modified for freshness —
      // then intelligently merge.
      const byPriority = await getSitemapUrls(s, { client_id, limit: Math.ceil(urlLimit * 0.6), orderBy: 'priority' })
      const byLastmod = await getSitemapUrls(s, { client_id, limit: Math.ceil(urlLimit * 0.6), orderBy: 'lastmod' })
      const seen = new Set<string>()
      for (const row of [...(byPriority.urls || []), ...(byLastmod.urls || [])]) {
        if (seen.size >= urlLimit) break
        if (row?.url && !seen.has(row.url)) {
          seen.add(row.url)
        }
      }
      sitemapUrls = Array.from(seen)
    }
  } catch { /* fall through */ }

  const pageHtml = await fetchPage(normalizedUrl)

  // Fallback: fetch sitemap XML inline (legacy behavior)
  if (sitemapUrls.length === 0) {
    let sitemapXml = ''
    for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
      const xml = await fetchPage(`${origin}${path}`)
      if (xml && xml.includes('<loc>')) { sitemapXml = xml; break }
    }
    let fallbackUrls = extractSitemapUrls(sitemapXml)
    // If sitemap_index, fetch child sitemaps
    if (sitemapXml.includes('<sitemapindex')) {
      const childUrls = fallbackUrls.slice(0, 5)
      const childResults = await Promise.all(childUrls.map(u => fetchPage(u)))
      const allPageUrls: string[] = []
      for (const child of childResults) {
        allPageUrls.push(...extractSitemapUrls(child))
      }
      fallbackUrls = [...new Set(allPageUrls)]
    }
    sitemapUrls = fallbackUrls.slice(0, urlLimit)
  }

  const pageText = extractText(pageHtml).slice(0, 6000)
  const headings = extractH1H2(pageHtml)
  const titles = extractPageTitles(pageHtml)

  const sitemapPaths = sitemapUrls.map(u => { try { return new URL(u).pathname } catch { return u } }).filter(p => p !== '/')

  // 4. Fetch content from top pages for deeper context
  const topPages = sitemapUrls.slice(0, 8).filter(u => u !== normalizedUrl)
  const topPageContents = await Promise.all(
    topPages.map(async (url) => {
      const html = await fetchPage(url)
      const text = extractText(html).slice(0, 1500)
      const h = extractH1H2(html)
      return { url, text: text.slice(0, 800), headings: h.slice(0, 5) }
    })
  )

  // 5. Build the massive prompt
  const onboardingData = client.onboarding_answers || {}
  const bizContext = [
    client.primary_service && `Primary Service: ${client.primary_service}`,
    client.target_customer && `Target Customer: ${client.target_customer}`,
    client.industry && `Industry: ${client.industry}`,
    client.unique_selling_prop && `USP: ${client.unique_selling_prop}`,
    client.welcome_statement && `Brand Statement: ${client.welcome_statement}`,
    onboardingData.products_services && `Products/Services: ${onboardingData.products_services}`,
    onboardingData.ideal_customer_desc && `Ideal Customer: ${onboardingData.ideal_customer_desc}`,
    onboardingData.why_choose_you && `Why Choose Them: ${onboardingData.why_choose_you}`,
  ].filter(Boolean).join('\n')

  const kwContext = keywords.length > 0
    ? `\nEXISTING TRACKED KEYWORDS (${keywords.length}):\n${keywords.slice(0, 80).map((k: any) => `- "${k.keyword}" [${k.intent}] vol:${k.kp_monthly_volume || '?'} pos:${k.sc_avg_position ? '#' + Math.round(k.sc_avg_position) : 'unranked'} cat:${k.category}`).join('\n')}`
    : '\nNo existing keywords tracked yet.'

  const pagesContext = topPageContents.length > 0
    ? `\nEXISTING SITE PAGES (sample of ${sitemapPaths.length} total):\n${topPageContents.map(p => `URL: ${p.url}\nHeadings: ${p.headings.join(' | ')}\nContent: ${p.text.slice(0, 400)}`).join('\n---\n')}`
    : ''

  const topicalMapPrompt = `You are KotoIQ's Semantic SEO brain. Your task is to build a complete topical map for this business using advanced semantic SEO methodology.

═══════════════════════════════════════════════════
BUSINESS CONTEXT
═══════════════════════════════════════════════════
Business Name: ${client.name}
Website: ${normalizedUrl}
${bizContext}

═══════════════════════════════════════════════════
HOMEPAGE CONTENT
═══════════════════════════════════════════════════
Headings: ${headings.slice(0, 10).join(' | ')}
Title: ${titles[0] || 'Unknown'}
Content (first 4000 chars):
${pageText.slice(0, 4000)}

═══════════════════════════════════════════════════
SITE STRUCTURE (${sitemapPaths.length} pages found)
═══════════════════════════════════════════════════
${sitemapPaths.slice(0, 60).join('\n')}
${pagesContext}
${kwContext}

═══════════════════════════════════════════════════
TOPICAL MAP FRAMEWORK — KOTOIQ SEMANTIC SEO METHOD
═══════════════════════════════════════════════════

Follow these steps precisely:

**STEP 1 — IDENTIFY THE CENTRAL ENTITY**
The Central Entity is the MAIN THING this business fundamentally IS or DOES. Not a keyword — an entity. It represents the core of the business's expertise and knowledge domain. For a plumber, the central entity is "Plumbing". For a personal injury law firm, it's "Personal Injury Law". For a SaaS analytics company, it's "Web Analytics". Identify the single most accurate central entity for this business.

**STEP 2 — DEFINE THE SOURCE CONTEXT**
The Source Context is HOW the brand monetizes or utilizes the central entity. It creates the lens through which the central entity is viewed. A plumbing company's source context might be "Residential plumbing service and repair in [City]". A law firm's might be "Client representation for personal injury claims". The source context defines the commercial angle.

**STEP 3 — DERIVE THE CENTRAL SEARCH INTENT**
The Central Search Intent unifies the entity and its source context into one search purpose. It's the overarching intent that ties every piece of content together. Example: "Finding and hiring a reliable residential plumber in [City]". This becomes the gravitational center of the topical map.

**STEP 4 — MAP CORE SECTION NODES (15-25 nodes)**
Core Section nodes are DIRECTLY related to monetization — the services, products, processes, and commercial offerings. Each Core node should be:
- A specific entity related to revenue generation
- Something a potential customer would search for
- Connected to the central search intent
Examples for a plumber: "Drain Cleaning", "Water Heater Installation", "Emergency Plumbing", "Pipe Repair", "Bathroom Remodeling"

**STEP 5 — MAP OUTER SECTION NODES (10-20 nodes)**
Outer Section nodes build TOPICAL AUTHORITY — broader concepts that demonstrate expertise without being directly commercial. They create the semantic breadth that search engines use to evaluate domain expertise.
Examples for a plumber: "Water Conservation", "Plumbing Code Compliance", "Pipe Material Guide", "Water Quality Testing", "Home Maintenance Schedules"

**STEP 6 — DEFINE EDGES (CONTEXTUAL BRIDGES)**
For each node, define how it connects to other nodes. Contextual bridges are the semantic relationships that help search engines understand the topical map. Types of edges:
- parent_child: hierarchical (Service Hub → Specific Service)
- sibling: same level, related topics
- contextual_bridge: semantic connection across sections
- supports: informational content supporting commercial content

**STEP 7 — ASSIGN CONTENT TYPES**
Each node needs a content_type:
- pillar: Comprehensive hub page (2000-4000 words) — anchors the topic cluster
- cluster: Detailed subtopic page (1200-2000 words) — targets specific queries
- support: Supporting content (800-1200 words) — answers specific questions, builds depth
- faq: FAQ page targeting People Also Ask queries
- comparison: "X vs Y" or "Best X" comparative content

**STEP 8 — ENTITY-ATTRIBUTE PAIRS**
For each node, define 3-6 entity-attribute pairs. These are the specific attributes that search engines associate with the entity. For "Drain Cleaning": [["Drain Cleaning", "methods"], ["Drain Cleaning", "cost"], ["Drain Cleaning", "frequency"], ["Drain Cleaning", "signs needed"]]. These guide on-page content structure.

Return ONLY valid JSON with this exact structure:
{
  "central_entity": "The core entity (2-4 words)",
  "source_context": "How the brand monetizes (1-2 sentences)",
  "central_search_intent": "The unified search purpose (1 sentence)",
  "core_nodes": [
    {
      "entity": "Specific entity name",
      "entity_type": "service|product|process|location|attribute",
      "attributes": [["entity", "attribute1"], ["entity", "attribute2"], ["entity", "attribute3"]],
      "priority": 1-10,
      "content_type": "pillar|cluster|support|faq|comparison",
      "macro_context": "How this entity relates to the central search intent (1 sentence)",
      "micro_contexts": ["specific search query 1", "specific search query 2", "specific search query 3"],
      "contextual_bridges": ["related entity 1", "related entity 2"],
      "suggested_title": "SEO-optimized page title",
      "suggested_url": "/url-slug/",
      "estimated_search_volume": "high|medium|low"
    }
  ],
  "outer_nodes": [
    {
      "entity": "Broader authority topic",
      "entity_type": "concept|guide|resource|comparison",
      "attributes": [["entity", "attribute1"], ["entity", "attribute2"]],
      "priority": 1-10,
      "content_type": "pillar|cluster|support|faq|comparison",
      "macro_context": "How this builds topical authority (1 sentence)",
      "micro_contexts": ["search query 1", "search query 2"],
      "contextual_bridges": ["connected core entity 1", "connected core entity 2"],
      "suggested_title": "Page title",
      "suggested_url": "/url-slug/",
      "estimated_search_volume": "high|medium|low"
    }
  ],
  "edges": [
    {
      "from_entity": "source entity name",
      "to_entity": "target entity name",
      "edge_type": "parent_child|sibling|contextual_bridge|supports",
      "anchor_text": "suggested internal link text",
      "weight": 1-10
    }
  ]
}`

  // 6. Call Claude
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: 'You are KotoIQ\'s Semantic SEO intelligence engine. Build topical maps using advanced semantic methodology. Return ONLY valid JSON. No markdown, no commentary.',
    messages: [{ role: 'user', content: topicalMapPrompt }],
  })

  void logTokenUsage({
    feature: 'kotoiq_topical_map',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agency_id,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  let mapData: any
  try {
    mapData = JSON.parse(cleanJSON(raw))
  } catch {
    return { error: 'Failed to parse topical map from AI response', status: 500 }
  }

  // 7. Cross-reference existing content to determine node statuses
  const existingUrls = new Set(sitemapPaths.map(p => p.toLowerCase().replace(/\/$/, '')))
  const existingKwSet = new Set<string>(keywords.map((k: any) => k.keyword.toLowerCase()))

  function determineNodeStatus(node: any): 'covered' | 'partial' | 'gap' {
    const suggestedUrl = (node.suggested_url || '').toLowerCase().replace(/\/$/, '')
    const entityLower = (node.entity || '').toLowerCase()

    // Check if any existing URL closely matches
    const urlMatch = existingUrls.has(suggestedUrl) || [...existingUrls].some(u =>
      u.includes(entityLower.replace(/\s+/g, '-')) || entityLower.split(' ').every((w: string) => u.includes(w))
    )

    // Check if any existing keywords match the entity
    const kwMatch = existingKwSet.has(entityLower) || [...existingKwSet].some((k: string) =>
      k.includes(entityLower) || entityLower.includes(k)
    )

    // Check micro_contexts against existing keywords
    const microMatches = (node.micro_contexts || []).filter((mc: string) =>
      existingKwSet.has(mc.toLowerCase()) || [...existingKwSet].some((k: string) => k.includes(mc.toLowerCase()) || mc.toLowerCase().includes(k))
    ).length

    if (urlMatch && (kwMatch || microMatches >= 2)) return 'covered'
    if (urlMatch || kwMatch || microMatches >= 1) return 'partial'
    return 'gap'
  }

  // Find matching URL and search volume from existing keywords
  function findExistingUrl(node: any): string | null {
    const entityLower = (node.entity || '').toLowerCase()
    for (const p of sitemapPaths) {
      const pl = p.toLowerCase().replace(/\/$/, '')
      if (pl.includes(entityLower.replace(/\s+/g, '-')) || entityLower.split(' ').every((w: string) => pl.includes(w))) {
        return p
      }
    }
    return null
  }

  function findSearchVolume(node: any): number | null {
    const entityLower = (node.entity || '').toLowerCase()
    const match = keywords.find((k: any) => k.keyword.toLowerCase() === entityLower || k.keyword.toLowerCase().includes(entityLower))
    return match ? (match as any).kp_monthly_volume : null
  }

  // 8. Delete old map data for this client
  const { data: existingMap } = await s
    .from('kotoiq_topical_maps')
    .select('id')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingMap) {
    await s.from('kotoiq_topical_edges').delete().eq('map_id', existingMap.id)
    await s.from('kotoiq_topical_nodes').delete().eq('map_id', existingMap.id)
    await s.from('kotoiq_topical_maps').delete().eq('id', existingMap.id)
  }

  // 9. Save map
  const allNodes = [
    ...(mapData.core_nodes || []).map((n: any) => ({ ...n, section: 'core' })),
    ...(mapData.outer_nodes || []).map((n: any) => ({ ...n, section: 'outer' })),
  ]

  const coveredCount = allNodes.filter((n: any) => determineNodeStatus(n) === 'covered').length
  const partialCount = allNodes.filter((n: any) => determineNodeStatus(n) === 'partial').length
  const totalNodes = allNodes.length
  const coverageScore = totalNodes > 0 ? Math.round((coveredCount + partialCount * 0.5) / totalNodes * 100) : 0

  // Vastness = breadth of topic coverage (number of unique entities)
  const vastness = Math.min(100, Math.round(totalNodes / 40 * 100))

  // Depth = average number of micro_contexts + attributes per node
  const avgDepth = totalNodes > 0
    ? allNodes.reduce((sum: number, n: any) => sum + (n.micro_contexts?.length || 0) + (n.attributes?.length || 0), 0) / totalNodes
    : 0
  const depth = Math.min(100, Math.round(avgDepth / 8 * 100))

  // Momentum = % of core nodes that are covered or partial
  const coreNodes = allNodes.filter((n: any) => n.section === 'core')
  const coreCovered = coreNodes.filter((n: any) => determineNodeStatus(n) !== 'gap').length
  const momentum = coreNodes.length > 0 ? Math.round(coreCovered / coreNodes.length * 100) : 0

  const { data: mapRow, error: mapErr } = await s.from('kotoiq_topical_maps').insert({
    client_id,
    agency_id,
    central_entity: mapData.central_entity || '',
    source_context: mapData.source_context || '',
    central_search_intent: mapData.central_search_intent || '',
    topical_coverage_score: coverageScore,
    vastness_score: vastness,
    depth_score: depth,
    momentum_score: momentum,
    total_nodes: totalNodes,
    covered_nodes: coveredCount,
  }).select().single()

  if (mapErr || !mapRow) {
    return { error: 'Failed to save topical map: ' + (mapErr?.message || 'unknown'), status: 500 }
  }

  // 10. Save nodes
  const nodeRecords = allNodes.map((n: any) => {
    const status = determineNodeStatus(n)
    const existingUrl = findExistingUrl(n)
    const searchVol = findSearchVolume(n)
    return {
      map_id: mapRow.id,
      client_id,
      entity: n.entity,
      entity_type: n.entity_type || 'concept',
      section: n.section,
      attributes: n.attributes || [],
      status,
      priority: n.priority || 5,
      search_volume: searchVol || (n.estimated_search_volume === 'high' ? 1000 : n.estimated_search_volume === 'medium' ? 300 : 100),
      content_type: n.content_type || 'cluster',
      macro_context: n.macro_context || '',
      micro_contexts: n.micro_contexts || [],
      contextual_bridges: n.contextual_bridges || [],
      suggested_title: n.suggested_title || '',
      suggested_url: n.suggested_url || '',
      existing_url: existingUrl,
    }
  })

  const { data: insertedNodes, error: nodeErr } = await s
    .from('kotoiq_topical_nodes')
    .insert(nodeRecords)
    .select('id, entity')

  if (nodeErr) {
    return { error: 'Failed to save nodes: ' + nodeErr.message, status: 500 }
  }

  // 11. Save edges — map entity names to node IDs
  const nodeIdMap = new Map<string, string>()
  for (const n of (insertedNodes || [])) {
    nodeIdMap.set(n.entity.toLowerCase(), n.id)
  }

  const edgeRecords: any[] = []
  for (const e of (mapData.edges || [])) {
    const fromId = nodeIdMap.get((e.from_entity || '').toLowerCase())
    const toId = nodeIdMap.get((e.to_entity || '').toLowerCase())
    if (fromId && toId) {
      edgeRecords.push({
        map_id: mapRow.id,
        from_node_id: fromId,
        to_node_id: toId,
        edge_type: e.edge_type || 'contextual_bridge',
        anchor_text: e.anchor_text || '',
        weight: e.weight || 5,
        exists_in_content: false,
      })
    }
  }

  if (edgeRecords.length > 0) {
    await s.from('kotoiq_topical_edges').insert(edgeRecords)
  }

  return {
    success: true,
    map: {
      id: mapRow.id,
      central_entity: mapData.central_entity,
      source_context: mapData.source_context,
      central_search_intent: mapData.central_search_intent,
      coverage_score: coverageScore,
      vastness: vastness,
      depth: depth,
      momentum: momentum,
      total_nodes: totalNodes,
      covered_nodes: coveredCount,
      partial_nodes: partialCount,
      gap_nodes_count: totalNodes - coveredCount - partialCount,
      core_nodes: nodeRecords.filter(n => n.section === 'core'),
      outer_nodes: nodeRecords.filter(n => n.section === 'outer'),
      edges: edgeRecords,
    },
  }
}

// ── Get Topical Map ───────────────────────────────────────────

export async function getTopicalMap(s: SB, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  // Get latest map
  const { data: mapRow } = await s
    .from('kotoiq_topical_maps')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!mapRow) {
    return { map: null, message: 'No topical map generated yet' }
  }

  // Get all nodes
  const { data: nodes } = await s
    .from('kotoiq_topical_nodes')
    .select('*')
    .eq('map_id', mapRow.id)
    .order('priority', { ascending: true })

  // Get all edges
  const { data: edges } = await s
    .from('kotoiq_topical_edges')
    .select('*')
    .eq('map_id', mapRow.id)

  const allNodes: any[] = nodes || []
  const coreNodes = allNodes.filter((n: any) => n.section === 'core')
  const outerNodes = allNodes.filter((n: any) => n.section === 'outer')

  return {
    map: {
      ...mapRow,
      core_nodes: coreNodes,
      outer_nodes: outerNodes,
      edges: edges || [],
      stats: {
        total: allNodes.length,
        covered: allNodes.filter((n: any) => n.status === 'covered').length,
        partial: allNodes.filter((n: any) => n.status === 'partial').length,
        gap: allNodes.filter((n: any) => n.status === 'gap').length,
        core_count: coreNodes.length,
        outer_count: outerNodes.length,
      },
    },
  }
}

// ── Update Topical Node ───────────────────────────────────────

export async function updateTopicalNode(s: SB, body: any) {
  const { node_id, ...updates } = body
  if (!node_id) return { error: 'node_id required', status: 400 }

  // Only allow updating specific fields
  const allowedFields = ['status', 'existing_url', 'priority', 'content_type', 'suggested_title', 'suggested_url', 'search_volume']
  const cleanUpdates: any = {}
  for (const key of allowedFields) {
    if (updates[key] !== undefined) cleanUpdates[key] = updates[key]
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return { error: 'No valid fields to update', status: 400 }
  }

  cleanUpdates.updated_at = new Date().toISOString()

  const { data, error } = await s
    .from('kotoiq_topical_nodes')
    .update(cleanUpdates)
    .eq('id', node_id)
    .select()
    .single()

  if (error) return { error: error.message, status: 500 }

  // Recalculate map scores if status changed
  if (cleanUpdates.status && data) {
    await recalculateMapScores(s, data.map_id)
  }

  return { success: true, node: data }
}

// ── Recalculate Map Scores ────────────────────────────────────

async function recalculateMapScores(s: SB, mapId: string) {
  const { data: nodes } = await s
    .from('kotoiq_topical_nodes')
    .select('section, status')
    .eq('map_id', mapId)

  if (!nodes || nodes.length === 0) return

  const total = nodes.length
  const covered = nodes.filter((n: any) => n.status === 'covered').length
  const partial = nodes.filter((n: any) => n.status === 'partial').length
  const gap = nodes.filter((n: any) => n.status === 'gap').length

  const coverageScore = Math.round((covered + partial * 0.5) / total * 100)

  const coreNodes = nodes.filter((n: any) => n.section === 'core')
  const coreCovered = coreNodes.filter((n: any) => n.status !== 'gap').length
  const momentum = coreNodes.length > 0 ? Math.round(coreCovered / coreNodes.length * 100) : 0

  await s.from('kotoiq_topical_maps').update({
    topical_coverage_score: coverageScore,
    momentum_score: momentum,
    total_nodes: total,
    covered_nodes: covered,
  }).eq('id', mapId)
}

// ── Analyze Topical Coverage ──────────────────────────────────

export async function analyzeTopicalCoverage(s: SB, ai: AI, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  // Get the existing map
  const { data: mapRow } = await s
    .from('kotoiq_topical_maps')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!mapRow) {
    return { error: 'No topical map found. Generate one first.', status: 400 }
  }

  // Get all nodes
  const { data: nodes } = await s
    .from('kotoiq_topical_nodes')
    .select('*')
    .eq('map_id', mapRow.id)

  if (!nodes || nodes.length === 0) {
    return { error: 'No nodes in topical map', status: 400 }
  }

  // Get client info for URL
  const { data: client } = await s
    .from('clients')
    .select('website')
    .eq('id', client_id)
    .single()

  if (!client?.website) {
    return { error: 'Client has no website', status: 400 }
  }

  let normalizedUrl = client.website.trim()
  if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl
  const origin = new URL(normalizedUrl).origin

  // url_limit body param — default 500, max 10,000
  const coverageUrlLimit = Math.min(Math.max(parseInt(body.url_limit) || 500, 1), 10000)

  // Prefer cached sitemap URLs
  let sitemapUrls: string[] = []
  try {
    const latestCrawl = await getLatestCrawl(s, client_id).catch(() => null)
    if (latestCrawl?.status === 'complete' && (latestCrawl.urls_saved || 0) > 0) {
      const result = await getSitemapUrls(s, { client_id, limit: coverageUrlLimit, orderBy: 'priority' })
      sitemapUrls = (result.urls || []).map((u: any) => u.url).filter(Boolean)
    }
  } catch { /* fall through */ }

  // Fallback: crawl sitemap inline
  if (sitemapUrls.length === 0) {
    for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
      const xml = await fetchPage(`${origin}${path}`)
      if (xml && xml.includes('<loc>')) {
        if (xml.includes('<sitemapindex')) {
          const childUrls = extractSitemapUrls(xml).slice(0, 5)
          const childResults = await Promise.all(childUrls.map(u => fetchPage(u)))
          for (const child of childResults) {
            sitemapUrls.push(...extractSitemapUrls(child))
          }
        } else {
          sitemapUrls = extractSitemapUrls(xml)
        }
        break
      }
    }
    sitemapUrls = [...new Set(sitemapUrls)].slice(0, coverageUrlLimit)
  }

  // Fetch a sample of pages for content analysis
  const pagesToAnalyze = sitemapUrls.slice(0, 20)
  const pageContents = await Promise.all(
    pagesToAnalyze.map(async (url) => {
      const html = await fetchPage(url)
      const text = extractText(html).slice(0, 1000)
      const headings = extractH1H2(html)
      const title = extractPageTitles(html)[0] || ''
      return { url, text, headings: headings.slice(0, 6), title }
    })
  )

  // Use Claude to match pages to nodes
  const nodeList = nodes.map((n: any) => `[${n.id}] "${n.entity}" (${n.section}) — ${n.macro_context || ''}`).join('\n')
  const pageList = pageContents.map(p => `URL: ${p.url}\nTitle: ${p.title}\nHeadings: ${p.headings.join(' | ')}\nContent: ${p.text.slice(0, 400)}`).join('\n---\n')

  const analysisPrompt = `Analyze which website pages cover which topical map nodes.

TOPICAL MAP NODES:
${nodeList}

WEBSITE PAGES:
${pageList}

For each node, determine coverage status:
- "covered" — a page thoroughly covers this entity (dedicated page or major section)
- "partial" — the entity is mentioned but not the primary focus of any page
- "gap" — no page meaningfully covers this entity

Also identify the best matching URL for partially or fully covered nodes.

Return ONLY valid JSON:
{
  "coverage": [
    {
      "node_id": "uuid",
      "status": "covered|partial|gap",
      "matching_url": "/url-path or null",
      "confidence": "high|medium|low",
      "notes": "brief explanation"
    }
  ],
  "recommendations": [
    "High-priority content gap recommendation 1",
    "High-priority content gap recommendation 2"
  ]
}`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: 'You are a Semantic SEO content analyst. Match website pages to topical map nodes. Return ONLY valid JSON.',
    messages: [{ role: 'user', content: analysisPrompt }],
  })

  void logTokenUsage({
    feature: 'kotoiq_topical_coverage',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: body.agency_id || null,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  let analysis: any
  try {
    analysis = JSON.parse(cleanJSON(raw))
  } catch {
    return { error: 'Failed to parse coverage analysis', status: 500 }
  }

  // Update node statuses in the database
  const coverageItems = analysis.coverage || []
  for (const item of coverageItems) {
    if (!item.node_id) continue
    const updateData: any = { status: item.status, updated_at: new Date().toISOString() }
    if (item.matching_url) updateData.existing_url = item.matching_url
    await s.from('kotoiq_topical_nodes').update(updateData).eq('id', item.node_id)
  }

  // Recalculate map scores
  await recalculateMapScores(s, mapRow.id)

  // Fetch updated map
  const updatedMap = await getTopicalMap(s, { client_id })

  return {
    success: true,
    analysis: {
      pages_analyzed: pageContents.length,
      total_sitemap_urls: sitemapUrls.length,
      coverage_items: coverageItems.length,
      recommendations: analysis.recommendations || [],
    },
    map: (updatedMap as any).map,
  }
}
