import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// synergyEngine.test — WS3 synergistic recommendations (Phase 12 / Plan 12-03).
//
// A Sonnet pass over the client's CONFIRMED services/offerings + industry/business
// context recommends complementary/synergistic services + products as ACCEPT-able
// suggestions (distinct from confirmed). CRITICAL: when ANTHROPIC_API_KEY is
// absent/unfunded the engine returns {ok:false, reason:'ai_unavailable'} WITHOUT
// throwing and WITHOUT a silent catch (copies serviceInference.ts:216 — NOT the
// localStrategistEngine ANTHROPIC_API_KEY! throw).
//
// Tests (all on the pure helpers or a mocked Claude — no network):
//   (1) recommendSynergies returns {ok:false, reason:'ai_unavailable'} with empty
//       arrays when ANTHROPIC_API_KEY is unset (never throws).
//   (2) parseSynergyJson handles a fenced ```json block and a bare object; garbage
//       → empty arrays (null shape).
//   (3) buildSynergyPrompt includes the confirmed service names + industry.
//   (4) on the Sonnet path, logTokenUsage is called exactly once with the
//       synergy-recommendations feature.
// ─────────────────────────────────────────────────────────────────────────────

const logTokenUsageMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/tokenTracker', () => ({
    logTokenUsage: (...a: unknown[]) => logTokenUsageMock(...a),
}))

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = { create: (...a: unknown[]) => createMock(...a) }
    },
}))

import {
    recommendSynergies,
    buildSynergyPrompt,
    parseSynergyJson,
} from '@/lib/kotoiq/synergyEngine'

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
    logTokenUsageMock.mockClear()
    createMock.mockReset()
})

afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
})

describe('parseSynergyJson', () => {
    it('parses a fenced ```json block', () => {
        const raw = '```json\n{"synergistic_services":[{"name":"Gutter Cleaning","rationale":"pairs with roofing"}],"complementary_products":[{"name":"Roof Warranty","rationale":"recurring revenue"}]}\n```'
        const parsed = parseSynergyJson(raw)
        expect(parsed).not.toBeNull()
        expect(parsed!.synergistic_services).toHaveLength(1)
        expect(parsed!.synergistic_services[0].name).toBe('Gutter Cleaning')
        expect(parsed!.complementary_products[0].name).toBe('Roof Warranty')
    })

    it('parses a bare object with surrounding prose', () => {
        const raw = 'Here you go: {"synergistic_services":[{"name":"Drain Cleaning","rationale":"adjacent trade"}],"complementary_products":[]} hope this helps'
        const parsed = parseSynergyJson(raw)
        expect(parsed).not.toBeNull()
        expect(parsed!.synergistic_services[0].name).toBe('Drain Cleaning')
        expect(parsed!.complementary_products).toHaveLength(0)
    })

    it('returns null on garbage', () => {
        expect(parseSynergyJson('not json at all')).toBeNull()
        expect(parseSynergyJson('{"synergistic_services":"oops"}')).toBeNull()
    })

    it('drops malformed items lacking a name', () => {
        const raw = '{"synergistic_services":[{"rationale":"no name"},{"name":"Real Service","rationale":"ok"}],"complementary_products":[]}'
        const parsed = parseSynergyJson(raw)
        expect(parsed).not.toBeNull()
        expect(parsed!.synergistic_services).toHaveLength(1)
        expect(parsed!.synergistic_services[0].name).toBe('Real Service')
    })
})

describe('buildSynergyPrompt', () => {
    it('includes the confirmed service names + offerings + industry', () => {
        const prompt = buildSynergyPrompt({
            services: ['Roof Repair', 'Storm Restoration'],
            offerings: ['Free Estimate'],
            industry: 'Roofing',
            businessName: 'Acme Roofing',
        })
        expect(prompt).toContain('Roof Repair')
        expect(prompt).toContain('Storm Restoration')
        expect(prompt).toContain('Free Estimate')
        expect(prompt).toContain('Roofing')
        expect(prompt).toContain('Acme Roofing')
    })
})

describe('recommendSynergies', () => {
    it('returns {ok:false, reason:ai_unavailable} with empty arrays when no key (never throws)', async () => {
        delete process.env.ANTHROPIC_API_KEY
        const res = await recommendSynergies({
            agencyId: 'ag1',
            clientId: 'cl1',
            services: ['Roof Repair'],
            offerings: [],
            industry: 'Roofing',
            businessName: 'Acme',
        })
        expect(res.ok).toBe(false)
        expect(res.reason).toBe('ai_unavailable')
        expect(res.ai_available).toBe(false)
        expect(res.synergistic_services).toEqual([])
        expect(res.complementary_products).toEqual([])
        expect(logTokenUsageMock).not.toHaveBeenCalled()
    })

    it('returns parsed synergies and logs token usage exactly once on the Sonnet path', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-test'
        createMock.mockResolvedValue({
            content: [{ type: 'text', text: '{"synergistic_services":[{"name":"Gutter Cleaning","rationale":"pairs"}],"complementary_products":[{"name":"Roof Warranty","rationale":"recurring"}]}' }],
            usage: { input_tokens: 100, output_tokens: 50 },
        })
        const res = await recommendSynergies({
            agencyId: 'ag1',
            clientId: 'cl1',
            services: ['Roof Repair'],
            offerings: ['Free Estimate'],
            industry: 'Roofing',
            businessName: 'Acme',
        })
        expect(res.ok).toBe(true)
        expect(res.ai_available).toBe(true)
        expect(res.synergistic_services[0].name).toBe('Gutter Cleaning')
        expect(res.complementary_products[0].name).toBe('Roof Warranty')
        expect(logTokenUsageMock).toHaveBeenCalledTimes(1)
        expect(logTokenUsageMock).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'kotoiq_synergy_recommendations', model: 'claude-sonnet-4-6' }),
        )
    })

    it('returns {ok:false, reason:parse_error} on unparseable Sonnet output (no throw, still logs)', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-test'
        createMock.mockResolvedValue({
            content: [{ type: 'text', text: 'completely not json' }],
            usage: { input_tokens: 10, output_tokens: 5 },
        })
        const res = await recommendSynergies({
            agencyId: 'ag1',
            clientId: 'cl1',
            services: ['Roof Repair'],
            offerings: [],
        })
        expect(res.ok).toBe(false)
        expect(res.reason).toBe('parse_error')
        expect(res.synergistic_services).toEqual([])
        expect(res.complementary_products).toEqual([])
        // The Sonnet call DID happen → spend is tracked even on a parse failure.
        expect(logTokenUsageMock).toHaveBeenCalledTimes(1)
    })

    it('does not throw when the Sonnet call itself errors — degrades to ai_unavailable', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-test'
        createMock.mockRejectedValue(new Error('network down'))
        const res = await recommendSynergies({
            agencyId: 'ag1',
            clientId: 'cl1',
            services: ['Roof Repair'],
            offerings: [],
        })
        expect(res.ok).toBe(false)
        expect(res.reason).toBe('ai_unavailable')
        expect(res.synergistic_services).toEqual([])
    })
})
