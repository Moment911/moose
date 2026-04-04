// ══════════════════════════════════════════════════════════════════════════════
// US Geographic Data — 100% local, no external API calls
// Source: USPS ZIP Code database (42K ZIPs, 30K cities, 3.1K counties, 51 states)
// Per-state JSON files in /public/geo/{state}.json — loaded on demand & cached
// ══════════════════════════════════════════════════════════════════════════════

export const US_STATES = [
  { code:'AL', name:'Alabama',        fips:'01' }, { code:'AK', name:'Alaska',          fips:'02' },
  { code:'AZ', name:'Arizona',        fips:'04' }, { code:'AR', name:'Arkansas',         fips:'05' },
  { code:'CA', name:'California',     fips:'06' }, { code:'CO', name:'Colorado',         fips:'08' },
  { code:'CT', name:'Connecticut',    fips:'09' }, { code:'DE', name:'Delaware',         fips:'10' },
  { code:'FL', name:'Florida',        fips:'12' }, { code:'GA', name:'Georgia',          fips:'13' },
  { code:'HI', name:'Hawaii',         fips:'15' }, { code:'ID', name:'Idaho',            fips:'16' },
  { code:'IL', name:'Illinois',       fips:'17' }, { code:'IN', name:'Indiana',          fips:'18' },
  { code:'IA', name:'Iowa',           fips:'19' }, { code:'KS', name:'Kansas',           fips:'20' },
  { code:'KY', name:'Kentucky',       fips:'21' }, { code:'LA', name:'Louisiana',        fips:'22' },
  { code:'ME', name:'Maine',          fips:'23' }, { code:'MD', name:'Maryland',         fips:'24' },
  { code:'MA', name:'Massachusetts',  fips:'25' }, { code:'MI', name:'Michigan',         fips:'26' },
  { code:'MN', name:'Minnesota',      fips:'27' }, { code:'MS', name:'Mississippi',      fips:'28' },
  { code:'MO', name:'Missouri',       fips:'29' }, { code:'MT', name:'Montana',          fips:'30' },
  { code:'NE', name:'Nebraska',       fips:'31' }, { code:'NV', name:'Nevada',           fips:'32' },
  { code:'NH', name:'New Hampshire',  fips:'33' }, { code:'NJ', name:'New Jersey',       fips:'34' },
  { code:'NM', name:'New Mexico',     fips:'35' }, { code:'NY', name:'New York',         fips:'36' },
  { code:'NC', name:'North Carolina', fips:'37' }, { code:'ND', name:'North Dakota',     fips:'38' },
  { code:'OH', name:'Ohio',           fips:'39' }, { code:'OK', name:'Oklahoma',         fips:'40' },
  { code:'OR', name:'Oregon',         fips:'41' }, { code:'PA', name:'Pennsylvania',     fips:'42' },
  { code:'RI', name:'Rhode Island',   fips:'44' }, { code:'SC', name:'South Carolina',   fips:'45' },
  { code:'SD', name:'South Dakota',   fips:'46' }, { code:'TN', name:'Tennessee',        fips:'47' },
  { code:'TX', name:'Texas',          fips:'48' }, { code:'UT', name:'Utah',             fips:'49' },
  { code:'VT', name:'Vermont',        fips:'50' }, { code:'VA', name:'Virginia',         fips:'51' },
  { code:'WA', name:'Washington',     fips:'53' }, { code:'WV', name:'West Virginia',    fips:'54' },
  { code:'WI', name:'Wisconsin',      fips:'55' }, { code:'WY', name:'Wyoming',          fips:'56' },
  { code:'DC', name:'Washington DC',  fips:'11' },
]

// ── In-memory cache: state code → loaded data ──────────────────────────────
const _cache = {}

/**
 * Load geo data for a state. Returns { counties: string[], cities: CityEntry[] }
 * CityEntry: { n: cityName, c: countyName, z: string[], lat: number, lng: number }
 * Cached after first load — instant on repeat calls.
 */
export async function loadStateGeo(stateCode) {
  const code = stateCode.toUpperCase()
  if (_cache[code]) return _cache[code]
  try {
    const res = await fetch(`/geo/${code.toLowerCase()}.json`)
    if (!res.ok) throw new Error(`No data for ${code}`)
    const data = await res.json()
    _cache[code] = data
    return data
  } catch (e) {
    console.warn(`loadStateGeo(${code}):`, e.message)
    return { counties: [], cities: [] }
  }
}

/** Get all county names for a state */
export async function fetchCounties(stateCode) {
  const data = await loadStateGeo(stateCode)
  return data.counties.map(name => ({ name, stateCode }))
}

/** Get all cities for a state, optionally filtered to specific counties */
export async function fetchCities(stateCode, countyFilter = null) {
  const data = await loadStateGeo(stateCode)
  let cities = data.cities
  if (countyFilter && countyFilter.length > 0) {
    const cf = new Set(countyFilter)
    cities = cities.filter(c => cf.has(c.c))
  }
  return cities.map(c => ({
    name:      c.n,
    county:    c.c,
    stateCode,
    zips:      c.z,
    lat:       c.lat,
    lng:       c.lng,
  }))
}

