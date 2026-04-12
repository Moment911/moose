import 'server-only'
// ── Industry classification lookups ─────────────────────────────────────────
//
// NAICS codes from the US Census Bureau Economic Census (2017 edition,
// which is the latest with a working REST endpoint as of April 2026).
//
// The endpoint returns 2,111 unique NAICS codes from 2-digit sectors down
// to 6-digit individual industries, each with an official label.
//
// Verified working: 2026-04-12
// curl "https://api.census.gov/data/2017/ecnbasic?get=NAICS2017_LABEL,NAICS2017&for=us:*&NAICS2017=*"

import { createVerifiedData, buildExpiresAt, type VerifiedDataSource } from './dataIntegrity'
import { getOrFetch } from './geoCache'

const NAICS_API_URL = 'https://api.census.gov/data/2017/ecnbasic?get=NAICS2017_LABEL,NAICS2017&for=us:*&NAICS2017=*'

export interface NAICSCode {
  code: string
  label: string
  level: number   // 2=sector, 3=subsector, 4=industry group, 5=industry, 6=national industry
}

export interface NAICSResult extends VerifiedDataSource {
  data: NAICSCode[]
}

export async function getNAICSCodes(): Promise<NAICSResult> {
  return getOrFetch('industry:naics', 'industry-naics', async () => {
    const res = await fetch(NAICS_API_URL, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`[industrySources] Census Economic Census API ${res.status}`)

    const raw: string[][] = await res.json()
    // Dedupe — the API can return the same code multiple times
    const seen = new Set<string>()
    const codes: NAICSCode[] = []

    for (let i = 1; i < raw.length; i++) {
      const label = raw[i][0]
      const code = raw[i][1]
      if (!code || seen.has(code)) continue
      seen.add(code)
      codes.push({
        code,
        label,
        level: code.length,
      })
    }

    codes.sort((a, b) => a.code.localeCompare(b.code))

    return createVerifiedData(codes, {
      source_url: NAICS_API_URL,
      source_name: 'US Census Bureau — Economic Census NAICS 2017',
      source_type: 'government-federal',
      fetched_at: new Date().toISOString(),
      expires_at: buildExpiresAt('industry-naics'),
      cross_referenced: false,
      ai_generated: false,
      confidence: 'single-source',
    })
  })
}

// Search NAICS codes by keyword — useful for Scout query parsing
export async function searchNAICS(keyword: string, maxResults = 20): Promise<NAICSCode[]> {
  const all = await getNAICSCodes()
  const lower = keyword.toLowerCase()
  return all.data
    .filter(c => c.label.toLowerCase().includes(lower))
    .slice(0, maxResults)
}

// Look up a specific NAICS code
export async function lookupNAICS(code: string): Promise<NAICSCode | null> {
  const all = await getNAICSCodes()
  return all.data.find(c => c.code === code) || null
}
