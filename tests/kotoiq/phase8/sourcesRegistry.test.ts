import { describe, it, expect } from 'vitest'
import {
  SOURCE_TYPES,
  type SourceType,
  type ClientProfile,
} from '../../../src/lib/kotoiq/profileTypes'
import {
  mockAnthropicVisionCall,
  expectPdfDocumentBlock,
  expectImageBlock,
} from '../../fixtures/anthropicVisionMock'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Plan 1 — sourcesRegistry parity + shared Vision fixture smoke tests.
//
// Catches editor regressions where only ONE of profileTypes.ts /
// profileConfig.ts was updated — duplicate of the Task 1 SOURCE_TYPES
// assertion plus type-level shape checks for the `sources` jsonb entries
// (D-27, unchanged schema from Phase 7).
//
// Also smoke-tests the new anthropicVisionMock fixture so downstream Plans
// 06 and 07 can rely on it.
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_8_SOURCE_TYPES: SourceType[] = [
  'typeform_api',
  'jotform_api',
  'google_forms_api',
  'form_scrape',
  'website_scrape',
  'gbp_authenticated',
  'gbp_public',
  'pdf_text_extract',
  'pdf_image_extract',
  'docx_text_extract',
  'image_ocr_vision',
]

describe('phase 8 — sources registry type parity (D-27)', () => {
  it('SOURCE_TYPES contains all 11 Phase 8 values (append-only invariant)', () => {
    // Duplicate of the Task 1 assertion on purpose — catches regressions
    // where an editor touches only profileConfig.ts without updating
    // profileTypes.ts (or vice versa).
    for (const t of PHASE_8_SOURCE_TYPES) {
      expect(SOURCE_TYPES).toContain(t)
    }
  })

  it('ClientProfile.sources accepts a website_scrape entry (Phase 7 D-09 shape)', () => {
    // Type-level assertion via real value — TS narrows the shape; if the
    // union of source_type ever narrowed away from Phase 8 values this
    // would fail to compile (not just assert).
    type SourcesEntry = ClientProfile['sources'][number]
    const entry: SourcesEntry = {
      source_type: 'website_scrape',
      source_url: 'https://example.com/about',
      added_at: '2026-04-20T00:00:00Z',
      added_by: 'operator:user_123',
      metadata: { crawl_mode: 'A', pages_crawled: 5 },
    }
    expect(entry.source_type).toBe('website_scrape')
    expect(entry.source_url).toBe('https://example.com/about')
  })

  it('ClientProfile.sources accepts a file upload entry with chunked source_ref (D-20)', () => {
    type SourcesEntry = ClientProfile['sources'][number]
    const entry: SourcesEntry = {
      source_type: 'pdf_text_extract',
      source_ref: 'upload:3fa85f64-5717-4562-b3fc-2c963f66afa6#page=3',
      added_at: '2026-04-20T00:00:00Z',
      added_by: 'operator:user_123',
      metadata: { upload_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', page: 3 },
    }
    expect(entry.source_type).toBe('pdf_text_extract')
    expect(entry.source_ref).toMatch(/^upload:[0-9a-f-]+#page=\d+$/)
  })

  it('ClientProfile.sources accepts a GBP authenticated entry', () => {
    type SourcesEntry = ClientProfile['sources'][number]
    const entry: SourcesEntry = {
      source_type: 'gbp_authenticated',
      source_ref: 'locations/456',
      added_at: '2026-04-20T00:00:00Z',
      added_by: 'operator:user_123',
      metadata: {
        gbp_location_name: 'accounts/123/locations/456',
        oauth_token_ref: 'koto_agency_integrations:uuid-here',
      },
    }
    expect(entry.source_type).toBe('gbp_authenticated')
  })
})

describe('phase 8 — anthropicVisionMock fixture smoke', () => {
  it('mockAnthropicVisionCall returns a tool_use response with the fields input', async () => {
    mockAnthropicVisionCall({
      fields: [
        { field_name: 'business_name', value: 'Acme Plumbing' },
        { field_name: 'phone', value: '5551234567', confidence: 0.6 },
      ],
      inputTokens: 1200,
      outputTokens: 80,
    })
    const res = await (globalThis.fetch as any)('https://api.anthropic.com/v1/messages', {
      method: 'POST',
    })
    const body = await res.json()
    expect(body.type).toBe('message')
    expect(body.content[0].type).toBe('tool_use')
    expect(body.content[0].name).toBe('extract_profile_fields')
    expect(body.content[0].input.fields).toHaveLength(2)
    expect(body.content[0].input.fields[0].field_name).toBe('business_name')
    expect(body.content[0].input.fields[1].confidence).toBe(0.6)
    expect(body.usage.input_tokens).toBe(1200)
  })

  it('expectPdfDocumentBlock validates a correctly-shaped PDF document block', () => {
    const body = {
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==',  // `%PDF-1.4` base64 prefix
            },
          },
          { type: 'text', text: 'Extract fields' },
        ],
      }],
    }
    // Should not throw.
    expect(() => expectPdfDocumentBlock(body, 'JVBER')).not.toThrow()
    // Wrong prefix should throw.
    expect(() => expectPdfDocumentBlock(body, 'XXXXX')).toThrow()
    // Missing document block should throw.
    expect(() => expectPdfDocumentBlock({ messages: [{ content: [] }] }, 'JVBER')).toThrow()
  })

  it('expectImageBlock validates the media_type of an image content block', () => {
    const body = {
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: '/9j/4AAQSkZJRg==',
            },
          },
          { type: 'text', text: 'Extract fields' },
        ],
      }],
    }
    expect(() => expectImageBlock(body, 'image/jpeg')).not.toThrow()
    expect(() => expectImageBlock(body, 'image/png')).toThrow()
  })
})
