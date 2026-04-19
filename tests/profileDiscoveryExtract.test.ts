import { describe, it, expect, beforeEach } from 'vitest'
import { mockAnthropicFetch } from './fixtures/anthropicMock'

const originalFetch = globalThis.fetch
beforeEach(() => {
  globalThis.fetch = originalFetch
})
process.env.ANTHROPIC_API_KEY = 'sk-test'

describe('extractFromDiscoverySection', () => {
  it('returns ProvenanceRecord map keyed on CANONICAL_FIELD_NAMES', async () => {
    globalThis.fetch = mockAnthropicFetch({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fields: [
              {
                field_name: 'primary_service',
                value: 'Google Ads management',
                snippet: 'We focus on Google Ads for local service biz.',
                confidence: 0.9,
              },
              {
                field_name: 'target_customer',
                value: 'small local businesses',
                snippet: 'Our ICP is local service businesses.',
                confidence: 0.85,
              },
              {
                field_name: 'NOT_A_REAL_FIELD',
                value: 'junk',
                snippet: 'junk',
                confidence: 0.9,
              },
            ],
          }),
        },
      ],
      usage: { input_tokens: 250, output_tokens: 120 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { extractFromDiscoverySection } = await import(
      '../src/lib/kotoiq/profileDiscoveryExtract'
    )
    const out = await extractFromDiscoverySection({
      engagementId: 'eng-1',
      sectionKey: 'services',
      sectionTitle: 'Services',
      sectionText:
        'We focus on Google Ads management for local service businesses. Our ICP is local service businesses.',
      agencyId: 'a1',
      clientId: 'c1',
      sourceUrl: 'https://hellokoto.com/discovery/eng-1',
    })
    expect(out.primary_service?.[0].value).toBe('Google Ads management')
    expect(out.primary_service?.[0].source_type).toBe('discovery_doc')
    expect(out.primary_service?.[0].source_ref).toBe(
      'discovery_doc:eng-1:section:services',
    )
    expect(out.primary_service?.[0].source_url).toBe(
      'https://hellokoto.com/discovery/eng-1',
    )
    expect(out.target_customer?.[0].value).toBe('small local businesses')
    // Junk field rejected by CANONICAL_FIELD_NAMES allowlist
    expect(out.NOT_A_REAL_FIELD).toBeUndefined()
  })

  it('returns {} when sectionText < 20 chars (noise guard)', async () => {
    const { extractFromDiscoverySection } = await import(
      '../src/lib/kotoiq/profileDiscoveryExtract'
    )
    const out = await extractFromDiscoverySection({
      engagementId: 'eng-x',
      sectionKey: 'k',
      sectionTitle: 't',
      sectionText: 'too short',
      agencyId: 'a1',
      clientId: 'c1',
      sourceUrl: 'https://hellokoto.com/discovery/eng-x',
    })
    expect(Object.keys(out)).toHaveLength(0)
  })

  it('returns {} on JSON parse failure', async () => {
    globalThis.fetch = mockAnthropicFetch({
      content: [{ type: 'text', text: 'not valid json {{{' }],
      usage: { input_tokens: 50, output_tokens: 20 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { extractFromDiscoverySection } = await import(
      '../src/lib/kotoiq/profileDiscoveryExtract'
    )
    const out = await extractFromDiscoverySection({
      engagementId: 'eng-y',
      sectionKey: 'k',
      sectionTitle: 't',
      sectionText: 'x'.repeat(100),
      agencyId: 'a1',
      clientId: 'c1',
      sourceUrl: 'https://hellokoto.com/discovery/eng-y',
    })
    expect(Object.keys(out)).toHaveLength(0)
  })
})
