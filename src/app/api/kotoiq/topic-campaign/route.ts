import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Several actions on this route are long-running:
//   - generate_master with competitor_sample_city → DataForSEO SERP + 3 URL
//     scrapes + Claude master generation (~30-60s)
//   - wrapper_assist with large HTML → streaming Claude 16k+ tokens (~30-90s)
//   - deploy across many cities → N WP REST calls (~60-180s for 50+ cities)
//   - eeat_score + topical_expand → smaller Claude calls (~5-15s)
// Default Vercel function timeout is 60s — too tight. Bump to 300s
// (Vercel's max on Hobby/Pro Fluid Compute) so none of these silently
// time out and return as opaque 504 errors to the dashboard.
export const maxDuration = 300
import Anthropic from '@anthropic-ai/sdk'
import { generateTopicCampaignMaster } from '@/lib/wp-shim/topicCampaignGenerator'
import { resolveMaster, type LocationContext, type ResolveContext, type TopicCampaignMaster } from '@/lib/wp-shim/tokenResolver'
import { buildEeatContext } from '@/lib/wp-shim/eeatContext'
import { validateJsonLd } from '@/lib/wp-shim/schemaValidator'
import { resolveWikidataEntity } from '@/lib/wp-shim/entityGraph'
import { checkCitations } from '@/lib/wp-shim/citationTracker'
import { loadSiteCredentials } from '@/lib/wp-shim/credentialsVault'
import { wpFetchJson } from '@/lib/wp-shim/wpFetch'
import { writeSeoMeta } from '@/lib/wp-shim/ports/seoPort'
import { postGetMetaBulk, healthDiagnostics } from '@/lib/wp-shim/verbs'
import { getAccessToken, fetchSearchConsoleData, fetchGA4Data, loadClientConnections } from '@/lib/seoService'
import { fetchCruxData } from '@/lib/builder/cruxClient'
import { getPlacesForState, STATE_FIPS } from '@/lib/geoLookup'
import { fetchCityLocalData } from '@/lib/wp-shim/censusLocalData'
import { buildLlmsTxt, publishLlmsTxt } from '@/lib/wp-shim/llmsTxtBuilder'
import { shimSelfUpdate } from '@/lib/wp-shim/shimSelfUpdate'
import { logTokenUsage } from '@/lib/tokenTracker'
import { buildMultiCityCompetitorContext } from '@/lib/wp-shim/competitorContext'

// Thin name wrapper — local handle for the per-location ACS lookup used in
// deploy + redeploy. Returns null on any failure (missing key, city not found,
// API outage) so the "By the Numbers" block silently skips.
async function fetchLocalDataForCity(loc: LocationContext) {
    if (!loc?.city || !loc?.stateAbbr) return null
    return fetchCityLocalData(loc.city, loc.stateAbbr)
}

// ─── POST /api/kotoiq/topic-campaign ───────────────────────────────────────
//
// Actions:
//   - generate_master  → Claude writes the master document, save to DB
//   - update_master    → operator-edited master, save to DB
//   - preview_resolved → resolve one city against the master, return HTML
//   - deploy           → bulk-publish N cities to a paired WP site
//   - list_campaigns   → list campaigns for an agency/client
//   - get_campaign     → fetch one campaign
//   - list_deploys     → fetch deploy history for a campaign

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function sb() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
    const action = String(body.action || '')
    const agencyId = String(body.agency_id || '')
    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    const supabase = sb()

    try {
        // Note: await each branch so rejections propagate to the catch
        // below — without await, the Promise escapes the try block and
        // a thrown error becomes a 500 with empty body (client sees
        // "Unexpected end of JSON input").
        switch (action) {
            case 'generate_master':   return await generateMaster(supabase, agencyId, body)
            case 'update_master':     return await updateMaster(supabase, agencyId, body)
            case 'preview_resolved':  return await previewResolved(supabase, agencyId, body)
            case 'deploy':            return await deployCampaign(supabase, agencyId, body)
            case 'list_campaigns':    return await listCampaigns(supabase, agencyId, body)
            case 'get_campaign':      return await getCampaign(supabase, agencyId, body)
            case 'list_deploys':      return await listDeploys(supabase, agencyId, body)
            case 'redeploy':          return await redeployCampaign(supabase, agencyId, body)
            case 'get_performance':   return await getPerformance(supabase, agencyId, body)
            case 'retry_failed':      return await retryFailedDeploys(supabase, agencyId, body)
            case 'verify_live':       return await verifyLiveDeploys(supabase, agencyId, body)
            case 'resync_seo_meta':   return await resyncSeoMeta(supabase, agencyId, body)
            case 'capture_styling':   return await captureStyling(body)
            case 'export_performance_csv': return await exportPerformanceCsv(supabase, agencyId, body)
            case 'publish_llms_txt':  return await publishLlmsTxtForSite(supabase, agencyId, body)
            case 'preview_llms_txt':  return await previewLlmsTxtForSite(supabase, agencyId, body)
            case 'shim_update':       return await shimUpdateForSite(supabase, agencyId, body)
            case 'wrapper_assist':    return await wrapperAssist(body, agencyId)
            case 'eeat_score':        return await eeatScoreMaster(supabase, agencyId, body)
            case 'topical_expand':    return await topicalExpand(supabase, agencyId, body)
            case 'integration_status':return await integrationStatusForSite(supabase, agencyId, body)
            case 'regenerate_master': return await regenerateMaster(supabase, agencyId, body)
            case 'list_states':       return NextResponse.json({ ok: true, states: Object.keys(STATE_FIPS).sort() })
            case 'list_cities':       return await listCities(body)
            case 'delete_campaign':   return await deleteCampaign(supabase, agencyId, body)
            case 'find_places':       return await findPlaces(body)
            case 'set_campaign_place':return await setCampaignPlace(supabase, agencyId, body)
            case 'set_eeat_inputs':   return await setEeatInputs(supabase, agencyId, body)
            case 'validate_schema':   return await validateSchema(supabase, agencyId, body)
            case 'check_citations':   return await checkCitationsAction(supabase, agencyId, body)
            default: return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Detect a "column does not exist" failure across the different shapes Supabase
 * / PostgREST emit it. Postgres raises "column X does not exist" (42703), but
 * PostgREST's schema-cache path raises "Could not find the 'X' column of 'Y'
 * in the schema cache" (code PGRST204) — which the old `/does not exist/` regex
 * missed, so missing optional columns surfaced as hard errors to the user
 * instead of triggering the retry-without-column fallback.
 */
function isMissingColumnError(error: any): boolean {
    if (!error) return false
    const msg = String(error.message || '')
    return error.code === 'PGRST204'
        || error.code === '42703'
        || /column .* does not exist/i.test(msg)
        || /could not find the .* column/i.test(msg)
        || /schema cache/i.test(msg)
}

/**
 * Parse the operator's competitor-sample input and build aggregated intel.
 * The city field may be a comma-separated list of up to 5 cities (paired with
 * one state abbr) — we sample each city's SERP and aggregate, so domains that
 * dominate across markets float to the top. Returns an empty meta when no city
 * is supplied or every SERP lookup fails; generation then proceeds without
 * intel rather than erroring.
 */
async function resolveCompetitorIntel(
    topic: string,
    body: any,
): Promise<{ competitorContext?: string; competitorMeta: any }> {
    const stateAbbr = String(body.competitor_sample_state_abbr || '').trim()
    const cities = String(body.competitor_sample_city || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        // Drop an accidental state abbr typed into the city list (e.g. "Austin, TX").
        .filter((c: string) => !stateAbbr || c.toUpperCase() !== stateAbbr.toUpperCase())
        .slice(0, 5)
    if (cities.length === 0) return { competitorMeta: null }

    try {
        const locations = cities.map((city: string) => ({ city, stateAbbr: stateAbbr || undefined }))
        const ctx = await buildMultiCityCompetitorContext(topic, locations)
        if (!ctx) return { competitorMeta: null }
        return {
            competitorContext: ctx.promptText,
            competitorMeta: {
                multi_city: ctx.cityCount > 1,
                cities_sampled: ctx.citiesSampled,
                city_count: ctx.cityCount,
                sample_query: ctx.sampleQuery,
                sample_location: ctx.sampleLocation,
                competitor_count: ctx.domains.length,
                ai_overview_seen: ctx.aiOverviewSeen,
                people_also_ask: ctx.peopleAlsoAsk.slice(0, 6),
                competitors: ctx.domains.slice(0, 10).map(d => ({
                    domain: d.domain,
                    appearances: d.appearances,
                    best_rank: d.bestRank,
                    h1: d.h1,
                    word_count: d.avgWordCount,
                })),
            },
        }
    } catch {
        return { competitorMeta: null }
    }
}

/**
 * delete_campaign — remove a campaign + its deploy records (agency-scoped).
 * Does NOT delete the published WP pages — those stay live unless the operator
 * removes them in WordPress (deleting live client pages is high blast-radius).
 */
async function deleteCampaign(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data: campaign } = await supabase
        .from('koto_topic_campaigns')
        .select('id')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
    await supabase.from('koto_topic_campaign_deploys').delete().eq('campaign_id', campaignId)
    const { error } = await supabase
        .from('koto_topic_campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

/**
 * find_places — Google Places (New) text search so the operator can connect a
 * business listing to a campaign for live review pulls. Returns candidates with
 * true rating + review count so they can confirm the right one.
 */
async function findPlaces(body: any) {
    const query = String(body.query || '').trim()
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })
    const key = process.env.GOOGLE_PLACES_API_KEY || ''
    if (!key) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, { status: 500 })
    try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
            },
            body: JSON.stringify({ textQuery: query }),
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) {
            const txt = await res.text().catch(() => '')
            return NextResponse.json({ error: `Places error ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ''}` }, { status: 502 })
        }
        const data: any = await res.json()
        const places = (Array.isArray(data.places) ? data.places : []).slice(0, 8).map((p: any) => ({
            place_id: p.id,
            name: p.displayName?.text || '(unnamed)',
            address: p.formattedAddress || '',
            rating: typeof p.rating === 'number' ? p.rating : null,
            review_count: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
        }))
        return NextResponse.json({ ok: true, places })
    } catch (e: any) {
        return NextResponse.json({ error: `Places lookup failed: ${String(e?.message || e)}` }, { status: 500 })
    }
}

/**
 * set_campaign_place — connect (or clear, place_id=null) a Google place to a
 * campaign. Reviews then auto-pull from this place on the next deploy.
 */
async function setCampaignPlace(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const placeId = body.place_id == null ? null : String(body.place_id).trim() || null
    let { data, error } = await supabase
        .from('koto_topic_campaigns')
        .update({ google_place_id: placeId })
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .select('id, google_place_id')
        .single()
    if (isMissingColumnError(error)) {
        return NextResponse.json({ error: 'google_place_id column missing — apply the koto_topic_campaigns google_place_id migration in Supabase first' }, { status: 409 })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data })
}

/**
 * set_eeat_inputs — save operator-provided E-E-A-T data (strategist, results,
 * citations, sameAs) to the campaign. Sanitized to the known shape; empty
 * collections are dropped so blocks stay omit-when-empty. NEVER includes
 * reviews/testimonials — those are pulled live from Google.
 */
