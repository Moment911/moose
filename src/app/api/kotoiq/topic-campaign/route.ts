import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateTopicCampaignMaster } from '@/lib/wp-shim/topicCampaignGenerator'
import { resolveMaster, type LocationContext, type ResolveContext, type TopicCampaignMaster } from '@/lib/wp-shim/tokenResolver'
import { loadSiteCredentials } from '@/lib/wp-shim/credentialsVault'
import { wpFetchJson } from '@/lib/wp-shim/wpFetch'
import { writeSeoMeta } from '@/lib/wp-shim/ports/seoPort'
import { postGetMetaBulk } from '@/lib/wp-shim/verbs'
import { getPlacesForState, STATE_FIPS } from '@/lib/geoLookup'

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
        switch (action) {
            case 'generate_master':   return generateMaster(supabase, agencyId, body)
            case 'update_master':     return updateMaster(supabase, agencyId, body)
            case 'preview_resolved':  return previewResolved(supabase, agencyId, body)
            case 'deploy':            return deployCampaign(supabase, agencyId, body)
            case 'list_campaigns':    return listCampaigns(supabase, agencyId, body)
            case 'get_campaign':      return getCampaign(supabase, agencyId, body)
            case 'list_deploys':      return listDeploys(supabase, agencyId, body)
            case 'redeploy':          return redeployCampaign(supabase, agencyId, body)
            case 'list_states':       return NextResponse.json({ ok: true, states: Object.keys(STATE_FIPS).sort() })
            case 'list_cities':       return listCities(body)
            default: return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// ─── Actions ────────────────────────────────────────────────────────────────

async function generateMaster(supabase: any, agencyId: string, body: any) {
    const topic = String(body.topic || '').trim()
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const { master, inputTokens, outputTokens, model } = await generateTopicCampaignMaster(ai, {
        topic,
        companyName: body.company_name || undefined,
        phone: body.phone || undefined,
        htmlWrapperHint: body.custom_html_wrapper || undefined,
        notes: body.notes || undefined,
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
        master,
        status: 'draft',
        tokens_used: totalTokens,
        model_used: model,
    }
    const { data, error } = await supabase.from('koto_topic_campaigns').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data, tokens_used: totalTokens })
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

    const ctx: ResolveContext = {
        location,
        phone: campaign.phone || undefined,
        companyName: campaign.company_name || undefined,
    }
    const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx, campaign.custom_html_wrapper || undefined)
    return NextResponse.json({ ok: true, resolved })
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

    for (const loc of locations) {
        const ctx: ResolveContext = {
            location: loc,
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
            heroImageUrl: campaign.hero_image_url || undefined,
            heroVideoUrl: campaign.hero_video_url || undefined,
            heroImageAlt: campaign.hero_image_alt || undefined,
            siblingLinks,
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
        if (resolved.jsonLd) {
            // Plugin v4.1.0+ registers _kotoiq_schema_jsonld with
            // show_in_rest:true. Writes here are echoed via wp_head.
            // Older plugins ignore the unknown meta key.
            wpBody.meta = { _kotoiq_schema_jsonld: resolved.jsonLd }
        }

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
        if (wpResp.ok && wpResp.data?.id) {
            await writeSeoMeta(site.site_url, wpResp.data.id, {
                seo_title: resolved.metaTitle,
                meta_description: resolved.metaDescription,
                focus_keyword: `${campaign.topic} ${loc.city}`.toLowerCase(),
            }).catch(() => null) // best-effort
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

    return NextResponse.json({
        ok: true,
        deployed: successCount,
        failed: results.length - successCount,
        results,
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

    // Sibling links for internal linking — use stored URLs from prior deploys.
    const siblingLinks = existingDeploys
        .filter((x: any) => x.wp_post_url)
        .map((x: any) => ({ city: x.city, state_abbr: x.state_abbr, url: x.wp_post_url }))

    for (const d of existingDeploys) {
        const ctx: ResolveContext = {
            location: { city: d.city, state: d.state, stateAbbr: d.state_abbr, zip: d.zip || undefined, county: d.county || undefined },
            phone: campaign.phone || undefined,
            companyName: campaign.company_name || undefined,
            heroImageUrl: campaign.hero_image_url || undefined,
            heroVideoUrl: campaign.hero_video_url || undefined,
            heroImageAlt: campaign.hero_image_alt || undefined,
            siblingLinks,
        }
        const resolved = resolveMaster(campaign.master as TopicCampaignMaster, ctx, campaign.custom_html_wrapper || undefined)

        const updBody: Record<string, unknown> = {
            title: resolved.title,
            content: resolved.bodyHtml,
            excerpt: resolved.metaDescription,
        }
        if (resolved.jsonLd) updBody.meta = { _kotoiq_schema_jsonld: resolved.jsonLd }

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
                focus_keyword: `${campaign.topic} ${d.city}`.toLowerCase(),
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

    return NextResponse.json({ ok: true, updated, failed, total: existingDeploys.length })
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
    const res = await getPlacesForState(stateAbbr, { incorporatedOnly: true })
    const cities = (res.data || [])
        .filter(p => p.kind === 'city' || p.kind === 'town')
        .map(p => ({ name: p.name, kind: p.kind, fips: p.fips }))
        .sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ ok: true, state: stateAbbr, cities, source_url: res.source_url, fetched_at: res.fetched_at })
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
