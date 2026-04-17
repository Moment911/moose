import 'server-only'

import { getKotoIQDb } from '../kotoiqDb'
import { fetchCruxData, type CruxResult } from './cruxClient'

interface DecayAnalysis {
  decay_detected: boolean
  recommendation: string
  score: number
}

interface RescanSummary {
  pages_scanned: number
  decay_detected: number
  cwv_updated: number
}

function analyzeDecay(crux: CruxResult): DecayAnalysis {
  let score = 0
  const issues: string[] = []

  if (crux.lcp_p75_ms !== null && crux.lcp_p75_ms > 2500) {
    score += crux.lcp_p75_ms > 4000 ? 40 : 20
    issues.push(`LCP ${crux.lcp_p75_ms}ms exceeds threshold`)
  }
  if (crux.cls_p75 !== null && crux.cls_p75 > 0.1) {
    score += crux.cls_p75 > 0.25 ? 30 : 15
    issues.push(`CLS ${crux.cls_p75} exceeds threshold`)
  }
  if (crux.inp_p75_ms !== null && crux.inp_p75_ms > 200) {
    score += crux.inp_p75_ms > 500 ? 30 : 15
    issues.push(`INP ${crux.inp_p75_ms}ms exceeds threshold`)
  }

  const decay_detected = score >= 20
  const recommendation = issues.length > 0
    ? `Performance decay: ${issues.join('; ')}. Consider content refresh.`
    : 'All CWV metrics within acceptable range.'

  return { decay_detected, recommendation, score }
}

export async function rescanPublishedPages(
  siteId: string,
  agencyId: string
): Promise<RescanSummary> {
  const db = getKotoIQDb(agencyId)
  const apiKey = process.env.GOOGLE_CRUX_API_KEY || process.env.CRUX_API_KEY || ''

  const { data: publishes } = await db.from('kotoiq_publishes')
    .select('id, url, variant_id, metadata')
    .eq('site_id', siteId)
    .not('url', 'is', null)

  const pages = publishes || []
  let decayCount = 0
  let cwvCount = 0

  for (const pub of pages) {
    if (!pub.url) continue

    const crux = await fetchCruxData(pub.url, apiKey)
    if (!crux) continue

    await db.from('kotoiq_cwv_readings').insert({
      publish_id: pub.id,
      lcp_p75_ms: crux.lcp_p75_ms,
      cls_p75: crux.cls_p75,
      inp_p75_ms: crux.inp_p75_ms,
      fcp_p75_ms: crux.fcp_p75_ms,
      ttfb_p75_ms: crux.ttfb_p75_ms,
      source: crux.source,
      device: 'PHONE',
      fetched_at: crux.fetched_at,
    })
    cwvCount++

    const decay = analyzeDecay(crux)
    if (decay.decay_detected) decayCount++

    const existingMeta = (pub.metadata && typeof pub.metadata === 'object') ? pub.metadata : {}
    await db.from('kotoiq_publishes')
      .update({
        metadata: {
          ...existingMeta,
          decay_status: decay.decay_detected ? 'detected' : 'healthy',
          decay_recommendation: decay.recommendation,
          decay_score: decay.score,
          last_rescan_at: new Date().toISOString(),
        },
      })
      .eq('id', pub.id)
  }

  return {
    pages_scanned: pages.length,
    decay_detected: decayCount,
    cwv_updated: cwvCount,
  }
}
