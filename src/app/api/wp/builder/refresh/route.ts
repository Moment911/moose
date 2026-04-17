import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../../lib/apiAuth'
import { refreshVariant } from '../../../../../lib/builder/refreshPipeline'
import { getKotoIQDb } from '../../../../../lib/kotoiqDb'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    const session = await verifySession(req, body)
    const agencyId = session.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: 'Unauthorized — no agency_id' }, { status: 401 })
    }

    if (action === 'approve_refresh') {
      const { publish_id } = body
      if (!publish_id) {
        return NextResponse.json({ error: 'publish_id required' }, { status: 400 })
      }

      const approvedBy = session.userId || 'unknown'
      const result = await refreshVariant(publish_id, agencyId, approvedBy)
      return NextResponse.json(result)
    }

    if (action === 'refresh_history') {
      const { publish_id } = body
      if (!publish_id) {
        return NextResponse.json({ error: 'publish_id required' }, { status: 400 })
      }

      const db = getKotoIQDb(agencyId)

      const { data: pub } = await db.from('kotoiq_publishes')
        .select('id, variant_id, url, published_at, metadata')
        .eq('id', publish_id)
        .single()

      if (!pub) {
        return NextResponse.json({ error: 'Publish not found' }, { status: 404 })
      }

      const { data: variant } = await db.from('kotoiq_variants')
        .select('id, slot_fills, metadata')
        .eq('id', pub.variant_id)
        .single()

      const variantMeta = (variant?.metadata && typeof variant.metadata === 'object') ? variant.metadata : {}
      const versions = Array.isArray(variantMeta.versions) ? variantMeta.versions : []

      const { data: cwvReadings } = await db.from('kotoiq_cwv_readings')
        .select('lcp_p75_ms, cls_p75, inp_p75_ms, fcp_p75_ms, ttfb_p75_ms, source, device, fetched_at')
        .eq('publish_id', publish_id)
        .order('fetched_at', { ascending: false })
        .limit(20)

      return NextResponse.json({
        publish_id,
        url: pub.url,
        published_at: pub.published_at,
        current_fills: variant?.slot_fills || [],
        versions,
        cwv_history: cwvReadings || [],
        decay_status: (pub.metadata as any)?.decay_status || null,
      })
    }

    if (action === 'list_decay') {
      const { site_id } = body
      const db = getKotoIQDb(agencyId)

      let query = db.from('kotoiq_publishes')
        .select('id, variant_id, url, published_at, metadata')
        .not('url', 'is', null)

      if (site_id) {
        query = query.eq('site_id', site_id)
      }

      const { data: publishes } = await query

      const decayed = (publishes || [])
        .filter((p: any) => p.metadata?.decay_status === 'detected')
        .map((p: any) => ({
          publish_id: p.id,
          variant_id: p.variant_id,
          url: p.url,
          published_at: p.published_at,
          decay_score: p.metadata?.decay_score || 0,
          decay_recommendation: p.metadata?.decay_recommendation || null,
          last_rescan_at: p.metadata?.last_rescan_at || null,
        }))
        .sort((a: any, b: any) => (b.decay_score || 0) - (a.decay_score || 0))

      return NextResponse.json({ pages: decayed, total: decayed.length })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[WP Builder Refresh API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
