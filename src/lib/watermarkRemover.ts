import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — ChatGPT Watermark Remover
// Strips zero-width unicode watermarks, detects common ChatGPT
// stylometric patterns, and rewrites flagged passages in a more
// natural voice using Claude.
// Called via POST /api/kotoiq action: remove_ai_watermarks
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ───────────────────────────────────────────────────────────────────
export interface WatermarkRemoval {
  type: string
  count: number
}

export interface RewriteEntry {
  original: string
  rewritten: string
  reason: string
}

export interface WatermarkResult {
  cleaned_content: string
  watermarks_removed: WatermarkRemoval[]
  chatgpt_patterns_detected: string[]
  rewrite_diff: RewriteEntry[]
  human_score_before: number
  human_score_after: number
}

// ── Pattern catalogs ────────────────────────────────────────────────────────
// Unicode characters used as invisible watermarks by various AI systems
const ZERO_WIDTH_CHARS: Array<{ code: string; char: string; label: string }> = [
  { code: '\\u200b', char: '\u200b', label: 'zero-width space' },
  { code: '\\u200c', char: '\u200c', label: 'zero-width non-joiner' },
  { code: '\\u200d', char: '\u200d', label: 'zero-width joiner' },
  { code: '\\u2060', char: '\u2060', label: 'word joiner' },
  { code: '\\ufeff', char: '\ufeff', label: 'zero-width no-break space' },
  { code: '\\u180e', char: '\u180e', label: 'mongolian vowel separator' },
]

// Overused ChatGPT phrases — regex sources
const OVERUSED_PHRASES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bin today'?s fast[- ]paced world\b/gi, label: "In today's fast-paced world" },
  { pattern: /\bnavigate the complexit(?:y|ies)\b/gi, label: 'Navigate the complexities' },
  { pattern: /\bunleash the power of\b/gi, label: 'Unleash the power of' },
  { pattern: /\ba testament to\b/gi, label: 'A testament to' },
  { pattern: /\bdelv(?:e|ing) into\b/gi, label: 'Delve into' },
  { pattern: /\btapestry of\b/gi, label: 'Tapestry of' },
  { pattern: /\bkaleidoscope of\b/gi, label: 'Kaleidoscope of' },
  { pattern: /\brealm of\b/gi, label: 'Realm of' },
  { pattern: /\bin the ever[- ]evolving\b/gi, label: 'In the ever-evolving' },
  { pattern: /\bat the forefront of\b/gi, label: 'At the forefront of' },
  { pattern: /\bgame[- ]changer\b/gi, label: 'Game-changer' },
  { pattern: /\bcrucial role\b/gi, label: 'Crucial role' },
  { pattern: /\bmeticulously\b/gi, label: 'Meticulously' },
  { pattern: /\bit'?s worth noting that\b/gi, label: "It's worth noting that" },
  { pattern: /\bembark on (?:a |the )?journey\b/gi, label: 'Embark on a journey' },
  { pattern: /\bwhen it comes to\b/gi, label: 'When it comes to' },
]

const TRANSITION_WORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(^|\.\s)moreover,\s/gi, label: 'Moreover,' },
  { pattern: /(^|\.\s)furthermore,\s/gi, label: 'Furthermore,' },
  { pattern: /(^|\.\s)in addition,\s/gi, label: 'In addition,' },
  { pattern: /(^|\.\s)additionally,\s/gi, label: 'Additionally,' },
  { pattern: /(^|\.\s)however,\s/gi, label: 'However,' },
  { pattern: /(^|\.\s)in conclusion,\s/gi, label: 'In conclusion,' },
  { pattern: /(^|\.\s)ultimately,\s/gi, label: 'Ultimately,' },
]

// ── Utilities ───────────────────────────────────────────────────────────────
function countMatches(text: string, pattern: RegExp): number {
  const m = text.match(pattern)
  return m ? m.length : 0
}

function stripZeroWidth(text: string): { cleaned: string; removed: WatermarkRemoval[] } {
  const removed: WatermarkRemoval[] = []
  let cleaned = text
  for (const z of ZERO_WIDTH_CHARS) {
    const re = new RegExp(z.char, 'g')
    const count = (cleaned.match(re) || []).length
    if (count > 0) {
      removed.push({ type: `${z.label} (${z.code})`, count })
      cleaned = cleaned.replace(re, '')
    }
  }
  // Unusual non-breaking spaces sprinkled mid-sentence are a classic watermark too
  const nbspInline = cleaned.match(/\w\u00a0\w/g)?.length || 0
  if (nbspInline > 0) {
    removed.push({ type: 'non-breaking space (\\u00a0) in unusual positions', count: nbspInline })
    cleaned = cleaned.replace(/\u00a0/g, ' ')
  }
  return { cleaned, removed }
}

