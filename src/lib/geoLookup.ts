import 'server-only'
// ── Universal US geographic lookup ──────────────────────────────────────────
//
// Any part of Koto that needs a list of cities, counties, or ZIP codes calls
// this file — never hardcoded lists anywhere else. Data comes from the US
// Census Bureau API, which is the authoritative source for US geography.
//
// Returned values are wrapped with VerifiedDataSource so downstream code
// (cache layer, API responses, UI badges) can prove where the data came
// from and how old it is.
//
// The only thing hardcoded in this file is STATE_FIPS — the 2-digit federal
// state identifiers. These are a permanent standard (unchanged since 1874)
// and their immutability is the reason they can live in code without
// violating the data integrity standard.

import { createVerifiedData, buildExpiresAt, type VerifiedDataSource } from './dataIntegrity'
import { buildSourceUrl, DATA_SOURCES } from './dataSources'

// State FIPS codes — permanent federal standard, safe to hardcode.
export const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06',
  CO: '08', CT: '09', DE: '10', FL: '12', GA: '13',
  HI: '15', ID: '16', IL: '17', IN: '18', IA: '19',
  KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29',
  MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34',
  NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45',
  SD: '46', TN: '47', TX: '48', UT: '49', VT: '50',
  VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
  DC: '11', PR: '72',
}

// Inverse lookup — FIPS → state abbreviation
export const FIPS_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([abbr, fips]) => [fips, abbr])
)

export function fipsForState(stateAbbr: string): string {
  const fips = STATE_FIPS[stateAbbr.toUpperCase()]
  if (!fips) {
    const valid = Object.keys(STATE_FIPS).sort().join(', ')
    throw new Error(
      `[geoLookup] "${stateAbbr}" is not a valid US state abbreviation. ` +
      `Use a 2-letter code like FL, TX, CA. Valid codes: ${valid}`
    )
  }
  return fips
}

// ── Shared shape for any place the Census API returns ───────────────────────
export interface GeoPlace {
  name: string              // human-readable name ("Coral Gables")
  raw_name: string          // full census label ("Coral Gables city, Florida")
  kind: PlaceKind           // derived from the raw_name suffix
  fips: string              // full FIPS identifier (state + local)
  state: string             // 2-letter state abbreviation
  type: 'state' | 'county' | 'place' | 'zip'
}

export type PlaceKind =
  | 'city'
  | 'town'
  | 'village'
  | 'borough'
  | 'CDP'               // Census Designated Place (unincorporated)
  | 'municipality'      // generic fallback
  | 'unknown'

// Parse the Census "NAME" field into a clean name + place kind.
// Examples of the raw format:
//   "Coral Gables city, Florida"       → name="Coral Gables", kind="city"
//   "Fruit Cove CDP, Florida"          → name="Fruit Cove",   kind="CDP"
//   "Horseshoe Beach town, Florida"    → name="Horseshoe Beach", kind="town"
function parsePlaceLabel(raw: string): { name: string; kind: PlaceKind } {
  const stripped = raw.replace(/,\s*[A-Za-z][^,]*$/, '') // drop ", Florida"
  const match = stripped.match(/^(.+?)\s+(city|town|village|borough|CDP|municipality)$/i)
  if (!match) return { name: stripped, kind: 'unknown' }
  const kind = match[2].toLowerCase() as PlaceKind
  return { name: match[1], kind }
}

// ── Counties ────────────────────────────────────────────────────────────────
export interface CountiesResult extends VerifiedDataSource {
  data: GeoPlace[]
}
export async function getCountiesForState(stateAbbr: string): Promise<CountiesResult> {
  const fips = fipsForState(stateAbbr)
  const url = buildSourceUrl('us_counties', { STATE_FIPS: fips })
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`[geoLookup] Census counties API ${res.status} for ${stateAbbr}`)

  const raw: string[][] = await res.json()
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error(`[geoLookup] Unexpected Census payload shape for counties: ${JSON.stringify(raw).slice(0, 200)}`)
  }
  const headers = raw[0]
  const nameIdx = headers.indexOf('NAME')
  const countyIdx = headers.indexOf('county')

  const counties: GeoPlace[] = raw.slice(1).map((row) => {
    const name = row[nameIdx].replace(/,\s*[A-Za-z][^,]*$/, '').replace(/\s+County$/i, '')
    return {
      name,
      raw_name: row[nameIdx],
      kind: 'municipality',
      fips: fips + row[countyIdx],
      state: stateAbbr.toUpperCase(),
      type: 'county',
    }
  })

  return createVerifiedData(counties, {
    source_url: url,
    source_name: DATA_SOURCES.us_counties.name,
    source_type: 'government-federal',
    fetched_at: new Date().toISOString(),
    expires_at: buildExpiresAt('geo-county'),
    cross_referenced: false,
    ai_generated: false,
    confidence: 'single-source',
  })
}

