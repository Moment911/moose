import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../lib/kotoiqDb'
import { MAX_PASTED_TEXT_CHARS } from '../../../../lib/kotoiq/profileConfig'
import { CANONICAL_FIELD_NAMES } from '../../../../lib/kotoiq/profileTypes'
import { seedProfile } from '../../../../lib/kotoiq/profileSeeder'
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
import type { ProvenanceRecord } from '../../../../lib/kotoiq/profileTypes'

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

      // clients is NOT a kotoiq_* table; explicit .eq('agency_id', agencyId).
      const { data: clientRow } = await sb
        .from('clients')
        .select('id, name, email, phone')
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

      const channelArg = typeof body.channel === 'string' ? body.channel : 'auto'
      let channel: 'sms' | 'email' | 'portal'
      if (channelArg === 'sms' || channelArg === 'email' || channelArg === 'portal') {
        channel = channelArg
      } else {
        const picked = await pickClarificationChannel({
          question: c.question,
          agencyId,
          clientId: c.client_id,
        })
        // pickClarificationChannel may return 'operator' (D-18) — collapse to
        // portal so the downstream switch is exhaustive.
        channel = picked.channel === 'operator' ? 'portal' : picked.channel
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

    return err(400, 'Unhandled action')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[profile.route] error', e)
    return err(500, 'Internal error', {
      message: String(e?.message || e).slice(0, 500),
    })
  }
}
