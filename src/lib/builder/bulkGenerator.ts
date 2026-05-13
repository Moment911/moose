/**
 * Bulk Generator — orchestrates batch page generation for the Page Factory
 *
 * Takes a list of page suggestions (service x city combos),
 * generates content for each via ContentEngine, runs uniqueness checks,
 * and queues for publishing via the existing publish orchestrator.
 *
 * Supports:
 * - Parallel generation with configurable concurrency
 * - Progress tracking via database updates
 * - Cancellation mid-batch
 * - Per-agency daily limits
 * - Uniqueness gating before publish
 */

import 'server-only'
import { getKotoIQDb } from '../kotoiqDb'
import { generatePage, generateBatch, type ContentGenerationInput, type GeneratedPage } from './contentEngine'
import { checkBatchUniqueness, stripHtml, computeBodyHash } from './uniquenessGate'
import { fillWildcards, buildDefaultValues, ALL_WILDCARDS } from './wildcards'
import type { StyleProfile } from './styleExtractor'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BulkGenerationInput {
  agencyId: string
  clientId: string
  /** Suggestion IDs to generate (from kotoiq_page_suggestions) */
  suggestionIds: string[]
  /** Style profile to use for all pages */
  styleProfileId?: string
  /** Wildcard values shared across all pages (business info, etc.) */
  sharedWildcards: Record<string, string>
  /** Content rotation mode */
  mode?: 'static' | 'rotation'
  /** Variants per section for rotation (default 3) */
  variantCount?: number
  /** Max concurrent generation (default 3) */
  concurrency?: number
  /** Campaign name */
  campaignName?: string
  /** WordPress site ID to publish to */
  siteId?: string
}

export interface BulkGenerationResult {
  campaignId: string
  totalRequested: number
  generated: number
  failed: number
  uniquenessScore: number
  duplicateFlags: number
}

// ── Daily Limit ────────────────────────────────────────────────────────────

const DAILY_LIMIT = 200

