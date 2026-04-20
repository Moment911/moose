import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 07 — Supabase Storage helpers for KotoIQ file uploads
//
// All paths are agency-scoped: kotoiq-uploads/{agency_id}/{client_id}/{upload_id}.{ext}
// Cross-agency access is refused by parseUploadPath + agencyId check (T-08-62).
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'review-files'
const STORAGE_PREFIX = 'kotoiq-uploads'
const MAX_SIGNED_URL_TTL_SEC = 3600 // RESEARCH §Security Domain: TTL <= 1 hour

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('[profileUploadStorage] Missing Supabase env')
  return createClient(url, key)
}

export function buildUploadPath(agencyId: string, clientId: string, uploadId: string, ext: string): string {
  return `${STORAGE_PREFIX}/${agencyId}/${clientId}/${uploadId}.${ext}`
}

export function parseUploadPath(path: string): { agencyId: string; clientId: string; uploadId: string; ext: string } | null {
  const parts = path.split('/')
  if (parts.length !== 4 || parts[0] !== STORAGE_PREFIX) return null
  const [, agencyId, clientId, filename] = parts
  const m = filename.match(/^([\w-]+)\.([A-Za-z0-9]+)$/)
  if (!m) return null
  return { agencyId, clientId, uploadId: m[1], ext: m[2] }
}

export async function uploadToStorage(args: {
  agencyId: string
  clientId: string
  buffer: Uint8Array
  ext: string
  contentType: string
  uploadId?: string
}): Promise<{ path: string; uploadId: string; bytes: number }> {
  const sb = storageClient()
  const uploadId = args.uploadId ?? randomUUID()
  const path = buildUploadPath(args.agencyId, args.clientId, uploadId, args.ext)
  const { error } = await sb.storage.from(BUCKET).upload(path, args.buffer, {
    contentType: args.contentType,
    upsert: false,
  })
  if (error) throw new Error(`STORAGE_UPLOAD: ${error.message}`)
  return { path, uploadId, bytes: args.buffer.length }
}

export async function getSignedUrl(args: { path: string; agencyId: string; ttlSec?: number }): Promise<string> {
  const parsed = parseUploadPath(args.path)
  if (!parsed) throw new Error('STORAGE_BAD_PATH')
  if (parsed.agencyId !== args.agencyId) throw new Error('STORAGE_AGENCY_MISMATCH')
  const ttl = Math.min(args.ttlSec ?? 600, MAX_SIGNED_URL_TTL_SEC)
  const sb = storageClient()
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(args.path, ttl)
  if (error || !data?.signedUrl) throw new Error(`STORAGE_SIGN: ${error?.message ?? 'no_url'}`)
  return data.signedUrl
}

export async function deleteUpload(args: { path: string; agencyId: string }): Promise<void> {
  const parsed = parseUploadPath(args.path)
  if (!parsed) throw new Error('STORAGE_BAD_PATH')
  if (parsed.agencyId !== args.agencyId) throw new Error('STORAGE_AGENCY_MISMATCH')
  const sb = storageClient()
  const { error } = await sb.storage.from(BUCKET).remove([args.path])
  if (error) throw new Error(`STORAGE_DELETE: ${error.message}`)
}

export async function downloadForProcessing(args: { path: string; agencyId: string }): Promise<Uint8Array> {
  const parsed = parseUploadPath(args.path)
  if (!parsed) throw new Error('STORAGE_BAD_PATH')
  if (parsed.agencyId !== args.agencyId) throw new Error('STORAGE_AGENCY_MISMATCH')
  const sb = storageClient()
  const { data, error } = await sb.storage.from(BUCKET).download(args.path)
  if (error || !data) throw new Error(`STORAGE_DOWNLOAD: ${error?.message ?? 'no_data'}`)
  const buf = await data.arrayBuffer()
  return new Uint8Array(buf)
}
