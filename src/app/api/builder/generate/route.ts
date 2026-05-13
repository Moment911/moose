/**
 * Page Factory: Content Generation API
 *
 * POST /api/builder/generate
 *   action=run       — kick off bulk generation (fire-and-forget)
 *   action=status    — check generation progress
 *   action=preview   — generate a single page preview (blocking)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runBulkGeneration } from '@/lib/builder/bulkGenerator'
import { generatePage, type ContentGenerationInput } from '@/lib/builder/contentEngine'
import { getKotoIQDb } from '@/lib/kotoiqDb'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, client_id } = body

    if (!agency_id) {
      return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    }

    switch (action) {
      case 'run': {
        const {
          suggestion_ids, style_profile_id, shared_wildcards,
          mode, variant_count, concurrency, campaign_name, site_id,
        } = body

        if (!suggestion_ids?.length) {
          return NextResponse.json({ error: 'suggestion_ids[] required' }, { status: 400 })
        }

        // Fire-and-forget: start generation in background
        // Return immediately with campaign ID
        const startPromise = runBulkGeneration({
          agencyId: agency_id,
          clientId: client_id,
          suggestionIds: suggestion_ids,
          styleProfileId: style_profile_id,
          sharedWildcards: shared_wildcards || {},
          mode: mode || 'rotation',
          variantCount: variant_count || 3,
          concurrency: concurrency || 3,
          campaignName: campaign_name,
          siteId: site_id,
        })

        // Don't await -- let it run in background
        startPromise.catch(err => {
          console.error('[builder/generate] Background generation failed:', err)
        })

        return NextResponse.json({
          ok: true,
          message: `Generation started for ${suggestion_ids.length} pages`,
          suggestion_count: suggestion_ids.length,
        })
      }

      case 'status': {
        const { campaign_id } = body
        if (!campaign_id) {
          return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
        }

        const db = getKotoIQDb(agency_id)

        // Get campaign
        const { data: campaign } = await db.from('kotoiq_campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single()

        if (!campaign) {
          return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get variant status breakdown
        const { data: variants } = await db.from('kotoiq_variants')
          .select('id, status, seed_row, body_hash, metadata')
          .eq('campaign_id', campaign_id)

        const statusCounts = {
          pending: 0,
          generating: 0,
          ready: 0,
          publishing: 0,
          published: 0,
          failed: 0,
        }

        for (const v of variants || []) {
          const s = v.status as keyof typeof statusCounts
          if (s in statusCounts) statusCounts[s]++
        }

        return NextResponse.json({
          campaign: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            total: campaign.total_variants,
            generated: campaign.published_variants,
            uniqueness_score: campaign.metadata?.uniqueness_score,
            duplicate_count: campaign.metadata?.duplicate_count,
          },
          status_breakdown: statusCounts,
          variants: (variants || []).map(v => ({
            id: v.id,
            status: v.status,
            city: v.seed_row?.city,
            service: v.seed_row?.service,
            word_count: v.metadata?.word_count,
            variant_count: v.metadata?.variant_count,
          })),
        })
      }

      case 'preview': {
        const {
          service, city, state, county,
          wildcards, style_profile_id, mode, variant_count, brief_id,
        } = body

        if (!service || !city || !state) {
          return NextResponse.json({ error: 'service, city, state required' }, { status: 400 })
        }

        const db = getKotoIQDb(agency_id)

        // Load style profile if specified
        let styleProfile = null
        if (style_profile_id) {
          const { data: sp } = await db.from('kotoiq_style_profiles')
            .select('*')
            .eq('id', style_profile_id)
            .single()
          if (sp) {
            styleProfile = {
              heading_pattern: sp.heading_pattern,
              section_structure: sp.section_structure,
              class_conventions: sp.class_conventions,
              tone: sp.tone,
              content_density: sp.content_density,
              word_count_target: sp.word_count_target,
              notable_patterns: sp.metadata?.notable_patterns || [],
            }
          }
        }

        // Load content brief if specified
        let brief = null
        if (brief_id && client_id) {
          const { data: briefRow } = await db.client
            .from('kotoiq_content_briefs')
            .select('outline, target_entities, information_gain, title_options, semantic_data')
            .eq('id', brief_id)
            .single()
          if (briefRow) brief = briefRow
        } else if (client_id) {
          // Auto-match brief by keyword (service + city)
          const keyword = `${service} ${city}`.toLowerCase()
          const { data: briefRow } = await db.client
            .from('kotoiq_content_briefs')
            .select('outline, target_entities, information_gain, title_options, semantic_data')
            .eq('client_id', client_id)
            .ilike('target_keyword', `%${keyword}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (briefRow) brief = briefRow
        }

        const input: ContentGenerationInput = {
          service, city, state, county,
          wildcardValues: wildcards || {},
          styleProfile,
          variantCount: variant_count || 1,
          mode: mode || 'static', // preview defaults to static (show one version)
          brief,
        }

        const page = await generatePage(input)

        return NextResponse.json({
          title: page.title,
          body_html: page.bodyHtml,
          word_count: page.wordCount,
          variant_count: page.variantCount,
          rank_math_meta: page.rankMathMeta,
          schemas: page.schemas,
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    console.error('[builder/generate]', e)
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
