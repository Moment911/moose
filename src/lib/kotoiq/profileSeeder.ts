import 'server-only'
import { getKotoIQDb } from '../kotoiqDb'
import { SEED_DEBOUNCE_SECONDS } from './profileConfig'
import {
  pullFromClient,
  pullFromRecipients,
  pullFromDiscovery,
  pullFromVoiceCallAnalysis,
} from './profileIngestInternal'
import { pullRetellTranscripts } from './profileRetellPull'
import { extractFromVoiceTranscript } from './profileVoiceExtract'
import { extractFromDiscoverySection } from './profileDiscoveryExtract'
import { extractFromPastedText } from './profileExtractClaude'
import { detectDiscrepancies } from './profileDiscrepancy'
import { profileToEntityGraphSeed } from './profileGraphSerializer'
import type { ClientProfile, ProvenanceRecord, SourceType } from './profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — Stage 0 master orchestrator (D-21).
//
// Composes every Plan 2 puller + Plan 3 extractor into one call:
//
//   seedProfile({ clientId, agencyId, pastedText?, forceRebuild? })
//     → { profile, discrepancies, sourcesAdded }
//
// Steps:
//   1. Debounce check (RESEARCH §15 cost-runaway mitigation).
//      If profile exists, last_seeded_at < SEED_DEBOUNCE_SECONDS old, AND no
//      pastedText AND not forceRebuild → return cached profile + discrepancies.
//   2. Pull internal sources in parallel (4 pullers from Plan 2).
//   3. If discovery has sections, run extractFromDiscoverySection (Plan 3 Haiku)
//      per section with concurrency cap = 3.
//   4. Pull Retell transcripts (Plan 4 helper, capped at MAX_VOICE_TRANSCRIPT_PULLS)
//      and run extractFromVoiceTranscript per call (concurrency cap = 3).
//   5. If pastedText present, call extractFromPastedText (Plan 3 Sonnet tool-use).
//   6. Merge every Record<string, ProvenanceRecord[]> output into one fields map,
//      sorted operator_edit-wins-ties + descending confidence per field.
//   7. Promote winning records to hot columns (denormalised text columns
//      mirrored on kotoiq_client_profile rows for fast launch-page list queries).
//   8. Detect discrepancies (Plan 3 pure function over the merged map).
//   9. Derive D-10 margin notes (rule-based, capped at 4) from voice analysis +
//      transcript keyword frequency. Persisted into margin_notes column so
//      Plan 7 MarginNote.jsx can render them without re-deriving.
//  10. Upsert kotoiq_client_profile row.
//  11. Serialize entity_graph_seed (D-22) and patch into the row.
//
// Returns SeedResult with the persisted profile, discrepancies, and an
// activity-log of source_refs added during this seed.
// ─────────────────────────────────────────────────────────────────────────────

export type SeedArgs = {
  clientId: string
  agencyId: string
  pastedText?: string
  pastedTextSourceLabel?: string
  pastedTextSourceUrl?: string
  forceRebuild?: boolean
}

export type SeedResult = {
  profile: ClientProfile
  discrepancies: ReturnType<typeof detectDiscrepancies>
  sourcesAdded: string[]
}

// Hot columns mirror — kept in sync with kotoiqDb.PROFILE_HOT_COLUMNS and
// the migration column order. When a winning record lands on a hot field,
// we also patch the indexed text column so launch-page list queries don't
// have to recompute the winner from jsonb.
const HOT_COLUMNS = [
  'business_name',
  'website',
  'primary_service',
  'target_customer',
  'service_area',
  'phone',
  'founding_year',
  'unique_selling_prop',
  'industry',
  'city',
  'state',
] as const

function mergeFields(
  ...maps: Array<Record<string, ProvenanceRecord[]>>
): Record<string, ProvenanceRecord[]> {
  const out: Record<string, ProvenanceRecord[]> = {}
  for (const m of maps) {
    for (const [k, recs] of Object.entries(m || {})) {
      out[k] = (out[k] || []).concat(recs || [])
    }
  }
  // Per-field sort: operator_edit > confidence desc (Plan 1 invariant).
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => {
      if (a.source_type === 'operator_edit' && b.source_type !== 'operator_edit') return -1
      if (b.source_type === 'operator_edit' && a.source_type !== 'operator_edit') return 1
      return (b.confidence || 0) - (a.confidence || 0)
    })
  }
  return out
}

