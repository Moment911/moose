// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 10-10 Task 1 (RED) — diffEngine tests
//
// Covers:
//   - match / minor_diff / major_diff classification
//   - DIFF_IGNORE_KEYS (timestamps, request_ids, nonces) → minor_diff
//   - v3-only / v4-only keys → major_diff (unless ignored)
//   - Sample cap (default 5)
//   - hashResponse sorted-key determinism
//   - hashResponse null vs undefined separation
//   - Array order sensitivity → major_diff
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
    compareResponses,
    hashResponse,
    summarizeDiff,
    DIFF_IGNORE_KEYS,
} from './diffEngine'

describe('compareResponses', () => {
    it('classifies identical objects as match', () => {
        const a = { a: 1, b: { c: 'x' }, d: [1, 2, 3] }
        const b = { a: 1, b: { c: 'x' }, d: [1, 2, 3] }
        const r = compareResponses(a, b)
        expect(r.status).toBe('match')
        expect(r.summary.changed_keys).toEqual([])
        expect(r.summary.v3_only_keys).toEqual([])
        expect(r.summary.v4_only_keys).toEqual([])
    })

    it('classifies a difference in an ignore-listed key (`time`) as minor_diff', () => {
        const a = { ok: true, time: 1700000000 }
        const b = { ok: true, time: 1700000001 }
        const r = compareResponses(a, b)
        expect(r.status).toBe('minor_diff')
    })

    it('classifies a difference in a regular field as major_diff', () => {
        const a = { data: { foo: 'bar' }, time: 1 }
        const b = { data: { foo: 'baz' }, time: 2 }
        const r = compareResponses(a, b)
        expect(r.status).toBe('major_diff')
        expect(r.summary.changed_keys).toContain('data.foo')
    })

    it('treats v3-only key as major_diff with v3_only_keys populated', () => {
        const a = { ok: true, extra: 'present' }
        const b = { ok: true }
        const r = compareResponses(a, b)
        expect(r.status).toBe('major_diff')
        expect(r.summary.v3_only_keys).toContain('extra')
    })

    it('treats v4-only key as major_diff with v4_only_keys populated', () => {
        const a = { ok: true }
        const b = { ok: true, extra: 'present' }
        const r = compareResponses(a, b)
        expect(r.status).toBe('major_diff')
        expect(r.summary.v4_only_keys).toContain('extra')
    })

    it('caps samples at maxSamples (default 5)', () => {
        const a: Record<string, unknown> = {}
        const b: Record<string, unknown> = {}
        for (let i = 0; i < 10; i++) {
            a[`k${i}`] = `v3-${i}`
            b[`k${i}`] = `v4-${i}`
        }
        const r = compareResponses(a, b)
        expect(r.status).toBe('major_diff')
        expect(r.summary.samples.length).toBeLessThanOrEqual(5)
    })

    it('detects array-order differences as major_diff', () => {
        const a = { items: ['a', 'b', 'c'] }
        const b = { items: ['c', 'b', 'a'] }
        const r = compareResponses(a, b)
        expect(r.status).toBe('major_diff')
    })

    it('detects array-length differences as major_diff', () => {
        const a = { items: [1, 2, 3] }
        const b = { items: [1, 2] }
        const r = compareResponses(a, b)
        expect(r.status).toBe('major_diff')
    })

    it('exposes DIFF_IGNORE_KEYS containing the canonical timestamp keys', () => {
        expect(DIFF_IGNORE_KEYS.has('time')).toBe(true)
        expect(DIFF_IGNORE_KEYS.has('nonce')).toBe(true)
        expect(DIFF_IGNORE_KEYS.has('request_id')).toBe(true)
        expect(DIFF_IGNORE_KEYS.has('updated_at')).toBe(true)
    })

    it('summarizeDiff returns a non-empty human string', () => {
        const a = { data: { x: 1 } }
        const b = { data: { x: 2 } }
        const r = compareResponses(a, b)
        const s = summarizeDiff(r)
        expect(typeof s).toBe('string')
        expect(s.length).toBeGreaterThan(0)
    })

    it('respects custom maxSamples option', () => {
        const a: Record<string, unknown> = { a: 1, b: 2, c: 3 }
        const b: Record<string, unknown> = { a: 9, b: 9, c: 9 }
        const r = compareResponses(a, b, { maxSamples: 2 })
        expect(r.summary.samples.length).toBeLessThanOrEqual(2)
    })

    it('respects custom ignoreKeys option', () => {
        const a = { foo: 1, custom_ts: 100 }
        const b = { foo: 1, custom_ts: 200 }
        const ignore = new Set(['custom_ts'])
        const r = compareResponses(a, b, { ignoreKeys: ignore })
        expect(r.status).toBe('minor_diff')
    })
})

describe('hashResponse', () => {
    it('is deterministic regardless of object key order', () => {
        const h1 = hashResponse({ a: 1, b: 2, c: 3 })
        const h2 = hashResponse({ c: 3, b: 2, a: 1 })
        expect(h1).toBe(h2)
    })

    it('returns different hashes for null vs undefined', () => {
        const hNull = hashResponse(null)
        const hUndef = hashResponse(undefined)
        expect(hNull).not.toBe(hUndef)
    })

    it('returns different hashes for arrays of different orders', () => {
        const h1 = hashResponse([1, 2, 3])
        const h2 = hashResponse([3, 2, 1])
        expect(h1).not.toBe(h2)
    })

    it('produces a 64-char hex sha256 string', () => {
        const h = hashResponse({ foo: 'bar' })
        expect(h).toMatch(/^[0-9a-f]{64}$/)
    })

    it('recurses sorted-key into nested objects', () => {
        const h1 = hashResponse({ outer: { a: 1, b: 2 } })
        const h2 = hashResponse({ outer: { b: 2, a: 1 } })
        expect(h1).toBe(h2)
    })
})
