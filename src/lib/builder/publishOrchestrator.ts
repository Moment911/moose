/**
 * Publish Orchestrator (ORCH-01, ORCH-02, ORCH-03)
 *
 * Orchestrates publishing all ready variants for a campaign.
 * For each variant: clone page on WP -> update kotoiq_publishes -> update variant status.
 *
 * Cadence: respects per_day_cap from cadence_config.
 * Idempotency: checks idempotency_key on kotoiq_publishes before creating.
 * Retry: on failure, marks variant as 'failed' with error. Does not auto-retry.
 * Progress: updates kotoiq_campaigns.published_variants and failed_variants counts.
 *
 * ── Vercel Workflow migration path ──
 * This is currently an async function called from an API route.
 * To migrate to Vercel Workflow DevKit:
 *   1. Convert publishCampaign() to a workflow.define() with steps
 *   2. Each variant publish becomes a workflow.step('publish-variant-{id}', ...)
 *   3. The cadence delay becomes workflow.sleep('cadence-wait', ms)
 *   4. Cancellation checks become workflow.isCancelled()
 *   5. Progress updates become workflow.report({ ... })
 * The step-based approach gives automatic crash recovery and resume.
 */

import { getKotoIQDb, type KotoIQDb } from '../kotoiqDb'
import { getPublishSchedule, type ScheduledVariant } from './cadenceScheduler'

// ── Types ───────────────────────────────────────────────────────────────────

interface PublishResult {
  campaign_id: string
  total: number
  published: number
  failed: number
  skipped: number
  cancelled: boolean
  errors: Array<{ variant_id: string; error: string }>
}

interface WPCloneResponse {
  ok: boolean
  data?: {
    post_id?: number
    url?: string
    [key: string]: any
  }
  error?: string
}

// ── WP Proxy helper ─────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

async function callWPProxy(action: string, payload: Record<string, any>): Promise<any> {
  const res = await fetch(`${APP_URL}/api/wp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

// ── Main orchestrator ───────────────────────────────────────────────────────

/**
 * Publish all ready variants for a campaign.
 *
 * This function runs asynchronously and updates the database as it progresses.
 * It can be called from an API route that returns immediately while this runs.
 *
 * @param campaignId - The campaign to publish
 * @param agencyId - The agency that owns the campaign
 * @returns PublishResult with counts and errors
 */
export async function publishCampaign(
  campaignId: string,
  agencyId: string
): Promise<PublishResult> {
  const db = getKotoIQDb(agencyId)

  // 1. Load campaign
  const { data: campaign, error: campaignError } = await db.campaigns.get(campaignId)
  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignId}`)
  }

  // 2. Set campaign status to 'publishing'
  await db.campaigns.update(campaignId, { status: 'publishing' })

  // 3. Load ready variants
  const { data: variants } = await db.from('kotoiq_variants')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })

  const readyVariants = variants || []

  if (readyVariants.length === 0) {
    await db.campaigns.update(campaignId, { status: 'live' })
    return {
      campaign_id: campaignId,
      total: 0, published: 0, failed: 0, skipped: 0,
      cancelled: false, errors: [],
    }
  }

  // 4. Build publish schedule based on cadence
  const variantIds = readyVariants.map((v: any) => v.id)
  const schedule = getPublishSchedule(
    { id: campaign.id, cadence: campaign.cadence, cadence_config: campaign.cadence_config },
    variantIds
  )

  // 5. Group by scheduled_at date for per_day_cap enforcement
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayBatch = schedule.filter(
    (s: ScheduledVariant) => s.scheduled_at.toISOString().slice(0, 10) === todayStr
  )

  // Only publish today's batch. Future batches will be picked up by subsequent runs.
  const toPublish = todayBatch.length > 0 ? todayBatch : schedule

  const result: PublishResult = {
    campaign_id: campaignId,
    total: toPublish.length,
    published: 0,
    failed: 0,
    skipped: 0,
    cancelled: false,
    errors: [],
  }

  // 6. Publish each variant sequentially
  for (const item of toPublish) {
    // Check if campaign was cancelled mid-run
    const { data: currentCampaign } = await db.campaigns.get(campaignId)
    if (currentCampaign?.status === 'cancelled') {
      result.cancelled = true
      break
    }

    const variant = readyVariants.find((v: any) => v.id === item.variant_id)
    if (!variant) {
      result.skipped++
      continue
    }

    try {
      await publishSingleVariant(db, campaign, variant)
      result.published++
    } catch (err: any) {
      result.failed++
      result.errors.push({
        variant_id: variant.id,
        error: err.message || 'Unknown error',
      })
    }

    // Update campaign progress after each variant
    await updateCampaignProgress(db, campaignId)
  }

  // 7. Final campaign status update
  const finalStatus = result.cancelled
    ? 'cancelled'
    : result.failed > 0 && result.published === 0
      ? 'failed'
      : 'live'
  await db.campaigns.update(campaignId, { status: finalStatus })

  return result
}

// ── Single variant publish ──────────────────────────────────────────────────