function promoteHotColumns(
  fields: Record<string, ProvenanceRecord[]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {}
  for (const c of HOT_COLUMNS) {
    const top = fields[c]?.[0]
    if (top) {
      const v = top.value
      if (c === 'founding_year') {
        const n =
          typeof v === 'number'
            ? v
            : parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
        out[c] = Number.isFinite(n) ? n : null
      } else {
        out[c] = Array.isArray(v) ? v.join(', ') : v === null ? null : String(v)
      }
    } else {
      out[c] = null
    }
  }
  return out
}

type MarginNote = {
  id: string
  field_path: string
  question: string
  suggested_value?: string | null
  source_ref: string
  created_at: string
  status: 'pending' | 'accepted' | 'rejected' | 'edited'
}

/**
 * D-10 margin notes — Claude's proactive observations.
 *
 * v1 is rule-based (NO extra LLM call) and derives up to 4 notes per profile from:
 *   (a) voice pain_point_emphasis ProvenanceRecords (already structured by
 *       pullFromVoiceCallAnalysis in Plan 2)
 *   (b) raw transcript keyword-frequency emphases (single allow-listed phrase
 *       appearing 3+ times in one call)
 *   (c) existing margin notes — if a note with the same (field_path, question)
 *       is already accepted/rejected/edited, we do NOT re-emit it (avoids
 *       nagging the operator).
 *
 * Cap of 4 from 07-VALIDATION.md manual-only UX-density table.
 */
function deriveMarginNotes(args: {
  voiceAnalysisFields: Record<string, ProvenanceRecord[]>
  transcripts: Array<{
    call_id: string
    transcript?: string
    start_timestamp?: number
  }>
  clientId: string
  existingMarginNotes: MarginNote[]
}): MarginNote[] {
  const out: MarginNote[] = []
  const nowIso = new Date().toISOString()

  const resolvedKey = (field_path: string, question: string) =>
    `${field_path}::${question.slice(0, 80).toLowerCase()}`
  const resolvedSet = new Set(
    args.existingMarginNotes
      .filter((n) => n.status !== 'pending')
      .map((n) => resolvedKey(n.field_path, n.question)),
  )

  const pushIfNew = (
    candidate: Omit<MarginNote, 'id' | 'created_at' | 'status'>,
  ) => {
    if (out.length >= 4) return
    const k = resolvedKey(candidate.field_path, candidate.question)
    if (resolvedSet.has(k)) return
    if (out.some((n) => resolvedKey(n.field_path, n.question) === k)) return
    out.push({
      ...candidate,
      id: `mn-${args.clientId.slice(0, 8)}-${Date.now()}-${out.length}`,
      created_at: nowIso,
      status: 'pending',
    })
  }

  // (a) notable_insights / pain_point_emphasis from voice analysis
  const painRecords = args.voiceAnalysisFields?.pain_point_emphasis || []
  for (const rec of painRecords) {
    const vals = Array.isArray(rec.value) ? rec.value : [rec.value]
    for (const v of vals) {
      const s = String(v || '').trim()
      if (!s) continue
      pushIfNew({
        field_path: 'unique_selling_prop',
        question: `Operator emphasised "${s.slice(0, 80)}". Add this as a differentiator?`,
        suggested_value: s.slice(0, 200),
        source_ref: rec.source_ref || 'voice_call',
      })
    }
  }

  // (b) keyword frequency emphases — small allow-list to keep signal-to-noise
  // tight in v1. A single allow-listed phrase appearing 3+ times in one
  // transcript triggers a margin note suggesting how to act on it.
  const KEYWORD_HINTS: Array<{
    pattern: RegExp
    field_path: string
    suggest: (n: number) => string
  }> = [
    {
      pattern: /\bemergency\b/gi,
      field_path: 'unique_selling_prop',
      suggest: (n) =>
        `Client said "emergency" ${n}× on one call. Add 24/7 service as a differentiator?`,
    },
    {
      pattern: /\bsame[- ]day\b/gi,
      field_path: 'unique_selling_prop',
      suggest: (n) =>
        `"Same-day" came up ${n}× in one call. Worth calling out as a differentiator?`,
    },
    {
      pattern: /\bafter[- ]hours\b/gi,
      field_path: 'unique_selling_prop',
      suggest: (n) =>
        `"After-hours" came up ${n}× — after-hours coverage worth flagging?`,
    },
    {
      pattern: /\baffordable\b/gi,
      field_path: 'pain_points',
      suggest: (n) =>
        `Price-sensitivity came up ${n}× — is affordability the primary pain?`,
    },
  ]
  for (const t of args.transcripts || []) {
    const transcript = t.transcript || ''
    if (transcript.length < 40) continue
    for (const hint of KEYWORD_HINTS) {
      const hits = (transcript.match(hint.pattern) || []).length
      if (hits >= 3) {
        pushIfNew({
          field_path: hint.field_path,
          question: hint.suggest(hits),
          source_ref: `retell_call:${t.call_id}`,
        })
      }
      if (out.length >= 4) break
    }
    if (out.length >= 4) break
  }

  return out
}

