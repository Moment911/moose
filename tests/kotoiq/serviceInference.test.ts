import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// serviceInference.test — WS3 service auto-extraction (Phase 11 / Plan 11-03).
//
// The client's services are inferred FROM the client's own baseline-scanned
// pages (NOT the keyword scan). Services are AI-inferred → user-editable, so
// every inferred item carries an `ai_inferred` provenance flag (data-integrity
// standard: the user must verify AI output before it drives builds).
//
// Three behaviors the plan calls out, all on the PURE helpers / a mocked Claude
// client so no network is required:
//
//   (1) the heuristic extracts a clean, DEDUPED + SORTED services list from
//       fixture pages with /services/{x} URL paths + service-y H1s, and every
//       returned service carries source_type:'ai_inferred' + a confidence.
//   (2) graceful degrade — empty / no-signal pages return an empty list, never
//       throws.
//   (3) when the Claude (Haiku) escalation path runs, logTokenUsage is called
//       exactly once with the service-inference feature.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mocks (declared before importing the module under test) ──────────────────

const logTokenUsageMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/tokenTracker', () => ({
    logTokenUsage: (...a: unknown[]) => logTokenUsageMock(...a),
}))

// Mock the Anthropic SDK so the escalation path is exercised without network.
const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = { create: (...a: unknown[]) => createMock(...a) }
    },
}))

import {
    inferServices,
    normalizeServiceName,
    servicesFromHeuristic,
    type BaselinePageInput,
} from '@/lib/kotoiq/serviceInference'

// Minimal baseline-page shape the engine reads (subset of ExtractedPage).
const page = (over: Partial<BaselinePageInput> = {}): BaselinePageInput => ({
    url: 'https://acme.test/services/roof-repair',
    h1: 'Roof Repair',
    meta_title: 'Roof Repair | Acme Roofing',
    page_type: 'service',
    word_count: 320,
    ...over,
})

beforeEach(() => {
    logTokenUsageMock.mockClear()
    createMock.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
})
afterEach(() => { vi.restoreAllMocks() })

describe('normalizeServiceName (pure)', () => {
    it('title-cases, trims, collapses whitespace, strips boilerplate', () => {
        expect(normalizeServiceName('  roof   repair ')).toBe('Roof Repair')
        expect(normalizeServiceName('Emergency Plumbing Services')).toBe('Emergency Plumbing')
        expect(normalizeServiceName('hvac-installation')).toBe('Hvac Installation')
    })
})

describe('servicesFromHeuristic (pure, deterministic)', () => {
    it('extracts deduped + sorted services from /services/ paths and H1s', () => {
        const pages: BaselinePageInput[] = [
            page({ url: 'https://acme.test/services/roof-repair', h1: 'Roof Repair' }),
            // duplicate via H1 vs path slug — must dedupe
            page({ url: 'https://acme.test/services/roof-repair/', h1: 'Roof Repair Services' }),
            page({ url: 'https://acme.test/services/gutter-cleaning', h1: 'Gutter Cleaning' }),
            // non-service page contributes nothing
            page({ url: 'https://acme.test/about', h1: 'About Us', page_type: 'other' }),
            page({ url: 'https://acme.test/', h1: 'Home', page_type: 'home' }),
        ]
        const out = servicesFromHeuristic(pages)
        expect(out).toEqual(['Gutter Cleaning', 'Roof Repair'])
    })

    it('returns an empty list for pages with no service signal', () => {
        const out = servicesFromHeuristic([
            page({ url: 'https://acme.test/', h1: 'Home', page_type: 'home' }),
            page({ url: 'https://acme.test/contact', h1: 'Contact', page_type: 'other' }),
        ])
        expect(out).toEqual([])
    })
})

describe('inferServices (heuristic path)', () => {
    it('returns ai_inferred, confidence-carrying, deduped + sorted services', async () => {
        const res = await inferServices({
            agencyId: 'ag1',
            clientId: 'cl1',
            pages: [
                page({ url: 'https://acme.test/services/roof-repair', h1: 'Roof Repair' }),
                page({ url: 'https://acme.test/services/gutter-cleaning', h1: 'Gutter Cleaning' }),
                page({ url: 'https://acme.test/services/siding', h1: 'Siding Installation' }),
            ],
        })

        expect(res.ok).toBe(true)
        expect(res.source).toBe('heuristic')
        const names = res.services.map(s => s.name)
        // deduped + sorted
        expect(names).toEqual([...names].sort())
        expect(names).toContain('Roof Repair')
        // every inferred service is flagged ai_inferred + carries a confidence
        for (const s of res.services) {
            expect(s.provenance.source_type).toBe('ai_inferred')
            expect(typeof s.provenance.confidence).toBe('number')
            expect(s.provenance.confidence).toBeGreaterThan(0)
            expect(typeof s.provenance.source_url).toBe('string')
            expect(typeof s.provenance.captured_at).toBe('string')
        }
        // heuristic path never calls Claude
        expect(createMock).not.toHaveBeenCalled()
        expect(logTokenUsageMock).not.toHaveBeenCalled()
    })

    it('degrades gracefully (empty list, ok) when there are no pages', async () => {
        const res = await inferServices({ agencyId: 'ag1', clientId: 'cl1', pages: [] })
        expect(res.ok).toBe(true)
        expect(res.services).toEqual([])
    })
})

describe('inferServices (Claude/Haiku escalation path)', () => {
    it('logs token usage exactly once with the service-inference feature', async () => {
        createMock.mockResolvedValue({
            content: [{ type: 'text', text: '{"services":["Roof Repair","Storm Damage Restoration"]}' }],
            usage: { input_tokens: 120, output_tokens: 30 },
        })

        // Thin heuristic signal (no /services/ paths) forces escalation, but the
        // pages still carry body signal in H1/meta so the Haiku pass is invoked.
        const res = await inferServices({
            agencyId: 'ag1',
            clientId: 'cl1',
            forceClaude: true,
            pages: [
                page({ url: 'https://acme.test/what-we-do', h1: 'What We Do', page_type: 'other' }),
                page({ url: 'https://acme.test/storm', h1: 'Storm Damage', page_type: 'other' }),
            ],
        })

        expect(createMock).toHaveBeenCalledTimes(1)
        expect(logTokenUsageMock).toHaveBeenCalledTimes(1)
        const arg = logTokenUsageMock.mock.calls[0][0] as { feature: string; model: string }
        expect(arg.feature).toBe('kotoiq_service_inference')
        expect(arg.model).toBe('claude-haiku-4-5-20251001')

        expect(res.source).toBe('claude')
        const names = res.services.map(s => s.name).sort()
        expect(names).toContain('Roof Repair')
        for (const s of res.services) {
            expect(s.provenance.source_type).toBe('ai_inferred')
        }
    })
})
