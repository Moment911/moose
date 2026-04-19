import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAnthropicFetch } from './fixtures/anthropicMock'

const originalFetch = globalThis.fetch
beforeEach(() => {
  globalThis.fetch = originalFetch
})
process.env.ANTHROPIC_API_KEY = 'sk-test'

describe('extractFromVoiceTranscript', () => {
  it('returns ProvenanceRecord arrays for competitor_mentions, objections, pain_point_emphasis, differentiators', async () => {
    globalThis.fetch = mockAnthropicFetch({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            competitor_mentions: [
              { name: 'Acme SEO', snippet: 'they all use Acme SEO', confidence: 0.9 },
            ],
            objections: [
              { text: 'pricing concerns', snippet: 'too expensive', confidence: 0.8 },
            ],
            pain_point_emphasis: [
              {
                text: 'emergency response',
                snippet: 'emergency calls four times a week',
                confidence: 0.85,
              },
            ],
            differentiators: [
              { text: 'same-day service', snippet: 'we respond same day', confidence: 0.9 },
            ],
          }),
        },
      ],
      usage: { input_tokens: 200, output_tokens: 100 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { extractFromVoiceTranscript } = await import(
      '../src/lib/kotoiq/profileVoiceExtract'
    )
    const out = await extractFromVoiceTranscript({
      transcript: 'x'.repeat(200),
      call_id: 'call_abc',
      call_start: '2026-04-17T10:00:00Z',
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(out.fields.competitor_mentions?.[0].value).toBe('Acme SEO')
    expect(out.fields.competitor_mentions?.[0].source_type).toBe('voice_call')
    expect(out.fields.competitor_mentions?.[0].source_ref).toBe('retell_call:call_abc')
    expect(out.fields.objections?.[0].value).toBe('pricing concerns')
    expect(out.fields.pain_point_emphasis?.[0].value).toBe('emergency response')
    expect(out.fields.differentiators?.[0].value).toBe('same-day service')
    expect(out.fields.competitor_mentions?.[0].captured_at).toBe(
      '2026-04-17T10:00:00Z',
    )
  })

  it('returns empty fields when transcript too short (noise guard)', async () => {
    const { extractFromVoiceTranscript } = await import(
      '../src/lib/kotoiq/profileVoiceExtract'
    )
    const out = await extractFromVoiceTranscript({
      transcript: 'hi',
      call_id: 'call_x',
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(Object.keys(out.fields)).toHaveLength(0)
  })

  it('strips markdown fences before JSON.parse', async () => {
    globalThis.fetch = mockAnthropicFetch({
      content: [
        {
          type: 'text',
          text:
            '```json\n' +
            JSON.stringify({
              competitor_mentions: [
                { name: 'X', snippet: 'x', confidence: 0.9 },
              ],
              objections: [],
              pain_point_emphasis: [],
              differentiators: [],
            }) +
            '\n```',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { extractFromVoiceTranscript } = await import(
      '../src/lib/kotoiq/profileVoiceExtract'
    )
    const out = await extractFromVoiceTranscript({
      transcript: 'x'.repeat(200),
      call_id: 'call_fence',
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(out.fields.competitor_mentions?.[0].value).toBe('X')
  })

  it('returns empty on API failure (no throw)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as any
    const { extractFromVoiceTranscript } = await import(
      '../src/lib/kotoiq/profileVoiceExtract'
    )
    const out = await extractFromVoiceTranscript({
      transcript: 'x'.repeat(200),
      call_id: 'call_fail',
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(Object.keys(out.fields)).toHaveLength(0)
  })
})