async function setEeatInputs(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const inRaw = body.eeat_inputs && typeof body.eeat_inputs === 'object' ? body.eeat_inputs : {}

    const clean: any = {}
    const s = inRaw.strategist
    if (s && String(s.name || '').trim()) {
        clean.strategist = {
            name: String(s.name).trim(),
            ...(String(s.title || '').trim() ? { title: String(s.title).trim() } : {}),
            ...(Number(s.yearsExperience) > 0 ? { yearsExperience: Number(s.yearsExperience) } : {}),
            ...(String(s.photoUrl || '').trim() ? { photoUrl: String(s.photoUrl).trim() } : {}),
        }
    }
    const sameAs = Array.isArray(inRaw.sameAs) ? inRaw.sameAs.map((u: any) => String(u || '').trim()).filter(Boolean) : []
    if (sameAs.length) clean.sameAs = sameAs
    const results = Array.isArray(inRaw.results)
        ? inRaw.results.map((r: any) => ({ metric: String(r?.metric || '').trim(), context: String(r?.context || '').trim() })).filter((r: any) => r.metric)
        : []
    if (results.length) clean.results = results.map((r: any) => (r.context ? r : { metric: r.metric }))
    const citations = Array.isArray(inRaw.citations)
        ? inRaw.citations.map((c: any) => ({ claim: String(c?.claim || '').trim(), sourceName: String(c?.sourceName || '').trim(), sourceUrl: String(c?.sourceUrl || '').trim() })).filter((c: any) => c.sourceName && c.sourceUrl)
        : []
    if (citations.length) clean.citations = citations.map((c: any) => (c.claim ? c : { sourceName: c.sourceName, sourceUrl: c.sourceUrl }))
    const rt = inRaw.rating
    if (rt && Number(rt.ratingValue) > 0 && Number(rt.reviewCount) > 0) {
        clean.rating = {
            ratingValue: Math.max(0, Math.min(5, Number(rt.ratingValue))),
            reviewCount: Math.max(0, Math.round(Number(rt.reviewCount))),
        }
    }
    const addr = inRaw.address
    if (addr && (String(addr.street || '').trim() || String(addr.city || '').trim())) {
        clean.address = {
            ...(String(addr.street || '').trim() ? { street: String(addr.street).trim() } : {}),
            ...(String(addr.city || '').trim() ? { city: String(addr.city).trim() } : {}),
            ...(String(addr.state || '').trim() ? { state: String(addr.state).trim() } : {}),
            ...(String(addr.zip || '').trim() ? { zip: String(addr.zip).trim() } : {}),
        }
    }
    const testimonials = Array.isArray(inRaw.testimonials)
        ? inRaw.testimonials
            .map((t: any) => ({
                text: String(t?.text || '').trim(),
                author: String(t?.author || '').trim(),
                rating: Number(t?.rating) > 0 ? Math.max(1, Math.min(5, Number(t.rating))) : undefined,
                sourceLabel: String(t?.sourceLabel || '').trim() || undefined,
            }))
            .filter((t: any) => t.text && t.author)
        : []
    if (testimonials.length) clean.testimonials = testimonials

    const eeat_inputs = Object.keys(clean).length ? clean : null
    let { data, error } = await supabase
        .from('koto_topic_campaigns')
        .update({ eeat_inputs })
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .select('id, eeat_inputs')
        .single()
    if (isMissingColumnError(error)) {
        return NextResponse.json({ error: 'eeat_inputs column missing — apply the koto_topic_campaigns eeat_inputs migration in Supabase first' }, { status: 409 })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data })
}

/**
 * validate_schema — resolve the master for a sample city, then run the local
 * JSON-LD validator so the operator sees schema health (errors + warnings +
 * which @types are emitted) before publishing across cities.
 */
async function validateSchema(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data: campaign, error } = await supabase
        .from('koto_topic_campaigns').select('*').eq('id', campaignId).eq('agency_id', agencyId).single()
    if (error || !campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    const location: LocationContext = (body.location?.city && body.location?.state)
        ? body.location
        : { city: 'Austin', state: 'Texas', stateAbbr: 'TX' }
    const eeat = await buildEeatContext(supabase, campaign, { withReviews: true })
    const ctx: ResolveContext = {
        location,
        phone: campaign.phone || undefined,
        companyName: campaign.company_name || undefined,
        pageUrl: `https://example.com/sample/`,
        ...(eeat ? { eeat } : {}),
    }
    const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx, campaign.custom_html_wrapper || undefined)
    const report = validateJsonLd(resolved.jsonLd)
    return NextResponse.json({ ok: true, report, sample_location: `${location.city}, ${location.stateAbbr || location.state}` })
}

/**
 * check_citations — for the campaign's deployed cities, query "{topic} in
 * {city}" and report whether the site is cited in Google AI Overviews +
 * ranking in organic. Saves the latest report on the campaign (best-effort).
 */
async function checkCitationsAction(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data: campaign } = await supabase
        .from('koto_topic_campaigns').select('id, topic').eq('id', campaignId).eq('agency_id', agencyId).single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    const { data: deploys } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('city, state, state_abbr, wp_post_url')
        .eq('campaign_id', campaignId)
    const rows = (deploys || []).filter((d: any) => d.wp_post_url && d.city)
    if (!rows.length) {
        return NextResponse.json({ error: 'No deployed pages yet — deploy the campaign first, then check citations.' }, { status: 400 })
    }

    let domain = ''
    try { domain = new URL(rows[0].wp_post_url).hostname } catch {}
    if (!domain) return NextResponse.json({ error: 'could not determine site domain from deploy URLs' }, { status: 400 })

    // Dedupe cities (one query per city).
    const seen = new Set<string>()
    const locations: { city: string; state?: string }[] = []
    for (const d of rows) {
        const key = String(d.city).toLowerCase().trim()
        if (seen.has(key)) continue
        seen.add(key)
        locations.push({ city: d.city, state: d.state || d.state_abbr || undefined })
    }

    const report = await checkCitations({
        topic: campaign.topic,
        domain,
        locations,
        sampleSize: Number(body.sample_size) > 0 ? Number(body.sample_size) : 8,
    })

    try {
        await supabase.from('koto_topic_campaigns')
            .update({ citation_report: report, citation_checked_at: report.checkedAt })
            .eq('id', campaignId)
    } catch {}

    return NextResponse.json({ ok: true, report })
}

async function generateMaster(supabase: any, agencyId: string, body: any) {
    const topic = String(body.topic || '').trim()
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

    // Optional competitor-aware generation: if operator supplied one or more
    // sample cities (comma-separated), sample each city's top-3 SERP, aggregate
    // the on-page signal, and feed Claude as context so the master takes
    // deliberately differentiated angles against the entrenched regional
    // players. Skipped silently on failure — generation still proceeds.
    const { competitorContext, competitorMeta } = await resolveCompetitorIntel(topic, body)

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const { master, inputTokens, outputTokens, model } = await generateTopicCampaignMaster(ai, {
        topic,
        companyName: body.company_name || undefined,
        phone: body.phone || undefined,
        htmlWrapperHint: body.custom_html_wrapper || undefined,
        notes: body.notes || undefined,
        competitorContext,
        topicalCluster: Array.isArray(body.topical_cluster) ? body.topical_cluster : undefined,
        variantsPerSection: body.variants_per_section || undefined,
        faqCount: body.faq_count || undefined,
        agencyId,
    })

    const totalTokens = inputTokens + outputTokens
    const insert: any = {
        agency_id: agencyId,
        client_id: body.client_id || null,
        site_id: body.site_id || null,
        topic,
        phone: body.phone || null,
        company_name: body.company_name || null,
        notes: body.notes || null,
        post_type: body.post_type === 'post' ? 'post' : 'page',
        custom_html_wrapper: body.custom_html_wrapper || null,
        focus_keyword_template: body.focus_keyword_template || null,
        master,
        status: 'draft',
        tokens_used: totalTokens,
        model_used: model,
        competitor_meta: competitorMeta,
    }
    let { data, error } = await supabase.from('koto_topic_campaigns').insert(insert).select().single()
    // competitor_meta may not exist as a column on older schemas — retry
    // without it rather than failing master generation. Same defensive
    // schema-drift handling used elsewhere in this module.
    if (isMissingColumnError(error)) {
        delete insert.competitor_meta
        ;({ data, error } = await supabase.from('koto_topic_campaigns').insert(insert).select().single())
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data, tokens_used: totalTokens, competitor_meta: competitorMeta })
}

/**
 * regenerate_master action — re-runs Claude master generation for an
 * EXISTING campaign, optionally with fresh competitor intel for a new
 * sample city. Lets the operator change the topic / sample location and
 * rebuild the master without creating a new campaign (keeps the same
 * campaign_id, deploy history, site link).
 *
 * Destructive to the master content — replaces it. Deploy history +
 * custom_html_wrapper are preserved.
 */
async function regenerateMaster(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data: campaign } = await supabase
        .from('koto_topic_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    // Topic can be overridden in the same call (operator edited it).
    const topic = String(body.topic || campaign.topic || '').trim()
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

    // Competitor intel — optional sample city/state (comma-separated cities
    // sampled + aggregated, same as generate).
    const { competitorContext, competitorMeta } = await resolveCompetitorIntel(topic, body)

    // Optional improvement loop inputs: topical cluster (sibling subtopics to
    // weave in) + E-E-A-T audit gaps to close on this revision pass.
    const topicalCluster = Array.isArray(body.topical_cluster) ? body.topical_cluster : undefined
    const improvementDirectives = Array.isArray(body.eeat_gaps)
        ? body.eeat_gaps
            .map((g: any) => (typeof g === 'string' ? g : [g?.dimension, g?.issue, g?.fix].filter(Boolean).join(' — ')))
            .filter(Boolean)
        : undefined

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const { master, inputTokens, outputTokens, model } = await generateTopicCampaignMaster(ai, {
        topic,
        companyName: campaign.company_name || undefined,
        phone: campaign.phone || undefined,
        htmlWrapperHint: campaign.custom_html_wrapper || undefined,
        notes: campaign.notes || undefined,
        competitorContext,
        topicalCluster,
        improvementDirectives,
        agencyId,
    })

    const patch: any = {
        topic,
        master,
        tokens_used: (campaign.tokens_used || 0) + inputTokens + outputTokens,
        model_used: model,
        competitor_meta: competitorMeta,
        updated_at: new Date().toISOString(),
    }
    let { data, error } = await supabase.from('koto_topic_campaigns').update(patch).eq('id', campaignId).select().single()
    if (isMissingColumnError(error)) {
        delete patch.competitor_meta
        ;({ data, error } = await supabase.from('koto_topic_campaigns').update(patch).eq('id', campaignId).select().single())
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data, competitor_meta: competitorMeta })
}

async function updateMaster(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const patch: any = {}
    if (body.master) patch.master = body.master
    if (body.topic) patch.topic = body.topic
    if (body.phone !== undefined) patch.phone = body.phone || null
    if (body.company_name !== undefined) patch.company_name = body.company_name || null
    if (body.notes !== undefined) patch.notes = body.notes || null
    if (body.post_type) patch.post_type = body.post_type === 'post' ? 'post' : 'page'
    if (body.custom_html_wrapper !== undefined) patch.custom_html_wrapper = body.custom_html_wrapper || null
    if (body.hero_image_url !== undefined) patch.hero_image_url = body.hero_image_url || null
    if (body.hero_video_url !== undefined) patch.hero_video_url = body.hero_video_url || null
    if (body.hero_image_alt !== undefined) patch.hero_image_alt = body.hero_image_alt || null
    if (body.focus_keyword_template !== undefined) patch.focus_keyword_template = body.focus_keyword_template || null
    if (body.status) patch.status = body.status
    patch.updated_at = new Date().toISOString()

    const { data, error } = await supabase
        .from('koto_topic_campaigns')
        .update(patch)
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data })
}

async function previewResolved(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const location = body.location as LocationContext | undefined
    if (!location?.city || !location?.state) {
        return NextResponse.json({ error: 'location.city and location.state required' }, { status: 400 })
    }

    const { data: campaign, error } = await supabase
        .from('koto_topic_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Preview shows operator-provided E-E-A-T blocks (byline/results/citations/
    // sameAs). Live Google reviews are skipped here to avoid a Places call on
    // every preview keystroke — they populate at deploy time.
    const eeat = await buildEeatContext(supabase, campaign, { withReviews: false })
    const topicEntity = await resolveWikidataEntity(campaign.topic).catch(() => null)
    const ctx: ResolveContext = {
        location,
        phone: campaign.phone || undefined,
        companyName: campaign.company_name || undefined,
        ...(eeat ? { eeat } : {}),
        ...(topicEntity ? { entities: { topic: topicEntity } } : {}),
        ...(campaign.eeat_inputs?.address ? { businessAddress: campaign.eeat_inputs.address } : {}),
    }
    const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx, campaign.custom_html_wrapper || undefined)
    return NextResponse.json({ ok: true, resolved })
}

