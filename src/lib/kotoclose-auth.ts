import { createClient } from '@supabase/supabase-js'

const supabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export interface KCAccess {
  canAccess: boolean
  isSuperAdmin: boolean
  agencyId: string | null
  userEmail: string | null
  features: {
    intelligence: boolean
    rvm: boolean
    ghl: boolean
    brainBuilder: boolean
    dncScrub: boolean
  }
  limits: { maxDailyCalls: number; maxCampaigns: number }
  planTier: 'starter' | 'growth' | 'agency'
}

export const DENIED: KCAccess = {
  canAccess: false, isSuperAdmin: false, agencyId: null, userEmail: null,
  features: { intelligence: false, rvm: false, ghl: false, brainBuilder: false, dncScrub: false },
  limits: { maxDailyCalls: 0, maxCampaigns: 0 }, planTier: 'starter',
}

export async function getKCAccess(): Promise<KCAccess> {
  const sb = supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return DENIED

  // Check super admin
  const { data: admin } = await sb.from('koto_platform_admins').select('id').eq('user_id', user.id).maybeSingle()
  if (admin) {
    return {
      canAccess: true, isSuperAdmin: true, agencyId: null, userEmail: user.email || null,
      features: { intelligence: true, rvm: true, ghl: true, brainBuilder: true, dncScrub: true },
      limits: { maxDailyCalls: 999999, maxCampaigns: 999 }, planTier: 'agency',
    }
  }

  // Check agency member
  const { data: member } = await sb.from('agency_members').select('agency_id, role').eq('user_id', user.id).maybeSingle()
  if (!member || !['owner', 'admin'].includes(member.role)) return DENIED

  // Check KC access
  const { data: access } = await sb.from('kc_agency_access').select('*').eq('agency_id', member.agency_id).maybeSingle()
  if (!access || !access.kotoclose_enabled) return DENIED

  return {
    canAccess: true, isSuperAdmin: false, agencyId: member.agency_id, userEmail: user.email || null,
    features: {
      intelligence: access.feature_intelligence ?? true,
      rvm: access.feature_rvm ?? true,
      ghl: access.feature_ghl ?? true,
      brainBuilder: access.feature_brain_builder ?? true,
      dncScrub: access.feature_dnc_scrub ?? true,
    },
    limits: { maxDailyCalls: access.max_daily_calls ?? 500, maxCampaigns: access.max_campaigns ?? 10 },
    planTier: (access.plan_tier as KCAccess['planTier']) || 'agency',
  }
}
