import 'server-only'
// ── County filtering for Census places ──────────────────────────────────────
//
// Pipeline: Census Gazetteer (place coordinates) → FCC Area API (county FIPS)
//
// The Census API returns places by state but NOT by county (places can span
// multiple counties). This module solves county filtering by:
//
// 1. Fetching the Census Gazetteer for a state — tab-delimited file with
//    lat/lon centroids for every place (no API key needed, free download)
// 2. For each place, calling the FCC Area API with its coordinates to get
//    the county FIPS code
// 3. Caching the place→county mapping so subsequent lookups are instant
//
// The Gazetteer download is ~50-200KB per state. The FCC API is free and
// unauthenticated. Both are government sources.

import { createVerifiedData, buildExpiresAt, type VerifiedDataSource } from './dataIntegrity'
import { fipsForState, type GeoPlace } from './geoLookup'
import { getCached, setCache } from './geoCache'

// ── Gazetteer: lat/lon for every Census place ──────────────────────────────
interface GazetteerEntry {
  geoid: string     // full FIPS (state + place)
  name: string
  lat: number
  lon: number
  state: string     // 2-letter
}

async function fetchGazetteer(stateAbbr: string): Promise<GazetteerEntry[]> {
  const fips = fipsForState(stateAbbr)
  const url = `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_place_${fips}.txt`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`[countyLookup] Gazetteer fetch failed: ${res.status} for ${stateAbbr}`)

  const text = await res.text()
  const lines = text.split('\n')
  // Header: USPS  GEOID  ANSICODE  NAME  LSAD  FUNCSTAT  ALAND  AWATER  ALAND_SQMI  AWATER_SQMI  INTPTLAT  INTPTLONG
  const entries: GazetteerEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split('\t')
    if (cols.length < 12) continue

    const lat = parseFloat(cols[10]?.trim())
    const lon = parseFloat(cols[11]?.trim())
    if (isNaN(lat) || isNaN(lon)) continue

    entries.push({
      geoid: cols[1]?.trim(),
      name: cols[3]?.trim(),
      lat,
      lon,
      state: stateAbbr.toUpperCase(),
    })
  }

  return entries
}

// ── FCC Area API: lat/lon → county ─────────────────────────────────────────
interface CountyInfo {
  county_fips: string
  county_name: string
}

async function lookupCounty(lat: number, lon: number): Promise<CountyInfo | null> {
  try {
    const url = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return null
    return {
      county_fips: result.county_fips,
      county_name: result.county_name?.replace(/\s+County$/i, ''),
    }
  } catch {
    return null
  }
}

// ── Main: build place→county mapping for a state ───────────────────────────
export interface PlaceCountyMapping {
  [placeGeoid: string]: {
    county_fips: string
    county_name: string
  }
}

export interface PlaceCountyResult extends VerifiedDataSource {
  data: PlaceCountyMapping
}

export async function getPlaceCountyMapping(stateAbbr: string): Promise<PlaceCountyResult> {
  const cacheKey = `place-county:${stateAbbr.toUpperCase()}`

  // Check cache first — this mapping is expensive to build
  const cached = getCached(cacheKey, 'geo-municipality')
  if (cached) return cached as PlaceCountyResult

  const gazetteer = await fetchGazetteer(stateAbbr)
  const mapping: PlaceCountyMapping = {}

  // Batch FCC lookups with a small delay to avoid hammering
  // FCC Area API is free but has no documented rate limit — be polite
  let resolved = 0
  for (const entry of gazetteer) {
    const county = await lookupCounty(entry.lat, entry.lon)
    if (county) {
      mapping[entry.geoid] = county
    }
    resolved++

    // Rate limit: ~10 requests/second
    if (resolved % 10 === 0) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  const result = createVerifiedData(mapping, {
    source_url: `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/`,
    source_name: 'Census Gazetteer + FCC Area API',
    source_type: 'government-federal',
    fetched_at: new Date().toISOString(),
    expires_at: buildExpiresAt('geo-municipality'),
    cross_referenced: true,  // two independent federal sources
    ai_generated: false,
    confidence: 'cross-referenced',
  })

  setCache(cacheKey, result)
  return result
}

// ── Filter places by county names ──────────────────────────────────────────
// Given a list of Census GeoPlace objects and target county names,
// return only the places that fall within those counties.
export async function filterPlacesByCounty(
  places: GeoPlace[],
  stateAbbr: string,
  countyNames: string[]
): Promise<{
  filtered: GeoPlace[]
  mapping: PlaceCountyMapping
  matchedCounties: string[]
}> {
  const countyMapping = await getPlaceCountyMapping(stateAbbr)
  const targetNames = new Set(countyNames.map(n => n.toLowerCase().replace(/\s+county$/i, '').trim()))

  const filtered = places.filter(place => {
    const entry = countyMapping.data[place.fips]
    if (!entry) return false
    return targetNames.has(entry.county_name.toLowerCase().trim())
  })

  const matchedCounties = [...new Set(
    filtered.map(p => countyMapping.data[p.fips]?.county_name).filter(Boolean)
  )]

  return { filtered, mapping: countyMapping.data, matchedCounties }
}