/**
 * integration_status action — given a site_id, return a snapshot of every
 * data integration the AI Pages panel depends on:
 *   - GSC + GA4: per-client OAuth (read from seo_connections)
 *   - CrUX, Census, DataForSEO, Anthropic: env-keyed (sitewide)
 *   - Shim plugin: per-site (read shim_version + plugin_version)
 *
 * Lets the panel render a one-line status bar so the operator knows
 * immediately what's connected before generating campaigns.
 */
async function integrationStatusForSite(supabase: any, agencyId: string, body: any) {
    const siteId = String(body.site_id || '')
    if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
    const { data: site } = await supabase
        .from('koto_wp_sites')
        .select('id, site_url, client_id, shim_version, plugin_version')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .single()
    if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 })

    let gsc = false, ga4 = false
    if (site.client_id) {
        try {
            const { data: conns } = await supabase
                .from('seo_connections')
                .select('provider, connected')
                .eq('client_id', site.client_id)
            for (const c of (conns || [])) {
                if (!c.connected) continue
                if (c.provider === 'google_search_console') gsc = true
                if (c.provider === 'google_analytics' || c.provider === 'ga4') ga4 = true
            }
        } catch {}
    }

    return NextResponse.json({
        ok: true,
        site: {
            site_url: site.site_url,
            shim_version: site.shim_version || null,
            plugin_version: site.plugin_version || null,
            has_client_id: !!site.client_id,
        },
        integrations: {
            // Per-client OAuth
            gsc: { connected: gsc, scope: 'per-client', requires: site.client_id ? 'OAuth in client → Connections' : 'No client_id set on site' },
            ga4: { connected: ga4, scope: 'per-client', requires: site.client_id ? 'OAuth in client → Connections' : 'No client_id set on site' },
            // Env-keyed sitewide
            crux:       { connected: !!(process.env.GOOGLE_CRUX_API_KEY || process.env.CRUX_API_KEY), scope: 'sitewide', requires: 'GOOGLE_CRUX_API_KEY env' },
            census:     { connected: !!process.env.CENSUS_API_KEY, scope: 'sitewide', requires: 'CENSUS_API_KEY env' },
            dataforseo: { connected: !!process.env.DATAFORSEO_AUTH, scope: 'sitewide', requires: 'DATAFORSEO_AUTH env' },
            anthropic:  { connected: !!process.env.ANTHROPIC_API_KEY, scope: 'sitewide', requires: 'ANTHROPIC_API_KEY env' },
            shim:       { connected: site.shim_version === 'v4', scope: 'per-site', requires: 'v4 pairing handshake', version: site.plugin_version || null },
        },
    })
}

/**
 * eeat_score action — scores a campaign's master against E-E-A-T signals
 * (Experience, Expertise, Authoritativeness, Trustworthiness). Returns
 * 0-100 overall score + per-dimension scores + a punchlist of specific
 * gaps for the operator to fix.
 *
 * Lightweight: one Claude call, no external API hits. Reads the campaign
 * row, asks Claude to evaluate, returns JSON. Caller stores the result
 * on the campaign if desired.
 */
async function eeatScoreMaster(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data: campaign } = await supabase
        .from('koto_topic_campaigns')
        .select('id, topic, master, company_name, phone')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const systemPrompt = `You are a Google Search Quality Rater grading a landing page master document on E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).

Return ONLY valid JSON matching this shape:
{
  "overall_score": <0-100>,
  "experience": <0-25>,
  "expertise": <0-25>,
  "authoritativeness": <0-25>,
  "trustworthiness": <0-25>,
  "strengths": [<3-5 concrete things the master does well>],
  "gaps": [
    { "dimension": "experience|expertise|authoritativeness|trustworthiness", "issue": "<one-line problem>", "fix": "<one-line concrete improvement>" }
  ]
}

Score generously where the format limits the signal (it's a city-rotatable template) but flag any genuinely missing E-E-A-T anchors: author byline, citations, dates, testimonials/social proof, real specifics (numbers, deliverables, named clients), credentials, contact verification, business address, certifications.`

    const userPrompt = `Evaluate this topic-campaign master:\n\nTOPIC: ${campaign.topic}\nCOMPANY: ${campaign.company_name || '(unknown)'}\n\nMASTER:\n${JSON.stringify(campaign.master, null, 2)}\n\nReturn ONLY the JSON.`

    let parsed: any = null
    try {
        const msg = await ai.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })
        const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        parsed = JSON.parse(stripped)
        void logTokenUsage({
            feature: 'kotoiq_topic_campaign_eeat',
            model: 'claude-sonnet-4-6',
            inputTokens: msg.usage?.input_tokens || 0,
            outputTokens: msg.usage?.output_tokens || 0,
            agencyId,
        })
    } catch (e: any) {
        return NextResponse.json({ error: `eeat scoring failed: ${String(e?.message || e)}` }, { status: 500 })
    }

    // Best-effort store on campaign — schema-drift tolerant.
    try {
        await supabase.from('koto_topic_campaigns')
            .update({ eeat_score: parsed.overall_score, eeat_audit: parsed })
            .eq('id', campaignId)
    } catch {}
    return NextResponse.json({ ok: true, audit: parsed })
}

/**
 * topical_expand action — given a campaign's topic, asks Claude for 8-12
 * related sub-topics + 5-8 supporting "supporting" sub-topics, forming
 * a topical authority cluster. Operator clicks any to generate a new
 * campaign for it.
 *
 * Cheap. One Claude call, no external API hits.
 */
