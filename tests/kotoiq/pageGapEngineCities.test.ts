import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 / Plan 04 — pageGapEngine explicit cities[] scoping (WS4).
//
// analyzePageGaps gains an optional `cities[]` input so the user-chosen cities
// scope competitor discovery. The city-selection step is extracted into the
// pure helper `selectCitiesToCheck` so it's unit-testable without DB/network.
//
// Data-integrity guarantee (T-11-11): the explicit names only ever FILTER the
// Census-loaded set — an unknown name is dropped, never invented.
// ─────────────────────────────────────────────────────────────────────────────

import { selectCitiesToCheck } from '../../src/lib/builder/pageGapEngine'

// Fixture: a small Census-shaped city list (as loadCities() would return).
const CENSUS_CITIES = [
  { name: 'Austin', county: 'Travis', state: 'TX', zips: ['78701'] },
  { name: 'Dallas', county: 'Dallas', state: 'TX', zips: ['75201'] },
  { name: 'Houston', county: 'Harris', state: 'TX', zips: ['77002'] },
  { name: 'San Antonio', county: 'Bexar', state: 'TX', zips: ['78205'] },
]

describe('selectCitiesToCheck — explicit cities[] scoping', () => {
  it('(1) retains only the named cities when cities[] is provided', () => {
    const result = selectCitiesToCheck(CENSUS_CITIES, { cities: ['Austin', 'Dallas'] })
    expect(result.map(c => c.name).sort()).toEqual(['Austin', 'Dallas'])
  })

  it('matches city names case-insensitively', () => {
    const result = selectCitiesToCheck(CENSUS_CITIES, { cities: ['austin', 'DALLAS'] })
    expect(result.map(c => c.name).sort()).toEqual(['Austin', 'Dallas'])
  })

  it('(2) falls back to slice(0, cityLimit) when cities[] is absent', () => {
    const result = selectCitiesToCheck(CENSUS_CITIES, { cityLimit: 2 })
    expect(result.map(c => c.name)).toEqual(['Austin', 'Dallas'])
    expect(result.length).toBe(2)
  })

  it('falls back to slice when cities[] is an empty array (back-compat)', () => {
    const result = selectCitiesToCheck(CENSUS_CITIES, { cities: [], cityLimit: 3 })
    expect(result.map(c => c.name)).toEqual(['Austin', 'Dallas', 'Houston'])
  })

  it('(3) drops a name not in the Census list — never fabricates a city', () => {
    const result = selectCitiesToCheck(CENSUS_CITIES, { cities: ['Austin', 'Atlantis'] })
    expect(result.map(c => c.name)).toEqual(['Austin'])
    // Atlantis is not in the loaded Census set → it must NOT appear.
    expect(result.find(c => c.name === 'Atlantis')).toBeUndefined()
  })

  it('returns an empty list when every named city is unknown (nothing invented)', () => {
    const result = selectCitiesToCheck(CENSUS_CITIES, { cities: ['Atlantis', 'El Dorado'] })
    expect(result).toEqual([])
  })

  it('preserves the original GeoCity objects (county/zips intact) for matched cities', () => {
    const [austin] = selectCitiesToCheck(CENSUS_CITIES, { cities: ['Austin'] })
    expect(austin.county).toBe('Travis')
    expect(austin.zips).toEqual(['78701'])
  })
})
