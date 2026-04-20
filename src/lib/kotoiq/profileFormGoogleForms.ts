import 'server-only'
import { extractFromPastedText, type ExtractedFieldRecord } from './profileExtractClaude'
import { SOURCE_CONFIG } from './profileConfig'
import { getKotoIQDb } from '../kotoiqDb'
import { encryptSecret } from './profileIntegrationsVault'

export type GoogleFormsPullArgs = {
  formId: string
  accessToken: string
  refreshToken: string
  integrationRowId: string  // koto_agency_integrations.id for token refresh persistence
  agencyId: string
  clientId: string
  sourceUrl: string
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    }).toString(),
  })
  if (!r.ok) throw new Error(`GOOGLE_REFRESH_${r.status}`)
  return r.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function pullFromGoogleForms(args: GoogleFormsPullArgs): Promise<ExtractedFieldRecord[]> {
  let token = args.accessToken

  async function doFetch(t: string) {
    return fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(args.formId)}/responses`, {
      headers: { Authorization: `Bearer ${t}` },
    })
  }

  let r = await doFetch(token)
  if (r.status === 401) {
    // Refresh once
    const refreshed = await refreshGoogleToken(args.refreshToken)
    token = refreshed.access_token
    // Persist new access_token
    const db = getKotoIQDb(args.agencyId)
    const row = await db.agencyIntegrations.get(args.integrationRowId)
    if (row) {
      const encrypted_payload = encryptSecret(JSON.stringify({
        access_token: token, refresh_token: args.refreshToken, expires_in: refreshed.expires_in,
        refreshed_at: new Date().toISOString(),
      }), args.agencyId)
      await db.agencyIntegrations.upsert({ ...row, encrypted_payload })
    }
    r = await doFetch(token)
  }
  if (!r.ok) throw new Error(`GOOGLE_FORMS_HTTP_${r.status}`)
  const body = await r.json() as any

  const blocks: string[] = []
  for (const resp of body?.responses ?? []) {
    for (const [qid, ans] of Object.entries(resp?.answers ?? {})) {
      const a = ans as any
      const texts = a?.textAnswers?.answers?.map((x: any) => x.value).filter(Boolean) ?? []
      if (texts.length) blocks.push(`Q: ${qid}\nA: ${texts.join(' | ')}`)
    }
  }
  const text = blocks.join('\n\n')
  if (!text) return []

  const records = await extractFromPastedText({
    text, agencyId: args.agencyId, clientId: args.clientId,
    sourceLabel: 'google_forms', sourceUrl: args.sourceUrl,
  })
  const ceiling = SOURCE_CONFIG.google_forms_api.confidence_ceiling
  return records.map(({ field_name, record }) => ({
    field_name,
    record: { ...record, source_type: 'google_forms_api' as const, confidence: Math.min(record.confidence, ceiling) },
  }))
}
