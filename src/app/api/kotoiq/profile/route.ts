import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../lib/kotoiqDb'
import { MAX_PASTED_TEXT_CHARS } from '../../../../lib/kotoiq/profileConfig'
import { CANONICAL_FIELD_NAMES } from '../../../../lib/kotoiq/profileTypes'
import { seedProfile } from '../../../../lib/kotoiq/profileSeeder'
import { crawlWebsite, type CrawlScope } from '../../../../lib/kotoiq/profileWebsiteCrawl'
import { checkBudget, applyOverride, checkRateLimit } from '../../../../lib/kotoiq/profileCostBudget'
import { estimateCost } from '../../../../lib/kotoiq/profileCostEstimate'
import { computeCompleteness } from '../../../../lib/kotoiq/profileGate'
import { extractFromPastedText } from '../../../../lib/kotoiq/profileExtractClaude'
import { detectDiscrepancies } from '../../../../lib/kotoiq/profileDiscrepancy'
import { recomputeClarifications } from '../../../../lib/kotoiq/profileClarifications'
import {
  pickClarificationChannel,
  forwardViaSMS,
  forwardViaEmail,
  forwardViaPortal,
} from '../../../../lib/kotoiq/profileChannels'
import { runFullPipeline } from '../../../../lib/builder/pipelineOrchestrator'
import { seedFromFormUrl } from '../../../../lib/kotoiq/profileFormSeeder'
import { detectFormProvider } from '../../../../lib/kotoiq/profileFormDetect'
import type { ProvenanceRecord } from '../../../../lib/kotoiq/profileTypes'
import { generateConsentUrl } from '../../../../lib/kotoiq/profileGBPOAuth'
import { pullFromGBPAuth } from '../../../../lib/kotoiq/profileGBPPull'
import { pullFromGBPPlaces } from '../../../../lib/kotoiq/profileGBPPlaces'
import { decryptSecret } from '../../../../lib/kotoiq/profileIntegrationsVault'
import { SOURCE_CONFIG } from '../../../../lib/kotoiq/profileConfig'
import { seedFromUpload } from '../../../../lib/kotoiq/profileUploadSeeder'
import { buildUploadPath, parseUploadPath } from '../../../../lib/kotoiq/profileUploadStorage'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 6 — POST /api/kotoiq/profile
//
// 14-action JSON dispatcher composing every Plan 2-5 lib module into the
// single HTTP surface the Launch Page (Plan 7) and the chat widget (Plan 8)
// call for every profile + clarification operation EXCEPT streaming
// narration (which lives at /api/kotoiq/profile/stream_seed — Plan 4).
//
// Auth: every action runs verifySession FIRST.  agencyId is read from the
// session, NEVER from body (T-07-01d — RESEARCH §15).  body.agency_id is
// silently ignored if present.
//
// Cross-agency clientId guard: every action that resolves a client_id checks
// the clients row exists under the session's agency_id; mismatch → 404 (NOT
// 403, per the link-enumeration mitigation — RESEARCH §15 T-07).
//
// Cross-table query pattern (clients, agencies, koto_telnyx_numbers, etc.
// — NOT kotoiq_* tables): use db.client.from(...) with explicit
// .eq('agency_id', agencyId) per CLAUDE.md agency-isolation rule.  The
// scoped-from helper only auto-injects for DIRECT_AGENCY_TABLES; non-kotoiq
// tables get explicit scoping so the kotoiq/no-unscoped-kotoiq lint rule
// never fires (and so future readers see the boundary clearly).
//
// Plan deviation note: the planner's pseudocode used `db.raw().from(...)` —
// that method does NOT exist on KotoIQDb.  This route uses `db.client.from(...)`
// + explicit `.eq('agency_id', agencyId)`, matching the same pattern Plans
// 04 and 05 standardised on.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

// Internal Koto path matcher — restricted by design to /onboard,
// /onboarding-dashboard, /clients (the three places clientIds appear in
// Koto URLs).  External URLs don't match → clientId stays null → 400.
const URL_RE =
  /\/(onboard|onboarding-dashboard|clients)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]+)/

const ALLOWED_ACTIONS = [
  'seed',
  'get_profile',
  'list_profile',
  'paste_text',
  'update_field',
  'add_field',
  'delete_field',
  'reject_field',
  'add_question',
  'launch',
  'list_clarifications',
  'answer_clarification',
  'forward_to_client',
  'add_source',
  'seed_website',
  'connect_gbp_oauth_start',
  'list_gbp_locations',
  'seed_gbp_auth',
  'seed_gbp_places',
  'seed_form_url',
  'seed_upload',
  'list_uploads',
] as const

// First 11 canonical fields are the "hot" columns mirrored to indexed text
// columns on kotoiq_client_profile (must match kotoiqDb.PROFILE_HOT_COLUMNS).
const HOT_COLUMNS_SET = new Set(CANONICAL_FIELD_NAMES.slice(0, 11))

