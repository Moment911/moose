import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — Plagiarism + AI Detection Engine
// Splits content into chunks, searches for unique phrases on
// Google via DataForSEO, flags duplicates, then runs an AI
// detection pass (ChatGPT/Claude/Gemini stylometry).
// Called via POST /api/kotoiq action: check_plagiarism
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getSERPResults } from '@/lib/dataforseo'

// ── Types ───────────────────────────────────────────────────────────────────
export interface PlagiarizedChunk {
  text: string
  matched_urls: string[]
  similarity_pct: number
}

export interface PlagiarismResult {
  overall_originality_score: number
  plagiarized_chunks: PlagiarizedChunk[]
  ai_generation_likelihood: number
  ai_patterns_detected: string[]
  recommendations: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function splitIntoSentences(text: string): string[] {
  // Simple sentence splitter — good enough for chunking
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function chunkSentences(sentences: string[], chunkSize = 7): string[] {
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const slice = sentences.slice(i, i + chunkSize).join(' ')
    if (slice.length > 40) chunks.push(slice)
  }
  return chunks
}

// Extract a distinctive 7-10 word phrase from a chunk for SERP lookup
function extractSignaturePhrase(chunk: string): string {
  const words = chunk.split(/\s+/).filter(w => w.length > 0)
  if (words.length < 7) return chunk
  // Prefer a window from the middle of the chunk — less likely to be boilerplate
  const start = Math.max(0, Math.floor(words.length / 2) - 4)
  const phrase = words.slice(start, start + 9).join(' ')
  // Strip trailing punctuation that would break the search
  return phrase.replace(/[^\w\s'-]/g, '').trim()
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Main entry: check_plagiarism ────────────────────────────────────────────
export async function checkPlagiarism(
  s: SupabaseClient,
  ai: Anthropic,
  body: {
    client_id?: string | null
    agency_id?: string | null
    content: string
    url?: string | null
    check_type?: 'web' | 'ai_detection' | 'both'
  }
): Promise<PlagiarismResult & { record_id?: string }> {
  const { client_id, agency_id, content, url } = body
  const check_type = body.check_type || 'both'

  if (!content || content.trim().length < 40) {
    throw new Error('content is required and must be at least 40 characters')
  }

  const plagiarized_chunks: PlagiarizedChunk[] = []
  let ai_generation_likelihood = 0
  let ai_patterns_detected: string[] = []
  let recommendations: string[] = []

  // ── 1. Web plagiarism check ──
  if (check_type === 'web' || check_type === 'both') {
    const sentences = splitIntoSentences(content)
    const chunks = chunkSentences(sentences, 7)

    // Cap at 8 chunks to control DataForSEO spend
    const chunksToCheck = chunks.slice(0, 8)

    for (const chunk of chunksToCheck) {
      const phrase = extractSignaturePhrase(chunk)
      if (!phrase || phrase.split(/\s+/).length < 6) continue

      // Quote-wrap for exact-phrase search
      const query = `"${phrase}"`
      try {
        const serp = await getSERPResults(query, 'United States', 'en')
        const matched_urls: string[] = []
        const normalizedPhrase = normalizeForMatch(phrase)

        for (const item of serp.items || []) {
          if (item.type !== 'organic') continue
          const haystack = normalizeForMatch(`${item.title || ''} ${item.description || ''}`)
          // If the engine returned it for a quoted phrase, treat as an exact hit
          // but still prefer items whose snippet actually contains the phrase.
          if (haystack.includes(normalizedPhrase) || (item.url && !matched_urls.includes(item.url))) {
            if (item.url) matched_urls.push(item.url)
          }
          if (matched_urls.length >= 5) break
        }

        if (matched_urls.length > 0) {
          // If the same phrase appears on other pages, similarity ≈ len(phrase)/len(chunk)
          const phraseWords = phrase.split(/\s+/).length
          const chunkWords = chunk.split(/\s+/).length
          const similarity_pct = Math.min(100, Math.round((phraseWords / Math.max(chunkWords, 1)) * 100))
          plagiarized_chunks.push({
            text: chunk.slice(0, 300),
            matched_urls: matched_urls.slice(0, 5),
            similarity_pct,
          })
        }
      } catch {
        // SERP failure — skip this chunk, don't fail the whole check
      }
    }
  }

  // ── 2. AI detection via Claude ──
  if (check_type === 'ai_detection' || check_type === 'both') {
    const sample = content.slice(0, 6000)
    const prompt = `You are a forensic AI-content analyst. Evaluate the passage below for signals that it was machine-generated (ChatGPT, Claude, Gemini, Llama).

Consider:
- Overused phrasing ("In today's fast-paced world", "Delve into", "Navigate the complexities", "Tapestry of")
- Em-dash overuse and "not X, but Y" constructions
- Consistent uniform perplexity (low burstiness) and mechanical parallel structure
- Missing human quirks: no typos, no personal anecdotes, no specific names/dates
- Generic transitional phrases (Moreover, Furthermore, In addition, In conclusion)
- Triple-item lists everywhere
- Polished but vague — high fluency, low specificity

Return ONLY valid JSON:
{
  "ai_generation_likelihood": 0-100,
  "patterns_detected": ["short phrase", "short phrase"],
  "reasoning": "one short paragraph",
  "recommendations": ["action 1", "action 2", "action 3"]
}

PASSAGE:
"""
${sample}
"""`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: 'You are a forensic AI-content analyst. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      })

      void logTokenUsage({
        feature: 'kotoiq_plagiarism_ai_detection',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId: agency_id || null,
      })

      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const analysis = JSON.parse(cleaned)

      ai_generation_likelihood = Math.max(0, Math.min(100, Number(analysis.ai_generation_likelihood) || 0))
      ai_patterns_detected = Array.isArray(analysis.patterns_detected) ? analysis.patterns_detected.slice(0, 12) : []
      recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations.slice(0, 8) : []
    } catch {
      // AI analysis failed — leave defaults
    }
  }

  // ── 3. Overall originality score ──
  // Start at 100, subtract for each plagiarized chunk weighted by similarity
  const totalContentChunks = Math.max(1, Math.ceil(content.split(/\s+/).length / 70))
  const duplicateWeight = plagiarized_chunks.reduce((acc, c) => acc + c.similarity_pct, 0) / 100
  const plagiarismPenalty = Math.min(70, (duplicateWeight / totalContentChunks) * 100)
  const aiPenalty = ai_generation_likelihood > 70 ? 15 : ai_generation_likelihood > 40 ? 8 : 0
  const overall_originality_score = Math.max(0, Math.round(100 - plagiarismPenalty - aiPenalty))

  // Merge duplicate-specific recommendations in if not already present
  if (plagiarized_chunks.length > 0 && !recommendations.some(r => /rewrite|paraphrase|cite/i.test(r))) {
    recommendations.unshift('Rewrite or cite the flagged passages — verbatim matches were found on other URLs.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Content looks original. Keep adding first-hand experience and specific examples to reinforce E-E-A-T.')
  }

  const result: PlagiarismResult = {
    overall_originality_score,
    plagiarized_chunks,
    ai_generation_likelihood,
    ai_patterns_detected,
    recommendations,
  }

  // ── 4. Persist ──
  let record_id: string | undefined
  if (client_id) {
    try {
      const { data } = await s.from('kotoiq_plagiarism_checks').insert({
        client_id,
        url: url || null,
        content_preview: content.slice(0, 500),
        originality_score: overall_originality_score,
        ai_generation_likelihood,
        plagiarized_chunks,
        ai_patterns: ai_patterns_detected,
        recommendations,
      }).select('id').single()
      record_id = data?.id
    } catch {
      // Persistence failure shouldn't block the response
    }
  }

  return { ...result, record_id }
}

// ── History ─────────────────────────────────────────────────────────────────
export async function getPlagiarismHistory(
  s: SupabaseClient,
  body: { client_id: string; limit?: number }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data, error } = await s
    .from('kotoiq_plagiarism_checks')
    .select('*')
    .eq('client_id', client_id)
    .order('checked_at', { ascending: false })
    .limit(Math.min(body.limit || 25, 100))

  if (error && error.code !== 'PGRST116') throw error
  return data || []
}
