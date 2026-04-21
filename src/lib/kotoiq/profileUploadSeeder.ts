import 'server-only'
import type { ExtractedFieldRecord } from './profileExtractClaude'
import { detectFileType } from './profileUploadDetect'
import { downloadForProcessing, parseUploadPath } from './profileUploadStorage'
import { extractFromPdf } from './profileUploadPdf'
import { extractFromDocx } from './profileUploadDocx'
import { extractFromImage } from './profileUploadImage'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 07 — Upload dispatcher
//
// detectFileType -> route to correct extractor based on magic bytes.
// Rejects files > 25 MB with clear error.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BYTES = 25 * 1024 * 1024

export type SeedUploadArgs = {
  agencyId: string
  clientId: string
  storagePath: string
  uploadId: string
}

export async function seedFromUpload(
  args: SeedUploadArgs,
): Promise<{ records: ExtractedFieldRecord[]; kind: string }> {
  const parsed = parseUploadPath(args.storagePath)
  if (!parsed) throw new Error('SEED_UPLOAD_BAD_PATH')
  if (parsed.agencyId !== args.agencyId) throw new Error('SEED_UPLOAD_AGENCY_MISMATCH')

  const bytes = await downloadForProcessing({ path: args.storagePath, agencyId: args.agencyId })
  if (bytes.length > MAX_BYTES) throw new Error('SEED_UPLOAD_FILE_TOO_LARGE')

  const det = detectFileType(bytes)
  if (!det.valid) throw new Error(`SEED_UPLOAD_UNSUPPORTED:${det.reason ?? 'unknown'}`)

  const common = {
    agencyId: args.agencyId,
    clientId: args.clientId,
    uploadId: args.uploadId,
    storagePath: args.storagePath,
  }

  switch (det.kind) {
    case 'pdf':
      return { kind: det.kind, records: await extractFromPdf({ buffer: bytes, ...common }) }
    case 'docx':
      return { kind: det.kind, records: await extractFromDocx({ buffer: bytes, ...common }) }
    case 'png':
    case 'jpeg':
    case 'webp':
    case 'heic':
      return {
        kind: det.kind,
        records: await extractFromImage({ buffer: bytes, mime: det.mime as any, ...common }),
      }
    default:
      throw new Error(`SEED_UPLOAD_UNEXPECTED_KIND:${det.kind}`)
  }
}
