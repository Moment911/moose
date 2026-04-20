// Shared Vitest mock for Anthropic Vision calls (image + document content blocks).
// Extends the Phase 7 anthropicMock pattern — same fetch-level stub, adds
// convenience builders for vision-style tool_use responses.
import { vi } from 'vitest'

export type VisionToolUseFixture = {
  fields: Array<{ field_name: string; value: string; source_snippet?: string; confidence?: number }>
  inputTokens?: number
  outputTokens?: number
}

export function mockAnthropicVisionCall(fixture: VisionToolUseFixture) {
  const body = {
    id: 'msg_vision_test',
    type: 'message',
    role: 'assistant',
    content: [{
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
    }],
    stop_reason: 'tool_use',
    usage: { input_tokens: fixture.inputTokens ?? 500, output_tokens: fixture.outputTokens ?? 200 },
  }
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as any) as any
}

/** Builder for a document (PDF) content block in a request body — lets tests
 *  assert the request was shaped correctly without hitting the wire. */
export function expectPdfDocumentBlock(body: any, base64Prefix: string) {
  const msg = body.messages?.[0]
  if (!msg) throw new Error('No user message')
  const doc = msg.content.find((c: any) => c.type === 'document')
  if (!doc) throw new Error('No document block')
  if (doc.source.media_type !== 'application/pdf') throw new Error('Wrong media_type')
  if (!doc.source.data.startsWith(base64Prefix)) throw new Error('PDF base64 mismatch')
}

export function expectImageBlock(body: any, mediaType: 'image/png' | 'image/jpeg' | 'image/webp') {
  const msg = body.messages?.[0]
  const img = msg?.content?.find((c: any) => c.type === 'image')
  if (!img) throw new Error('No image block')
  if (img.source.media_type !== mediaType) throw new Error(`Wrong media_type (got ${img.source.media_type})`)
}
