// ─────────────────────────────────────────────────────────────
// Auto-trigger initial data sync after a new connection is saved
// Fire-and-forget — doesn't block the OAuth callback
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function autoTriggerSync(
  s: SupabaseClient,
  body: { client_id: string; provider: string; agency_id?: string }
): Promise<{ triggered: boolean; provider: string }> {
  const { client_id, provider, agency_id } = body
  if (!client_id || !provider) throw new Error('client_id and provider required')

  // Dynamically import the correct ingestion engine
  try {
    switch (provider) {
      case 'ads': {
        const { ingestGoogleAds } = await import('./ingestGoogleAds')
        void ingestGoogleAds(s, { client_id, agency_id }) // fire-and-forget
        break
      }
      case 'meta': {
        const { ingestMetaAds } = await import('./ingestMetaAds')
        void ingestMetaAds(s, { client_id, agency_id })
        break
      }
      case 'linkedin': {
        const { ingestLinkedInAds } = await import('./ingestLinkedInAds')
        void ingestLinkedInAds(s, { client_id, agency_id })
        break
      }
      case 'hotjar': {
        const { ingestHotjar } = await import('./ingestHotjar')
        void ingestHotjar(s, { client_id, agency_id })
        break
      }
      case 'clarity': {
        const { ingestClarity } = await import('./ingestClarity')
        void ingestClarity(s, { client_id, agency_id })
        break
      }
      default:
        return { triggered: false, provider }
    }
    return { triggered: true, provider }
  } catch (e: any) {
    console.error(`[autoTriggerSync] Failed for ${provider}:`, e.message)
    return { triggered: false, provider }
  }
}
