// ══════════════════════════════════════════════════════════════════════════════
// Q&A KNOWLEDGE BASE — AI-powered search + answer generation
// Sources: tickets (auto), manual entries, web search
// ══════════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase'
import { callClaude } from './ai'

// ── Search knowledge base (full-text + semantic) ──────────────────────────────
export async function searchKnowledge(query, agencyId, limit = 8) {
  // Try full-text search first
  const { data: exact } = await supabase.from('desk_knowledge')
    .select('*')
    .eq('agency_id', agencyId)
    .or(`question.ilike.%${query}%,answer.ilike.%${query}%,tags.cs.{${query}}`)
    .order('use_count', { ascending: false })
    .limit(limit)

  if (exact?.length >= 3) return exact

  // Tag + category search as fallback
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  if (words.length === 0) return exact || []

  const { data: loose } = await supabase.from('desk_knowledge')
    .select('*')
    .eq('agency_id', agencyId)
    .or(words.map(w => `question.ilike.%${w}%`).join(','))
    .order('use_count', { ascending: false })
    .limit(limit)

  // Merge + dedupe
  const all   = [...(exact || []), ...(loose || [])]
  const seen  = new Set()
  return all.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true }).slice(0, limit)
}

// ── Generate a comprehensive answer using Claude + web search ─────────────────
export async function generateAnswer(question, agencyId, onProgress) {
  // 1. Check knowledge base first
  onProgress?.('Searching knowledge base…', 10)
  const existing = await searchKnowledge(question, agencyId, 5)

  // 2. Web search for current info
  onProgress?.('Searching the web for current information…', 30)
  let webResults = []
  try {
    const searchRes = await fetch('/api/qa/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question }),
    })
    if (searchRes.ok) webResults = (await searchRes.json()).results || []
  } catch(e) { console.warn('Web search failed:', e.message) }

  // 3. Build context for Claude
  onProgress?.('Synthesizing answer with AI…', 60)
  const kbContext = existing.length
    ? 'KNOWLEDGE BASE:\n' + existing.map(k =>
        `Q: ${k.question || k.subject_pattern}\nA: ${k.answer || k.resolution}`
      ).join('\n\n')
    : ''

  const webContext = webResults.length
    ? 'WEB SOURCES:\n' + webResults.slice(0, 5).map((r, i) =>
        `[${i+1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
      ).join('\n\n')
    : ''

  const prompt =
    'You are a knowledgeable marketing agency support specialist. Answer this question comprehensively.\n\n' +
    'QUESTION: ' + question + '\n\n' +
    (kbContext ? kbContext + '\n\n' : '') +
    (webContext ? webContext + '\n\n' : '') +
    'Provide a complete, accurate, actionable answer. Structure it clearly with:\n' +
    '1. A direct 1-sentence answer (short_answer)\n' +
    '2. A comprehensive explanation (answer) — use markdown formatting, bullet points, numbered steps where helpful\n' +
    '3. Source citations where web data was used\n\n' +
    'Return JSON:\n' +
    '{"short_answer":"one sentence direct answer","answer":"full markdown answer with all detail","category":"seo|ads|content|design|billing|general|technical|social","tags":["tag1","tag2","tag3"],"confidence":0.0-1.0}'

  const raw = await callClaude(
    'You are an expert marketing support AI. Return only raw JSON, no markdown fences.',
    prompt, 2000
  )

  onProgress?.('Finalizing answer…', 90)

  const clean = raw.replace(/```json|```/g, '').trim()
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  if (s === -1) throw new Error('No JSON in response')

  let parsed
  try { parsed = JSON.parse(clean.slice(s, e+1)) }
  catch(_) { parsed = JSON.parse(clean.slice(s, e+1).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')) }

  return {
    ...parsed,
    web_sources:    webResults.slice(0, 5).map(r => ({ url:r.url, title:r.title, snippet:r.snippet })),
    existing_matches: existing,
  }
}

// ── Auto-learn from resolved ticket ──────────────────────────────────────────
export async function learnFromResolvedTicket(ticket, replies, agencyId) {
  try {
    // Build Q&A from ticket + resolution thread
    const thread = replies
      .filter(r => !r.is_internal)
      .map(r => `${r.author_type === 'client' ? 'Client' : 'Agent'}: ${r.body}`)
      .join('\n')

    const prompt =
      'A support ticket was resolved. Extract a reusable Q&A from it.\n\n' +
      'TICKET: ' + ticket.subject + '\n' +
      'DESCRIPTION: ' + ticket.description + '\n' +
      'THREAD:\n' + (thread || 'No replies') + '\n\n' +
      'Return JSON:\n' +
      '{"question":"normalized question (how someone might ask this)","short_answer":"1 sentence","answer":"full helpful answer in markdown","category":"'+ticket.ai_category||'general'+'","tags":["tag1","tag2"],"should_add":true}'

    const raw = await callClaude(
      'You extract reusable Q&A pairs from support tickets. Return only raw JSON.',
      prompt, 1000
    )
    const clean = raw.replace(/```json|```/g,'').trim()
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
    const qa = JSON.parse(clean.slice(s, e+1))

    if (!qa.should_add || !qa.question || !qa.answer) return null

    const { data } = await supabase.from('desk_knowledge').insert({
      agency_id:       agencyId,
      ticket_id:       ticket.id,
      category:        qa.category || ticket.ai_category || 'general',
      question:        qa.question,
      answer:          qa.answer,
      answer_short:    qa.short_answer,
      subject_pattern: ticket.subject?.slice(0, 100),
      resolution:      qa.answer,
      tags:            qa.tags || ticket.ai_tags || [],
      source:          'ticket',
      is_verified:     false,
      confidence:      0.8,
    }).select().single()

    return data
  } catch(e) {
    console.warn('learnFromResolvedTicket failed:', e.message)
    return null
  }
}

// ── Manually add a Q&A entry ──────────────────────────────────────────────────
export async function addKnowledgeEntry(entry, agencyId) {
  const { data, error } = await supabase.from('desk_knowledge').insert({
    agency_id:    agencyId,
    category:     entry.category || 'general',
    question:     entry.question,
    answer:       entry.answer,
    answer_short: entry.answer_short || '',
    tags:         entry.tags || [],
    source:       entry.source || 'manual',
    is_verified:  entry.is_verified || false,
    is_public:    entry.is_public !== false,
    confidence:   1.0,
  }).select().single()
  return { data, error }
}

// ── Mark answer helpful/not helpful ──────────────────────────────────────────
export async function rateAnswer(id, helpful) {
  const field = helpful ? 'helpful_count' : 'not_helpful_count'
  const { data: current } = await supabase.from('desk_knowledge').select(field).eq('id', id).single()
  const newVal = (current?.[field] || 0) + 1
  await supabase.from('desk_knowledge').update({
    [field]: newVal,
    use_count: supabase.rpc ? undefined : undefined, // bump via separate call
    updated_at: new Date().toISOString(),
  }).eq('id', id)
}

// ── Get all knowledge for admin view ─────────────────────────────────────────
export async function getAllKnowledge(agencyId, filters = {}) {
  let q = supabase.from('desk_knowledge')
    .select('*')
    .eq('agency_id', agencyId)
    .order('use_count', { ascending: false })

  if (filters.category) q = q.eq('category', filters.category)
  if (filters.source)   q = q.eq('source',   filters.source)
  if (filters.verified !== undefined) q = q.eq('is_verified', filters.verified)

  const { data } = await q.limit(500)
  return data || []
}
