import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../../lib/kotoiqDb'
import { detectFileType } from '../../../../../lib/kotoiq/profileUploadDetect'
import { uploadToStorage } from '../../../../../lib/kotoiq/profileUploadStorage'
import { randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 07 — Multipart upload route for file-based profile extraction
//
// POST /api/kotoiq/profile/upload
// Accepts: multipart/form-data with `file` + `client_id`
// Returns: { ok, upload_id, path, bytes, kind, mime, ext, file_name }
//
// Two-step flow: upload lands file in Storage, then UI calls seed_upload to
// trigger extraction (operator picks cost cap before extraction).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req)
  if (!session.verified || !session.agencyId || !session.userId) {
    return err(401, 'unauthenticated')
  }
  const agencyId = session.agencyId

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return err(400, 'invalid_multipart')
  }

  const clientId = String(form.get('client_id') ?? '')
  const file = form.get('file') as File | null
  if (!clientId) return err(400, 'missing_client_id')
  if (!file) return err(400, 'missing_file')

  // Cross-agency client check
  const db = getKotoIQDb(agencyId)
  const { data: clientRow } = await db.client
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (!clientRow) return err(404, 'not_found')

  // Size gate
  if (file.size > MAX_BYTES) {
    return err(413, 'file_too_large', { limit_mb: 25, actual_mb: Math.ceil(file.size / (1024 * 1024)) })
  }

  const buf = new Uint8Array(await file.arrayBuffer())
  const det = detectFileType(buf)
  if (!det.valid || !det.ext || !det.mime) {
    return err(415, 'unsupported_type', { reason: det.reason ?? 'unknown' })
  }

  const uploadId = randomUUID()
  const { path, bytes } = await uploadToStorage({
    agencyId,
    clientId,
    buffer: buf,
    ext: det.ext,
    contentType: det.mime,
    uploadId,
  })

  return NextResponse.json({
    ok: true,
    upload_id: uploadId,
    path,
    bytes,
    kind: det.kind,
    mime: det.mime,
    ext: det.ext,
    file_name: file.name,
  })
}
