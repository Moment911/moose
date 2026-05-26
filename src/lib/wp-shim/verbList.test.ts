import { describe, it, expect } from 'vitest'
import { SHIM_VERBS, isShimVerb, type ShimVerb } from './verbList'

// ─────────────────────────────────────────────────────────────────────────────
// Lock test — guards the canonical 27-verb whitelist against accidental drift.
//
// Any change here demands the PHP verb-table in the shim plugin update too;
// the dispatcher MUST stay in lockstep with this file.
// ─────────────────────────────────────────────────────────────────────────────

describe('SHIM_VERBS — canonical 27-verb whitelist', () => {
    it('contains exactly 27 entries', () => {
        expect(SHIM_VERBS.length).toBe(27)
    })

    it('contains the canonical sample verb names', () => {
        // One representative from each major group — if any of these vanish,
        // a verb was renamed (which Plan 02's dispatcher will reject).
        expect(SHIM_VERBS).toContain('health.ping')
        expect(SHIM_VERBS).toContain('meta.update')
        expect(SHIM_VERBS).toContain('elementor.save')
        expect(SHIM_VERBS).toContain('query.select')
        expect(SHIM_VERBS).toContain('file.write')
    })

    it('contains NO IP-leaky verb names', () => {
        // Names that reveal what KotoIQ does. If anyone adds one of these
        // because "it'd be convenient", this test screams.
        const ipLeakyForbidden = [
            'seo.score',
            'sitemap.generate',
            'content.rotate',
            'page.factory',
            'redirect.add',
        ]
        for (const forbidden of ipLeakyForbidden) {
            expect(SHIM_VERBS).not.toContain(forbidden)
        }
    })

    it('every verb matches the noun.verb regex shape', () => {
        // /^[a-z_]+\.[a-z_]+$/ — lowercase, underscore-allowed, single dot.
        // Catches accidental capitalisation, dashes, dotted paths.
        const shape = /^[a-z_]+\.[a-z_]+$/
        for (const verb of SHIM_VERBS) {
            expect(verb).toMatch(shape)
        }
    })

    it('isShimVerb runtime guard accepts every canonical verb and rejects unknowns', () => {
        // Type-level lock: every entry of SHIM_VERBS should be ShimVerb.
        // Runtime lock: isShimVerb returns true for every canonical entry.
        for (const v of SHIM_VERBS) {
            const typed: ShimVerb = v
            expect(isShimVerb(typed)).toBe(true)
        }
        expect(isShimVerb('seo.score')).toBe(false)
        expect(isShimVerb('unknown.verb')).toBe(false)
        expect(isShimVerb('')).toBe(false)
        expect(isShimVerb(undefined)).toBe(false)
        expect(isShimVerb(42)).toBe(false)
    })
})