/** Look up a ZIP code — returns { zip, city, county, state, lat, lng } or null */
export async function lookupZip(zip) {
  const z = String(zip).padStart(5, '0')
  // Try every state (ZIPs are not always predictable by prefix)
  // For speed: use a pre-built ZIP index approach
  // We search state files based on ZIP prefix ranges (rough heuristic)
  const prefixMap = {
    '0': ['CT','MA','ME','NH','NJ','NY','PR','RI','VT'],
    '1': ['DE','NY','PA'],
    '2': ['DC','MD','NC','SC','VA','WV'],
    '3': ['AL','FL','GA','MS','TN'],
    '4': ['IN','KY','MI','OH'],
    '5': ['IA','MN','MT','ND','SD','WI'],
    '6': ['IL','KS','MO','NE'],
    '7': ['AR','LA','OK','TX'],
    '8': ['AZ','CO','ID','NM','NV','UT','WY'],
    '9': ['AK','CA','HI','OR','WA'],
  }
  const candidateStates = prefixMap[z[0]] || US_STATES.map(s => s.code)
  for (const state of candidateStates) {
    const data = await loadStateGeo(state)
    for (const city of data.cities) {
      if (city.z.includes(z)) {
        return { zip: z, city: city.n, county: city.c, state, lat: city.lat, lng: city.lng }
      }
    }
  }
  return null
}

/** Look up multiple ZIPs in parallel */
export async function lookupZips(zips) {
  const results = await Promise.allSettled(zips.map(lookupZip))
  return results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
}

/** Format population number */
export function formatPop(n) {
  if (!n) return ''
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return Math.round(n / 1_000) + 'K'
  return n.toLocaleString()
}

/** US regions */
export const REGIONS = {
  'Northeast': ['CT','DE','ME','MD','MA','NH','NJ','NY','PA','RI','VT','DC'],
  'Southeast': ['AL','AR','FL','GA','KY','LA','MS','NC','SC','TN','VA','WV'],
  'Midwest':   ['IL','IN','IA','KS','MI','MN','MO','NE','ND','OH','SD','WI'],
  'Southwest': ['AZ','NM','OK','TX'],
  'West':      ['AK','CA','CO','HI','ID','MT','NV','OR','UT','WA','WY'],
}

/** Major metro areas */
export const METRO_AREAS = [
  { id:'miami',      name:'Miami Metro',           states:['FL'],           counties:['Miami-Dade','Broward','Palm Beach'],                                    pop:6100000 },
  { id:'nyc',        name:'New York Metro',         states:['NY','NJ'],      counties:['New York','Kings','Queens','Bronx','Richmond','Nassau','Suffolk'],      pop:19800000 },
  { id:'la',         name:'Los Angeles Metro',      states:['CA'],           counties:['Los Angeles','Orange','Riverside','San Bernardino','Ventura'],         pop:13200000 },
  { id:'chicago',    name:'Chicago Metro',          states:['IL','IN'],      counties:['Cook','DuPage','Lake','Will','Kane','McHenry'],                        pop:9500000 },
  { id:'dallas',     name:'Dallas-Fort Worth',      states:['TX'],           counties:['Dallas','Tarrant','Collin','Denton','Ellis'],                          pop:7600000 },
  { id:'houston',    name:'Houston Metro',          states:['TX'],           counties:['Harris','Fort Bend','Montgomery','Brazoria','Galveston'],              pop:7100000 },
  { id:'dc',         name:'Washington DC Metro',    states:['DC','VA','MD'], counties:['District of Columbia','Arlington','Fairfax','Montgomery'],             pop:6300000 },
  { id:'atlanta',    name:'Atlanta Metro',          states:['GA'],           counties:['Fulton','DeKalb','Gwinnett','Cobb','Clayton'],                         pop:6100000 },
  { id:'phoenix',    name:'Phoenix Metro',          states:['AZ'],           counties:['Maricopa','Pinal'],                                                    pop:4900000 },
  { id:'boston',     name:'Boston Metro',           states:['MA'],           counties:['Suffolk','Middlesex','Norfolk','Essex'],                               pop:4900000 },
  { id:'sf',         name:'San Francisco Bay Area', states:['CA'],           counties:['San Francisco','Alameda','Santa Clara','San Mateo','Contra Costa'],    pop:4700000 },
  { id:'seattle',    name:'Seattle Metro',          states:['WA'],           counties:['King','Snohomish','Pierce'],                                           pop:4000000 },
  { id:'tampa',      name:'Tampa Bay Area',         states:['FL'],           counties:['Hillsborough','Pinellas','Pasco','Hernando'],                          pop:3100000 },
  { id:'denver',     name:'Denver Metro',           states:['CO'],           counties:['Denver','Arapahoe','Jefferson','Adams','Douglas'],                     pop:2900000 },
  { id:'orlando',    name:'Orlando Metro',          states:['FL'],           counties:['Orange','Seminole','Osceola','Lake'],                                  pop:2600000 },
  { id:'minneapolis',name:'Minneapolis Metro',      states:['MN'],           counties:['Hennepin','Ramsey','Dakota','Anoka','Washington'],                     pop:3600000 },
  { id:'portland',   name:'Portland Metro',         states:['OR','WA'],      counties:['Multnomah','Washington','Clackamas','Clark'],                          pop:2400000 },
  { id:'charlotte',  name:'Charlotte Metro',        states:['NC','SC'],      counties:['Mecklenburg','Union','Cabarrus','Gaston'],                             pop:2700000 },
  { id:'sandiego',   name:'San Diego Metro',        states:['CA'],           counties:['San Diego'],                                                           pop:3300000 },
  { id:'nashville',  name:'Nashville Metro',        states:['TN'],           counties:['Davidson','Williamson','Rutherford','Wilson','Sumner'],                pop:2100000 },
]
