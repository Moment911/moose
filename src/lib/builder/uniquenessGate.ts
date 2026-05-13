/**
 * Uniqueness Gate — scores content uniqueness across a batch of pages
 *
 * Prevents Google duplicate content penalties by ensuring each page
 * in a bulk generation batch is sufficiently unique.
 */

import crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export interface UniquenessResult {
  passed: boolean
  score: number          // 0-100 (100 = fully unique)
  duplicates: Array<{
    indexA: number
    indexB: number
    cityA: string
    cityB: string
    similarity: number   // 0-1 (1 = identical)
  }>
  warnings: string[]
}

// ── Core Gate ──────────────────────────────────────────────────────────────

/**
 * Check uniqueness across a batch of generated pages.
 * Flags pairs with >60% text similarity as potential duplicates.
 */
export function checkBatchUniqueness(
  pages: Array<{
    city: string
    bodyText: string  // HTML-stripped text content
    bodyHash: string
  }>,
  threshold = 0.6,
): UniquenessResult {
  const duplicates: UniquenessResult['duplicates'] = []
  const warnings: string[] = []

  // 1. Check for exact hash duplicates (O(n) with set)
  const hashMap = new Map<string, number>()
  for (let i = 0; i < pages.length; i++) {
    const existing = hashMap.get(pages[i].bodyHash)
    if (existing !== undefined) {
      duplicates.push({
        indexA: existing,
        indexB: i,
        cityA: pages[existing].city,
        cityB: pages[i].city,
        similarity: 1.0,
      })
    }
    hashMap.set(pages[i].bodyHash, i)
  }

  // 2. Check for near-duplicates using trigram similarity (O(n^2) but batch is small)
  // Only run on batches < 200 to avoid performance issues
  if (pages.length <= 200) {
    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        // Skip if already flagged as exact duplicate
        if (pages[i].bodyHash === pages[j].bodyHash) continue

        const sim = trigramSimilarity(pages[i].bodyText, pages[j].bodyText)
        if (sim > threshold) {
          duplicates.push({
            indexA: i,
            indexB: j,
            cityA: pages[i].city,
            cityB: pages[j].city,
            similarity: Math.round(sim * 100) / 100,
          })
        }
      }
    }
  } else {
    warnings.push(`Batch too large (${pages.length}) for full similarity check; only exact hash duplicates checked`)
  }

  // 3. Check for short content (< 300 words)
  for (let i = 0; i < pages.length; i++) {
    const wordCount = pages[i].bodyText.split(/\s+/).length
    if (wordCount < 300) {
      warnings.push(`Page ${i} (${pages[i].city}) has only ${wordCount} words (target: 800+)`)
    }
  }

  // Calculate overall uniqueness score
  const uniquePairs = (pages.length * (pages.length - 1)) / 2
  const duplicatePairs = duplicates.length
  const score = uniquePairs > 0
    ? Math.round(((uniquePairs - duplicatePairs) / uniquePairs) * 100)
    : 100

  return {
    passed: duplicates.length === 0 && score >= 80,
    score,
    duplicates,
    warnings,
  }
}

/**
 * Compute body hash for deduplication.
 */
export function computeBodyHash(text: string): string {
  // Normalize: lowercase, strip extra whitespace, strip city/state names
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Strip HTML tags and return plain text.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Trigram Similarity ─────────────────────────────────────────────────────

function trigrams(text: string): Set<string> {
  const set = new Set<string>()
  // Use first 2000 chars for performance
  const t = text.toLowerCase().slice(0, 2000)
  for (let i = 0; i <= t.length - 3; i++) {
    set.add(t.slice(i, i + 3))
  }
  return set
}

function trigramSimilarity(a: string, b: string): number {
  const tA = trigrams(a)
  const tB = trigrams(b)

  if (tA.size === 0 || tB.size === 0) return 0

  let intersection = 0
  for (const t of tA) {
    if (tB.has(t)) intersection++
  }

  const union = tA.size + tB.size - intersection
  return union > 0 ? intersection / union : 0
}