export async function seedProfile(args: SeedArgs): Promise<SeedResult> {
  const db = getKotoIQDb(args.agencyId)

  // 1. Debounce (RESEARCH §15 T-07 cost runaway mitigation)
  const { data: existing } = await db.clientProfile.get(args.clientId)
  if (existing && !args.forceRebuild && !args.pastedText) {
    const ageMs = existing.last_seeded_at
      ? Date.now() - new Date(existing.last_seeded_at).getTime()
      : Infinity
    if (ageMs < SEED_DEBOUNCE_SECONDS * 1000) {
      const discrepancies = detectDiscrepancies(existing.fields || {})
      return {
        profile: existing as ClientProfile,
        discrepancies,
        sourcesAdded: [],
      }
    }
  }

  // 2. Pull internal sources in parallel
  const [clientResult, recipientFields, discoveryResult, voiceAnalysisFields] =
    await Promise.all([
      pullFromClient({ clientId: args.clientId, agencyId: args.agencyId }),
      pullFromRecipients({ clientId: args.clientId, agencyId: args.agencyId }),
      pullFromDiscovery({ clientId: args.clientId, agencyId: args.agencyId }),
      pullFromVoiceCallAnalysis({
        clientId: args.clientId,
        agencyId: args.agencyId,
      }),
    ])

  // 3. Per-section Haiku discovery extraction (concurrency cap 3)
  let discoverySectionFields: Record<string, ProvenanceRecord[]> = {}
  if (
    discoveryResult.engagement?.sections &&
    Array.isArray(discoveryResult.engagement.sections)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = discoveryResult.engagement.sections as any[]
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
    const sourceUrl = `${APP_URL}/discovery/${discoveryResult.engagement.id}`
    const results: Array<Record<string, ProvenanceRecord[]>> = []
    for (let i = 0; i < sections.length; i += 3) {
      const batch = sections.slice(i, i + 3)
      const batchResults = await Promise.allSettled(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        batch.map(async (s: any) => {
          const text = String(s.text || s.content || '').slice(0, 4000)
          if (!text) return {}
          return await extractFromDiscoverySection({
            engagementId: discoveryResult.engagement!.id,
            sectionKey: String(s.key || s.id || 'section'),
            sectionTitle: String(s.title || s.key || ''),
            sectionText: text,
            agencyId: args.agencyId,
            clientId: args.clientId,
            sourceUrl,
          })
        }),
      )
      for (const r of batchResults) if (r.status === 'fulfilled') results.push(r.value)
    }
    discoverySectionFields = mergeFields(...results)
  }

  // 4. Retell transcripts (cap inside pullRetellTranscripts), per-call Haiku
  //    extraction with concurrency cap 3
  const transcripts = await pullRetellTranscripts({
    clientId: args.clientId,
    agencyId: args.agencyId,
  })
  const voiceExtractResults: Array<Record<string, ProvenanceRecord[]>> = []
  if (transcripts.length > 0) {
    for (let i = 0; i < transcripts.length; i += 3) {
      const batch = transcripts.slice(i, i + 3)
      const results = await Promise.allSettled(
        batch.map(async (t) => {
          const ext = await extractFromVoiceTranscript({
            transcript: t.transcript || '',
            call_id: t.call_id,
            call_start: t.start_timestamp
              ? new Date(t.start_timestamp).toISOString()
              : undefined,
            agencyId: args.agencyId,
            clientId: args.clientId,
          })
          return ext.fields
        }),
      )
      for (const r of results)
        if (r.status === 'fulfilled') voiceExtractResults.push(r.value)
    }
  }

  // 5. Pasted text (Sonnet tool-use)
  const pastedTextFields: Record<string, ProvenanceRecord[]> = {}
  const sourcesAdded: string[] = []
  if (args.pastedText) {
    const extracted = await extractFromPastedText({
      text: args.pastedText,
      agencyId: args.agencyId,
      clientId: args.clientId,
      sourceLabel: args.pastedTextSourceLabel || 'operator_paste',
      sourceUrl: args.pastedTextSourceUrl,
    })
    for (const { field_name, record } of extracted) {
      pastedTextFields[field_name] = pastedTextFields[field_name] || []
      pastedTextFields[field_name].push(record)
    }
    sourcesAdded.push(`paste:${args.pastedTextSourceLabel || 'operator_paste'}`)
  }

  // 6. Merge every source map
  const mergedFields = mergeFields(
    clientResult.records,
    recipientFields,
    discoveryResult.narrativeRecords,
    voiceAnalysisFields,
    discoverySectionFields,
    ...voiceExtractResults,
    pastedTextFields,
  )

  // 7. Promote winning records to hot columns
  const hotCols = promoteHotColumns(mergedFields)

  // 8. Discrepancies (pure function — no I/O)
  const discrepancies = detectDiscrepancies(mergedFields)

  // 9. Derive D-10 margin notes (rule-based, capped at 4)
  const marginNotes = deriveMarginNotes({
    voiceAnalysisFields,
    transcripts,
    clientId: args.clientId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingMarginNotes: ((existing as any)?.margin_notes || []) as MarginNote[],
  })

  // 10. Upsert profile row
  const nowIso = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingSources = ((existing as any)?.sources || []) as Array<Record<string, any>>
  const pulledSourceRefs: string[] = [
    ...(clientResult.client ? [`clients:${args.clientId}`] : []),
    ...(discoveryResult.engagement
      ? [`discovery:${discoveryResult.engagement.id}`]
      : []),
    ...transcripts.map((t) => `retell_call:${t.call_id}`),
    ...sourcesAdded,
  ]
  // WR-09 — explicit branches per ref scheme so future ref schemes don't
  // get silently misbucketed as 'onboarding_form'.  `clients:` is the
  // table-level pull (a mix of onboarding form fields + voice rollups);
  // we currently bucket it as onboarding_form because that's the dominant
  // upstream source, but a future SourceType ('koto_crm') could split it.
  const refToSourceType = (ref: string): SourceType => {
    if (ref.startsWith('retell_call:')) return 'voice_call'
    if (ref.startsWith('discovery:')) return 'discovery_doc'
    if (ref.startsWith('paste:')) return 'claude_inference'
    if (ref.startsWith('clients:')) return 'onboarding_form'
    // Defensive: unrecognised ref scheme — log so we notice silent
    // misclassification, then fall back to onboarding_form (the closest
    // permissive bucket among existing SOURCE_TYPES).
    console.warn(JSON.stringify({
      level: 'warn',
      module: 'profileSeeder.refToSourceType',
      reason: 'unknown_ref_scheme',
      ref,
      effect: 'classified as onboarding_form',
    }))
    return 'onboarding_form'
  }
  const mergedSources = existingSources.concat(
    pulledSourceRefs.map((ref) => ({
      source_type: refToSourceType(ref),
      source_ref: ref,
      added_at: nowIso,
      added_by: 'seeder',
    })),
  )

  const row = {
    client_id: args.clientId,
    agency_id: args.agencyId,
    ...hotCols,
    fields: mergedFields,
    sources: mergedSources,
    margin_notes: marginNotes,
    last_seeded_at: nowIso,
    last_edited_at: nowIso,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.clientProfile.upsert(row as any)

  const { data: stored } = await db.clientProfile.get(args.clientId)
  const profile = (stored || row) as ClientProfile

  // 11. Serialize + stash entity graph seed
  const seed = profileToEntityGraphSeed(profile)
  await db.clientProfile.upsert({
    client_id: args.clientId,
    agency_id: args.agencyId,
    entity_graph_seed: seed,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return {
    profile: { ...profile, entity_graph_seed: seed },
    discrepancies,
    sourcesAdded,
  }
}
