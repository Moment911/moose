import 'server-only'
import { MODELS, FEATURE_TAGS } from './profileConfig'
import { logTokenUsage } from '../tokenTracker'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 3 — Narration helper primitives for the streaming seeder.
//
// RESEARCH §5 (Option C — orchestrated SSE endpoint): the Launch Page
// reads newline-delimited text chunks from
// `/api/kotoiq/profile/stream_seed` so each sentence can fade-in as it
// arrives.  This module exposes the four primitives Plan 4's route uses:
//
//   writeNarrationLine        — enqueue one newline-terminated line
//   proxyHaikuStream          — drain Anthropic SSE → text_delta → controller
//                               (verbatim pattern from build-proposal/route.ts:134-178)
//   streamHaikuWrapUp         — fire one Haiku stream call + proxy + log tokens
//   narrationResponseHeaders  — exact three headers the client reader expects
//
// Plan 4 composes these into the seeder loop:
//   for each ingest stage → writeNarrationLine("Pulled X from Y…")
//   final wrap-up         → streamHaikuWrapUp({ ... })
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes one narration line to a ReadableStream controller.
 * Chunks are newline-terminated so the client can split on '\n' and fade
 * each sentence (UI-SPEC §5.1 + RESEARCH §5 Option C client-side reader).
 */
export function writeNarrationLine(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  line: string,
) {
  if (!line) return
  const chunk = line.endsWith('\n') ? line : line + '\n'
  controller.enqueue(encoder.encode(chunk))
}

/**
 * Proxies a Claude SSE response through, filtering text_delta events into
 * plain-text chunks written to the controller.  Verbatim SSE-parsing pattern
 * from src/app/api/demo/build-proposal/route.ts:134-178 — buffer-on-`\n\n`,
 * filter `content_block_delta` + `text_delta`.
 */
export async function proxyHaikuStream(
  anthropicRes: Response,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
): Promise<void> {
  if (!anthropicRes.body) return
  const reader = anthropicRes.body.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    sseBuffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
      const block = sseBuffer.slice(0, idx)
      sseBuffer = sseBuffer.slice(idx + 2)
      const dataLines = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
      for (const line of dataLines) {
        if (!line || line === '[DONE]') continue
        try {
          const evt = JSON.parse(line)
          if (
            evt.type === 'content_block_delta' &&
            evt.delta?.type === 'text_delta' &&
            typeof evt.delta.text === 'string'
          ) {
            controller.enqueue(encoder.encode(evt.delta.text))
          }
        } catch {
          // skip malformed SSE chunk
        }
      }
    }
  }
}

/**
 * Fires a one-shot Haiku stream prompt and proxies its text into the
 * controller.  Falls back to a static line on fetch failure so the client
 * never sees an empty stream.  Token usage is logged best-effort (streaming
 * doesn't return usage in text_delta events; a full implementation would
 * also parse `message_stop` for the final usage block — Plan 4 may refine).
 */
export async function streamHaikuWrapUp(args: {
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
  systemPrompt: string
  userMessage: string
  agencyId: string
  clientId: string
}): Promise<void> {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) {
    writeNarrationLine(
      args.controller,
      args.encoder,
      "I couldn't reach Claude to wrap up — showing you what I've got.",
    )
    return
  }

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': MODELS.ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: MODELS.HAIKU,
        max_tokens: 160,
        stream: true,
        system: args.systemPrompt,
        messages: [{ role: 'user', content: args.userMessage }],
      }),
    })
  } catch {
    writeNarrationLine(
      args.controller,
      args.encoder,
      "Done. Let me show you what I've got.",
    )
    return
  }
  if (!res.ok) {
    writeNarrationLine(
      args.controller,
      args.encoder,
      "Done. Let me show you what I've got.",
    )
    return
  }

  await proxyHaikuStream(res, args.controller, args.encoder)

  // Best-effort token logging — streaming text_delta events don't carry usage.
  // Rough estimate: ~4 chars/token for input, fixed 40-token output guess.
  // Plan 4 may refine by also parsing `message_stop` events for true usage.
  void logTokenUsage({
    feature: FEATURE_TAGS.NARRATE,
    model: MODELS.HAIKU,
    inputTokens: Math.ceil(
      (args.systemPrompt.length + args.userMessage.length) / 4,
    ),
    outputTokens: 40,
    agencyId: args.agencyId,
    metadata: { client_id: args.clientId },
  })
}

/**
 * Exact response headers the Plan 4 `/api/kotoiq/profile/stream_seed` route
 * MUST return.  RESEARCH §5 Option C — `X-Accel-Buffering: no` defeats nginx
 * proxy buffering on the Vercel edge so each chunk reaches the browser
 * immediately.  `no-transform` blocks gzip-mid-stream rewriting.
 */
export function narrationResponseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  }
}
