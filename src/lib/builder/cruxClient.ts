import 'server-only'

/**
 * CrUX API Client (ATTR-01)
 *
 * Fetches Chrome UX Report field data for a given URL.
 * Falls back to origin-level data when URL has insufficient traffic.
 * All results carry source_url + fetched_at per the VerifiedDataSource standard.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface CruxMetrics {
  lcp_p75_ms: number | null
  cls_p75: number | null
  inp_p75_ms: number | null
  fcp_p75_ms: number | null
  ttfb_p75_ms: number | null
}

export interface CruxResult extends CruxMetrics {
  source: 'crux_url' | 'crux_origin'
  raw: Record<string, any>
  source_url: string
  fetched_at: string
}

type DeviceType = 'PHONE' | 'DESKTOP' | 'TABLET'

const CRUX_API = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord'

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractP75(metric: any): number | null {
  if (!metric?.percentiles?.p75) return null
  const val = metric.percentiles.p75
  // CLS is reported as a decimal, everything else as ms integers
  return typeof val === 'number' ? val : null
}

function parseMetrics(record: any): CruxMetrics {
  const m = record?.metrics ?? {}
  return {
    lcp_p75_ms: extractP75(m.largest_contentful_paint),
    cls_p75: extractP75(m.cumulative_layout_shift),
    inp_p75_ms: extractP75(m.interaction_to_next_paint),
    fcp_p75_ms: extractP75(m.first_contentful_paint),
    ttfb_p75_ms: extractP75(m.experimental_time_to_first_byte),
  }
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Fetch CrUX field data for a URL, with origin fallback.
 *
 * @param url      Full page URL to query
 * @param apiKey   Google CrUX API key
 * @param device   Optional device filter (default: PHONE — mobile-first)
 * @returns CruxResult with provenance metadata, or null if no data available
 */
export async function fetchCruxData(
  url: string,
  apiKey: string,
  device: DeviceType = 'PHONE'
): Promise<CruxResult | null> {
  const endpoint = `${CRUX_API}?key=${apiKey}`
  const fetchedAt = new Date().toISOString()

  // Attempt 1: URL-level data
  const urlResult = await queryCrux(endpoint, { url, formFactor: device })
  if (urlResult?.record) {
    return {
      ...parseMetrics(urlResult.record),
      source: 'crux_url',
      raw: urlResult,
      source_url: endpoint,
      fetched_at: fetchedAt,
    }
  }

  // Attempt 2: Origin-level fallback
  const origin = new URL(url).origin
  const originResult = await queryCrux(endpoint, { origin, formFactor: device })
  if (originResult?.record) {
    return {
      ...parseMetrics(originResult.record),
      source: 'crux_origin',
      raw: originResult,
      source_url: endpoint,
      fetched_at: fetchedAt,
    }
  }

  return null
}

async function queryCrux(
  endpoint: string,
  body: Record<string, string>
): Promise<any | null> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      // 404 = no data for this URL/origin — not an error
      if (res.status === 404) return null
      console.error(`[cruxClient] CrUX API ${res.status}: ${await res.text()}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.error('[cruxClient] CrUX fetch error:', err)
    return null
  }
}
