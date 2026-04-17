import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../../lib/apiAuth'
import { publishCampaign, retryVariant, getCampaignPublishStatus } from '../../../../../lib/builder/publishOrchestrator'
import { getKotoIQDb } from '../../../../../lib/kotoiqDb'

/**
 * KotoIQ Builder — Publish Orchestration API (ORCH-04, ORCH-05)
 *
 * Actions:
 *   run            — kick off publishCampaign, returns immediately with run status
 *   status         — campaign publish progress (counts + per-variant breakdown)
 *   retry_variant  — retry a single failed variant
 *   stop           — cancel a campaign (in-flight variants finish, no new ones start)
 *   kick           — resume a paused/cancelled campaign
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, campaign_id, variant_id } = body

    const session = await verifySession(req, body)
    const agencyId = session.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: 'Unauthorized — no agency_id' }, { status: 401 })
    }

    // ── run ─────────────────────────────────────────────────────────────
    if (action === 'run') {
      if (!campaign_id) {
        return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
      }

      const db = getKotoIQDb(agencyId)
      const { data: campaign } = await db.campaigns.get(campaign_id)
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      if (campaign.status === 'publishing') {
        return NextResponse.json({ error: 'Campaign is already publishing' }, { status: 409 })
      }

      // Fire and forget — the orchestrator updates DB as it progresses.
      // In production with Vercel Workflow, this would return a workflow_run_id.
      publishCampaign(campaign_id, agencyId).catch((err) => {
        console.error(`[publish-orchestrator] Campaign ${campaign_id} failed:`, err.message)
      })

      return NextResponse.json({
        ok: true,
        campaign_id,
        status: 'publishing',
        message: 'Publish run started. Poll with action=status to track progress.',
      })
    }

    // ── status ──────────────────────────────────────────────────────────
    if (action === 'status') {
      if (!campaign_id) {
        return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
      }
      const result = await getCampaignPublishStatus(campaign_id, agencyId)
      return NextResponse.json(result)
    }

    // ── retry_variant ───────────────────────────────────────────────────
    if (action === 'retry_variant') {
      if (!campaign_id || !variant_id) {
        return NextResponse.json({ error: 'campaign_id and variant_id required' }, { status: 400 })
      }
      const result = await retryVariant(variant_id, campaign_id, agencyId)
      return NextResponse.json(result)
    }

    // ── stop ────────────────────────────────────────────────────────────
    if (action === 'stop') {
      if (!campaign_id) {
        return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
      }
      const db = getKotoIQDb(agencyId)
      const { data: campaign } = await db.campaigns.get(campaign_id)
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      // Mark as cancelled — the orchestrator checks this before each variant
      await db.campaigns.update(campaign_id, { status: 'cancelled' })
      return NextResponse.json({ ok: true, campaign_id, status: 'cancelled' })
    }

    // ── kick ────────────────────────────────────────────────────────────
    if (action === 'kick') {
      if (!campaign_id) {
        return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
      }
      const db = getKotoIQDb(agencyId)
      const { data: campaign } = await db.campaigns.get(campaign_id)
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      if (campaign.status !== 'cancelled' && campaign.status !== 'paused' && campaign.status !== 'failed') {
        return NextResponse.json({
          error: `Cannot resume campaign with status "${campaign.status}"`,
        }, { status: 409 })
      }

      // Reset failed variants back to ready so they can be re-published
      await db.from('kotoiq_variants')
        .update({ status: 'ready', error: null, updated_at: new Date().toISOString() })
        .eq('campaign_id', campaign_id)
        .eq('status', 'failed')

      // Fire the orchestrator
      publishCampaign(campaign_id, agencyId).catch((err) => {
        console.error(`[publish-orchestrator] Campaign ${campaign_id} kick failed:`, err.message)
      })

      return NextResponse.json({
        ok: true,
        campaign_id,
        status: 'publishing',
        message: 'Campaign resumed. Failed variants reset to ready.',
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[WP Builder Publish API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
