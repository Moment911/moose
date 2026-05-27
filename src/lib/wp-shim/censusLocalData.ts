import 'server-only'

// ── Per-city Census ACS 5-Year demographic + economic stats ─────────────────
//
// Powers the "{City} by the Numbers" block on topic-campaign deployed pages.
// Reads only from the live Census API — never hardcoded numbers — and surfaces
// the source URL + label so the deployed page can carry an inline citation
// (AI search engines reward citation-attached structured data).
//
// Cached in-memory per (state, vintage) since a typical campaign deploys to
// many cities in one state.

import { fipsForState } from '../geoLookup'

// ACS 5-Year variable codes. The 2022 5-year set covers 2018-2022 and is the
// most recently published vintage as of 2026. Variables are stable across
// vintages (Census policy: pre-existing codes never re-purpose).
const ACS_VINTAGE = '2022'
const ACS_WINDOW = '2018-2022'

const ACS_VARS = {
    population: 'B01003_001E',          // Total population
    medianHouseholdIncome: 'B19013_001E', // Median household income (dollars)
    housingUnits: 'B25001_001E',        // Total housing units
    medianAge: 'B01002_001E',           // Median age (years)
    medianHomeValue: 'B25077_001E',     // Median owner-occupied home value
} as const

interface CensusPlaceRow {
    name: string
    placeFips: string
    population: number | null
    medianHouseholdIncome: number | null
    housingUnits: number | null
    medianAge: number | null
    medianHomeValue: number | null
}

// In-memory cache: stateAbbr → rows. Survives within one Vercel function
// instance which is plenty for a single deploy batch. No TTL because Census
// vintage doesn't change mid-session.
const stateCache = new Map<string, CensusPlaceRow[]>()

/**
 * Pull every place in a state along with the 5 ACS variables we surface.
 * One API call per state per cold start; subsequent calls hit the in-memory
 * cache. Returns [] on failure.
 */
async function loadStateAcsPlaces(stateAbbr: string): Promise<CensusPlaceRow[]> {
    const upper = stateAbbr.toUpperCase()
    const cached = stateCache.get(upper)
    if (cached) return cached

    const stateFips = (() => {
        try {
            return fipsForState(upper)
        } catch {
            return null
        }
    })()
    if (!stateFips) return []

    const key = process.env.CENSUS_API_KEY || ''
    if (!key) return [] // graceful skip — block just won't render

    const vars = Object.values(ACS_VARS).join(',')
    const url =
        `https://api.census.gov/data/${ACS_VINTAGE}/acs/acs5?get=NAME,${vars}` +
        `&for=place:*&in=state:${stateFips}&key=${encodeURIComponent(key)}`

    let raw: any
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
        if (!res.ok) return []
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('json')) return []
        raw = await res.json()
    } catch {
        return []
    }
    if (!Array.isArray(raw) || raw.length < 2) return []

    // Census returns: [header_row, ...data_rows]. Each data row is positional.
    const headers = raw[0] as string[]
    const idxOf = (h: string) => headers.indexOf(h)
    const iName = idxOf('NAME')
    const iPop = idxOf(ACS_VARS.population)
    const iInc = idxOf(ACS_VARS.medianHouseholdIncome)
    const iHou = idxOf(ACS_VARS.housingUnits)
    const iAge = idxOf(ACS_VARS.medianAge)
    const iHom = idxOf(ACS_VARS.medianHomeValue)
    const iState = idxOf('state')
    const iPlace = idxOf('place')

    const rows: CensusPlaceRow[] = []
    for (let i = 1; i < raw.length; i++) {
        const r = raw[i]
        if (!Array.isArray(r)) continue
        const placeFips = `${r[iState] || ''}${r[iPlace] || ''}`
        rows.push({
            name: String(r[iName] || ''),
            placeFips,
            population: asInt(r[iPop]),
            medianHouseholdIncome: asInt(r[iInc]),
            housingUnits: asInt(r[iHou]),
            medianAge: asFloat(r[iAge]),
            medianHomeValue: asInt(r[iHom]),
        })
    }
    stateCache.set(upper, rows)
    return rows
}

function asInt(v: any): number | null {
    if (v == null || v === '') return null
    const n = Number(v)
    // Census uses negative sentinel values (-666666666 etc.) for "not
    // available". Treat any negative income/population as missing.
    if (!Number.isFinite(n) || n < 0) return null
    return Math.round(n)
}

function asFloat(v: any): number | null {
    if (v == null || v === '') return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return null
    return n
}

/**
 * Find a place in the state list by matching the human-readable city name.
 * Census labels look like "Apalachicola city, Florida" — we strip the suffix
 * ("city" / "town" / "CDP") for comparison.
 */
function findPlace(rows: CensusPlaceRow[], city: string): CensusPlaceRow | null {
    const target = normalizeCity(city)
    if (!target) return null
    // Prefer exact match; fall back to startsWith for cases where Census has
    // additional disambiguation like "Augusta-Richmond County consolidated
    // government (balance), Georgia".
    for (const r of rows) {
        const stripped = r.name.replace(/,\s*[A-Za-z][^,]*$/, '') // drop state
        const cleaned = normalizeCity(stripped.replace(/\s+(city|town|village|borough|CDP|municipality)$/i, ''))
        if (cleaned === target) return r
    }
    for (const r of rows) {
        const stripped = r.name.replace(/,\s*[A-Za-z][^,]*$/, '')
        const cleaned = normalizeCity(stripped.replace(/\s+(city|town|village|borough|CDP|municipality)$/i, ''))
        if (cleaned.startsWith(target)) return r
    }
    return null
}

function normalizeCity(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

export interface LocalDataPayload {
    sourceLabel: string
    sourceUrl: string
    fetchedAt: string
    items: Array<{ label: string; value: string }>
}

/**
 * Public API — return formatted local-data items for a (city, state) pair,
 * or null if we can't find authoritative data. Caller should treat null
 * as "skip the block, don't show fake numbers".
 */
export async function fetchCityLocalData(city: string, stateAbbr: string): Promise<LocalDataPayload | null> {
    if (!city || !stateAbbr) return null
    const rows = await loadStateAcsPlaces(stateAbbr)
    if (rows.length === 0) return null
    const match = findPlace(rows, city)
    if (!match) return null

    // Format items — verbatim values, no rounding/approximation. AI engines
    // and human readers both benefit from precise numbers tied to a source.
    const items: Array<{ label: string; value: string }> = []
    if (match.population != null) items.push({ label: 'Population', value: match.population.toLocaleString() })
    if (match.medianHouseholdIncome != null) items.push({ label: 'Median household income', value: '$' + match.medianHouseholdIncome.toLocaleString() })
    if (match.housingUnits != null) items.push({ label: 'Housing units', value: match.housingUnits.toLocaleString() })
    if (match.medianAge != null) items.push({ label: 'Median age', value: match.medianAge.toFixed(1) })
    if (match.medianHomeValue != null) items.push({ label: 'Median home value', value: '$' + match.medianHomeValue.toLocaleString() })

    if (items.length === 0) return null

    // Build the citation URL — points at data.census.gov's place page so
    // readers (human or AI) can verify every number. data.census.gov uses
    // the format /profile?g=160XX00US{stateFips}{placeFips} for places.
    const sourceUrl = match.placeFips
        ? `https://data.census.gov/profile?g=160XX00US${match.placeFips}`
        : 'https://data.census.gov/'

    return {
        sourceLabel: `US Census Bureau ACS 5-Year Estimates (${ACS_WINDOW})`,
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        items,
    }
}