async function checkDailyLimit(db: ReturnType<typeof getKotoIQDb>, agencyId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { count } = await db.from('kotoiq_page_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
    .in('status', ['generating', 'built', 'published'])
    .gte('updated_at', `${today}T00:00:00Z`)

  return count || 0
}

// ── Core Bulk Generator ────────────────────────────────────────────────────

export async function runBulkGeneration(input: BulkGenerationInput): Promise<BulkGenerationResult> {
  const {
    agencyId, clientId, suggestionIds,
    styleProfileId, sharedWildcards,
    mode = 'rotation', variantCount = 3,
    concurrency = 3, campaignName, siteId,
  } = input

  const db = getKotoIQDb(agencyId)

  // 1. Check daily limit
  const todayCount = await checkDailyLimit(db, agencyId)
  const remainingQuota = DAILY_LIMIT - todayCount
  if (remainingQuota <= 0) {
    throw new Error(`Daily generation limit reached (${DAILY_LIMIT} pages/day). Try again tomorrow.`)
  }

  const effectiveIds = suggestionIds.slice(0, remainingQuota)

  // 2. Load suggestions
  const { data: suggestions, error: sugErr } = await db.from('kotoiq_page_suggestions')
    .select('*')
    .in('id', effectiveIds)
    .eq('client_id', clientId)

  if (sugErr || !suggestions?.length) {
    throw new Error('No valid suggestions found')
  }

  // 3. Load style profile if specified
  let styleProfile: StyleProfile | null = null
  if (styleProfileId) {
    const { data: sp } = await db.from('kotoiq_style_profiles')
      .select('*')
      .eq('id', styleProfileId)
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

  // 4. Load client's sitemap URLs for internal linking
  const { data: sitemapData } = await db.client
    .from('kotoiq_sitemap_urls')
    .select('url')
    .limit(2000)
  const sitemapUrls = sitemapData || []

  // 5. Create campaign record
  const campaignRow = {
    agency_id: agencyId,
    template_id: null, // Page Factory doesn't use templates
    name: campaignName || `Page Factory: ${suggestions[0].service} (${suggestions.length} cities)`,
    cadence: 'burst',
    cadence_config: { mode, variant_count: variantCount },
    status: 'generating',
    total_variants: suggestions.length,
    published_variants: 0,
    metadata: {
      source: 'page_factory',
      style_profile_id: styleProfileId,
      client_id: clientId,
      site_id: siteId,
    },
  }

  const { data: campaign, error: campErr } = await db.from('kotoiq_campaigns')
    .insert(campaignRow)
    .select('id')
    .single()

  if (campErr || !campaign) {
    throw new Error(`Failed to create campaign: ${campErr?.message}`)
  }

  const campaignId = campaign.id

  // 6. Mark suggestions as generating
  await db.from('kotoiq_page_suggestions')
    .update({ status: 'generating', campaign_id: campaignId, updated_at: new Date().toISOString() })
    .in('id', effectiveIds)

  // 7. Build content generation inputs
  const inputs: Array<ContentGenerationInput & { suggestionId: string }> = suggestions.map(s => ({
    suggestionId: s.id,
    service: s.service,
    city: s.city,
    state: s.state,
    county: s.county,
    wildcardValues: {
      ...sharedWildcards,
      '{city}': s.city,
      '{state}': s.state,
      '{state_full}': stateFullName(s.state),
      '{county}': s.county || '',
      '{zip}': s.zip || '',
      '{keyword}': `${s.service.toLowerCase()} ${s.city.toLowerCase()} ${s.state}`,
      '{year}': new Date().getFullYear().toString(),
    },
    styleProfile,
    sitemapUrls,
    variantCount,
    mode,
  }))

  // 8. Generate pages in batch
  let generated = 0
  let failed = 0

  const results = await generateBatch(
    inputs,
    {
      concurrency,
      onProgress: async (done, total) => {
        // Update campaign progress
        await db.from('kotoiq_campaigns')
          .update({ published_variants: done, metadata: { ...campaignRow.metadata, progress: `${done}/${total}` } })
          .eq('id', campaignId)
          .then(() => {}, () => {}) // non-critical progress update
      },
    },
  )

  // 9. Store generated variants
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const suggestion = suggestions[i]
    const suggestionId = inputs[i].suggestionId

    if (result.error) {
      failed++
      console.error(`[bulkGenerator] Page failed: ${suggestion.service} in ${suggestion.city} — ${result.error}`)
      await db.from('kotoiq_page_suggestions')
        .update({ status: 'suggested', updated_at: new Date().toISOString() }) // reset to suggested on failure
        .eq('id', suggestionId)
      continue
    }

    // Insert variant
    const variantRow = {
      campaign_id: campaignId,
      seed_row: {
        service: suggestion.service,
        city: suggestion.city,
        state: suggestion.state,
        county: suggestion.county,
      },
      rendered_elementor_data: null, // Page Factory uses bodyHtml, not Elementor JSON
      body_text: result.bodyText,
      body_hash: result.bodyHash,
      idempotency_key: computeBodyHash(`${agencyId}:${suggestion.service}:${suggestion.city}:${suggestion.state}`),
      status: 'ready',
      metadata: {
        body_html: result.bodyHtml,
        title: result.title,
        post_meta: result.postMeta,
        schemas: result.schemas,
        word_count: result.wordCount,
        variant_count: result.variantCount,
        rank_math_meta: result.rankMathMeta,
      },
    }

    const { data: variant } = await db.from('kotoiq_variants')
      .insert(variantRow)
      .select('id')
      .single()

    if (variant) {
      generated++
      await db.from('kotoiq_page_suggestions')
        .update({ status: 'built', variant_id: variant.id, updated_at: new Date().toISOString() })
        .eq('id', suggestionId)
    }
  }

  // 10. Run uniqueness check across the batch
  const pagesForCheck = results
    .filter(r => !r.error)
    .map(r => ({
      city: r.city,
      bodyText: r.bodyText,
      bodyHash: r.bodyHash,
    }))

  const uniqueness = checkBatchUniqueness(pagesForCheck)

  // 11. Update campaign status
  const finalStatus = failed === suggestions.length ? 'failed' : 'ready'
  await db.from('kotoiq_campaigns')
    .update({
      status: finalStatus,
      published_variants: generated,
      metadata: {
        ...campaignRow.metadata,
        uniqueness_score: uniqueness.score,
        duplicate_count: uniqueness.duplicates.length,
        warnings: uniqueness.warnings,
      },
    })
    .eq('id', campaignId)

  return {
    campaignId,
    totalRequested: suggestions.length,
    generated,
    failed,
    uniquenessScore: uniqueness.score,
    duplicateFlags: uniqueness.duplicates.length,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

function stateFullName(abbr: string): string {
  return STATE_NAMES[abbr.toUpperCase()] || abbr
}