// CR-01 mitigation — uniform field_name shape + size validation applied to
// every action that writes into the kotoiq_client_profile.fields jsonb
// (update_field, add_field, delete_field, reject_field).  Without this an
// authenticated operator could pollute the jsonb with arbitrary keys
// (`__proto__`, megabyte-long strings, etc.).
const FIELD_NAME_RE = /^[a-z][a-z0-9_]*$/i
const MAX_FIELD_NAME_LEN = 80
const MAX_FIELD_VALUE_LEN = 8000

function validateFieldNameShape(fieldName: unknown):
  | { ok: true; name: string }
  | { ok: false; error: string } {
  if (typeof fieldName !== 'string') return { ok: false, error: 'field_name must be a string' }
  if (fieldName.length === 0 || fieldName.length > MAX_FIELD_NAME_LEN) {
    return { ok: false, error: `field_name must be 1-${MAX_FIELD_NAME_LEN} chars` }
  }
  if (!FIELD_NAME_RE.test(fieldName)) {
    return { ok: false, error: 'field_name must be alphanumeric/underscore (regex: ^[a-z][a-z0-9_]*$/i)' }
  }
  return { ok: true, name: fieldName }
}

function validateFieldValueSize(value: unknown):
  | { ok: true }
  | { ok: false; error: string } {
  if (typeof value === 'string' && value.length > MAX_FIELD_VALUE_LEN) {
    return { ok: false, error: `value exceeds ${MAX_FIELD_VALUE_LEN} chars` }
  }
  // Best-effort size check for non-string payloads — JSON.stringify gives an
  // upper bound that catches accidentally huge arrays / objects.
  if (value !== null && value !== undefined && typeof value !== 'string') {
    try {
      const s = JSON.stringify(value)
      if (s && s.length > MAX_FIELD_VALUE_LEN) {
        return { ok: false, error: `value exceeds ${MAX_FIELD_VALUE_LEN} chars (serialized)` }
      }
    } catch {
      return { ok: false, error: 'value is not JSON-serializable' }
    }
  }
  return { ok: true }
}

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractClientId(body: any): string | null {
  if (body?.client_id && typeof body.client_id === 'string') return body.client_id
  if (body?.url && typeof body.url === 'string') {
    const m = body.url.match(URL_RE)
    return m?.[2] || null
  }
  return null
}

