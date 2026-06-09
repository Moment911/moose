/**
 * computeInternalLinks — shared sibling / cross-campaign / hub link computation
 * (Phase 11 / WS6).
 *
 * This is an EXTRACTION (not a rewrite) of the link computation that
 * deployCampaign builds inline in
 * src/app/api/kotoiq/topic-campaign/route.ts (~lines 1745-1785). Pulling it into
 * one helper lets BOTH the topic-campaign deploy/redeploy path AND the Page
 * Factory build path weave the same sibling + cross-campaign + hub links through
 * the existing tokenResolver — without rebuilding the link injector.
 *
 * Contract — byte-identical to the inline deploy path:
 *   • siblingLinks  — prior published deploys for THIS campaign, deduped by city,
 *                     with the caller's `newSiblings` winning when a city appears
 *                     in both. (Matches deployCampaign's siblingsByCity merge.)
 *   • crossByCity   — other campaigns on the same SITE that have published pages
 *                     in the same cities → "Related Services in {City}". (Matches
 *                     buildCrossCampaignMap exactly.)
 *   • hub           — passed through only when the caller has a hub. (Matches
 *                     deployCampaign's `campaign.hub_url ? { hub } : {}`.)
 *
 * The helper does DB READS only — never writes — so it is unit-testable against
 * a mocked supabase. The `newSiblings` for the current batch are computed by the
 * caller (they need campaign-specific resolveMaster), then handed in; the
 * byte-identical merge happens here.
 *
 * BreadcrumbList stays schema-only (KSES) — the hub here is just { url, title }
 * passed into tokenResolver ctx.hub, which renders it as JSON-LD, NEVER into the
 * post body. This helper does not touch post HTML.
 */

import 'server-only'

export interface SiblingLink {
  city: string
  state_abbr?: string
  url: string
}

export interface CrossLink {
  topic: string
  city: string
  state_abbr: string
  url: string
}

export interface HubContext {
  url: string
  title: string
}

export interface ComputeInternalLinksInput {
  /** koto_wp_sites.id — cross-linking is scoped to the same domain. */
  siteId: string
  /** The current campaign id — excluded from the cross-campaign map. */
  campaignId: string
  /**
   * Siblings for the current batch (caller-computed via resolveMaster). The
   * byte-identical merge gives these precedence over prior deploys for the same
   * city. For redeploy this is the list rebuilt from stored deploy URLs.
   */
  newSiblings: SiblingLink[]
  /** Hub context, when the campaign has a hub. Passed straight through. */
  hub?: HubContext
}

export interface ComputeInternalLinksResult {
  siblingLinks: SiblingLink[]
  crossByCity: Map<string, CrossLink[]>
  hub?: HubContext
}

/**
 * Build the (city, state_abbr) → cross-campaign links map for a site. Byte-for-
 * byte the same logic as topic-campaign/route.ts buildCrossCampaignMap.
 */
async function buildCrossCampaignMap(
  supabase: any,
  siteId: string,
  excludeCampaignId: string,
): Promise<Map<string, CrossLink[]>> {
  const out = new Map<string, CrossLink[]>()
  if (!siteId) return out

  // Other campaigns on this site (excluding the current one)
  const { data: otherCampaigns } = await supabase
    .from('koto_topic_campaigns')
    .select('id, topic')
    .eq('site_id', siteId)
    .neq('id', excludeCampaignId)
  if (!otherCampaigns || otherCampaigns.length === 0) return out

  const idToTopic = new Map<string, string>()
  for (const c of otherCampaigns) idToTopic.set(c.id, c.topic || 'Service')

  const { data: otherDeploys } = await supabase
    .from('koto_topic_campaign_deploys')
    .select('campaign_id, city, state_abbr, wp_post_url')
    .in('campaign_id', otherCampaigns.map((c: any) => c.id))
    .eq('status', 'published')
    .not('wp_post_url', 'is', null)

  for (const d of (otherDeploys || [])) {
    if (!d.city || !d.wp_post_url) continue
    const stateAbbr = String(d.state_abbr || '').toUpperCase()
    const key = `${String(d.city).toLowerCase().trim()}|${stateAbbr}`
    const topic = idToTopic.get(d.campaign_id) || 'Service'
    const bucket = out.get(key) || []
    // Dedupe within a city by topic — keep the first if a topic somehow has two.
    if (!bucket.some(x => x.topic === topic)) {
      bucket.push({ topic, city: d.city, state_abbr: stateAbbr, url: d.wp_post_url })
    }
    out.set(key, bucket)
  }
  return out
}

export async function computeInternalLinks(
  supabase: any,
  input: ComputeInternalLinksInput,
): Promise<ComputeInternalLinksResult> {
  const { siteId, campaignId, newSiblings, hub } = input

  // Prior published siblings for THIS campaign. Mirrors deployCampaign @1750-1755.
  const { data: priorDeploys } = await supabase
    .from('koto_topic_campaign_deploys')
    .select('city, state_abbr, wp_post_url')
    .eq('campaign_id', campaignId)
    .eq('status', 'published')
    .not('wp_post_url', 'is', null)

  const priorSiblings: SiblingLink[] = (priorDeploys || []).map((x: any) => ({
    city: x.city,
    state_abbr: x.state_abbr,
    url: x.wp_post_url,
  }))

  // Dedupe by city — newSiblings win if a city appears in both (deployCampaign @1766-1770).
  const siblingsByCity = new Map<string, SiblingLink>()
  for (const s of priorSiblings) siblingsByCity.set(s.city, s)
  for (const s of newSiblings) siblingsByCity.set(s.city, s)
  const siblingLinks = Array.from(siblingsByCity.values())

  // Cross-campaign clustering, scoped to the same site (deployCampaign @1779).
  const crossByCity = await buildCrossCampaignMap(supabase, siteId, campaignId)

  return { siblingLinks, crossByCity, ...(hub ? { hub } : {}) }
}
