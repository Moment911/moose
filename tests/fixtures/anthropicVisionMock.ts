// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 — Reusable Anthropic Vision SDK fetch mocks for the Plan 06 / 07
// unit suites (PDF + image ingest).
//
// Complements tests/fixtures/anthropicMock.ts (Phase 7 text-only extractor
// fixture) — same fetch-level stub pattern, adds:
//   - mockAnthropicVisionCall       — tool_use response shaped for PDF /
//                                     image extraction with vision-aware
//                                     confidence defaults (0.7)
//   - expectPdfDocumentBlock        — assert outbound request body carries
//                                     a correctly-shaped PDF document block
//                                     (RESEARCH §6 content-block shape)
//   - expectImageBlock              — assert outbound request carries an
//                                     image content block with the right
//                                     media_type (png/jpeg/webp)
//
// Wire into @anthropic-ai/sdk by passing as the `fetch` option; or, because
// this stubs `globalThis.fetch`, by simply calling the mock before the
// anthropic client is constructed.
// ─────────────────────────────────────────────────────────────────────────────

import { vi } from 'vitest'

export type VisionToolUseFixture = {
  fields: Array<{
    field_name: string
    value: string
    source_snippet?: string
    confidence?: number
  }>
  inputTokens?: number
  outputTokens?: number
}

/**
 * Stub globalThis.fetch with an Anthropic Vision response that wraps
 * `fields` in an extract_profile_fields tool_use block — mirrors Phase 7
 * tool-use shape but with vision-leaning confidence defaults (0.7) so
 * tests reflect D-19 confidence ceilings for image_ocr_vision /
 * pdf_image_extract.
 *
 * Returns the mocked fetch so callers can `expect(fetch).toHaveBeenCalled()`.
 */
export function mockAnthropicVisionCall(fixture: VisionToolUseFixture) {
  const body = {
    id: 'msg_vision_test',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_vision_1',
        name: 'extract_profile_fields',
        input: {
          fields: fixture.fields.map(f => ({
            field_name: f.field_name,
            value: f.value,
            source_snippet: f.source_snippet ?? `[vision] ${f.value}`,
            char_offset_start: 0,
            char_offset_end: (f.source_snippet ?? f.value).length,
            confidence: f.confidence ?? 0.7,
          })),
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: {
      input_tokens: fixture.inputTokens ?? 500,
      output_tokens: fixture.outputTokens ?? 200,
    },
  }

  const mocked = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    body: null,
  } as any) as any
  globalThis.fetch = mocked
  return mocked
}

/**
 * Assert that `body.messages[0].content` carries a correctly-shaped PDF
 * document block (RESEARCH §6 content-block shape):
 *
 *   { type: 'document', source: { type: 'base64',
 *                                 media_type: 'application/pdf',
 *                                 data: <base64> } }
 *
 * `base64Prefix` is the first few chars of the expected base64 payload
 * (e.g. 'JVBER' for `%PDF` magic) — prefix match keeps the assertion
 * stable across any fixture size.
 */
export function expectPdfDocumentBlock(body: any, base64Prefix: string): void {
  const msg = body?.messages?.[0]
  if (!msg) throw new Error('expectPdfDocumentBlock: no user message on body.messages[0]')
  const doc = Array.isArray(msg.content)
    ? msg.content.find((c: any) => c?.type === 'document')
    : null
  if (!doc) throw new Error('expectPdfDocumentBlock: no document content block found')
  if (doc.source?.type !== 'base64') throw new Error('expectPdfDocumentBlock: source.type must be base64')
  if (doc.source?.media_type !== 'application/pdf') {
    throw new Error(`expectPdfDocumentBlock: wrong media_type (got ${doc.source?.media_type})`)
  }
  if (typeof doc.source?.data !== 'string' || !doc.source.data.startsWith(base64Prefix)) {
    throw new Error(`expectPdfDocumentBlock: PDF base64 prefix mismatch (expected "${base64Prefix}")`)
  }
}

/**
 * Assert that `body.messages[0].content` carries an image content block
 * with the given `mediaType`. Image shape per RESEARCH §6:
 *
 *   { type: 'image', source: { type: 'base64',
 *                              media_type: 'image/<png|jpeg|webp>',
 *                              data: <base64> } }
 */
export function expectImageBlock(
  body: any,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp',
): void {
  const msg = body?.messages?.[0]
  if (!msg) throw new Error('expectImageBlock: no user message on body.messages[0]')
  const img = Array.isArray(msg.content)
    ? msg.content.find((c: any) => c?.type === 'image')
    : null
  if (!img) throw new Error('expectImageBlock: no image content block found')
  if (img.source?.type !== 'base64') throw new Error('expectImageBlock: source.type must be base64')
  if (img.source?.media_type !== mediaType) {
    throw new Error(`expectImageBlock: wrong media_type (got ${img.source?.media_type}, expected ${mediaType})`)
  }
}