async function topicalExpand(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data: campaign } = await supabase
        .from('koto_topic_campaigns')
        .select('id, topic, company_name')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const systemPrompt = `You are a topical-authority SEO strategist. Given a primary service topic, return 8-12 SIBLING topics (services/products customers buying the primary topic also need) and 5-8 SUPPORTING topics (educational / informational queries that funnel into the primary topic).

Return ONLY valid JSON matching this shape:
{
  "primary": "<echo back the topic>",
  "siblings": [
    { "topic": "<short topic name>", "rationale": "<one-line why>", "intent": "commercial|local-commercial" }
  ],
  "supporting": [
    { "topic": "<short topic name>", "rationale": "<one-line why>", "intent": "informational|navigational" }
  ]
}

Siblings should be deployable as their own city-rotatable topic-campaigns. Supporting topics should be blog/glossary type content that builds authority around the primary cluster.`

    const userPrompt = `PRIMARY TOPIC: ${campaign.topic}\nCOMPANY CONTEXT: ${campaign.company_name || '(generic service business)'}\n\nReturn ONLY the JSON.`

    let parsed: any = null
    try {
        const msg = await ai.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 3000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })
        const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        parsed = JSON.parse(stripped)
        void logTokenUsage({
            feature: 'kotoiq_topic_campaign_topical_expand',
            model: 'claude-sonnet-4-6',
            inputTokens: msg.usage?.input_tokens || 0,
            outputTokens: msg.usage?.output_tokens || 0,
            agencyId,
        })
    } catch (e: any) {
        return NextResponse.json({ error: `topical expand failed: ${String(e?.message || e)}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true, expansion: parsed })
}

/**
 * Condense a (potentially huge) page's HTML down to the parts that carry its
 * design language, so wrapper_assist stays fast on big uploads. Keeps ALL
 * <style> blocks (design tokens + CSS vars live here) plus the top of the
 * document (head + hero + first sections). Trailing body content is dropped —
 * it doesn't inform color/type/spacing extraction. Total capped at ~120k chars
 * (~30k tokens), which is plenty for design extraction.
 */
function condenseHtmlForWrapper(html: string): string {
    const MAX = 120_000
    if (html.length <= MAX) return html
    const styles = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n')
    const styleBudget = styles.slice(0, 40_000)
    const topBudget = MAX - styleBudget.length - 200
    const top = html.slice(0, Math.max(0, topBudget))
    return `${top}\n\n<!-- [document truncated — additional <style> blocks below] -->\n${styleBudget}\n<!-- [end design-language sample] -->`
}

/**
 * wrapper_assist action — operator pastes raw page HTML (copied from their
 * styled WP page source), Claude reads the structure and inserts our token
 * placeholders ({{HERO_HEADLINE}}, {{SECTIONS}}, etc.) at the right spots.
 * Returns the modified HTML for the operator to drop into the Custom HTML
 * wrapper field.
 *
 * Cheap Sonnet call. Logged to koto_token_usage as kotoiq_wrapper_assist.
 */
async function wrapperAssist(body: any, agencyId: string) {
    const rawHtml = String(body.html || '').trim()
    if (!rawHtml) return NextResponse.json({ error: 'html required' }, { status: 400 })
    if (rawHtml.length > 1_000_000) return NextResponse.json({ error: 'html too large (max 1MB)' }, { status: 400 })

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

    const systemPrompt = `You build a KotoIQ topic-campaign wrapper INSPIRED BY the operator's pasted source. You are NOT copying the source verbatim — you are extracting its design language (colors, type scale, spacing, layout patterns, button styles) and applying it to a clean, semantic layout with our placeholder tokens.

OUTPUT SHAPE:
- A single self-contained HTML fragment (NOT a full page)
- Starts with one <style> block defining the visual language extracted from the source
- Then clean semantic divs / sections with our placeholders inside
- No <!doctype>, no <html>, no <head>, no <body>, no <nav>, no site header/footer
- No external <link rel="stylesheet">, no analytics scripts

DESIGN EXTRACTION — read the source carefully and pull out:
- Color palette (primary, accent, surface, text, muted, borders)
- Typography (font families if specified, headline/body weight + size scale)
- Spacing rhythm (section padding, gap, border-radius)
- Button + link styling (primary CTA, secondary, hover)
- Card / section treatments (background, border, shadow)
- If the source has CSS variables / design tokens / a color palette comment block, use those values directly

WRAPPER SHAPE — build something like:
<style>
  .koto-wrap { /* design tokens */ }
  .koto-wrap .hero { ...extracted hero styling... }
  .koto-wrap .section { ...extracted section styling... }
  .koto-wrap .cta { ...extracted CTA styling... }
  /* etc */
</style>
<div class="koto-wrap">
  {{DIRECT_ANSWER}}
  <header class="hero">
    {{HERO_MEDIA}}
    <h1>{{HERO_HEADLINE}}</h1>
    <div class="hero-sub">{{HERO_SUB}}</div>
  </header>
  <main>{{SECTIONS}}</main>
  {{HOWTO}}
  {{COMPARISON}}
  {{FAQS}}
  {{LOCAL_DATA}}
  <section class="cta">{{CTA}}</section>
  {{RELATED_SERVICES}}
  {{SERVICE_AREAS}}
</div>

Available placeholders — insert each one at most once at the natural spot:
{{HERO_HEADLINE}} {{HERO_SUB}} {{HERO_MEDIA}} {{SECTIONS}} {{HOWTO}} {{COMPARISON}} {{FAQS}} {{LOCAL_DATA}} {{CTA}} {{SERVICE_AREAS}} {{RELATED_SERVICES}} {{DIRECT_ANSWER}} {{AUTHOR_BYLINE}} {{TESTIMONIALS}} {{RESULTS}} {{CITATIONS}}

CRITICAL RULES:
- DO NOT paste the source's HTML structure into the output. Build fresh, clean markup INSPIRED BY it.
- DO NOT copy literal text content from the source (company names, phone numbers, city names, business copy) — every text slot must be a placeholder or a generic content tag.
- DO NOT include any third-party scripts, analytics, social-share widgets.
- DO write a self-contained <style> block. Keep selectors scoped under a wrapper class (.koto-wrap) so we don't leak rules into other parts of the page.
- DO use the source's colors / fonts / sizes / spacing values verbatim where extractable.
- IF the source is a design system reference (CSS variables, tokens, no real page) — read the tokens and build a fresh wrapper that uses those token values.
- Output ONLY the wrapper HTML+CSS. No commentary, no markdown fences, no explanation.`

    // We only need the page's DESIGN LANGUAGE (colors, fonts, spacing, button
    // styles) — which lives in <style>/<head> and the top of the page — not the
    // whole 1MB body. Sending the entire file made big uploads slow enough to
    // blow past maxDuration=300. Condense to a design-bearing sample so the call
    // stays fast and reliable.
    const condensed = condenseHtmlForWrapper(rawHtml)
    const userPrompt = `Insert KotoIQ placeholders into this WP page HTML (sampled for design language):\n\n${condensed}`

    // Streaming so the SDK doesn't impose the non-streaming soft cap. We don't
    // need chunks; finalMessage() awaits the full response. max_tokens is sized
    // for a wrapper FRAGMENT (a few k tokens) — 12k is generous headroom and
    // keeps worst-case generation comfortably under the 300s function limit.
    let msg
    try {
        const stream = ai.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 12000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })
        msg = await stream.finalMessage()
    } catch (e: any) {
        return NextResponse.json({ error: `claude error: ${String(e?.message || e)}` }, { status: 500 })
    }

    const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''
    if (!text) return NextResponse.json({ error: 'empty claude response' }, { status: 500 })

    // Strip any accidental markdown fences if Claude wrapped the output
    const cleaned = text.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim()

    void logTokenUsage({
        feature: 'kotoiq_wrapper_assist',
        model: 'claude-sonnet-4-6',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId,
    })

    return NextResponse.json({
        ok: true,
        wrapper: cleaned,
        placeholders_used: [
            '{{HERO_HEADLINE}}','{{HERO_SUB}}','{{HERO_MEDIA}}','{{SECTIONS}}',
            '{{HOWTO}}','{{COMPARISON}}','{{FAQS}}','{{LOCAL_DATA}}',
            '{{CTA}}','{{SERVICE_AREAS}}','{{RELATED_SERVICES}}','{{DIRECT_ANSWER}}',
        ].filter(p => cleaned.includes(p)),
    })
}

/**
 * shim_update action — pulls the latest shim version from the manifest
 * endpoint, signs a self-update envelope, sends it to the site, and
 * re-reads the plugin version from health.diagnostics to confirm. Lets
 * the operator update a paired site's shim plugin from the dashboard
 * without leaving the AI Pages panel.
 */
async function shimUpdateForSite(supabase: any, agencyId: string, body: any) {
    const siteId = String(body.site_id || '')
    if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
    const { data: site } = await supabase
        .from('koto_wp_sites')
        .select('id, site_url, shim_version, plugin_version')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .single()
    if (!site?.site_url) return NextResponse.json({ error: 'site not found or missing site_url' }, { status: 404 })
    if (site.shim_version !== 'v4') return NextResponse.json({ error: 'site is not on the v4 channel (paired via thin shim)' }, { status: 400 })

    // Pull the latest version + sha256 from our own manifest endpoint.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
    let manifest: any = null
    try {
        const r = await fetch(`${appUrl}/api/kotoiq-shim-manifest`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
        if (!r.ok) return NextResponse.json({ ok: false, error: `manifest HTTP ${r.status}` }, { status: 500 })
        manifest = await r.json()
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: `manifest fetch failed: ${String(e?.message || e)}` }, { status: 500 })
    }
    if (!manifest?.sha256 || !manifest?.download_url || !manifest?.version) {
        return NextResponse.json({ ok: false, error: 'manifest incomplete', manifest }, { status: 500 })
    }
    const currentVersion = String(site.plugin_version || 'unknown')
    if (currentVersion === manifest.version) {
        return NextResponse.json({
            ok: true, alreadyUpToDate: true,
            from_version: currentVersion, to_version: manifest.version,
        })
    }

    const result = await shimSelfUpdate(site.site_url, {
        download_url: manifest.download_url,
        sha256: manifest.sha256,
        version: manifest.version,
    })
    if (!result.ok) {
        return NextResponse.json({
            ok: false,
            error: result.error?.message || `HTTP ${result.httpStatus}`,
            code: result.error?.code,
        })
    }

    // Re-read the installed version via health.diagnostics (auth-gated, so
    // it actually reflects what's running) after WP_Upgrader settles. The
    // plugin reports its version in the shim_version field of the diag.
    await new Promise(r => setTimeout(r, 1500))
    let newVersion: string | null = null
    try {
        const diag = await healthDiagnostics(site.site_url)
        if (diag.ok && (diag.data as any)?.shim_version) {
            newVersion = String((diag.data as any).shim_version)
        }
    } catch {}

    // Trust the manifest version as the fallback — the shim verified sha256
    // before invoking Plugin_Upgrader, so what's installed matches.
    const finalVersion = newVersion || manifest.version
    await supabase.from('koto_wp_sites').update({ plugin_version: finalVersion }).eq('id', siteId)

    return NextResponse.json({
        ok: true,
        from_version: currentVersion,
        to_version: newVersion,
        manifest_version: manifest.version,
        installer_payload: result.data,
    })
}

/**
 * publish_llms_txt action — manually refresh /llms.txt for a site without
 * needing a full re-deploy. Useful for first-time setup, plugin upgrades,
 * or after editing a campaign topic.
 */
async function publishLlmsTxtForSite(supabase: any, agencyId: string, body: any) {
    const siteId = String(body.site_id || '')
    if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
    const { data: site } = await supabase
        .from('koto_wp_sites')
        .select('*')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .single()
    if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 })
    const result = await refreshLlmsTxtForSite(supabase, agencyId, siteId, site)
    return NextResponse.json({ ...result, llms_txt_url: `${String(site.site_url || '').replace(/\/$/, '')}/llms.txt` })
}

/**
 * preview_llms_txt action — render the llms.txt content WITHOUT pushing it
 * to the site. Lets the operator review before publishing.
 */
async function previewLlmsTxtForSite(supabase: any, agencyId: string, body: any) {
    const siteId = String(body.site_id || '')
    if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
    const { data: site } = await supabase
        .from('koto_wp_sites')
        .select('*')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .single()
    if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 })

    const { data: campaigns } = await supabase
        .from('koto_topic_campaigns')
        .select('id, topic, last_deploy_at')
        .eq('agency_id', agencyId)
        .eq('site_id', siteId)
        .order('last_deploy_at', { ascending: false, nullsFirst: false })
    const allCampaigns = campaigns || []

    const { data: deploys } = allCampaigns.length
        ? await supabase
            .from('koto_topic_campaign_deploys')
            .select('campaign_id, city, state_abbr, wp_post_url')
            .in('campaign_id', allCampaigns.map((c: any) => c.id))
            .eq('status', 'published')
            .not('wp_post_url', 'is', null)
        : { data: [] }

    const origin = String(site.site_url || '').replace(/\/$/, '')
    const content = buildLlmsTxt({
        siteName: site.site_name || origin.replace(/^https?:\/\//, ''),
        siteUrl: origin,
        siteDescription: site.description || undefined,
        campaigns: allCampaigns,
        deploys: deploys || [],
    })
    return NextResponse.json({ ok: true, content, byte_count: Buffer.byteLength(content, 'utf8') })
}

/**
 * Compose + push the site-wide llms.txt to a paired WP site. Enumerates
 * every published deploy across ALL campaigns on this site, groups by
 * campaign topic, renders the llmstxt.org-format markdown, and pushes via
 * the shim's file.write verb. Best-effort: returns {ok:false, error} on
 * any failure instead of throwing — callers don't fail the deploy if
 * llms.txt push errors out.
 *
 * Requires kotoiq-shim plugin v4.2.0+ to actually serve the file at
 * /llms.txt. On older plugin versions the file is still written but no
 * route serves it.
 */
async function refreshLlmsTxtForSite(
    supabase: any,
    agencyId: string,
    siteId: string,
    site: any,
): Promise<{ ok: true; bytes_written: number } | { ok: false; error: string }> {
    if (!siteId || !site?.site_url) return { ok: false, error: 'site missing' }

    const { data: campaigns } = await supabase
        .from('koto_topic_campaigns')
        .select('id, topic, last_deploy_at')
        .eq('agency_id', agencyId)
        .eq('site_id', siteId)
        .order('last_deploy_at', { ascending: false, nullsFirst: false })
    const allCampaigns = campaigns || []
    if (allCampaigns.length === 0) return { ok: false, error: 'no campaigns on site' }

    const { data: deploys } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('campaign_id, city, state_abbr, wp_post_url')
        .in('campaign_id', allCampaigns.map((c: any) => c.id))
        .eq('status', 'published')
        .not('wp_post_url', 'is', null)
    const liveDeploys = deploys || []

    const origin = String(site.site_url || '').replace(/\/$/, '')
    const hostname = origin.replace(/^https?:\/\//, '') || origin
    const content = buildLlmsTxt({
        siteName: site.site_name || hostname,
        siteUrl: origin,
        siteDescription: site.description || undefined,
        campaigns: allCampaigns,
        deploys: liveDeploys,
    })

    try {
        return await publishLlmsTxt(origin, content)
    } catch (err: any) {
        return { ok: false, error: String(err?.message || err) }
    }
}

/**
 * Build a map of (city, state_abbr) → array of cross-campaign URLs for a
 * given site. Used by both deploy and redeploy to render a "Related Services
 * in {City}" block on each page when another campaign on the same site has a
 * published page for that same city.
 *
 * Excludes the current campaign so it doesn't link to itself. Scoped by
 * site_id because cross-linking only makes sense on the same domain.
 */
async function buildCrossCampaignMap(
    supabase: any,
    siteId: string,
    excludeCampaignId: string,
): Promise<Map<string, Array<{ topic: string; city: string; state_abbr: string; url: string }>>> {
    const out = new Map<string, Array<{ topic: string; city: string; state_abbr: string; url: string }>>()
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
        // Dedupe within a city by topic — if the same topic somehow has two
        // deploys in one city (shouldn't, but guard anyway), keep the first.
        if (!bucket.some(x => x.topic === topic)) {
            bucket.push({ topic, city: d.city, state_abbr: stateAbbr, url: d.wp_post_url })
        }
        out.set(key, bucket)
    }
    return out
}

async function deployCampaign(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    const siteId = String(body.site_id || '')
    const locations = (body.locations || []) as LocationContext[]
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
    if (!Array.isArray(locations) || locations.length === 0) {
        return NextResponse.json({ error: 'locations[] required' }, { status: 400 })
    }
    if (locations.length > 100) {
        return NextResponse.json({ error: 'max 100 locations per deploy' }, { status: 400 })
    }

    const { data: campaign, error: ce } = await supabase
        .from('koto_topic_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (ce || !campaign) return NextResponse.json({ error: ce?.message || 'campaign not found' }, { status: 404 })

    const { data: site, error: se } = await supabase
        .from('koto_wp_sites')
        .select('*')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .single()
    if (se || !site) return NextResponse.json({ error: se?.message || 'site not found' }, { status: 404 })

    if (site.shim_version !== 'v4') {
        return NextResponse.json({ error: 'deploy requires a v4-paired site' }, { status: 400 })
    }

    const creds = await loadSiteCredentials(supabase, agencyId, siteId).catch(() => null)
    if (!creds) return NextResponse.json({ error: 'site has no paired credentials' }, { status: 401 })

    const restBase = campaign.post_type === 'post' ? 'posts' : 'pages'
    const results: any[] = []

    await supabase
        .from('koto_topic_campaigns')
        .update({ status: 'deploying' })
        .eq('id', campaignId)

    // Upload hero image to WP media library once for the batch
    const featuredMediaId = await ensureFeaturedMedia(supabase, campaign, site, creds)

    // Pre-compute sibling URLs for internal linking. Includes BOTH the new
    // cities in this batch AND any previously-published cities for this
    // campaign — so an incremental deploy weaves the new pages into the
    // existing cluster instead of creating an island.
    const siteOrigin = String(site.site_url || '').replace(/\/$/, '')
    const { data: priorDeploys } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('city, state_abbr, wp_post_url')
        .eq('campaign_id', campaignId)
        .eq('status', 'published')
        .not('wp_post_url', 'is', null)
    const newSiblings = locations.map(loc => {
        const ctx: ResolveContext = {
            location: loc,
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
        }
        const r = resolveMaster(campaign.master as TopicCampaignMaster, ctx)
        return { city: loc.city, state_abbr: loc.stateAbbr, url: `${siteOrigin}/${r.slug}/` }
    })
    const priorSiblings = (priorDeploys || []).map((x: any) => ({ city: x.city, state_abbr: x.state_abbr, url: x.wp_post_url }))
    // Dedupe by city — newSiblings win if a city appears in both (rare).
    const siblingsByCity = new Map<string, { city: string; state_abbr?: string; url: string }>()
    for (const s of priorSiblings) siblingsByCity.set(s.city, s)
    for (const s of newSiblings) siblingsByCity.set(s.city, s)
    const siblingLinks = Array.from(siblingsByCity.values())

    // Cross-campaign clustering — find OTHER campaigns deployed to this same
    // WP site that have published pages in the SAME cities as the current
    // batch. On the resulting per-city page, render a "Related Services in
    // {City}" block linking to those other campaigns' pages.
    //
    // Scoped by site_id (not client_id) because cross-linking must stay on
    // the same domain — that's where the SEO + UX benefit lives.
    const crossByCity = await buildCrossCampaignMap(supabase, siteId, campaignId)

    // E-E-A-T signals are client-level (constant across cities) — build once,
    // with live Google reviews, then reuse for every city's ctx.
    const eeat = await buildEeatContext(supabase, campaign, { withReviews: true })
    // Topic→Wikidata entity is constant per campaign — resolve once.
    const topicEntity = await resolveWikidataEntity(campaign.topic).catch(() => null)

    for (const loc of locations) {
        const cityKey = `${loc.city.toLowerCase().trim()}|${(loc.stateAbbr || '').toUpperCase()}`
        // Pre-compute the canonical URL so the schema graph can use it as the
        // base for @id values. Slug is derived deterministically from the
        // resolved hero headline; matches the URL WP will assign.
        const probeCtx: ResolveContext = { location: loc, phone: campaign.phone || undefined, companyName: campaign.company_name || undefined }
        const probeResolved = resolveMaster(campaign.master as TopicCampaignMaster, probeCtx)
        const pageUrl = `${siteOrigin}/${probeResolved.slug}/`
        const localData = await fetchLocalDataForCity(loc).catch(() => null)
        const ctx: ResolveContext = {
            location: loc,
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
            heroImageUrl: campaign.hero_image_url || undefined,
            heroVideoUrl: campaign.hero_video_url || undefined,
            heroImageAlt: campaign.hero_image_alt || undefined,
            siblingLinks,
            relatedServices: (crossByCity.get(cityKey) || []).map(r => ({
                topic: r.topic,
                city: loc.city,
                state_abbr: loc.stateAbbr,
                url: r.url,
            })),
            pageUrl,
            ...(localData ? { localData } : {}),
            ...(eeat ? { eeat } : {}),
            ...(topicEntity ? { entities: { topic: topicEntity } } : {}),
            ...(campaign.eeat_inputs?.address ? { businessAddress: campaign.eeat_inputs.address } : {}),
        }
        const resolved = resolveMaster(
            campaign.master as TopicCampaignMaster,
            ctx,
            campaign.custom_html_wrapper || undefined,
        )

        // Body is content only — JSON-LD goes to post meta because KSES
        // strips <script> tags from content for users without
        // unfiltered_html (kotoiq_service intentionally lacks it).
        const wpBody: Record<string, unknown> = {
            title: resolved.title,
            slug: resolved.slug,
            content: resolved.bodyHtml,
            excerpt: resolved.metaDescription,
            status: 'publish',
        }
        if (featuredMediaId) wpBody.featured_media = featuredMediaId
        // Meta writes — schema (v4.1.0+) and base CSS (v4.2.1+) both ride
        // through post meta because WP KSES strips <script> and <style>
        // from post_content for users without unfiltered_html (the
        // kotoiq_service role lacks it). The plugin echoes both in wp_head.
        // Older plugins ignore unknown meta keys.
        const metaForWp: Record<string, string> = {}
        if (resolved.jsonLd) metaForWp._kotoiq_schema_jsonld = resolved.jsonLd
        if (resolved.baseCss) metaForWp._kotoiq_base_css = resolved.baseCss
        if (Object.keys(metaForWp).length > 0) wpBody.meta = metaForWp

        const wpResp = await wpFetchJson<{ id?: number; link?: string; slug?: string; error?: string }>(
            site.site_url,
            `/wp/v2/${restBase}`,
            creds,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wpBody),
            },
        )

        // After WP returns the new post ID, write SEO meta (title, description,
        // focus keyword) to Yoast + RankMath + KotoIQ-native keys so whichever
        // SEO engine is active picks them up. Skipped on failure.
        // Focus keyword = "<topic> <city>" — the exact query operators try to
        // rank these pages on. RankMath uses it for the on-page audit score.
        let rankMathScore: number | null = null
        let seoMetaError: string | null = null
        if (wpResp.ok && wpResp.data?.id) {
            const seoRes = await writeSeoMeta(site.site_url, wpResp.data.id, {
                seo_title: resolved.metaTitle,
                meta_description: resolved.metaDescription,
                focus_keyword: resolveFocusKeyword(campaign, loc),
            }).catch((e: any) => ({ ok: false, error: { code: 'throw', message: e?.message || 'unknown' }, status: 0 } as const))
            if (!seoRes.ok) {
                seoMetaError = `${seoRes.error.code}: ${seoRes.error.message}`
            }
            // Read back RankMath's on-page score (if RankMath is active) for
            // dashboard visibility. Score is in the `rank_math_seo_score`
            // post meta after the SEO meta writes settle.
            rankMathScore = await readRankMathScore(site.site_url, wpResp.data.id, creds).catch(() => null)
        }

        const deployRow: any = {
            campaign_id: campaignId,
            agency_id: agencyId,
            site_id: siteId,
            city: loc.city,
            state: loc.state,
            state_abbr: loc.stateAbbr,
            zip: loc.zip || null,
            county: loc.county || null,
            wp_post_type: restBase === 'posts' ? 'post' : 'page',
            resolved_title: resolved.title,
            resolved_slug: wpResp.data?.slug || resolved.slug, // store WP's actual slug (handles collisions)
            resolved_meta_title: resolved.metaTitle,
            resolved_meta_description: resolved.metaDescription,
            resolved_jsonld: resolved.jsonLd || null,
            rendered_html_bytes: resolved.bodyHtml.length,
            rank_math_score: rankMathScore,
        }
        if (wpResp.ok) {
            deployRow.wp_post_id = wpResp.data?.id || null
            deployRow.wp_post_url = wpResp.data?.link || null
            deployRow.status = 'published'
            // If SEO meta write failed but the post itself published, surface
            // the error so the operator can re-sync via the new action below.
            if (seoMetaError) deployRow.error = `SEO meta partial: ${seoMetaError}`
        } else {
            deployRow.status = 'failed'
            deployRow.error = wpResp.error || `HTTP ${wpResp.status}`
        }
        const { data: deployData } = await supabase
            .from('koto_topic_campaign_deploys')
            .insert(deployRow)
            .select()
            .single()
        results.push(deployData)
    }

    const successCount = results.filter(r => r?.status === 'published').length
    await supabase
        .from('koto_topic_campaigns')
        .update({
            status: 'deployed',
            last_deploy_at: new Date().toISOString(),
            last_deploy_count: successCount,
        })
        .eq('id', campaignId)

    // Refresh llms.txt at site root with the updated campaign map.
    // Best-effort: a failure here doesn't fail the deploy — site visitors
    // get their pages, just no llms.txt update this round. Requires the
    // shim plugin to be v4.2.0+ to serve the file.
    const llmsResult = await refreshLlmsTxtForSite(supabase, agencyId, siteId, site).catch((err: any) => {
        return { ok: false as const, error: String(err?.message || err) }
    })

    return NextResponse.json({
        ok: true,
        deployed: successCount,
        failed: results.length - successCount,
        results,
        llms_txt: llmsResult,
    })
}

async function listCampaigns(supabase: any, agencyId: string, body: any) {
    let q = supabase
        .from('koto_topic_campaigns')
        .select('id, topic, status, post_type, last_deploy_at, last_deploy_count, created_at, site_id, client_id')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(50)
    if (body.site_id) q = q.eq('site_id', body.site_id)
    if (body.client_id) q = q.eq('client_id', body.client_id)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaigns: data || [] })
}

async function getCampaign(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data, error } = await supabase
        .from('koto_topic_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data })
}

async function redeployCampaign(supabase: any, agencyId: string, body: any) {
    // Re-resolve the master and PATCH each existing post by its stored
    // wp_post_id. Updates content + meta + schema in place. Operator usually
    // calls this after editing the master and wanting the change to flow
    // to all previously-deployed cities without creating duplicate URLs.
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const { data: campaign, error: ce } = await supabase
        .from('koto_topic_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (ce || !campaign) return NextResponse.json({ error: ce?.message || 'campaign not found' }, { status: 404 })

    const { data: existingDeploys } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'published')
        .not('wp_post_id', 'is', null)
    if (!existingDeploys || existingDeploys.length === 0) {
        return NextResponse.json({ error: 'no previously-published deploys to update' }, { status: 400 })
    }

    const { data: site } = await supabase
        .from('koto_wp_sites')
        .select('*')
        .eq('id', existingDeploys[0].site_id)
        .single()
    if (!site || site.shim_version !== 'v4') {
        return NextResponse.json({ error: 'redeploy requires the original v4-paired site' }, { status: 400 })
    }
    const creds = await loadSiteCredentials(supabase, agencyId, site.id).catch(() => null)
    if (!creds) return NextResponse.json({ error: 'site has no paired credentials' }, { status: 401 })

    const restBase = campaign.post_type === 'post' ? 'posts' : 'pages'
    let updated = 0
    let failed = 0

    // Upload hero image once for re-deploys too (caches if unchanged)
    const featuredMediaId = await ensureFeaturedMedia(supabase, campaign, site, creds)

    // Sibling links for internal linking — use stored URLs from prior deploys.
    const siblingLinks = existingDeploys
        .filter((x: any) => x.wp_post_url)
        .map((x: any) => ({ city: x.city, state_abbr: x.state_abbr, url: x.wp_post_url }))

    // Cross-campaign clustering — same as deploy, scoped to this site.
    // Re-deploys refresh the cluster so newly-added campaigns appear as
    // "Related Services in {City}" links on previously-deployed pages.
    const crossByCity = await buildCrossCampaignMap(supabase, site.id, campaignId)

    // E-E-A-T signals — client-level, built once with live Google reviews.
    const eeat = await buildEeatContext(supabase, campaign, { withReviews: true })
    const topicEntity = await resolveWikidataEntity(campaign.topic).catch(() => null)

    for (const d of existingDeploys) {
        const cityKey = `${String(d.city || '').toLowerCase().trim()}|${String(d.state_abbr || '').toUpperCase()}`
        const locForFetch = { city: d.city, state: d.state, stateAbbr: d.state_abbr } as LocationContext
        const localData = await fetchLocalDataForCity(locForFetch).catch(() => null)
        const ctx: ResolveContext = {
            location: { city: d.city, state: d.state, stateAbbr: d.state_abbr, zip: d.zip || undefined, county: d.county || undefined },
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
            heroImageUrl: campaign.hero_image_url || undefined,
            heroVideoUrl: campaign.hero_video_url || undefined,
            heroImageAlt: campaign.hero_image_alt || undefined,
            siblingLinks,
            relatedServices: (crossByCity.get(cityKey) || []).map(r => ({
                topic: r.topic,
                city: d.city,
                state_abbr: d.state_abbr,
                url: r.url,
            })),
            pageUrl: d.wp_post_url || undefined,
            ...(localData ? { localData } : {}),
            ...(eeat ? { eeat } : {}),
            ...(topicEntity ? { entities: { topic: topicEntity } } : {}),
            ...(campaign.eeat_inputs?.address ? { businessAddress: campaign.eeat_inputs.address } : {}),
        }
        const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx, campaign.custom_html_wrapper || undefined)

        const updBody: Record<string, unknown> = {
            title: resolved.title,
            content: resolved.bodyHtml,
            excerpt: resolved.metaDescription,
        }
        if (featuredMediaId) updBody.featured_media = featuredMediaId
        const updMeta: Record<string, string> = {}
        if (resolved.jsonLd) updMeta._kotoiq_schema_jsonld = resolved.jsonLd
        if (resolved.baseCss) updMeta._kotoiq_base_css = resolved.baseCss
        if (Object.keys(updMeta).length > 0) updBody.meta = updMeta

        const wpResp = await wpFetchJson<{ id?: number; link?: string }>(
            site.site_url,
            `/wp/v2/${restBase}/${d.wp_post_id}`,
            creds,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updBody) },
        )

        if (wpResp.ok) {
            await writeSeoMeta(site.site_url, d.wp_post_id, {
                seo_title: resolved.metaTitle,
                meta_description: resolved.metaDescription,
                focus_keyword: resolveFocusKeyword(campaign, { city: d.city, state: d.state, stateAbbr: d.state_abbr }),
            }).catch(() => null)
            await supabase.from('koto_topic_campaign_deploys').update({
                resolved_title: resolved.title,
                resolved_meta_title: resolved.metaTitle,
                resolved_meta_description: resolved.metaDescription,
                resolved_jsonld: resolved.jsonLd || null,
                rendered_html_bytes: resolved.bodyHtml.length,
            }).eq('id', d.id)
            updated++
        } else {
            failed++
        }
    }

    await supabase.from('koto_topic_campaigns').update({
        last_deploy_at: new Date().toISOString(),
        last_deploy_count: updated,
    }).eq('id', campaignId)

    // Refresh llms.txt — same best-effort pattern as deploy.
    const llmsResult = await refreshLlmsTxtForSite(supabase, agencyId, site.id, site).catch((err: any) => {
        return { ok: false as const, error: String(err?.message || err) }
    })

    return NextResponse.json({ ok: true, updated, failed, total: existingDeploys.length, llms_txt: llmsResult })
}

/**
 * Upload the campaign's hero image to the WP media library and cache the
 * returned attachment ID on the campaign row. Subsequent deploys reuse
 * the cached ID without re-uploading. Returns the attachment ID or null
 * if the image is missing/unreachable.
 *
 * Called from deploy() and redeployCampaign() before posting each page,
 * so the page can include featured_media:<id> — which Yoast and RankMath
 * read for og:image.
 */
async function ensureFeaturedMedia(
    supabase: any,
    campaign: any,
    site: { site_url: string },
    creds: { username: string; appPassword: string; fingerprint: string },
): Promise<number | null> {
    const imageUrl = campaign.hero_image_url || ''
    if (!imageUrl) return null

    // Cached and still pointing at the same source URL? Reuse.
    if (
        campaign.wp_featured_media_id &&
        campaign.wp_featured_media_source_url === imageUrl
    ) {
        return campaign.wp_featured_media_id
    }

    // Fetch the image bytes
    let bytes: ArrayBuffer
    let contentType = 'image/jpeg'
    let filename = 'koto-hero.jpg'
    try {
        const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) })
        if (!res.ok) return null
        contentType = res.headers.get('content-type') || 'image/jpeg'
        bytes = await res.arrayBuffer()
        const u = new URL(imageUrl)
        const base = u.pathname.split('/').pop() || 'koto-hero.jpg'
        filename = base.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-80) || 'koto-hero.jpg'
    } catch {
        return null
    }

    // Upload via /wp/v2/media. WP REST accepts the raw binary body with
    // Content-Disposition for the filename. App Password auth applies.
    const buf = Buffer.from(bytes)
    const url = `${site.site_url.replace(/\/$/, '')}/wp-json/wp/v2/media`
    const auth = 'Basic ' + Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64')
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: auth,
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
            body: buf,
            signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) return null
        const data = await res.json().catch(() => null) as { id?: number } | null
        if (!data?.id) return null
        // Cache the attachment ID so re-deploys skip the upload
        await supabase
            .from('koto_topic_campaigns')
            .update({
                wp_featured_media_id: data.id,
                wp_featured_media_source_url: imageUrl,
            })
            .eq('id', campaign.id)
        return data.id
    } catch {
        return null
    }
}

/**
 * Export campaign performance as CSV. Mirrors the data in the Performance
 * panel — per-city clicks, impressions, position, sessions, users,
 * conversions, RankMath score, plus the campaign topic + URL.
 */
async function exportPerformanceCsv(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    // Reuse get_performance for the heavy lifting, then format as CSV
    const perfResp = await getPerformance(supabase, agencyId, { campaign_id: campaignId, days: body.days || 28 })
    const perfData: any = await perfResp.json()
    if (!perfData.ok) return NextResponse.json({ error: perfData.error || 'performance fetch failed' }, { status: 502 })

    const { data: campaign } = await supabase
        .from('koto_topic_campaigns').select('topic').eq('id', campaignId).eq('agency_id', agencyId).single()
    const topic = campaign?.topic || 'campaign'

    // Also pull RankMath scores from deploys
    const { data: deploys } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('wp_post_url, rank_math_score, resolved_meta_title')
        .eq('campaign_id', campaignId)
        .eq('status', 'published')
    const scoreByUrl: Record<string, { score: number | null; meta_title: string }> = {}
    for (const d of (deploys || [])) {
        scoreByUrl[d.wp_post_url] = { score: d.rank_math_score, meta_title: d.resolved_meta_title || '' }
    }

    const rows: string[] = [
        ['City', 'State', 'URL', 'Meta Title', 'RankMath Score', 'Clicks', 'Impressions', 'CTR (%)', 'Position', 'Sessions', 'Users', 'Conversions'].join(','),
    ]
    for (const [url, p] of Object.entries(perfData.per_url || {}) as any) {
        const extra = scoreByUrl[url] || { score: null, meta_title: '' }
        const ctr = p.impressions > 0 ? (p.ctr * 100).toFixed(2) : '0'
        rows.push([
            csvCell(p.city),
            csvCell(p.state_abbr),
            csvCell(url),
            csvCell(extra.meta_title),
            extra.score != null ? String(extra.score) : '',
            String(p.clicks || 0),
            String(p.impressions || 0),
            ctr,
            p.position > 0 ? p.position.toFixed(2) : '',
            String(p.sessions || 0),
            String(p.users || 0),
            String(p.conversions || 0),
        ].join(','))
    }
    const csv = rows.join('\r\n')
    const filename = `${topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-performance-${perfData.window_days || 28}d.csv`

    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    })
}

function csvCell(v: any): string {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
}

/**
 * Capture styling from a URL on the client's site. Fetches the page,
 * locates the main content area, and returns a custom HTML wrapper that
 * mirrors the source page's div structure with {{TOKEN}} placeholders
 * for our content blocks.
 *
 * The deployed page inherits the source page's class chain → theme CSS
 * applies automatically. Works for Avada, Divi, Elementor, Gutenberg —
 * anything that uses a sensible content wrapper element.
 */
async function captureStyling(body: any) {
    const url = String(body.url || '').trim()
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
    let target: URL
    try { target = new URL(url) } catch { return NextResponse.json({ error: 'invalid URL' }, { status: 400 }) }
    if (!['http:', 'https:'].includes(target.protocol)) {
        return NextResponse.json({ error: 'URL must be http or https' }, { status: 400 })
    }

    let html = ''
    try {
        const res = await fetch(target.toString(), {
            signal: AbortSignal.timeout(15_000),
            headers: { 'User-Agent': 'Mozilla/5.0 (KotoIQ/4.1; +https://hellokoto.com)' },
            redirect: 'follow',
        })
        if (!res.ok) return NextResponse.json({ error: `Source page returned HTTP ${res.status}` }, { status: 502 })
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('text/html')) {
            return NextResponse.json({ error: `Expected HTML, got ${ct}` }, { status: 502 })
        }
        html = await res.text()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'fetch failed'
        return NextResponse.json({ error: `Could not fetch ${url}: ${msg}` }, { status: 502 })
    }

    // Use cheerio for robust HTML parsing
    const cheerioMod = await import('cheerio')
    const $ = cheerioMod.load(html)

    // Find the content container — try selectors in order of specificity
    const selectors = [
        'article .entry-content',          // standard WP
        '.entry-content',                  // theme-styled WP content
        'article',                         // semantic article
        'main .fusion-row',                // Avada
        'main',                            // semantic main
        '.et_pb_section',                  // Divi
        '.elementor-section',              // Elementor
        '#content',                        // common ID
        '#primary',                        // common ID
        'body > div',                      // last resort
    ]

    let $container: any = null
    let usedSelector = ''
    for (const sel of selectors) {
        const found = $(sel).first()
        if (found.length > 0 && (found.text() || '').trim().length > 100) {
            $container = found
            usedSelector = sel
            break
        }
    }

    if (!$container) {
        return NextResponse.json({
            error: 'Could not detect a content container on the source page. Pick a page with substantial body content (e.g. an About or Services page).',
        }, { status: 422 })
    }

    // Strip nav, header, footer, sidebar, comments, asides — anything that's
    // clearly not content but might have been nested inside our container.
    $container.find('nav, header, footer, aside, .sidebar, .menu, #comments, .comments, .post-navigation, .related-posts, script, style, form').remove()

    // Replace the inner content with our placeholders. We preserve the
    // container's outer tag + classes so theme styles still target it.
    const outerTag = ($container[0] as any).tagName?.toLowerCase() || 'div'
    const classAttr = $container.attr('class') || ''
    const idAttr = $container.attr('id') || ''

    const placeholder = `{{HERO_MEDIA}}\n<h1>{{HERO_HEADLINE}}</h1>\n<div class="koto-hero-sub">{{HERO_SUB}}</div>\n{{SECTIONS}}\n{{FAQS}}\n{{CTA}}\n{{SERVICE_AREAS}}`

    const wrapper = `<${outerTag}${idAttr ? ` id="${idAttr}"` : ''}${classAttr ? ` class="${classAttr}"` : ''}>\n${placeholder}\n</${outerTag}>`

    // Sample of what the source's inner HTML looks like (capped, for preview)
    const sampleSourceHtml = $container.html()?.slice(0, 1200) || ''

    return NextResponse.json({
        ok: true,
        wrapper,
        used_selector: usedSelector,
        source_url: url,
        sample_source_html: sampleSourceHtml,
        outer_tag: outerTag,
        class_attr: classAttr,
        notes: `Detected content container via "${usedSelector}". Wrapper preserves the outer ${outerTag}${classAttr ? `.${classAttr.split(/\s+/)[0]}` : ''} so theme CSS targets your deployed pages.`,
    })
}

/**
 * Resolve the focus-keyword template against a location. Operator can set
 * a free-form template on the campaign, with [koto_city] / [koto_state] /
 * [koto_state_abbr] tokens. Default (when template is null/empty) is
 * `${topic} ${city}` lowercase — matches the original hardcoded shape.
 */
function resolveFocusKeyword(
    campaign: { topic?: string; focus_keyword_template?: string | null },
    loc: { city: string; state?: string; stateAbbr?: string },
): string {
    const tmpl = (campaign.focus_keyword_template || '').trim()
    if (tmpl) {
        return tmpl
            .replace(/\[koto_city\]/g, loc.city || '')
            .replace(/\[koto_state_abbr\]/g, loc.stateAbbr || '')
            .replace(/\[koto_state\]/g, loc.state || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
    }
    return `${campaign.topic || ''} ${loc.city || ''}`.trim().toLowerCase()
}

/**
 * Force-rewrite SEO meta (title, description, focus keyword) to Yoast +
 * RankMath + KotoIQ-native keys for every published deploy. Useful when:
 *   - meta writes silently failed on the original deploy
 *   - operator changed the master's meta templates and wants to backfill
 *   - SEO panel shows "No keyword" even after a deploy completed
 */
async function resyncSeoMeta(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const { data: campaign } = await supabase
        .from('koto_topic_campaigns').select('*').eq('id', campaignId).eq('agency_id', agencyId).single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    const { data: published } = await supabase
        .from('koto_topic_campaign_deploys').select('*')
        .eq('campaign_id', campaignId).eq('status', 'published').not('wp_post_id', 'is', null)
    if (!published || published.length === 0) {
        return NextResponse.json({ ok: true, written: 0, failed: 0, message: 'No published deploys to re-sync' })
    }

    const { data: site } = await supabase
        .from('koto_wp_sites').select('*').eq('id', published[0].site_id).single()
    if (!site || site.shim_version !== 'v4') {
        return NextResponse.json({ error: 're-sync requires a v4-paired site' }, { status: 400 })
    }

    let written = 0, failed = 0
    const errors: Array<{ city: string; error: string }> = []
    for (const d of published) {
        const ctx: ResolveContext = {
            location: { city: d.city, state: d.state, stateAbbr: d.state_abbr, zip: d.zip || undefined, county: d.county || undefined },
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
        }
        // Re-resolve so meta reflects any master edits since deploy.
        const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx)
        const r = await writeSeoMeta(site.site_url, d.wp_post_id, {
            seo_title: resolved.metaTitle,
            meta_description: resolved.metaDescription,
            focus_keyword: `${campaign.topic} ${d.city}`.toLowerCase(),
        }).catch((e: any) => ({ ok: false, error: { code: 'throw', message: e?.message || 'unknown' }, status: 0 } as const))
        if (r.ok) {
            written++
            // Clear any prior "SEO meta partial" error on this row.
            if (d.error?.startsWith('SEO meta partial')) {
                await supabase.from('koto_topic_campaign_deploys').update({ error: null }).eq('id', d.id)
            }
            // Update stored resolved values to match what was just written.
            await supabase.from('koto_topic_campaign_deploys').update({
                resolved_meta_title: resolved.metaTitle,
                resolved_meta_description: resolved.metaDescription,
            }).eq('id', d.id)
        } else {
            failed++
            errors.push({ city: d.city, error: `${r.error.code}: ${r.error.message}` })
            await supabase.from('koto_topic_campaign_deploys')
                .update({ error: `SEO meta: ${r.error.code}: ${r.error.message}` })
                .eq('id', d.id)
        }
    }
    return NextResponse.json({ ok: true, written, failed, errors })
}

/**
 * Re-attempt deploys for cities that previously failed in this campaign.
 * Reuses the same resolve + WP POST logic as the main deploy action, but
 * scoped to status='failed' rows. UPDATES the existing deploy row instead
 * of creating a new one — so the operator can see the history (when it
 * first failed, what the error was, when it succeeded on retry).
 */
async function retryFailedDeploys(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const { data: campaign, error: ce } = await supabase
        .from('koto_topic_campaigns').select('*').eq('id', campaignId).eq('agency_id', agencyId).single()
    if (ce || !campaign) return NextResponse.json({ error: ce?.message || 'campaign not found' }, { status: 404 })

    const { data: failed } = await supabase
        .from('koto_topic_campaign_deploys').select('*').eq('campaign_id', campaignId).eq('status', 'failed')
    if (!failed || failed.length === 0) {
        return NextResponse.json({ ok: true, retried: 0, succeeded: 0, still_failed: 0, message: 'No failed deploys to retry' })
    }

    const { data: site } = await supabase
        .from('koto_wp_sites').select('*').eq('id', failed[0].site_id).single()
    if (!site || site.shim_version !== 'v4') {
        return NextResponse.json({ error: 'retry requires a v4-paired site' }, { status: 400 })
    }
    const creds = await loadSiteCredentials(supabase, agencyId, site.id).catch(() => null)
    if (!creds) return NextResponse.json({ error: 'site has no paired credentials' }, { status: 401 })

    // Sibling links — include every PUBLISHED deploy so retries weave back in.
    const { data: published } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('city, state_abbr, wp_post_url')
        .eq('campaign_id', campaignId).eq('status', 'published').not('wp_post_url', 'is', null)
    const siblingLinks = (published || []).map((x: any) => ({ city: x.city, state_abbr: x.state_abbr, url: x.wp_post_url }))

    const restBase = campaign.post_type === 'post' ? 'posts' : 'pages'
    const featuredMediaId = await ensureFeaturedMedia(supabase, campaign, site, creds)
    let succeeded = 0
    let stillFailed = 0
    const results: any[] = []

    for (const d of failed) {
        const loc = { city: d.city, state: d.state, stateAbbr: d.state_abbr, zip: d.zip || undefined, county: d.county || undefined }
        const ctx: ResolveContext = {
            location: loc,
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
            heroImageUrl: campaign.hero_image_url || undefined,
            heroVideoUrl: campaign.hero_video_url || undefined,
            heroImageAlt: campaign.hero_image_alt || undefined,
            siblingLinks,
        }
        const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx, campaign.custom_html_wrapper || undefined)
        const wpBody: Record<string, unknown> = {
            title: resolved.title, slug: resolved.slug, content: resolved.bodyHtml,
            excerpt: resolved.metaDescription, status: 'publish',
        }
        if (featuredMediaId) wpBody.featured_media = featuredMediaId
        const retryMeta: Record<string, string> = {}
        if (resolved.jsonLd) retryMeta._kotoiq_schema_jsonld = resolved.jsonLd
        if (resolved.baseCss) retryMeta._kotoiq_base_css = resolved.baseCss
        if (Object.keys(retryMeta).length > 0) wpBody.meta = retryMeta

        const wpResp = await wpFetchJson<{ id?: number; link?: string; slug?: string }>(
            site.site_url, `/wp/v2/${restBase}`, creds,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wpBody) },
        )

        const patch: any = {
            resolved_title: resolved.title,
            resolved_slug: wpResp.data?.slug || resolved.slug,
            resolved_meta_title: resolved.metaTitle,
            resolved_meta_description: resolved.metaDescription,
            resolved_jsonld: resolved.jsonLd || null,
            rendered_html_bytes: resolved.bodyHtml.length,
        }
        if (wpResp.ok && wpResp.data?.id) {
            await writeSeoMeta(site.site_url, wpResp.data.id, {
                seo_title: resolved.metaTitle,
                meta_description: resolved.metaDescription,
                focus_keyword: resolveFocusKeyword(campaign, { city: d.city, state: d.state, stateAbbr: d.state_abbr }),
            }).catch(() => null)
            patch.wp_post_id = wpResp.data.id
            patch.wp_post_url = wpResp.data.link
            patch.status = 'published'
            patch.error = null
            patch.rank_math_score = await readRankMathScore(site.site_url, wpResp.data.id, creds).catch(() => null)
            succeeded++
        } else {
            patch.status = 'failed'
            patch.error = (wpResp.ok ? null : wpResp.error) || `HTTP ${wpResp.status}`
            stillFailed++
        }
        const { data: updated } = await supabase
            .from('koto_topic_campaign_deploys').update(patch).eq('id', d.id).select().single()
        results.push(updated)
    }

    return NextResponse.json({ ok: true, retried: failed.length, succeeded, still_failed: stillFailed, results })
}

/**
 * For every deploy with a stored wp_post_id, fetch the live post via
 * /wp/v2/{pages,posts}/{id} and reconcile the local status. Catches
 * "post was actually published but we recorded it as failed" cases
 * (e.g. WP returned a non-standard success shape that wpFetchJson
 * couldn't parse, but the post landed anyway).
 */
async function verifyLiveDeploys(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const { data: campaign } = await supabase
        .from('koto_topic_campaigns').select('*').eq('id', campaignId).eq('agency_id', agencyId).single()
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    const { data: deploys } = await supabase
        .from('koto_topic_campaign_deploys').select('*').eq('campaign_id', campaignId)
    if (!deploys || deploys.length === 0) {
        return NextResponse.json({ ok: true, verified: 0, corrected: 0, message: 'No deploys to verify' })
    }

    const { data: site } = await supabase
        .from('koto_wp_sites').select('*').eq('id', deploys[0].site_id).single()
    if (!site) return NextResponse.json({ error: 'site row not found' }, { status: 404 })
    const creds = await loadSiteCredentials(supabase, agencyId, site.id).catch(() => null)
    if (!creds) return NextResponse.json({ error: 'site has no paired credentials' }, { status: 401 })

    const restBase = campaign.post_type === 'post' ? 'posts' : 'pages'
    let verified = 0, corrected = 0, gone = 0
    const reconciliation: any[] = []

    for (const d of deploys) {
        // 1. If we have a wp_post_id, check it directly
        if (d.wp_post_id) {
            const r = await wpFetchJson<{ id?: number; link?: string; status?: string; slug?: string; title?: any }>(
                site.site_url, `/wp/v2/${restBase}/${d.wp_post_id}?_fields=id,link,status,slug,title`, creds,
            )
            if (r.ok && r.data?.status === 'publish') {
                verified++
                reconciliation.push({ id: d.id, city: d.city, found: true, status: 'published', url: r.data.link })
                if (d.status !== 'published') {
                    await supabase.from('koto_topic_campaign_deploys').update({
                        status: 'published', wp_post_url: r.data.link, error: null,
                    }).eq('id', d.id)
                    corrected++
                }
                continue
            }
            // Post id existed but post is gone or not publish
            if (r.status === 404) {
                await supabase.from('koto_topic_campaign_deploys').update({
                    status: 'failed', error: 'Post no longer exists on WP (deleted manually?)',
                }).eq('id', d.id)
                gone++
                reconciliation.push({ id: d.id, city: d.city, found: false, status: 'deleted' })
                continue
            }
        }

        // 2. No wp_post_id (failed before WP returned an id) — search by slug
        if (d.resolved_slug) {
            const r = await wpFetchJson<Array<{ id?: number; link?: string; status?: string; slug?: string }>>(
                site.site_url, `/wp/v2/${restBase}?slug=${encodeURIComponent(d.resolved_slug)}&_fields=id,link,status,slug`, creds,
            )
            const hit = Array.isArray(r.data) ? r.data[0] : null
            if (hit?.id && hit.status === 'publish') {
                await supabase.from('koto_topic_campaign_deploys').update({
                    status: 'published',
                    wp_post_id: hit.id,
                    wp_post_url: hit.link,
                    error: null,
                }).eq('id', d.id)
                verified++
                corrected++
                reconciliation.push({ id: d.id, city: d.city, found: true, status: 'recovered', url: hit.link })
                continue
            }
        }

        reconciliation.push({ id: d.id, city: d.city, found: false, status: d.status })
    }

    return NextResponse.json({
        ok: true,
        checked: deploys.length,
        verified,
        corrected, // status updated from failed → published
        gone, // post existed in our DB but missing on WP
        reconciliation,
    })
}

/**
 * Daily Search Console series per page — used for sparkline trend lines.
 * Returns rows like { keys: [page, date], clicks, impressions }.
 */
async function fetchGscDailyByPage(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
    try {
        const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, dimensions: ['page', 'date'], rowLimit: 5000, aggregationType: 'auto' }),
            signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return null
        return res.json()
    } catch { return null }
}

/**
 * Daily Search Console series per (page, query) — powers per-query sparklines
 * in the expanded performance row. Returns rows like
 *   { keys: [page, query, date], clicks, impressions }.
 *
 * Limited to 25k rows (~25 pages × ~30 queries × 28 days ≈ 21k, comfortable
 * for our typical batch sizes). If a campaign has more, the lowest-traffic
 * queries get truncated server-side by GSC — which is fine because we only
 * surface the top 5 queries per page anyway.
 */
async function fetchGscDailyByPageQuery(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
    try {
        const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, dimensions: ['page', 'query', 'date'], rowLimit: 25000, aggregationType: 'auto' }),
            signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) return null
        return res.json()
    } catch { return null }
}

/**
 * Pull Search Console + GA4 data for every deployed page in a campaign and
 * join by URL. Returns per-city metrics + campaign totals + top queries.
 *
 * Date window defaults to the last 28 days. Caller can pass `days` to widen.
 */
async function getPerformance(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const days = Math.max(7, Math.min(365, Number(body.days) || 28))

    const { data: campaign, error: ce } = await supabase
        .from('koto_topic_campaigns')
        .select('id, agency_id, client_id, site_id, topic')
        .eq('id', campaignId)
        .eq('agency_id', agencyId)
        .single()
    if (ce || !campaign) return NextResponse.json({ error: ce?.message || 'campaign not found' }, { status: 404 })

    const { data: deploys } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('id, city, state_abbr, wp_post_url, status')
        .eq('campaign_id', campaignId)
        .eq('status', 'published')
        .not('wp_post_url', 'is', null)
    const liveDeploys = deploys || []

    if (!campaign.client_id) {
        return NextResponse.json({
            ok: true,
            window_days: days,
            error_hint: 'Campaign has no client_id — connect GSC/GA4 via the client to see performance.',
            deploys: liveDeploys, totals: null, per_url: {},
        })
    }

    const connections = await loadClientConnections(campaign.client_id)
    const scConn = connections.find((c: any) => c.provider === 'google_search_console') || null
    const ga4Conn = connections.find((c: any) => c.provider === 'google_analytics' || c.provider === 'ga4') || null

    const today = new Date()
    const start = new Date(today.getTime() - days * 86400 * 1000)
    const ymd = (d: Date) => d.toISOString().slice(0, 10)
    const startDate = ymd(start), endDate = ymd(today)

    let scData: any = null, ga4Data: any = null, scDailyData: any = null, scDailyByQueryData: any = null
    let scSiteUrl = ''
    try {
        if (scConn) {
            const tok = await getAccessToken(scConn)
            scSiteUrl = scConn.account_id || scConn.site_url || ''
            if (tok && scSiteUrl) {
                // Three calls: aggregate page+query rows, per-page daily series
                // (overall sparkline), and per-page-per-query daily series
                // (in-row top-query sparklines).
                const [agg, daily, dailyByQuery] = await Promise.all([
                    fetchSearchConsoleData(tok, scSiteUrl, startDate, endDate),
                    fetchGscDailyByPage(tok, scSiteUrl, startDate, endDate),
                    fetchGscDailyByPageQuery(tok, scSiteUrl, startDate, endDate),
                ])
                scData = agg
                scDailyData = daily
                scDailyByQueryData = dailyByQuery
            }
        }
    } catch {}
    try {
        if (ga4Conn) {
            const tok = await getAccessToken(ga4Conn)
            const propId = ga4Conn.property_id || ga4Conn.account_id
            if (tok && propId) {
                ga4Data = await fetchGA4Data(tok, propId, startDate, endDate)
            }
        }
    } catch {}

    // Index GSC rows by page URL (strip trailing slash + protocol for matching)
    const norm = (u: string) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    const gscByPage: Record<string, { clicks: number; impressions: number; ctr: number; position: number; queries: Array<{ query: string; clicks: number; impressions: number }> }> = {}
    for (const row of (scData?.rows || [])) {
        const [query, page] = row.keys || []
        const k = norm(page)
        if (!gscByPage[k]) gscByPage[k] = { clicks: 0, impressions: 0, ctr: 0, position: 0, queries: [] }
        gscByPage[k].clicks += row.clicks || 0
        gscByPage[k].impressions += row.impressions || 0
        gscByPage[k].queries.push({ query, clicks: row.clicks || 0, impressions: row.impressions || 0 })
    }
    // Recompute weighted average position + sort top queries per page
    for (const k of Object.keys(gscByPage)) {
        const rec = gscByPage[k]
        const totalImp = rec.impressions
        let weighted = 0
        for (const q of rec.queries) weighted += (q.impressions / Math.max(totalImp, 1)) * 0
        // Recompute position from the raw rows
        let posSum = 0, posWeight = 0
        for (const row of (scData?.rows || [])) {
            const [, page] = row.keys || []
            if (norm(page) !== k) continue
            posSum += (row.position || 0) * (row.impressions || 0)
            posWeight += row.impressions || 0
        }
        rec.position = posWeight > 0 ? posSum / posWeight : 0
        rec.ctr = totalImp > 0 ? rec.clicks / totalImp : 0
        rec.queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
        rec.queries = rec.queries.slice(0, 5)
    }

    // Index GA4 rows by pagePath (strip protocol + host since GA4 returns path only)
    const ga4ByPath: Record<string, { sessions: number; users: number; conversions: number; bounce_rate_sum: number; row_count: number }> = {}
    for (const row of (ga4Data?.rows || [])) {
        const path = String(row.dimensionValues?.[0]?.value || '')
        const k = path.replace(/\/$/, '').toLowerCase()
        if (!ga4ByPath[k]) ga4ByPath[k] = { sessions: 0, users: 0, conversions: 0, bounce_rate_sum: 0, row_count: 0 }
        ga4ByPath[k].sessions += Number(row.metricValues?.[0]?.value || 0)
        ga4ByPath[k].users    += Number(row.metricValues?.[1]?.value || 0)
        ga4ByPath[k].bounce_rate_sum += Number(row.metricValues?.[2]?.value || 0)
        ga4ByPath[k].conversions += Number(row.metricValues?.[3]?.value || 0)
        ga4ByPath[k].row_count++
    }

    // Index daily series per page
    const dailyByPage: Record<string, Array<{ date: string; clicks: number; impressions: number }>> = {}
    for (const row of (scDailyData?.rows || [])) {
        const [page, date] = row.keys || []
        const k = norm(page)
        if (!dailyByPage[k]) dailyByPage[k] = []
        dailyByPage[k].push({ date, clicks: row.clicks || 0, impressions: row.impressions || 0 })
    }
    for (const k of Object.keys(dailyByPage)) {
        dailyByPage[k].sort((a, b) => a.date.localeCompare(b.date))
    }

    // Index daily series per (page, query) — powers per-query sparklines in
    // the expanded performance row. Nested map: pageKey → query → daily[].
    const dailyByPageQuery: Record<string, Record<string, Array<{ date: string; clicks: number; impressions: number }>>> = {}
    for (const row of (scDailyByQueryData?.rows || [])) {
        const [page, query, date] = row.keys || []
        if (!page || !query || !date) continue
        const k = norm(page)
        if (!dailyByPageQuery[k]) dailyByPageQuery[k] = {}
        if (!dailyByPageQuery[k][query]) dailyByPageQuery[k][query] = []
        dailyByPageQuery[k][query].push({ date, clicks: row.clicks || 0, impressions: row.impressions || 0 })
    }
    for (const k of Object.keys(dailyByPageQuery)) {
        for (const q of Object.keys(dailyByPageQuery[k])) {
            dailyByPageQuery[k][q].sort((a, b) => a.date.localeCompare(b.date))
        }
    }

    // Fetch CrUX (Core Web Vitals) per URL in parallel — best-effort
    const cruxKey = process.env.GOOGLE_CRUX_API_KEY || process.env.CRUX_API_KEY || ''
    const cruxByUrl: Record<string, any> = {}
    if (cruxKey) {
        const cruxResults = await Promise.all(
            liveDeploys.map((d: any) =>
                fetchCruxData(d.wp_post_url, cruxKey).catch(() => null),
            ),
        )
        liveDeploys.forEach((d: any, i: number) => {
            const r = cruxResults[i]
            if (r) cruxByUrl[d.wp_post_url] = r
        })
    }

    // Build per-deploy result by matching its URL against GSC + GA4
    const per_url: Record<string, any> = {}
    let totalClicks = 0, totalImpressions = 0, totalSessions = 0, totalUsers = 0, totalConv = 0
    let bestCity: any = null
    for (const d of liveDeploys) {
        const fullKey = norm(d.wp_post_url)
        const pathKey = '/' + fullKey.split('/').slice(1).join('/')
        const gsc = gscByPage[fullKey] || null
        const ga4 = ga4ByPath[pathKey.replace(/\/$/, '').toLowerCase()] || null
        const daily = dailyByPage[fullKey] || []
        const crux = cruxByUrl[d.wp_post_url] || null
        // Attach per-query daily series to each top query so the frontend can
        // render an inline sparkline next to each query in the expanded row.
        const queryDailyMap = dailyByPageQuery[fullKey] || {}
        const topQueries = (gsc?.queries || []).map(q => ({
            ...q,
            daily: queryDailyMap[q.query] || [],
        }))
        const rec = {
            city: d.city, state_abbr: d.state_abbr, url: d.wp_post_url,
            clicks: gsc?.clicks || 0,
            impressions: gsc?.impressions || 0,
            ctr: gsc?.ctr || 0,
            position: gsc?.position || 0,
            sessions: ga4?.sessions || 0,
            users: ga4?.users || 0,
            conversions: ga4?.conversions || 0,
            top_queries: topQueries,
            daily, // [{date, clicks, impressions}] sorted ascending
            cwv: crux ? {
                lcp_p75_ms: crux.lcp_p75_ms,
                cls_p75: crux.cls_p75,
                inp_p75_ms: crux.inp_p75_ms,
                source: crux.source, // crux_url | crux_origin
            } : null,
        }
        per_url[d.wp_post_url] = rec
        totalClicks += rec.clicks
        totalImpressions += rec.impressions
        totalSessions += rec.sessions
        totalUsers += rec.users
        totalConv += rec.conversions
        if (!bestCity || rec.clicks > (bestCity.clicks || 0)) bestCity = rec
    }

    return NextResponse.json({
        ok: true,
        window_days: days,
        gsc_connected: !!scConn && !!scData,
        ga4_connected: !!ga4Conn && !!ga4Data,
        totals: {
            clicks: totalClicks,
            impressions: totalImpressions,
            sessions: totalSessions,
            users: totalUsers,
            conversions: totalConv,
            best_city: bestCity ? { city: bestCity.city, state_abbr: bestCity.state_abbr, clicks: bestCity.clicks } : null,
        },
        per_url,
    })
}

/**
 * Best-effort read of RankMath's calculated on-page score from post meta.
 * Returns null if RankMath isn't installed or the score hasn't been
 * calculated yet. Doesn't throw.
 */
async function readRankMathScore(siteUrl: string, postId: number, _creds: unknown): Promise<number | null> {
    try {
        const res = await postGetMetaBulk(siteUrl, {
            posts: [{ post_id: postId, keys: ['rank_math_seo_score'] }],
        })
        if (!res.ok) return null
        const v = res.data.results?.[String(postId)]?.rank_math_seo_score
        const n = Number(v)
        return isFinite(n) && n > 0 ? n : null
    } catch {
        return null
    }
}

async function listCities(body: any) {
    const stateAbbr = String(body.state_abbr || '').toUpperCase()
    if (!stateAbbr || !STATE_FIPS[stateAbbr]) {
        return NextResponse.json({ error: 'state_abbr required (2-letter)' }, { status: 400 })
    }
    try {
        const res = await getPlacesForState(stateAbbr, { incorporatedOnly: true })
        const cities = (res.data || [])
            .filter(p => p.kind === 'city' || p.kind === 'town')
            .map(p => ({ name: p.name, kind: p.kind, fips: p.fips }))
            .sort((a, b) => a.name.localeCompare(b.name))
        return NextResponse.json({ ok: true, state: stateAbbr, cities, source_url: res.source_url, fetched_at: res.fetched_at })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Census API failed'
        return NextResponse.json({
            ok: false,
            error: `Could not load cities for ${stateAbbr}: ${msg}. The Census API may be temporarily unavailable — try again in a minute.`,
        }, { status: 502 })
    }
}

async function listDeploys(supabase: any, agencyId: string, body: any) {
    const campaignId = String(body.campaign_id || '')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const { data, error } = await supabase
        .from('koto_topic_campaign_deploys')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deploys: data || [] })
}
