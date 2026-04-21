import 'server-only'
import { extractFromPastedText, type ExtractedFieldRecord } from './profileExtractClaude'
import { SOURCE_CONFIG } from './profileConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 07 — DOCX extraction via mammoth + section chunking
//
// mammoth.convertToHtml -> split on h1/h2 -> extractFromPastedText per section
// source_type='docx_text_extract', confidence <= 0.75
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SECTION_CHARS = 8_000

export type DocxExtractArgs = {
  buffer: Uint8Array
  agencyId: string
  clientId: string
  uploadId: string
  storagePath: string
}

export async function extractFromDocx(args: DocxExtractArgs): Promise<ExtractedFieldRecord[]> {
  const mammoth = await import('mammoth')
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(args.buffer) })
  if (!html || html.length < 20) return []

  const sections = splitDocxByHeadings(html)
  if (!sections.length) return []

  const ceiling = SOURCE_CONFIG.docx_text_extract.confidence_ceiling
  const out: ExtractedFieldRecord[] = []

  for (const { heading, content } of sections) {
    const text = stripHtml(content).slice(0, MAX_SECTION_CHARS)
    if (!text) continue
    const records = await extractFromPastedText({
      text,
      agencyId: args.agencyId,
      clientId: args.clientId,
      sourceLabel: 'docx_text_extract',
      sourceUrl: args.storagePath,
    })
    const sourceRef = `upload:${args.uploadId}#section=${encodeURIComponent(heading)}`
    for (const { field_name, record } of records) {
      out.push({
        field_name,
        record: {
          ...record,
          source_type: 'docx_text_extract' as const,
          source_ref: sourceRef,
          source_url: args.storagePath,
          confidence: Math.min(record.confidence, ceiling),
        },
      })
    }
  }
  return out
}

function splitDocxByHeadings(html: string): Array<{ heading: string; content: string }> {
  const re = /<h([12])[^>]*>(.*?)<\/h\1>/gis
  let match: RegExpExecArray | null
  const positions: Array<{ index: number; heading: string; end: number }> = []

  while ((match = re.exec(html)) !== null) {
    positions.push({
      index: match.index,
      heading: stripHtml(match[2]).trim(),
      end: match.index + match[0].length,
    })
  }

  if (!positions.length) {
    // No headings -- single section from whole doc
    return [{ heading: '(untitled)', content: html }]
  }

  const sections: Array<{ heading: string; content: string }> = []
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].end
    const end = positions[i + 1]?.index ?? html.length
    sections.push({
      heading: positions[i].heading || `section-${i + 1}`,
      content: html.slice(start, end),
    })
  }
  return sections
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
