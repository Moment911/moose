// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 10-10 Task 1 (GREEN) — diffEngine
//
// Semantic comparison of v3 vs v4 RPC responses for shadow-mode dual-run logging.
//
// Classification:
//   - match       — every leaf is equal (or only ignore-listed keys differ
//                   and they're at the leaf level)
//   - minor_diff  — only ignore-listed keys differ (timestamps, request IDs,
//                   nonces); these are expected non-determinism between v3
//                   and v4 even when both are correct
//   - major_diff  — at least one non-ignored key differs, or v3-only/v4-only
//                   keys exist (other than ignored ones)
//
// hashResponse:
//   - sha256 of JSON.stringify with sorted keys at every object depth
//   - deterministic regardless of input key ordering
//   - used to compress full v3/v4 bodies into ~64-char strings before
//     persisting to koto_wp_dual_run_log (the table never stores raw bodies
//     because args may contain post content — privacy / size win)
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'

// ── Ignore list ─────────────────────────────────────────────────────────────
// Keys whose values are expected to differ between v3 and v4 even when both
// responses are semantically correct. A diff in ONLY these keys is minor_diff;
// a diff that includes any non-ignored key is major_diff.
export const DIFF_IGNORE_KEYS: Set<string> = new Set([
    'time',
    'iat',
    'exp',
    'nonce',
    'request_id',
    'updated_at',
    'modified',
    'last_modified',
    'generated_at',
    'mtime',
    'etag',
    'post_modified',
    'pushed_at',
])

export interface CompareSample {
    path: string
    v3: unknown
    v4: unknown
}

export interface CompareSummary {
    changed_keys: string[]
    v3_only_keys: string[]
    v4_only_keys: string[]
    samples: CompareSample[]
}

export interface CompareResult {
    status: 'match' | 'minor_diff' | 'major_diff'
    summary: CompareSummary
}

export interface CompareOptions {
    ignoreKeys?: Set<string>
    maxSamples?: number
}

// ── Recursive walker ────────────────────────────────────────────────────────
function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function lastSegment(path: string): string {
    // Strip array indices like `[0]` then return the segment after the last dot.
    const noIdx = path.replace(/\[\d+\]/g, '')
    const idx = noIdx.lastIndexOf('.')
    return idx === -1 ? noIdx : noIdx.slice(idx + 1)
}

function walk(
    v3: unknown,
    v4: unknown,
    path: string,
    summary: CompareSummary,
    maxSamples: number,
): void {
    // ── Both objects → key-union recursion ──
    if (isPlainObject(v3) && isPlainObject(v4)) {
        const keys = new Set([...Object.keys(v3), ...Object.keys(v4)])
        for (const k of keys) {
            const subPath = path ? `${path}.${k}` : k
            const hasV3 = Object.prototype.hasOwnProperty.call(v3, k)
            const hasV4 = Object.prototype.hasOwnProperty.call(v4, k)
            if (hasV3 && !hasV4) {
                summary.v3_only_keys.push(subPath)
                if (summary.samples.length < maxSamples) {
                    summary.samples.push({ path: subPath, v3: v3[k], v4: undefined })
                }
            } else if (!hasV3 && hasV4) {
                summary.v4_only_keys.push(subPath)
                if (summary.samples.length < maxSamples) {
                    summary.samples.push({ path: subPath, v3: undefined, v4: v4[k] })
                }
            } else {
                walk(v3[k], v4[k], subPath, summary, maxSamples)
            }
        }
        return
    }

    // ── Both arrays → index-by-index (order-sensitive) ──
    if (Array.isArray(v3) && Array.isArray(v4)) {
        if (v3.length !== v4.length) {
            summary.changed_keys.push(path)
            if (summary.samples.length < maxSamples) {
                summary.samples.push({
                    path,
                    v3: `array length ${v3.length}`,
                    v4: `array length ${v4.length}`,
                })
            }
            return
        }
        for (let i = 0; i < v3.length; i++) {
            walk(v3[i], v4[i], `${path}[${i}]`, summary, maxSamples)
        }
        return
    }

    // ── Type mismatch (one is object/array, the other primitive) ──
    if (typeof v3 !== typeof v4 || Array.isArray(v3) !== Array.isArray(v4)) {
        summary.changed_keys.push(path)
        if (summary.samples.length < maxSamples) {
            summary.samples.push({ path, v3, v4 })
        }
        return
    }

    // ── Primitives ──
    if (v3 !== v4) {
        // NaN-vs-NaN tolerance for completeness (NaN !== NaN per IEEE-754).
        if (typeof v3 === 'number' && Number.isNaN(v3) && typeof v4 === 'number' && Number.isNaN(v4)) {
            return
        }
        summary.changed_keys.push(path)
        if (summary.samples.length < maxSamples) {
            summary.samples.push({ path, v3, v4 })
        }
    }
}

// ── compareResponses ────────────────────────────────────────────────────────
export function compareResponses(
    v3: unknown,
    v4: unknown,
    opts?: CompareOptions,
): CompareResult {
    const ignoreKeys = opts?.ignoreKeys ?? DIFF_IGNORE_KEYS
    const maxSamples = opts?.maxSamples ?? 5

    const summary: CompareSummary = {
        changed_keys: [],
        v3_only_keys: [],
        v4_only_keys: [],
        samples: [],
    }

    walk(v3, v4, '', summary, maxSamples)

    // Classify.
    const totalDiffs =
        summary.changed_keys.length +
        summary.v3_only_keys.length +
        summary.v4_only_keys.length

    if (totalDiffs === 0) {
        return { status: 'match', summary }
    }

    // Are ALL diffs on ignored leaf keys? If so → minor_diff.
    const allKeys = [
        ...summary.changed_keys,
        ...summary.v3_only_keys,
        ...summary.v4_only_keys,
    ]
    const anyNonIgnored = allKeys.some((p) => !ignoreKeys.has(lastSegment(p)))
    return { status: anyNonIgnored ? 'major_diff' : 'minor_diff', summary }
}

// ── summarizeDiff ───────────────────────────────────────────────────────────
export function summarizeDiff(result: CompareResult): string {
    if (result.status === 'match') return 'identical'
    const parts: string[] = []
    if (result.summary.changed_keys.length) {
        parts.push(`${result.summary.changed_keys.length} changed`)
    }
    if (result.summary.v3_only_keys.length) {
        parts.push(`${result.summary.v3_only_keys.length} v3-only`)
    }
    if (result.summary.v4_only_keys.length) {
        parts.push(`${result.summary.v4_only_keys.length} v4-only`)
    }
    return `${result.status}: ${parts.join(', ')}`
}

// ── hashResponse ────────────────────────────────────────────────────────────
// Sorted-key JSON stringification → sha256 hex. Deterministic regardless of
// caller-side key insertion order.
function stableStringify(value: unknown): string {
    if (value === undefined) return '__undefined__'
    return JSON.stringify(value, (_key, val) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            // Sort object keys.
            const sorted: Record<string, unknown> = {}
            for (const k of Object.keys(val as Record<string, unknown>).sort()) {
                sorted[k] = (val as Record<string, unknown>)[k]
            }
            return sorted
        }
        return val
    })
}

export function hashResponse(obj: unknown): string {
    const s = stableStringify(obj)
    return createHash('sha256').update(s).digest('hex')
}
