// NOT server-only — pure function, usable from anywhere that holds a fields jsonb
import { DISCREPANCY_TOLERANCE } from './profileConfig'
import type { ProvenanceRecord } from './profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 3 — Cross-source discrepancy detector (D-11 wow moment).
//
// RESEARCH §6 algorithm:
//   1. Group records per field (already done — input is the fields jsonb).
//   2. Skip fields with < 2 records.
//   3. Normalise values (lowercase strings, parsed numbers, sorted lists).
//   4. Per kind:
//      - numeric  — high - low > tolerance × max(|values|) → flag
//      - enum     — any value mismatch → flag
//      - list     — pairwise symmetric-diff ratio > tolerance → flag
//      - default  — string similarity (Levenshtein) < tolerance → flag
//
// Plan 7 renders the returned DiscrepancyReport[] as a pink callout per
// field (UI-SPEC §4.6 + §5.6).  Plan 4 seeder may enrich the optional
// `explanation` via a Haiku one-shot call before persisting.
// ─────────────────────────────────────────────────────────────────────────────

export type DiscrepancyKind = 'numeric' | 'enum' | 'string' | 'list'

export type DiscrepancyReport = {
  field: string
  kind: DiscrepancyKind
  records: ProvenanceRecord[]
  /** Optional one-liner — Plan 4 seeder may fill via Haiku */
  explanation?: string
}

const ENUM_FIELDS = new Set(['industry', 'caller_sentiment', 'follow_up_flag'])
const NUMERIC_FIELDS = new Set(['founding_year', 'marketing_budget'])
const LIST_FIELDS = new Set([
  'competitors',
  'differentiators',
  'pain_points',
  'service_areas',
  'trust_anchors',
  'expansion_signals',
  'competitor_mentions',
  'objections',
  'pain_point_emphasis',
  'current_channels',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseValue(v: any): string | number | string[] {
  if (Array.isArray(v)) {
    return v
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean)
      .sort()
  }
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim()
  const asNum = Number(s)
  if (s && Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(s)) return asNum
  return s.toLowerCase()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  let cur = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]
}

function stringSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}

function symmetricDiffRatio(a: string[], b: string[]): number {
  const sa = new Set(a)
  const sb = new Set(b)
  const union = new Set([...a, ...b])
  let shared = 0
  for (const x of sa) if (sb.has(x)) shared++
  if (union.size === 0) return 0
  return (union.size - shared) / union.size
}

export function detectDiscrepancies(
  fields: Record<string, ProvenanceRecord[]>,
): DiscrepancyReport[] {
  const out: DiscrepancyReport[] = []

  for (const [field, records] of Object.entries(fields)) {
    if (!records || records.length < 2) continue

    const values = records.map((r) => normaliseValue(r.value))
    const unique = Array.from(new Set(values.map((v) => JSON.stringify(v))))
    if (unique.length === 1) continue // all agree

    // Numeric fields
    //
    // Plan behavior (RESEARCH §6 + Plan 3 Task 4 description):
    //   - founding_year {2019, 2020}: NOT a discrepancy (within tolerance)
    //   - founding_year {2019, 2020, 2011}: IS a discrepancy
    //
    // Pure `(hi-lo) > tolerance × max(values)` underflags year-shaped fields
    // (0.2 × 2020 = 404 — never trips on real-world year deltas).  We split
    // by magnitude:
    //   - year-shaped (all values look like 4-digit years 1900-2100):
    //     absolute window of `tolerance × 25` years (= 5 years at tol=0.2)
    //   - all other numerics: `(hi - lo) / max > tolerance`
    //     (relative spread; matches RESEARCH §6 percentage interpretation)
    if (NUMERIC_FIELDS.has(field)) {
      const nums = values.filter((v): v is number => typeof v === 'number')
      if (nums.length < 2) continue
      const hi = Math.max(...nums)
      const lo = Math.min(...nums)
      const looksLikeYears = nums.every((n) => n >= 1900 && n <= 2100 && Number.isInteger(n))
      const flagged = looksLikeYears
        ? hi - lo > DISCREPANCY_TOLERANCE.numeric * 25
        : (hi - lo) / Math.max(Math.abs(hi), 1) > DISCREPANCY_TOLERANCE.numeric
      if (flagged) {
        out.push({ field, kind: 'numeric', records })
      }
      continue
    }

    // Enum fields — any mismatch
    if (ENUM_FIELDS.has(field)) {
      out.push({ field, kind: 'enum', records })
      continue
    }

    // List fields — pairwise symmetric-diff threshold
    if (LIST_FIELDS.has(field)) {
      const lists = values.filter((v): v is string[] => Array.isArray(v))
      if (lists.length < 2) continue
      let worst = 0
      for (let i = 0; i < lists.length; i++) {
        for (let j = i + 1; j < lists.length; j++) {
          worst = Math.max(worst, symmetricDiffRatio(lists[i], lists[j]))
        }
      }
      if (worst > DISCREPANCY_TOLERANCE.list_symmetric_diff) {
        out.push({ field, kind: 'list', records })
      }
      continue
    }

    // Default — string similarity (Levenshtein)
    const strs = values.map((v) => (typeof v === 'string' ? v : String(v)))
    let minSim = 1
    for (let i = 0; i < strs.length; i++) {
      for (let j = i + 1; j < strs.length; j++) {
        minSim = Math.min(minSim, stringSimilarity(strs[i], strs[j]))
      }
    }
    if (minSim < DISCREPANCY_TOLERANCE.string_similarity) {
      out.push({ field, kind: 'string', records })
    }
  }

  return out
}