async function publishSingleVariant(
  db: KotoIQDb,
  campaign: any,
  variant: any
): Promise<void> {
  const idempotencyKey = variant.idempotency_key || `pub-${variant.id}`

  // Idempotency check: skip if already published with this key
  const { data: existingPublish } = await db.from('kotoiq_publishes')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingPublish) {
    // Already published — mark variant as published and skip
    await db.from('kotoiq_variants')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', variant.id)
    return
  }

  // Mark variant as publishing
  await db.from('kotoiq_variants')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', variant.id)

  try {
    // Clone the template page on WP with the variant's rendered data
    const cloneResult: WPCloneResponse = await callWPProxy('clone_elementor_page', {
      site_id: campaign.site_id,
      agency_id: db.agencyId,
      source_post_id: campaign.template_post_id || campaign.source_post_id,
      title: variant.title || variant.name || `Variant ${variant.id.slice(0, 8)}`,
      slug: variant.slug,
      status: 'publish',
      elementor_data: variant.rendered_elementor_data,
      idempotency_key: idempotencyKey,
    })

    if (!cloneResult.ok && !cloneResult.data?.post_id) {
      throw new Error(cloneResult.error || 'WP clone failed — no post_id returned')
    }

    const wpPostId = cloneResult.data?.post_id
    const wpUrl = cloneResult.data?.url

    // Record the publish
    await db.from('kotoiq_publishes')
      .insert({
        variant_id: variant.id,
        campaign_id: campaign.id,
        site_id: campaign.site_id,
        wp_post_id: wpPostId,
        url: wpUrl || null,
        idempotency_key: idempotencyKey,
        workflow_run_id: null, // Will be set when migrated to Vercel Workflow
        published_at: new Date().toISOString(),
      })
      .select()

    // Mark variant as published
    await db.from('kotoiq_variants')
      .update({
        status: 'published',
        wp_post_id: wpPostId,
        url: wpUrl,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', variant.id)

  } catch (err: any) {
    // Mark variant as failed
    await db.from('kotoiq_variants')
      .update({
        status: 'failed',
        error: err.message || 'Unknown publish error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', variant.id)
    throw err
  }
}

// ── Retry a single failed variant ───────────────────────────────────────────

/**
 * Retry publishing a single failed variant.
 * Resets it to 'ready', generates a new idempotency key, and publishes.
 */
export async function retryVariant(
  variantId: string,
  campaignId: string,
  agencyId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = getKotoIQDb(agencyId)

  const { data: variant } = await db.from('kotoiq_variants')
    .select('*')
    .eq('id', variantId)
    .eq('campaign_id', campaignId)
    .single()

  if (!variant) return { ok: false, error: 'Variant not found' }
  if (variant.status !== 'failed') return { ok: false, error: `Variant is ${variant.status}, not failed` }

  const { data: campaign } = await db.campaigns.get(campaignId)
  if (!campaign) return { ok: false, error: 'Campaign not found' }

  // Generate new idempotency key for the retry
  const newKey = `pub-${variantId}-retry-${Date.now()}`
  await db.from('kotoiq_variants')
    .update({ status: 'ready', error: null, idempotency_key: newKey, updated_at: new Date().toISOString() })
    .eq('id', variantId)

  try {
    // Re-fetch variant with updated key
    const { data: updatedVariant } = await db.from('kotoiq_variants')
      .select('*').eq('id', variantId).single()
    await publishSingleVariant(db, campaign, updatedVariant)
    await updateCampaignProgress(db, campaignId)
    return { ok: true }
  } catch (err: any) {
    await updateCampaignProgress(db, campaignId)
    return { ok: false, error: err.message }
  }
}

// ── Progress tracking ───────────────────────────────────────────────────────

async function updateCampaignProgress(db: KotoIQDb, campaignId: string): Promise<void> {
  // Count variant statuses
  const { data: variants } = await db.from('kotoiq_variants')
    .select('status')
    .eq('campaign_id', campaignId)

  if (!variants) return

  const counts = {
    published_variants: 0,
    failed_variants: 0,
    total_variants: variants.length,
  }

  for (const v of variants) {
    if (v.status === 'published') counts.published_variants++
    if (v.status === 'failed') counts.failed_variants++
  }

  await db.campaigns.update(campaignId, counts)
}

// ── Campaign status query ───────────────────────────────────────────────────

/**
 * Get detailed publish status for a campaign, including per-variant breakdown.
 */
export async function getCampaignPublishStatus(
  campaignId: string,
  agencyId: string
): Promise<any> {
  const db = getKotoIQDb(agencyId)

  const [campaignRes, variantsRes] = await Promise.all([
    db.campaigns.get(campaignId),
    db.from('kotoiq_variants')
      .select('id, name, title, slug, status, error, wp_post_id, url, published_at, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true }),
  ])

  const campaign = campaignRes.data
  const variants = variantsRes.data || []

  const counts = {
    pending: 0, generating: 0, ready: 0,
    publishing: 0, published: 0, failed: 0,
  }
  for (const v of variants) {
    const status = v.status as keyof typeof counts
    if (status in counts) counts[status]++
  }

  return {
    campaign: campaign ? {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      cadence: campaign.cadence,
      total_variants: campaign.total_variants,
      published_variants: campaign.published_variants,
      failed_variants: campaign.failed_variants,
    } : null,
    counts,
    variants,
  }
}
