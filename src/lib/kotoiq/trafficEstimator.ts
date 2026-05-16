// ─────────────────────────────────────────────────────────────
// Traffic Estimator — Phase I
//
// Free, transparent organic-traffic estimate for any domain.
// Method: for each keyword the domain ranks for, multiply the
// keyword's monthly search volume by the standard CTR for the
// current ranking position. Sum across all keywords.
//
// Source for the data: DataForSEO (already wired). Source for
// the CTR curve: Advanced Web Ranking 2023 organic CTR study.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import { getDomainRankedKeywords } from '@/lib/dataforseo'

// Standard CTR curve (desktop organic). Position 1 = ~39.8%.
const CTR_CURVE: number[] = [
  // index = position - 1
  0.398, 0.187, 0.102, 0.072, 0.051,
  0.044, 0.030, 0.021, 0.019, 0.016,
  0.012, 0.010, 0.009, 0.008, 0.007,
  0.006, 0.005, 0.005, 0.005, 0.005,
]
const TAIL_CTR = 0.003   // anything past position 20

function ctrForPosition(pos: number): number {
  if (!pos || pos < 1) return 0
  if (pos > CTR_CURVE.length) return TAIL_CTR
  return CTR_CURVE[pos - 1]
}

export interface TrafficEstimate {
  domain: string
  monthly_traffic_est: number
  ranked_keywords: number
  top_3_keywords: number          // count of keywords ranking in top 3
  top_10_keywords: number
  source: 'dataforseo'
  computed_at: string
}

/**
 * Estimate monthly organic search traffic for a domain.
 * Uses DataForSEO ranked-keywords endpoint + standard CTR curve.
 */
export async function estimateDomainTraffic(domain: string): Promise<TrafficEstimate> {
  const clean = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const empty: TrafficEstimate = {
    domain: clean,
    monthly_traffic_est: 0,
    ranked_keywords: 0,
    top_3_keywords: 0,
    top_10_keywords: 0,
    source: 'dataforseo',
    computed_at: new Date().toISOString(),
  }
  if (!clean) return empty

  try {
    const result = await getDomainRankedKeywords(clean, 'United States', 1000)
    const ranked = result?.keywords || []
    if (!ranked.length) return empty

    let traffic = 0
    let top3 = 0
    let top10 = 0
    for (const kw of ranked) {
      const pos = (kw as any).rank_absolute || (kw as any).rank_group || (kw as any).position || 0
      const vol = (kw as any).search_volume || 0
      if (pos > 0 && pos <= 3) top3 += 1
      if (pos > 0 && pos <= 10) top10 += 1
      traffic += vol * ctrForPosition(pos)
    }

    return {
      ...empty,
      monthly_traffic_est: Math.round(traffic),
      ranked_keywords: result?.total ?? ranked.length,
      top_3_keywords: top3,
      top_10_keywords: top10,
    }
  } catch {
    return empty
  }
}

/**
 * Bulk estimate for multiple domains. Used by route action so we
 * can show "you vs N competitors" on a single dashboard cell.
 */
export async function estimateTrafficForDomains(domains: string[]): Promise<TrafficEstimate[]> {
  const out: TrafficEstimate[] = []
  for (const d of domains.slice(0, 20)) {     // safety cap
    out.push(await estimateDomainTraffic(d))
  }
  return out
}
