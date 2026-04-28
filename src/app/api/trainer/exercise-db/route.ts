import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trainer/exercise-db?name=barbell+back+squat
//
// Proxy + cache for the ExerciseDB OSS API (oss.exercisedb.dev).
// Accepts an exercise name, searches ExerciseDB, returns the best match
// with GIF URL, target muscles, equipment, and instructions.
//
// Server-side only so the external API URL stays out of client bundles
// and we can cache aggressively (exercise data is static).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const BASE = 'https://oss.exercisedb.dev/api/v1'

// In-memory cache: normalized name → ExerciseDB result.
// Exercises don't change — cache indefinitely within this function instance.
const cache = new Map<string, ExerciseMatch | null>()

type ExerciseMatch = {
  exerciseId: string
  name: string
  gifUrl: string
  bodyParts: string[]
  equipments: string[]
  targetMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\s+/g, ' ')
    .trim()
}

// Score how well a candidate name matches the query.
// Higher = better. Exact match = 1000. Contains all words = 100+.
function matchScore(query: string, candidate: string): number {
  const q = normalize(query)
  const c = normalize(candidate)
  if (q === c) return 1000
  if (c.includes(q)) return 500
  if (q.includes(c)) return 400
  // Word overlap
  const qWords = q.split(' ')
  const cWords = new Set(c.split(' '))
  let hits = 0
  for (const w of qWords) {
    if (cWords.has(w)) hits++
    // Partial word match (e.g. "squat" matches "squats")
    else if ([...cWords].some(cw => cw.startsWith(w) || w.startsWith(cw))) hits += 0.5
  }
  return qWords.length > 0 ? (hits / qWords.length) * 100 : 0
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: 'name query param required (min 2 chars)' }, { status: 400 })
  }

  const cacheKey = normalize(name)

  // Check cache
  if (cache.has(cacheKey)) {
    const hit = cache.get(cacheKey)
    if (hit) return NextResponse.json({ match: hit }, { headers: { 'x-cache': 'HIT' } })
    return NextResponse.json({ match: null, reason: 'no_match_cached' }, { headers: { 'x-cache': 'HIT' } })
  }

  try {
    // Search by name — ExerciseDB filters by substring match
    const searchTerm = extractSearchTerm(name)
    const url = `${BASE}/exercises?name=${encodeURIComponent(searchTerm)}&limit=20`
    const res = await fetch(url, { next: { revalidate: 86400 } }) // cache 24h at edge
    if (!res.ok) {
      console.error(`[exercise-db] API returned ${res.status}`)
      return NextResponse.json({ match: null, reason: 'api_error' }, { status: 502 })
    }

    const body = (await res.json()) as { data?: ExerciseMatch[] }
    const results = body.data ?? []

    if (results.length === 0) {
      cache.set(cacheKey, null)
      return NextResponse.json({ match: null, reason: 'no_results' })
    }

    // Score all results and pick the best match
    let best: ExerciseMatch | null = null
    let bestScore = 0
    for (const r of results) {
      const score = matchScore(name, r.name)
      if (score > bestScore) {
        bestScore = score
        best = r
      }
    }

    // Require minimum match quality
    if (!best || bestScore < 30) {
      cache.set(cacheKey, null)
      return NextResponse.json({ match: null, reason: 'low_confidence', bestScore })
    }

    cache.set(cacheKey, best)
    return NextResponse.json({ match: best, score: bestScore })
  } catch (e) {
    console.error('[exercise-db] fetch error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ match: null, reason: 'fetch_error' }, { status: 502 })
  }
}

// Extract the most meaningful search term from an exercise_id or name.
// "barbell_back_squat" → "back squat" (drop equipment prefix, ExerciseDB has its own equipment field)
// "db_bench_press" → "bench press"
function extractSearchTerm(raw: string): string {
  let s = normalize(raw)
  // Strip common equipment prefixes — ExerciseDB filters by name, not equipment
  const prefixes = ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'kettlebell', 'band', 'ez bar']
  for (const p of prefixes) {
    if (s.startsWith(p + ' ')) {
      // Keep the prefix in a secondary search if the stripped version returns nothing
      s = s.slice(p.length + 1)
      break
    }
  }
  return s
}
