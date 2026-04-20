import 'server-only'
import { extractFromPastedText, type ExtractedFieldRecord } from './profileExtractClaude'
import { SOURCE_CONFIG } from './profileConfig'

export type JotformPullArgs = {
  formId: string
  apiKey: string
  agencyId: string
  clientId: string
  sourceUrl: string
}

export async function pullFromJotform(args: JotformPullArgs): Promise<ExtractedFieldRecord[]> {
  // SECURITY: Use APIKEY header, NOT querystring — prevents key leak to Vercel Function logs
  // (RESEARCH §Security Domain — Jotform puts key in querystring by default; we deliberately move it to header).
  const r = await fetch(
    `https://api.jotform.com/form/${encodeURIComponent(args.formId)}/submissions?limit=1000`,
    { headers: { APIKEY: args.apiKey } }
  )
  if (r.status === 401 || r.status === 403) throw new Error('JOTFORM_AUTH_FAILED')
  if (!r.ok) throw new Error(`JOTFORM_HTTP_${r.status}`)
  const body = await r.json() as any
  if (body?.responseCode !== 200) throw new Error(`JOTFORM_RESPONSE_${body?.responseCode ?? 'unknown'}`)

  const blocks: string[] = []
  for (const sub of body?.content ?? []) {
    for (const [, a] of Object.entries(sub?.answers ?? {})) {
      const ans = a as any
      const q = ans?.text ?? ans?.name ?? 'question'
      const v = ans?.answer ?? ans?.prettyFormat ?? ''
      if (v && typeof v === 'string') blocks.push(`Q: ${q}\nA: ${v}`)
      else if (v && typeof v === 'object') blocks.push(`Q: ${q}\nA: ${JSON.stringify(v)}`)
    }
  }
  const text = blocks.join('\n\n')
  if (!text) return []

  const records = await extractFromPastedText({
    text, agencyId: args.agencyId, clientId: args.clientId,
    sourceLabel: 'jotform', sourceUrl: args.sourceUrl,
  })
  const ceiling = SOURCE_CONFIG.jotform_api.confidence_ceiling
  return records.map(({ field_name, record }) => ({
    field_name,
    record: { ...record, source_type: 'jotform_api' as const, confidence: Math.min(record.confidence, ceiling) },
  }))
}