export async function POST(req: NextRequest) {
  // 1. Auth — agencyId comes from session, never from body
  const session = await verifySession(req)
  if (!session.verified || !session.agencyId) return err(401, 'Unauthorized')
  const agencyId = session.agencyId
  const userId = session.userId || 'operator'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return err(400, 'Invalid JSON')
  }

  const action = String(body?.action || '')
  if (!(ALLOWED_ACTIONS as readonly string[]).includes(action)) {
    return err(400, 'Unknown action', { allowed_actions: ALLOWED_ACTIONS })
  }

  const db = getKotoIQDb(agencyId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = db.client

  try {
    // ── seed (PROF-01 + PROF-02) ─────────────────────────────────────────────
    if (action === 'seed') {
      const clientId = extractClientId(body)
      if (!clientId) return err(400, 'client_id or url required')
      if (body.pasted_text !== undefined && typeof body.pasted_text !== 'string') {
        return err(400, 'pasted_text must be a string')
      }
      if (body.pasted_text && body.pasted_text.length > MAX_PASTED_TEXT_CHARS) {
        return err(413, `pasted_text exceeds ${MAX_PASTED_TEXT_CHARS} chars`)
      }

      // Cross-agency existence check (T-07 link enumeration — 404 not 403).
      // clients is NOT a kotoiq_* table; explicit .eq('agency_id', agencyId).
      const { data: clientRow } = await sb
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!clientRow) return err(404, 'Client not found')

      const result = await seedProfile({
        clientId,
        agencyId,
        pastedText: body.pasted_text,
        pastedTextSourceLabel: body.pasted_text_source_label,
        pastedTextSourceUrl: body.pasted_text_source_url,
        forceRebuild: !!body.force_rebuild,
      })
      return NextResponse.json({
        profile: result.profile,
        discrepancies: result.discrepancies,
        sources_added: result.sourcesAdded,
      })
    }

    // ── get_profile ──────────────────────────────────────────────────────────
    if (action === 'get_profile') {
      if (!body.client_id) return err(400, 'client_id required')
      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const discrepancies = detectDiscrepancies((profile as any).fields || {})
      return NextResponse.json({ profile, discrepancies })
    }

    // ── list_profile ─────────────────────────────────────────────────────────
    if (action === 'list_profile') {
      const { data } = await db.clientProfile.list({ launched: body.launched })
      return NextResponse.json({ profiles: data || [] })
    }

    // ── paste_text (PROF-02 — review-before-save flow) ───────────────────────
    if (action === 'paste_text') {
      if (!body.client_id) return err(400, 'client_id required')
      if (!body.pasted_text || typeof body.pasted_text !== 'string') {
        return err(400, 'pasted_text required')
      }
      if (body.pasted_text.length > MAX_PASTED_TEXT_CHARS) {
        return err(413, `pasted_text exceeds ${MAX_PASTED_TEXT_CHARS} chars`)
      }
      const extracted = await extractFromPastedText({
        text: body.pasted_text,
        agencyId,
        clientId: body.client_id,
        sourceLabel: body.source_label || 'operator_paste',
        sourceUrl: body.source_url,
      })
      // commit=true persists by routing through seedProfile so the merge
      // ladder + hot-column promotion + discrepancy detection all run.
      if (body.commit === true) {
        const result = await seedProfile({
          clientId: body.client_id,
          agencyId,
          pastedText: body.pasted_text,
          pastedTextSourceLabel: body.source_label,
          pastedTextSourceUrl: body.source_url,
          forceRebuild: false,
        })
        return NextResponse.json({
          extracted,
          profile: result.profile,
          discrepancies: result.discrepancies,
        })
      }
      return NextResponse.json({ extracted })
    }

    // ── update_field (PROF-03 with operator-edit provenance) ─────────────────
    if (action === 'update_field') {
      if (!body.client_id || !body.field_name) {
        return err(400, 'client_id and field_name required')
      }
      // CR-01 — shape + length guard before any DB read.
      const nameCheck = validateFieldNameShape(body.field_name)
      if (nameCheck.ok === false) return err(400, nameCheck.error)
      const fieldName = nameCheck.name
      const valueCheck = validateFieldValueSize(body.value)
      if (valueCheck.ok === false) return err(413, valueCheck.error)

      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')

      // CR-01 — allowlist: must be a canonical name OR an existing custom
      // field on this profile. Operators must use add_field for new custom
      // fields so the create vs. edit boundary stays explicit.
      const isCanonical = (CANONICAL_FIELD_NAMES as readonly string[]).includes(fieldName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingFields = (((profile as any).fields) || {}) as Record<string, unknown>
      if (!isCanonical && !(fieldName in existingFields)) {
        return err(400, 'unknown field — use add_field to create a custom field first', {
          hint: 'update_field only edits canonical or already-added custom fields',
        })
      }

      const isOperatorEdit = body.source_type !== 'claude_inference'
      const record: ProvenanceRecord = {
        value: body.value ?? null,
        source_type: isOperatorEdit ? 'operator_edit' : 'claude_inference',
        source_snippet: body.source_snippet,
        captured_at: new Date().toISOString(),
        confidence: isOperatorEdit
          ? 1.0
          : Math.max(0, Math.min(1, Number(body.confidence) || 0.85)),
      }
      const { error: updateErr } = await db.clientProfile.updateField(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any).id,
        fieldName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        record as any,
      )
      if (updateErr) {
        return err(500, 'Update failed', {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: String((updateErr as any).message || updateErr),
        })
      }
      // Fire-and-forget re-score + clarification recompute.
      // Errors swallowed (D-19) — the field write already succeeded.
      ;(async () => {
        try {
          const { data: refreshed } = await db.clientProfile.get(body.client_id)
          if (refreshed) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const score = await computeCompleteness(refreshed as any)
            await db.clientProfile.upsert({
              client_id: body.client_id,
              completeness_score: score.completeness_score,
              completeness_reasoning: score.completeness_reasoning,
              soft_gaps: score.soft_gaps,
            })
            await recomputeClarifications({
              profile: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                id: (profile as any).id,
                client_id: body.client_id,
                agency_id: agencyId,
              },
              softGaps: score.soft_gaps,
              agencyId,
              clientId: body.client_id,
            })
          }
        } catch (e) {
          console.error('[profile.route] rescore failed', e)
        }
      })()
      return NextResponse.json({ ok: true })
    }

    // ── add_field (D-05 — operator-added custom field, NOT in canonical) ─────
    if (action === 'add_field') {
      if (!body.client_id || !body.field_name) {
        return err(400, 'client_id and field_name required')
      }
      // CR-01 — uniform shape + length guard.
      const nameCheck = validateFieldNameShape(body.field_name)
      if (nameCheck.ok === false) return err(400, nameCheck.error)
      const fieldName = nameCheck.name
      const valueCheck = validateFieldValueSize(body.value)
      if (valueCheck.ok === false) return err(413, valueCheck.error)

      if ((CANONICAL_FIELD_NAMES as readonly string[]).includes(fieldName)) {
        return err(400, 'field_name already in canonical schema — use update_field', {
          hint: 'D-05 add_field is for NEW custom operator fields',
        })
      }
      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')
      const { error: addErr } = await db.clientProfile.addField(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any).id,
        fieldName,
        body.value,
        { source_ref: 'operator_custom_field' },
      )
      if (addErr) return err(500, 'Add failed')
      return NextResponse.json({ ok: true })
    }

    // ── delete_field ─────────────────────────────────────────────────────────
    if (action === 'delete_field') {
      if (!body.client_id || !body.field_name) {
        return err(400, 'client_id and field_name required')
      }
      // CR-01 — uniform shape + length guard.
      const nameCheck = validateFieldNameShape(body.field_name)
      if (nameCheck.ok === false) return err(400, nameCheck.error)
      const fieldName = nameCheck.name

      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')
      const { error: delErr } = await db.clientProfile.deleteField(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any).id,
        fieldName,
      )
      if (delErr) return err(500, 'Delete failed')
      return NextResponse.json({ ok: true })
    }

    // ── reject_field (PROF-05 — rejection PRESERVES provenance) ─────────────
    if (action === 'reject_field') {
      if (!body.client_id || !body.field_name) {
        return err(400, 'client_id and field_name required')
      }
      // CR-01 — uniform shape + length guard.
      const nameCheck = validateFieldNameShape(body.field_name)
      if (nameCheck.ok === false) return err(400, nameCheck.error)
      const fieldName = nameCheck.name

      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = ((profile as any).fields || {}) as Record<string, any[]>
      const existing = fields[fieldName]
      if (!existing) return err(404, 'Field not present')
      // Mark every record rejected — keep the audit trail.  PROF-05 explicitly
      // says rejection is NOT deletion; the source records survive so the
      // "where did this come from?" UX still works post-rejection.
      const patched = existing.map((r) => ({ ...r, rejected: true }))
      fields[fieldName] = patched
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {
        client_id: body.client_id,
        fields,
        last_edited_at: new Date().toISOString(),
      }
      // Cast: HOT_COLUMNS_SET is typed Set<CanonicalFieldName>; fieldName is
      // string here — a runtime membership check is exactly what we want.
      if ((HOT_COLUMNS_SET as Set<string>).has(fieldName)) patch[fieldName] = null
      const { error: rejErr } = await db.clientProfile.upsert(patch)
      if (rejErr) return err(500, 'Reject failed')
      return NextResponse.json({ ok: true })
    }

    // ── add_question (D-12 — operator-authored clarification) ───────────────
    if (action === 'add_question') {
      if (!body.client_id || !body.question) {
        return err(400, 'client_id and question required')
      }
      if (String(body.question).length > 2000) return err(400, 'question too long')
      const { data: profile } = await db.clientProfile.get(body.client_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileId = (profile as any)?.id || null
      const sev =
        body.severity === 'high' || body.severity === 'medium' || body.severity === 'low'
          ? body.severity
          : 'medium'
      const { data } = await db.clarifications.create({
        client_id: body.client_id,
        profile_id: profileId,
        question: body.question,
        reason: body.reason || null,
        target_field_path: body.target_field_path || null,
        severity: sev,
        impact_hint: body.impact_hint || null,
        impact_unlocks: body.impact_unlocks || [],
      })
      return NextResponse.json({ clarification: data })
    }

    // ── launch (PROF-06 + D-15 non-blocking launch) ──────────────────────────
    if (action === 'launch') {
      if (!body.client_id) return err(400, 'client_id required')
      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')

      // Refresh completeness snapshot — STORED on the profile, not a hard gate
      // (D-13/D-15).  Even when score < 0.7 we still fire the pipeline; the
      // operator already chose to launch.
      const gate = await computeCompleteness(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profile as any,
      ).catch(() => ({
        completeness_score: 0,
        completeness_reasoning: 'gate unavailable',
        soft_gaps: [] as Array<{ field: string; reason: string }>,
      }))
      await db.clientProfile
        .upsert({
          client_id: body.client_id,
          completeness_score: gate.completeness_score,
          completeness_reasoning: gate.completeness_reasoning,
          soft_gaps: gate.soft_gaps,
        })
        .catch(() => {})

      const target_keywords = Array.isArray(body.target_keywords)
        ? body.target_keywords
        : []
      const config = {
        client_id: body.client_id,
        agency_id: agencyId,
        site_id: body.site_id,
        target_keywords,
        auto_publish: !!body.auto_publish,
        stages_to_run: body.stages_to_run,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
      const runId = await runFullPipeline(config)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.clientProfile.markLaunched((profile as any).id, runId)
      return NextResponse.json({
        run_id: runId,
        completeness_score: gate.completeness_score,
        soft_gaps: gate.soft_gaps,
      })
    }

    // ── list_clarifications (PROF-04) ────────────────────────────────────────
    if (action === 'list_clarifications') {
      const filters = {
        client_id: body.client_id,
        status: body.status,
        severity: body.severity,
        limit: body.limit ? Math.min(500, Number(body.limit)) : undefined,
      }
      const { data } = await db.clarifications.list(filters)
      return NextResponse.json({ clarifications: data || [] })
    }

    // ── answer_clarification (PROF-05 — accept flow) ─────────────────────────
    if (action === 'answer_clarification') {
      if (!body.clarification_id || !body.answer_text) {
        return err(400, 'clarification_id and answer_text required')
      }
      const { data: clar } = await db.clarifications.get(body.clarification_id)
      // T-07-20 — different-agency clarification returns no data via the
      // scoped helper → 404, never reveals existence cross-agency.
      if (!clar) return err(404, 'Clarification not found')
      await db.clarifications.markAnswered(
        body.clarification_id,
        String(body.answer_text).slice(0, 4000),
        userId,
      )
      // PROF-05 — propagate the answer into the profile when there's a target
      // field AND the operator hasn't opted out (update_field=false explicit).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = clar as any
      if (c.target_field_path && body.update_field !== false) {
        const { data: profile } = await db.clientProfile.get(c.client_id)
        if (profile) {
          const record: ProvenanceRecord = {
            value: String(body.answer_text),
            source_type: 'operator_edit',
            captured_at: new Date().toISOString(),
            confidence: 1.0,
          }
          await db.clientProfile.updateField(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (profile as any).id,
            c.target_field_path,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            record as any,
          )
        }
      }
      return NextResponse.json({ ok: true })
    }

    // ── forward_to_client (D-18 channel router) ──────────────────────────────
    if (action === 'forward_to_client') {
      if (!body.clarification_id) return err(400, 'clarification_id required')
      const { data: clar } = await db.clarifications.get(body.clarification_id)
      if (!clar) return err(404, 'Clarification not found')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = clar as any

      // WR-03 — pull the FULL clients row so we can read opt-in / opt-out /
      // preferred-channel preferences IF those columns exist on the schema
      // (they are not in the canonical 20260408 migration — operator may have
      // added them via custom migrations or they may live inside the
      // onboarding_answers jsonb).  We use select('*') instead of a column
      // list so missing columns simply come back undefined rather than 400.
      // clients is NOT a kotoiq_* table; explicit .eq('agency_id', agencyId).
      const { data: clientRow } = await sb
        .from('clients')
        .select('*')
        .eq('id', c.client_id)
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!clientRow) return err(404, 'Client not found')

      // Resolve agency display name for white-label messaging copy.
      const { data: agencyRow } = await sb
        .from('agencies')
        .select('name')
        .eq('id', agencyId)
        .maybeSingle()
      const agencyName = agencyRow?.name || 'Koto'

      // WR-03 — derive contact preferences from BOTH dedicated columns (if
      // present) AND the onboarding_answers jsonb (where the web form stores
      // them today).  Opt-OUT semantics dominate: an explicit opt-out always
      // wins over any opt-in or preferred_channel.  This honours the D-18
      // contract that we never SMS / email a client who has opted out.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cr = clientRow as Record<string, any>
      const oa = (cr.onboarding_answers && typeof cr.onboarding_answers === 'object'
        ? cr.onboarding_answers
        : {}) as Record<string, unknown>
      const prefBool = (...vals: unknown[]): boolean | undefined => {
        for (const v of vals) {
          if (v === true || v === 'true' || v === 1) return true
          if (v === false || v === 'false' || v === 0) return false
        }
        return undefined
      }
      const smsOptOut = prefBool(cr.sms_opt_out, oa.sms_opt_out, oa.do_not_text)
      const emailOptOut = prefBool(cr.email_opt_out, oa.email_opt_out, oa.do_not_email)
      const portalOptOut = prefBool(cr.portal_opt_out, oa.portal_opt_out)
      const smsOptIn = prefBool(cr.sms_opt_in, oa.sms_opt_in)
      const emailOptIn = prefBool(cr.email_opt_in, oa.email_opt_in)
      const portalOptIn = prefBool(cr.portal_opt_in, oa.portal_opt_in)
      const preferredRaw = (cr.preferred_channel ?? oa.preferred_channel ?? oa.preferred_contact_method) as
        | string
        | undefined
      const preferredChannel: 'sms' | 'email' | 'portal' | undefined =
        preferredRaw === 'sms' || preferredRaw === 'email' || preferredRaw === 'portal'
          ? preferredRaw
          : undefined

      // Effective opt-in flags = explicit opt-in unless explicitly opted out.
      const effectiveSmsOptIn = smsOptOut === true ? false : smsOptIn
      const effectiveEmailOptIn = emailOptOut === true ? false : emailOptIn
      const effectivePortalOptIn = portalOptOut === true ? false : portalOptIn

      const channelArg = typeof body.channel === 'string' ? body.channel : 'auto'
      let channel: 'sms' | 'email' | 'portal'
      if (channelArg === 'sms' || channelArg === 'email' || channelArg === 'portal') {
        channel = channelArg
      } else {
        const picked = await pickClarificationChannel({
          question: c.question,
          clientContactPreferences: {
            sms_opt_in: effectiveSmsOptIn,
            email_opt_in: effectiveEmailOptIn,
            portal_opt_in: effectivePortalOptIn,
            preferred_channel: preferredChannel,
          },
          agencyId,
          clientId: c.client_id,
        })
        // pickClarificationChannel may return 'operator' (D-18) — collapse to
        // portal so the downstream switch is exhaustive.
        channel = picked.channel === 'operator' ? 'portal' : picked.channel
      }

      // WR-03 — explicit opt-out always blocks the channel, even when the
      // operator hand-picked it.  D-18 promise: never message an opted-out client.
      if (channel === 'sms' && smsOptOut === true) {
        return err(409, 'Client has opted out of SMS', { opt_out: 'sms' })
      }
      if (channel === 'email' && emailOptOut === true) {
        return err(409, 'Client has opted out of email', { opt_out: 'email' })
      }
      if (channel === 'portal' && portalOptOut === true) {
        return err(409, 'Client has opted out of portal notifications', { opt_out: 'portal' })
      }

      const common = {
        clarificationId: body.clarification_id,
        clientId: c.client_id,
        agencyId,
        agencyName,
        questionText: c.question,
      }

      if (channel === 'sms') {
        if (!clientRow.phone) return err(400, 'Client has no phone — cannot SMS')
        const out = await forwardViaSMS({ ...common, clientPhone: clientRow.phone })
        if (!out.ok && /rate limit/i.test(out.error || '')) {
          return err(429, out.error || 'SMS rate limit exceeded')
        }
        return NextResponse.json({ ok: out.ok, channel: 'sms', error: out.error })
      }
      if (channel === 'email') {
        if (!clientRow.email) return err(400, 'Client has no email — cannot email')
        const out = await forwardViaEmail({
          ...common,
          clientName: clientRow.name || '',
          clientEmail: clientRow.email,
          reason: c.reason,
          impactHint: c.impact_hint,
        })
        return NextResponse.json({ ok: out.ok, channel: 'email', error: out.error })
      }
      // portal — v1 stub, fires a koto_notifications row + marks asked_channel.
      const out = await forwardViaPortal(common)
      return NextResponse.json({ ok: out.ok, channel: 'portal', error: out.error })
    }

    // ── add_source (Plan 7 drop-zone — records deferred_v2 stubs) ───────────
    if (action === 'add_source') {
      if (!body.client_id || !body.source_type) {
        return err(400, 'client_id and source_type required')
      }
      const { data: profile } = await db.clientProfile.get(body.client_id)
      if (!profile) return err(404, 'Profile not found')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = ((profile as any).sources || []) as Array<Record<string, any>>
      existing.push({
        source_type: body.source_type,
        source_url: body.source_url,
        source_ref: body.source_ref,
        added_at: new Date().toISOString(),
        added_by: userId,
        metadata: body.metadata || {},
      })
      const { error: srcErr } = await db.clientProfile.upsert({
        client_id: body.client_id,
        sources: existing,
      })
      if (srcErr) return err(500, 'Add source failed')
      return NextResponse.json({ ok: true })
    }

    // ── seed_website (PROF-08 — website crawl → extract per-page) ────────────
    if (action === 'seed_website') {
      if (!body.client_id || !body.url) {
        return err(400, 'client_id and url required')
      }
      // Cross-agency existence check
      const { data: clientRow } = await sb
        .from('clients')
        .select('id')
        .eq('id', body.client_id)
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!clientRow) return err(404, 'Client not found')

      // Rate limit (reuse seed_form_url bucket for v1)
      const rl = checkRateLimit({ agencyId, actionKey: 'seed_form_url' })
      if (!rl.allowed) {
        return err(429, 'Rate limited', { retry_after_ms: rl.retry_after_ms })
      }

      // Budget check
      const scope: CrawlScope = body.scope === 'B' ? 'B' : body.scope === 'C' ? 'C' : 'A'
      const costEst = estimateCost({ source_type: 'website_scrape', params: { scope, useJs: body.use_js } })
      const budget = await checkBudget({ agencyId, clientId: body.client_id, estimatedCost: costEst })
      if (!budget.allowed) {
        return err(402, 'Budget exceeded', {
          scope: budget.scope,
          remaining_client: budget.remaining_client,
          remaining_agency: budget.remaining_agency,
        })
      }

      const result = await crawlWebsite({
        url: body.url,
        agencyId,
        clientId: body.client_id,
        scope,
        useJs: body.use_js,
        robotsMode: body.robots_mode,
        costCap: body.cost_cap,
      })

      // Persist extracted records via seedProfile merge path
      if (result.records.length > 0) {
        await seedProfile({
          clientId: body.client_id,
          agencyId,
          externalRecords: result.records,
          forceRebuild: false,
        })
      }

      return NextResponse.json({
        ok: true,
        extracted: result.records.length,
        pages_crawled: result.pages_crawled,
        pages_skipped: result.pages_skipped,
        warnings: result.warnings,
        cost_usd: result.cost_spent_usd,
        aborted: result.aborted,
        abort_reason: result.abort_reason,
      })
    }

    // ── seed_form_url (PROF-07 — form URL → extract Q&A pairs) ─────────────
    if (action === 'seed_form_url') {
      const clientId = String(body?.client_id ?? '')
      if (!clientId) return err(400, 'missing_client_id')

      // Cross-agency client_id → 404 (T-08-34)
      const { data: clientRow } = await sb
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!clientRow) return err(404, 'not_found')

      const url = String(body?.url ?? '')
      const det = detectFormProvider(url)
      if (det.provider === 'unknown') return err(400, 'not_a_form_url')

      // Rate limit (D-10/T-08-33)
      const rl = checkRateLimit({ agencyId, actionKey: 'seed_form_url' })
      if (!rl.allowed) return err(429, 'rate_limited', { retry_after_ms: rl.retry_after_ms })

      // Cost gate (D-22/D-23)
      const source_type = `${det.provider}_api` as any
      const est = estimateCost({ source_type })
      const bg = await checkBudget({ agencyId, clientId, estimatedCost: est })
      if (bg.block && !body?.override) {
        return err(402, 'budget_exceeded', { ...bg, estimated_cost: est })
      }
      if (bg.block && body?.override) {
        await applyOverride({
          agencyId, clientId, userId,
          estimatedCost: est, originalCap: bg.scope === 'agency' ? 50 : 5,
          overrideValue: bg.scope === 'agency' ? bg.projected_agency : bg.projected_client,
          scope: bg.scope ?? 'per_source_cap', sourceType: source_type,
          justification: body?.justification ?? null,
        })
      }

      const result = await seedFromFormUrl({ url, agencyId, clientId, preferApi: body?.prefer_api !== false })

      // Persist extracted records via seedProfile merge path (same as paste_text commit flow)
      if (result.records.length > 0) {
        await seedProfile({
          clientId,
          agencyId,
          externalRecords: result.records,
          forceRebuild: false,
        })
      }

      return NextResponse.json({ ok: true, via: result.via, extracted: result.records.length, cost_usd: est })
    }

    // ── seed_upload (PROF-10 — extract from uploaded file) ─────────────────
    if (action === 'seed_upload') {
      const clientId = String(body?.client_id ?? '')
      const uploadId = String(body?.upload_id ?? '')
      if (!clientId || !uploadId) return err(400, 'client_id and upload_id required')

      // Cross-agency client check
      const { data: clientRow } = await sb
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!clientRow) return err(404, 'not_found')

      // Resolve storage path from upload_id
      const storagePath = body?.storage_path ?? buildUploadPath(agencyId, clientId, uploadId, body?.ext ?? 'pdf')
      const parsed = parseUploadPath(storagePath)
      if (!parsed || parsed.agencyId !== agencyId) return err(404, 'upload_not_found')

      // Cost gate (D-22/D-23) — estimate from source type hint or default to pdf_text
      const sourceTypeHint = body?.source_type ?? 'pdf_text_extract'
      const est = estimateCost({ source_type: sourceTypeHint, params: body?.cost_params })
      const bg = await checkBudget({ agencyId, clientId, estimatedCost: est })
      if (bg.block && !body?.override) {
        return err(402, 'budget_exceeded', { ...bg, estimated_cost: est })
      }
      if (bg.block && body?.override) {
        await applyOverride({
          agencyId, clientId, userId,
          estimatedCost: est, originalCap: bg.scope === 'agency' ? 50 : 5,
          overrideValue: bg.scope === 'agency' ? bg.projected_agency : bg.projected_client,
          scope: bg.scope ?? 'per_source_cap', sourceType: sourceTypeHint,
          justification: body?.justification ?? null,
        })
      }

      const result = await seedFromUpload({ agencyId, clientId, storagePath, uploadId })

      // Persist extracted records via seedProfile merge path
      if (result.records.length > 0) {
        await seedProfile({
          clientId,
          agencyId,
          externalRecords: result.records,
          forceRebuild: false,
        })
      }

      return NextResponse.json({
        ok: true,
        kind: result.kind,
        extracted: result.records.length,
        cost_usd: est,
      })
    }

    // ── list_uploads (PROF-10 — list uploads for a client) ──────────────────
    if (action === 'list_uploads') {
      const clientId = String(body?.client_id ?? '')
      if (!clientId) return err(400, 'client_id required')

      const { data: profile } = await db.clientProfile.get(clientId)
      if (!profile) return err(404, 'Profile not found')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sources = ((profile as any).sources || []) as Array<Record<string, any>>
      const uploads = sources.filter(s =>
        s.source_type?.startsWith('pdf_') ||
        s.source_type?.startsWith('docx_') ||
        s.source_type?.startsWith('image_') ||
        s.source_ref?.startsWith('upload:')
      )
      return NextResponse.json({ uploads })
    }

    // ── connect_gbp_oauth_start (PROF-09 — JSON consent URL for UI) ────────
    if (action === 'connect_gbp_oauth_start') {
      const rl = checkRateLimit({ agencyId, actionKey: 'connect_gbp_oauth_start' })
      if (!rl.allowed) {
        return err(429, 'Rate limited', { retry_after_ms: rl.retry_after_ms })
      }
      const mode = (body.mode === 'client' ? 'client' : 'agency') as 'agency' | 'client'
      const redirectUri = body.redirect_uri || `${new URL(req.url).origin}/api/kotoiq/profile/oauth_gbp/callback`
      const { url: consentUrl, state, stateCookieValue } = generateConsentUrl({
        agencyId,
        mode,
        clientId: body.scope_client_id,
        redirectUri,
        redirectAfter: body.redirect_after || '/kotoiq/launch',
      })
      return NextResponse.json({ consent_url: consentUrl, state, state_cookie: stateCookieValue })
    }

    // ── list_gbp_locations (PROF-09 — list accessible GBP locations) ─────────
    if (action === 'list_gbp_locations') {
      const integration = await db.agencyIntegrations.getByKind('gbp_agency_oauth', null)
      if (!integration.data?.encrypted_payload) {
        return err(404, 'No GBP OAuth connection found — connect first')
      }
      const plain = decryptSecret(integration.data.encrypted_payload, agencyId)
      const tokens = JSON.parse(plain)
      const acctRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (!acctRes.ok) return err(502, `GBP accounts API returned ${acctRes.status}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acctBody = await acctRes.json() as any
      const accounts = acctBody?.accounts || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locations: any[] = []
      for (const acct of accounts.slice(0, 10)) {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations?readMask=title,name,storefrontAddress`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } },
        )
        if (locRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const locBody = await locRes.json() as any
          for (const loc of locBody?.locations || []) {
            locations.push({ name: loc.name, title: loc.title, address: loc.storefrontAddress, account_name: acct.name })
          }
        }
      }
      return NextResponse.json({ locations })
    }

    // ── seed_gbp_auth (PROF-09 — pull from authenticated GBP) ───────────────
    if (action === 'seed_gbp_auth') {
      if (!body.client_id || !body.location_name) {
        return err(400, 'client_id and location_name required')
      }
      const costEst = SOURCE_CONFIG.gbp_authenticated.default_cost_cap
      const budget = await checkBudget({ agencyId, clientId: body.client_id, estimatedCost: costEst })
      if (!budget.allowed && !body.budget_override) {
        return err(402, 'Budget exceeded', { scope: budget.scope, remaining_client: budget.remaining_client, remaining_agency: budget.remaining_agency })
      }
      const integration = await db.agencyIntegrations.getByKind('gbp_agency_oauth', null)
      if (!integration.data?.encrypted_payload) {
        return err(404, 'No GBP OAuth connection — connect first')
      }
      const plain = decryptSecret(integration.data.encrypted_payload, agencyId)
      const tokens = JSON.parse(plain)
      const records = await pullFromGBPAuth({
        agencyId,
        clientId: body.client_id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        integrationRowId: integration.data.id,
        locationName: body.location_name,
      })
      if (records.length > 0) {
        await seedProfile({ clientId: body.client_id, agencyId, externalRecords: records, forceRebuild: false })
      }
      return NextResponse.json({ ok: true, extracted: records.length })
    }

    // ── seed_gbp_places (PROF-09 — pull from Places API public) ─────────────
    if (action === 'seed_gbp_places') {
      if (!body.client_id || !body.place_id) {
        return err(400, 'client_id and place_id required')
      }
      const costEst = SOURCE_CONFIG.gbp_public.default_cost_cap
      const budget = await checkBudget({ agencyId, clientId: body.client_id, estimatedCost: costEst })
      if (!budget.allowed && !body.budget_override) {
        return err(402, 'Budget exceeded', { scope: budget.scope, remaining_client: budget.remaining_client, remaining_agency: budget.remaining_agency })
      }
      const records = await pullFromGBPPlaces({ placeId: body.place_id, agencyId, clientId: body.client_id })
      if (records.length > 0) {
        await seedProfile({ clientId: body.client_id, agencyId, externalRecords: records, forceRebuild: false })
      }
      return NextResponse.json({ ok: true, extracted: records.length })
    }

    return err(400, 'Unhandled action')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[profile.route] error', e)
    return err(500, 'Internal error', {
      message: String(e?.message || e).slice(0, 500),
    })
  }
}