function detectPatterns(text: string, aggressiveness: 'light' | 'moderate' | 'aggressive'): {
  patterns: string[]
  counts: Record<string, number>
} {
  const counts: Record<string, number> = {}
  const patterns: string[] = []

  for (const p of OVERUSED_PHRASES) {
    const n = countMatches(text, p.pattern)
    if (n > 0) {
      counts[p.label] = n
      patterns.push(`${p.label} (×${n})`)
    }
  }

  // Em-dash overuse: more than 1 per 80 words
  const emDashCount = (text.match(/—/g) || []).length
  const wordCount = text.split(/\s+/).filter(Boolean).length || 1
  const dashRatio = emDashCount / wordCount
  if (emDashCount >= 3 && dashRatio > 1 / 80) {
    counts['em-dash overuse'] = emDashCount
    patterns.push(`Em-dash overuse (${emDashCount} dashes in ${wordCount} words)`)
  }

  // "Not X, but Y" construction
  const notXButY = countMatches(text, /\bnot\s+[^,.]{1,60},\s+but\s+/gi)
  if (notXButY > 0) {
    counts['not X, but Y'] = notXButY
    patterns.push(`"Not X, but Y" constructions (×${notXButY})`)
  }

  // Transition-word overuse
  let transitionTotal = 0
  for (const t of TRANSITION_WORDS) {
    const n = countMatches(text, t.pattern)
    if (n > 0) transitionTotal += n
  }
  const transitionThreshold = aggressiveness === 'aggressive' ? 1 : aggressiveness === 'moderate' ? 2 : 3
  if (transitionTotal >= transitionThreshold) {
    counts['transition phrase overuse'] = transitionTotal
    patterns.push(`Excessive transition phrases (×${transitionTotal}: Moreover/Furthermore/Additionally/etc.)`)
  }

  // Triple-item lists (X, Y, and Z) — only flag if very frequent
  const tripleLists = countMatches(text, /\w+,\s+\w+,?\s+and\s+\w+/g)
  if (tripleLists > 5) {
    counts['triple-item lists'] = tripleLists
    patterns.push(`Perfect triple-item lists (×${tripleLists})`)
  }

  // Generic sentence openers
  const genericOpeners = countMatches(text, /(^|\.\s)(This|These|It|There)\s+(is|are|was|were|will|can|must|should)\s/g)
  if (genericOpeners > 8) {
    counts['generic sentence openers'] = genericOpeners
    patterns.push(`Generic sentence openers (This is / It is / There are — ×${genericOpeners})`)
  }

  return { patterns, counts }
}

