import 'server-only'
import { extractFromPastedText, type ExtractedFieldRecord } from './profileExtractClaude'
import { SOURCE_CONFIG } from './profileConfig'

export type TypeformPullArgs = {
  formId: string
  apiKey: string
  agencyId: string
  clientId: string
  sourceUrl: string
}

export async function pullFromTypeform(args: TypeformPullArgs): Promise<ExtractedFieldRecord[]> {
  const r = await fetch(
    `https://api.typeform.com/forms/${encodeURIComponent(args.formId)}/responses?page_size=25`,
    { headers: { Authorization: `Bearer ${args.apiKey}` } }
  )
  if (r.status === 401 || r.status === 403) throw new Error('TYPEFORM_AUTH_FAILED')
  if (!r.ok) throw new Error(`TYPEFORM_HTTP_${r.status}`)
  const body = await r.json() as any

  // Concatenate every answer's text into a single Q&A blob.
  const blocks: string[] = []
  for (const item of body?.items ?? []) {
    for (const a of item?.answers ?? []) {
      const label = a?.field?.ref ?? a?.field?.id ?? 'question'
      const value = a?.text ?? a?.number ?? a?.boolean ?? a?.choice?.label ?? (a?.choices?.labels?.join?.(', ')) ?? ''
      if (value) blocks.push(`Q: ${label}\nA: ${value}`)
    }
  }
  const text = blocks.join('\n\n')
  if (!text) return []

  const records = await extractFromPastedText({
    text,
    agencyId: args.agencyId,
    clientId: args.clientId,
    sourceLabel: 'typeform',
    sourceUrl: args.sourceUrl,
  })

  // Override source_type + clamp confidence ceiling (D-04 = 0.9).
  const ceiling = SOURCE_CONFIG.typeform_api.confidence_ceiling
  return records.map(({ field_name, record }) => ({
    field_name,
    record: {
      ...record,
      source_type: 'typeform_api' as const,
      confidence: Math.min(record.confidence, ceiling),
    },
  }))
}
