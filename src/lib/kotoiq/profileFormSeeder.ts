import 'server-only'
import { detectFormProvider, type FormProvider } from './profileFormDetect'
import { pullFromTypeform } from './profileFormTypeform'
import { pullFromJotform } from './profileFormJotform'
import { pullFromGoogleForms } from './profileFormGoogleForms'
import { scrapeFormUrl } from './profileFormScrape'
import { getKotoIQDb } from '../kotoiqDb'
import { decryptSecret } from './profileIntegrationsVault'
import type { ExtractedFieldRecord } from './profileExtractClaude'

export type SeedFormArgs = {
  url: string
  agencyId: string
  clientId: string
  preferApi?: boolean  // default true; UI Plan 08 "Always scrape" toggles to false
}

export type SeedFormResult = {
  via: 'typeform_api' | 'jotform_api' | 'google_forms_api' | 'form_scrape'
  provider: FormProvider
  form_id: string | null
  records: ExtractedFieldRecord[]
}

const PROVIDER_TO_KIND: Record<Exclude<FormProvider, 'unknown'>, 'typeform' | 'jotform' | 'google_forms'> = {
  typeform: 'typeform',
  jotform: 'jotform',
  google_forms: 'google_forms',
}

export async function seedFromFormUrl(args: SeedFormArgs): Promise<SeedFormResult> {
  const det = detectFormProvider(args.url)
  if (det.provider === 'unknown') throw new Error('NOT_A_FORM_URL')

  const db = getKotoIQDb(args.agencyId)
  const preferApi = args.preferApi ?? true

  if (preferApi) {
    const kind = PROVIDER_TO_KIND[det.provider]
    const row = await db.agencyIntegrations.getByKind(kind, null)
    if (row && det.form_id) {
      try {
        const plaintext = decryptSecret(row.encrypted_payload, args.agencyId)
        if (det.provider === 'typeform') {
          const records = await pullFromTypeform({ formId: det.form_id, apiKey: plaintext, agencyId: args.agencyId, clientId: args.clientId, sourceUrl: args.url })
          return { via: 'typeform_api', provider: det.provider, form_id: det.form_id, records }
        }
        if (det.provider === 'jotform') {
          const records = await pullFromJotform({ formId: det.form_id, apiKey: plaintext, agencyId: args.agencyId, clientId: args.clientId, sourceUrl: args.url })
          return { via: 'jotform_api', provider: det.provider, form_id: det.form_id, records }
        }
        if (det.provider === 'google_forms') {
          const parsed = JSON.parse(plaintext) as { access_token: string; refresh_token: string }
          const records = await pullFromGoogleForms({
            formId: det.form_id, accessToken: parsed.access_token, refreshToken: parsed.refresh_token,
            integrationRowId: row.id, agencyId: args.agencyId, clientId: args.clientId, sourceUrl: args.url,
          })
          return { via: 'google_forms_api', provider: det.provider, form_id: det.form_id, records }
        }
      } catch (err) {
        console.warn('[profileFormSeeder] provider API failed, falling back to scrape', {
          provider: det.provider, error: (err as Error)?.message ?? 'unknown',
        })
        // fall through to scrape
      }
    }
  }

  // Scrape fallback (D-01)
  const records = await scrapeFormUrl({ url: args.url, agencyId: args.agencyId, clientId: args.clientId })
  return { via: 'form_scrape', provider: det.provider, form_id: det.form_id, records }
}