function humanScore(text: string, patternCount: number, zeroWidthCount: number): number {
  // 100 = fully human; subtract weighted penalties
  const words = text.split(/\s+/).filter(Boolean).length || 1
  const perKw = (patternCount + zeroWidthCount) / (words / 1000)
  const raw = 100 - Math.min(75, perKw * 8) - Math.min(20, zeroWidthCount)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

// Find flagged sentences so we can ask Claude to rewrite just those
function findFlaggedSentences(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(Boolean)

  const allPatterns: RegExp[] = [
    ...OVERUSED_PHRASES.map(p => p.pattern),
    /\bnot\s+[^,.]{1,60},\s+but\s+/gi,
  ]

  const flagged: string[] = []
  for (const sen of sentences) {
    let hit = false
    // Em-dash density
    if ((sen.match(/—/g) || []).length >= 2) hit = true
    // Overused phrases
    if (!hit) {
      for (const re of allPatterns) {
        if (re.test(sen)) { hit = true; break }
        re.lastIndex = 0
      }
    }
    if (hit) flagged.push(sen)
  }
  return flagged.slice(0, 12) // cap for cost control
}

// ── Main entry ──────────────────────────────────────────────────────────────
export async function removeAIWatermarks(
  ai: Anthropic,
  body: {
    content: string
    aggressiveness?: 'light' | 'moderate' | 'aggressive'
    client_id?: string | null
    agency_id?: string | null
    supabase?: SupabaseClient | null
  }
): Promise<WatermarkResult> {
  const { content } = body
  const aggressiveness = body.aggressiveness || 'moderate'
  const s = body.supabase || null

  if (!content || content.trim().length === 0) {
    throw new Error('content is required')
  }

  // ── 1. Strip zero-width characters ──
  const { cleaned: afterZW, removed: zeroWidthRemoved } = stripZeroWidth(content)
  const zeroWidthCount = zeroWidthRemoved.reduce((a, b) => a + b.count, 0)

  // ── 2. Detect stylometric patterns ──
  const { patterns, counts: patternCounts } = detectPatterns(afterZW, aggressiveness)
  const patternTotal = Object.values(patternCounts).reduce((a, b) => a + b, 0)

  // ── 3. Score before ──
  const human_score_before = humanScore(content, patternTotal, zeroWidthCount)

  // ── 4. Rewrite flagged passages via Claude ──
  const flagged = findFlaggedSentences(afterZW)
  let cleaned_content = afterZW
  const rewrite_diff: RewriteEntry[] = []

  if (flagged.length > 0 && patternTotal > 0) {
    const rewritePrompt = `You are a copy editor removing AI-generated writing tells so content reads more human.

Aggressiveness: ${aggressiveness}
- light: only rewrite sentences with the strongest AI tells, preserve voice
- moderate: rewrite any sentence with 2+ tells, vary sentence length
- aggressive: rewrite all flagged sentences to sound conversational

Remove these tells:
- Overused phrases (Delve into, Tapestry of, Navigate the complexities, In today's fast-paced world, etc.)
- Em-dash overuse (max 1 per sentence, prefer commas or periods)
- "Not X, but Y" constructions — just pick one
- Transition filler (Moreover, Furthermore, Additionally) — drop or replace
- Triple-item parallel structure when it feels mechanical

Keep meaning intact. Do not paraphrase beyond recognition.

Return ONLY valid JSON:
{
  "rewrites": [
    { "original": "exact sentence", "rewritten": "new version", "reason": "short reason" }
  ]
}

Flagged sentences:
${flagged.map((s, i) => `${i + 1}. ${s}`).join('\n')}`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: 'You are a copy editor. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: rewritePrompt }],
      })

      void logTokenUsage({
        feature: 'kotoiq_watermark_remover',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId: body.agency_id || null,
      })

      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      const rewrites: RewriteEntry[] = Array.isArray(parsed.rewrites) ? parsed.rewrites : []

      // Apply rewrites in reverse order of length so shorter replacements don't break longer ones
      rewrites.sort((a, b) => (b.original?.length || 0) - (a.original?.length || 0))
      for (const r of rewrites) {
        if (!r.original || !r.rewritten) continue
        if (cleaned_content.includes(r.original)) {
          cleaned_content = cleaned_content.split(r.original).join(r.rewritten)
          rewrite_diff.push({
            original: r.original,
            rewritten: r.rewritten,
            reason: r.reason || 'removed AI-generated tell',
          })
        }
      }
    } catch {
      // Rewrite failure — we still return the zero-width-stripped content
    }
  }

  // ── 5. Score after ──
  const { patterns: patternsAfter, counts: countsAfter } = detectPatterns(cleaned_content, aggressiveness)
  const patternTotalAfter = Object.values(countsAfter).reduce((a, b) => a + b, 0)
  const human_score_after = humanScore(cleaned_content, patternTotalAfter, 0)

  const result: WatermarkResult = {
    cleaned_content,
    watermarks_removed: zeroWidthRemoved,
    chatgpt_patterns_detected: patterns,
    rewrite_diff,
    human_score_before,
    human_score_after,
  }

  // ── 6. Persist (only if a supabase client is available) ──
  if (s && body.client_id) {
    try {
      await s.from('kotoiq_watermark_cleans').insert({
        client_id: body.client_id,
        original_preview: content.slice(0, 500),
        cleaned_preview: cleaned_content.slice(0, 500),
        watermarks_removed: zeroWidthRemoved,
        patterns_detected: patternsAfter.length > 0 ? patterns : patterns,
        human_score_before,
        human_score_after,
      })
    } catch {
      // Persistence failure shouldn't block the cleaned output
    }
  }

  return result
}