// ── Places (incorporated + CDPs) ────────────────────────────────────────────
export interface PlacesOptions {
  // If true, drop Census Designated Places (unincorporated) and keep only
  // incorporated cities/towns/villages/boroughs. Default is false — CDPs
  // are real populated areas and should usually be included in searches.
  incorporatedOnly?: boolean
}
export interface PlacesResult extends VerifiedDataSource {
  data: GeoPlace[]
}
export async function getPlacesForState(
  stateAbbr: string,
  opts: PlacesOptions = {}
): Promise<PlacesResult> {
  const fips = fipsForState(stateAbbr)
  const url = buildSourceUrl('us_places', { STATE_FIPS: fips })
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`[geoLookup] Census places API ${res.status} for ${stateAbbr}`)

  const raw: string[][] = await res.json()
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error(`[geoLookup] Unexpected Census payload shape for places: ${JSON.stringify(raw).slice(0, 200)}`)
  }
  const headers = raw[0]
  const nameIdx = headers.indexOf('NAME')
  const placeIdx = headers.indexOf('place')

  let places: GeoPlace[] = raw.slice(1).map((row) => {
    const { name, kind } = parsePlaceLabel(row[nameIdx])
    return {
      name,
      raw_name: row[nameIdx],
      kind,
      fips: fips + row[placeIdx],
      state: stateAbbr.toUpperCase(),
      type: 'place',
    }
  })

  if (opts.incorporatedOnly) {
    places = places.filter((p) => p.kind !== 'CDP')
  }

  return createVerifiedData(places, {
    source_url: url,
    source_name: DATA_SOURCES.us_places.name,
    source_type: 'government-federal',
    fetched_at: new Date().toISOString(),
    expires_at: buildExpiresAt('geo-municipality'),
    cross_referenced: false,
    ai_generated: false,
    confidence: 'single-source',
  })
}

// Backwards-compat alias — the brief calls this getMunicipalitiesForState.
// "Places" is more accurate (includes CDPs by default) so the new canonical
// name uses that, but code that reads like English still makes sense.
export const getMunicipalitiesForState = getPlacesForState

// ── ZIP codes (ZCTAs) ───────────────────────────────────────────────────────
export interface ZipsResult extends VerifiedDataSource {
  data: GeoPlace[]
}
export async function getZipCodesForState(stateAbbr: string): Promise<ZipsResult> {
  const fips = fipsForState(stateAbbr)
  const url = buildSourceUrl('us_zip_codes', { STATE_FIPS: fips })
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`[geoLookup] Census ZCTA API ${res.status} for ${stateAbbr}`)

  const raw: string[][] = await res.json()
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error(`[geoLookup] Unexpected Census payload shape for ZCTAs: ${JSON.stringify(raw).slice(0, 200)}`)
  }
  const headers = raw[0]
  const zctaIdx = headers.indexOf('zip code tabulation area')
  const nameIdx = headers.indexOf('NAME')

  const zips: GeoPlace[] = raw.slice(1).map((row) => ({
    name: row[zctaIdx] || row[nameIdx],
    raw_name: row[nameIdx] || row[zctaIdx],
    kind: 'unknown',
    fips: row[zctaIdx],
    state: stateAbbr.toUpperCase(),
    type: 'zip',
  }))

  return createVerifiedData(zips, {
    source_url: url,
    source_name: DATA_SOURCES.us_zip_codes.name,
    source_type: 'government-federal',
    fetched_at: new Date().toISOString(),
    expires_at: buildExpiresAt('geo-zip'),
    cross_referenced: false,
    ai_generated: false,
    confidence: 'single-source',
  })
}

// ── County-filtered places ──────────────────────────────────────────────────
//
// The Census API does not let you filter places by county in a single call —
// counties and places live in separate hierarchies. The authoritative way to
// do county-level filtering is to cross the Census TIGER/Line shapefiles
// (place centroid → point-in-polygon county). That requires downloading and
// parsing shapefiles, which is heavier than what this module currently does.
//
// For now this helper accepts a list of county NAMES and returns all places
// in the state whose raw_name happens to include the county name — a
// conservative matcher that works for well-known metro markers but is
// unreliable in general. Callers that need strict county filtering should
// treat this as "best effort" and verify results manually.
//
// Uses Census Gazetteer lat/lon + FCC Area API to determine which county
// each place belongs to. This is expensive on first call (~1 FCC request
// per 10 places per second) but cached for 6 months. For a state like
// Florida with ~1000 places, the first call takes ~2 minutes. After that
// the mapping is instant from cache.
//
// If countyNames is empty, returns all places (no filtering).
export async function getPlacesForCounties(
  stateAbbr: string,
  countyNames: string[],
  opts: PlacesOptions = {}
): Promise<PlacesResult> {
  const all = await getPlacesForState(stateAbbr, opts)

  if (!countyNames.length) return all

  // Lazy import to avoid circular dependency
  const { filterPlacesByCounty } = await import('./countyLookup')
  const { filtered } = await filterPlacesByCounty(all.data, stateAbbr, countyNames)

  return {
    ...all,
    confidence: 'cross-referenced',
    data: filtered,
  }
}
