// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Reusable Anthropic SDK fetch mocks for the Plan 2-5 unit suites.
//
// Three helpers cover every shape the seeder + classifier + narrator code
// paths consume:
//   - mockAnthropicFetch         — one-shot JSON response
//   - mockAnthropicToolUse       — JSON response wrapped in a tool_use block
//                                  (extract_profile_fields signature)
//   - mockAnthropicStreaming     — SSE-style text-delta stream for the
//                                  D-07 live-narration path
//
// All return a vi.fn() that satisfies the @anthropic-ai/sdk transport
// fetch contract.  Wire into the SDK by passing as the `fetch` option
// when constructing the client in tests, e.g.
//
//   import Anthropic from '@anthropic-ai/sdk'
//   const fetch = mockAnthropicToolUse([...])
//   const client = new Anthropic({ apiKey: 'test', fetch })
// ─────────────────────────────────────────────────────────────────────────────

import { vi } from 'vitest'

export function mockAnthropicFetch(responseBody: any) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => responseBody,
    body: null,
  })
}

export function mockAnthropicToolUse(extractedFields: Array<Record<string, any>>) {
  return mockAnthropicFetch({
    content: [
      {
        type: 'tool_use',
        name: 'extract_profile_fields',
        input: { fields: extractedFields },
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
  })
}

export function mockAnthropicStreaming(chunks: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        const sse = `event: content_block_delta\ndata: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: c },
        })}\n\n`
        controller.enqueue(encoder.encode(sse))
      }
      controller.close()
    },
  })
  return vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream })
}
