import { NextRequest } from 'next/server'
import { verifySession } from '../../../../../lib/apiAuth'
import {
  writeNarrationLine,
  streamHaikuWrapUp,
  narrationResponseHeaders,
} from '../../../../../lib/kotoiq/profileNarration'
import {
  pullFromClient,
  pullFromRecipients,
  pullFromDiscovery,
} from '../../../../../lib/kotoiq/profileIngestInternal'
import { pullRetellTranscripts } from '../../../../../lib/kotoiq/profileRetellPull'
import { seedProfile } from '../../../../../lib/kotoiq/profileSeeder'
import { MAX_PASTED_TEXT_CHARS } from '../../../../../lib/kotoiq/profileConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — POST /api/kotoiq/profile/stream_seed
//
// SSE-style streaming endpoint that narrates the full Stage 0 seed pipeline
// to the Launch Page. Returns text/plain chunked response so a client
// `fetch().body.getReader()` can split on '\n' and fade each sentence in
// (UI-SPEC §5.1, RESEARCH §5 Option C).
//
// Auth: verifySession only — body.agency_id is NEVER trusted (T-07-01d).
// Cost: bounded by maxDuration=60 + seeder internal timeouts (Sonnet 30s,
//       Haiku 15s, gate 20s) + SEED_DEBOUNCE_SECONDS=30 (re-seed within 30s
//       returns cached unless forceRebuild=true).
// Pasted text: capped at MAX_PASTED_TEXT_CHARS=50000 (T-07-07b DoS guard)
//              before any Claude call.
//
// Stream protocol:
//   - Each chunk is a UTF-8 string ending in '\n'
//   - Headers from narrationResponseHeaders() set Content-Type, Cache-Control,
//     and X-Accel-Buffering=no (defeats nginx proxy buffering on Vercel edge)
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // 1. Auth — agencyId comes from session, never from body
  const session = await verifySession(req)
  if (!session.verified || !session.agencyId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  const agencyId = session.agencyId

  // 2. Parse body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const {
    client_id,
    pasted_text,
    pasted_text_source_label,
    pasted_text_source_url,
    force_rebuild,
  } = body || {}
  if (!client_id) {
    return new Response(JSON.stringify({ error: 'client_id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (pasted_text && typeof pasted_text !== 'string') {
    return new Response(
      JSON.stringify({ error: 'pasted_text must be a string' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }
  if (pasted_text && pasted_text.length > MAX_PASTED_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `pasted_text exceeds ${MAX_PASTED_TEXT_CHARS} chars`,
      }),
      { status: 413, headers: { 'content-type': 'application/json' } },
    )
  }

  // 3. Build the SSE stream
  // WR-05 — wire client-disconnect to an AbortController so we can short-circuit
  // between stages when the operator navigates away or kills the tab. The
  // underlying seedProfile / extractor calls each enforce their own per-fetch
  // timeouts (Sonnet 30s, Haiku 15s, gate 20s); cancellation here adds a
  // between-stage check so we don't burn additional tokens after disconnect.
  const ac = new AbortController()
  const onAbort = () => {
    try { ac.abort() } catch { /* ignore */ }
  }
  try { req.signal.addEventListener('abort', onAbort) } catch { /* req.signal may be missing in test envs */ }

  const encoder = new TextEncoder()

  // Helper — abort-aware narration. Once aborted we stop pushing chunks
  // (the controller is being torn down anyway) but never throw.
  const writeIfActive = (controller: ReadableStreamDefaultController, text: string) => {
    if (ac.signal.aborted) return
    try { writeNarrationLine(controller, encoder, text) } catch { /* controller closed */ }
  }
  const output = new ReadableStream({
    async start(controller) {
      try {
        // Pre-read the deterministic sources for the first three narration
        // lines (no Claude). These return very fast (~ a few hundred ms) so
        // the client sees motion well within the 500ms first-line target.
        const [client, , discovery, transcripts] = await Promise.all([
          pullFromClient({ clientId: client_id, agencyId }),
          pullFromRecipients({ clientId: client_id, agencyId }),
          pullFromDiscovery({ clientId: client_id, agencyId }),
          pullRetellTranscripts({ clientId: client_id, agencyId }).catch(
            () => [],
          ),
        ])
        if (ac.signal.aborted) { try { controller.close() } catch {} ; return }
        const clientName = client.client?.name || 'this client'
        const fieldCount = Object.keys(client.records || {}).length
        const callCount = transcripts.length
        const discoveryOk = !!discovery.engagement

        writeIfActive(controller,
          `Reading ${clientName}'s onboarding... ${fieldCount} field${fieldCount === 1 ? '' : 's'} found.`,
        )
        if (callCount > 0) {
          writeIfActive(controller,
            `Pulling ${callCount} voice call${callCount === 1 ? '' : 's'}...`,
          )
        } else {
          writeIfActive(controller, `No voice calls on file.`)
        }
        if (discoveryOk) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sectionCount = Array.isArray(
            (discovery.engagement as any)?.sections,
          )
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (discovery.engagement as any).sections.length
            : 0
          writeIfActive(controller,
            `Pulling discovery doc... ${sectionCount} section${sectionCount === 1 ? '' : 's'}.`,
          )
        }

        if (ac.signal.aborted) { try { controller.close() } catch {} ; return }

        // 2. Run the real seed (calls Claude where needed). Plumbing the
        // AbortSignal all the way through extractFromPastedText /
        // extractFromVoiceTranscript / etc. is a v1.1 refactor; for now we
        // gate around the call and accept that an in-flight Sonnet/Haiku
        // request will run to its own per-fetch timeout.
        const seedResult = await seedProfile({
          clientId: client_id,
          agencyId,
          pastedText: pasted_text,
          pastedTextSourceLabel: pasted_text_source_label,
          pastedTextSourceUrl: pasted_text_source_url,
          forceRebuild: !!force_rebuild,
        })
        if (ac.signal.aborted) { try { controller.close() } catch {} ; return }
        const fieldsAfter = Object.keys(seedResult.profile.fields || {}).length
        writeIfActive(controller,
          `${fieldsAfter} field${fieldsAfter === 1 ? '' : 's'} resolved across sources.`,
        )
        if (seedResult.discrepancies.length > 0) {
          writeIfActive(controller,
            `Flagged ${seedResult.discrepancies.length} cross-source disagreement${seedResult.discrepancies.length === 1 ? '' : 's'}.`,
          )
        }

        if (ac.signal.aborted) { try { controller.close() } catch {} ; return }

        // 3. Optional Haiku wrap-up — one calm sentence that closes the narration
        await streamHaikuWrapUp({
          controller,
          encoder,
          systemPrompt:
            'You are Claude writing a single calm sentence to close an ingest narration. No breathless adjectives. Sentence-case. 1-2 sentences max.',
          userMessage: `Just ingested a client profile. ${fieldsAfter} fields populated. ${seedResult.discrepancies.length} mismatches. Close with one sentence that says "Done. Let me show you what I've got." or a close variant.`,
          agencyId,
          clientId: client_id,
        })

        writeIfActive(controller, '')
        try { controller.close() } catch {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (!ac.signal.aborted) {
          writeIfActive(controller,
            `I hit a snag: ${err?.message || 'unknown error'}. I'll carry on without it.`,
          )
        }
        try { controller.close() } catch {}
      } finally {
        try { req.signal.removeEventListener('abort', onAbort) } catch { /* ignore */ }
      }
    },
    // ReadableStream `cancel()` fires when the consumer (browser) tears down
    // the stream — flip the abort flag so the in-flight async start() loop
    // short-circuits at its next checkpoint.
    cancel() {
      try { ac.abort() } catch { /* ignore */ }
    },
  })

  return new Response(output, { headers: narrationResponseHeaders() })
}
