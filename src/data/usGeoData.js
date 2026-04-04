// ── US Geographic Data ─────────────────────────────────────────────────────────
// Uses US Census Bureau API (free, no key, CORS-enabled)

export const US_STATES = [
  { code:'AL', name:'Alabama',            fips:'01' }, { code:'AK', name:'Alaska',             fips:'02' },
  { code:'AZ', name:'Arizona',            fips:'04' }, { code:'AR', name:'Arkansas',            fips:'05' },
  { code:'CA', name:'California',         fips:'06' }, { code:'CO', name:'Colorado',            fips:'08' },
  { code:'CT', name:'Connecticut',        fips:'09' }, { code:'DE', name:'Delaware',            fips:'10' },
  { code:'FL', name:'Florida',            fips:'12' }, { code:'GA', name:'Georgia',             fips:'13' },
  { code:'HI', name:'Hawaii',             fips:'15' }, { code:'ID', name:'Idaho',               fips:'16' },
  { code:'IL', name:'Illinois',           fips:'17' }, { code:'IN', name:'Indiana',             fips:'18' },
  { code:'IA', name:'Iowa',               fips:'19' }, { code:'KS', name:'Kansas',              fips:'20' },
  { code:'KY', name:'Kentucky',           fips:'21' }, { code:'LA', name:'Louisiana',           fips:'22' },
  { code:'ME', name:'Maine',              fips:'23' }, { code:'MD', name:'Maryland',            fips:'24' },
  { code:'MA', name:'Massachusetts',      fips:'25' }, { code:'MI', name:'Michigan',            fips:'26' },
  { code:'MN', name:'Minnesota',          fips:'27' }, { code:'MS', name:'Mississippi',         fips:'28' },
  { code:'MO', name:'Missouri',           fips:'29' }, { code:'MT', name:'Montana',             fips:'30' },
  { code:'NE', name:'Nebraska',           fips:'31' }, { code:'NV', name:'Nevada',              fips:'32' },
  { code:'NH', name:'New Hampshire',      fips:'33' }, { code:'NJ', name:'New Jersey',          fips:'34' },
  { code:'NM', name:'New Mexico',         fips:'35' }, { code:'NY', name:'New York',            fips:'36' },
  { code:'NC', name:'North Carolina',     fips:'37' }, { code:'ND', name:'North Dakota',        fips:'38' },
  { code:'OH', name:'Ohio',               fips:'39' }, { code:'OK', name:'Oklahoma',            fips:'40' },
  { code:'OR', name:'Oregon',             fips:'41' }, { code:'PA', name:'Pennsylvania',        fips:'42' },
  { code:'RI', name:'Rhode Island',       fips:'44' }, { code:'SC', name:'South Carolina',      fips:'45' },
  { code:'SD', name:'South Dakota',       fips:'46' }, { code:'TN', name:'Tennessee',           fips:'47' },
  { code:'TX', name:'Texas',              fips:'48' }, { code:'UT', name:'Utah',                fips:'49' },
  { code:'VT', name:'Vermont',            fips:'50' }, { code:'VA', name:'Virginia',            fips:'51' },
  { code:'WA', name:'Washington',         fips:'53' }, { code:'WV', name:'West Virginia',       fips:'54' },
  { code:'WI', name:'Wisconsin',          fips:'55' }, { code:'WY', name:'Wyoming',             fips:'56' },
  { code:'DC', name:'Washington DC',      fips:'11' },
]

// Cache to avoid re-fetching
const _countyCache = {}
const _cityCache   = {}

// ── Fetch ALL counties for a state ────────────────────────────────────────────
export async function fetchCounties(stateFips) {
  if (_countyCache[stateFips]) return _countyCache[stateFips]
  try {
    const res = await fetch(
      `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`
    )
    if (!res.ok) throw new Error('Census API failed')
    const data = await res.json()
    // Row format: ["County Name, State Name", "stateFips", "countyFips"]
    const counties = data.slice(1).map(row => ({
      name: row[0]
        .split(',')[0]
        .replace(/ County$/i, '').replace(/ Parish$/i, '')
        .replace(/ Borough$/i, '').replace(/ Census Area$/i, '')
        .replace(/ Municipality$/i, '').trim(),
      fips:      row[2],
      stateFips: row[1],
    })).sort((a, b) => a.name.localeCompare(b.name))

    _countyCache[stateFips] = counties
    return counties
  } catch (e) {
    console.warn('fetchCounties failed:', e.message)
    return []
  }
}

// ── Fetch ALL cities/places for a state ───────────────────────────────────────
// Uses ACS 5-Year for richer population data and more complete place list
export async function fetchCities(stateFips) {
  if (_cityCache[stateFips]) return _cityCache[stateFips]
  try {
    // ACS 5-year 2022 — has population for all incorporated places + CDPs
    const res = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=NAME,B01001_001E&for=place:*&in=state:${stateFips}`
    )
    if (!res.ok) throw new Error('ACS API failed')
    const data = await res.json()
    // Row: ["City Name, State", population, stateFips, placeFips]
    const cities = data.slice(1)
      .map(row => ({
        name: row[0].split(',')[0]
          .replace(/ city$/i, '').replace(/ town$/i, '').replace(/ village$/i, '')
          .replace(/ CDP$/i, '').replace(/ borough$/i, '').replace(/ municipality$/i, '')
          .replace(/ township$/i, '').trim(),
        population: parseInt(row[1]) || 0,
        fips:       row[3],
        stateFips:  row[2],
      }))
      .filter(c => c.population >= 100) // include small towns down to 100 pop
      .sort((a, b) => b.population - a.population) // largest first

    _cityCache[stateFips] = cities
    return cities
  } catch (e) {
    console.warn('fetchCities ACS failed, trying dec/pl:', e.message)
    // Fallback to 2020 decennial
    try {
      const res2 = await fetch(
        `https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:${stateFips}`
      )
      if (!res2.ok) return []
      const data2 = await res2.json()
      const cities2 = data2.slice(1)
        .map(row => ({
          name: row[0].split(',')[0]
            .replace(/ city$/i, '').replace(/ town$/i, '').replace(/ village$/i, '')
            .replace(/ CDP$/i, '').trim(),
          population: parseInt(row[1]) || 0,
          fips: row[3],
          stateFips: row[2],
        }))
        .filter(c => c.population >= 100)
        .sort((a, b) => b.population - a.population)
      _cityCache[stateFips] = cities2
      return cities2
    } catch { return [] }
  }
}

// ── ZIP code lookup via Zippopotam.us (free, no auth) ─────────────────────────
export async function lookupZip(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    return {
      zip: data['post code'],
      city: data.places[0]['place name'],
      state: data.places[0]['state abbreviation'],
      lat: parseFloat(data.places[0].latitude),
      lng: parseFloat(data.places[0].longitude),
    }
  } catch { return null }
}

// ── Validate and expand a list of ZIP codes ───────────────────────────────────
export async function validateZips(zips) {
  const results = await Promise.allSettled(zips.map(lookupZip))
  return results
    .map((r, i) => r.status === 'fulfilled' && r.value ? r.value : null)
    .filter(Boolean)
}

export function formatPop(n) {
  if (!n) return ''
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return Math.round(n / 1000) + 'K'
  return n.toLocaleString()
}

// ── US Regions ────────────────────────────────────────────────────────────────
export const REGIONS = {
  'Northeast': ['CT','DE','ME','MD','MA','NH','NJ','NY','PA','RI','VT','DC'],
  'Southeast': ['AL','AR','FL','GA','KY','LA','MS','NC','SC','TN','VA','WV'],
  'Midwest':   ['IL','IN','IA','KS','MI','MN','MO','NE','ND','OH','SD','WI'],
  'Southwest': ['AZ','NM','OK','TX'],
  'West':      ['AK','CA','CO','HI','ID','MT','NV','OR','UT','WA','WY'],
}

// ── Major metro areas ─────────────────────────────────────────────────────────
export const METRO_AREAS = [
  { id:'miami',   name:'Miami Metro',           states:['FL'],           counties:['Miami-Dade','Broward','Palm Beach'],                                                                       pop:6100000 },
  { id:'nyc',     name:'New York Metro',         states:['NY','NJ','CT'], counties:['New York','Kings','Queens','Bronx','Richmond','Nassau','Suffolk','Westchester','Bergen','Hudson','Essex'], pop:19800000 },
  { id:'la',      name:'Los Angeles Metro',      states:['CA'],           counties:['Los Angeles','Orange','Riverside','San Bernardino','Ventura'],                                            pop:13200000 },
  { id:'chicago', name:'Chicago Metro',          states:['IL','IN'],      counties:['Cook','DuPage','Lake','Will','Kane','McHenry'],                                                           pop:9500000 },
  { id:'dallas',  name:'Dallas-Fort Worth',      states:['TX'],           counties:['Dallas','Tarrant','Collin','Denton','Ellis'],                                                             pop:7600000 },
  { id:'houston', name:'Houston Metro',          states:['TX'],           counties:['Harris','Fort Bend','Montgomery','Brazoria','Galveston'],                                                 pop:7100000 },
  { id:'dc',      name:'Washington DC Metro',    states:['DC','VA','MD'], counties:['District of Columbia','Arlington','Fairfax','Montgomery'],                                                pop:6300000 },
  { id:'atlanta', name:'Atlanta Metro',          states:['GA'],           counties:['Fulton','DeKalb','Gwinnett','Cobb','Clayton'],                                                            pop:6100000 },
  { id:'phoenix', name:'Phoenix Metro',          states:['AZ'],           counties:['Maricopa','Pinal'],                                                                                      pop:4900000 },
  { id:'boston',  name:'Boston Metro',           states:['MA'],           counties:['Suffolk','Middlesex','Norfolk','Essex'],                                                                  pop:4900000 },
  { id:'sf',      name:'San Francisco Bay Area', states:['CA'],           counties:['San Francisco','Alameda','Santa Clara','San Mateo','Contra Costa'],                                       pop:4700000 },
  { id:'seattle', name:'Seattle Metro',          states:['WA'],           counties:['King','Snohomish','Pierce'],                                                                             pop:4000000 },
  { id:'tampa',   name:'Tampa Bay Area',         states:['FL'],           counties:['Hillsborough','Pinellas','Pasco','Hernando'],                                                             pop:3100000 },
  { id:'denver',  name:'Denver Metro',           states:['CO'],           counties:['Denver','Arapahoe','Jefferson','Adams','Douglas','Broomfield'],                                           pop:2900000 },
  { id:'orlando', name:'Orlando Metro',          states:['FL'],           counties:['Orange','Seminole','Osceola','Lake'],                                                                    pop:2600000 },
  { id:'minneapolis', name:'Minneapolis Metro',  states:['MN'],           counties:['Hennepin','Ramsey','Dakota','Anoka','Washington'],                                                        pop:3600000 },
  { id:'portland', name:'Portland Metro',        states:['OR','WA'],      counties:['Multnomah','Washington','Clackamas','Clark'],                                                             pop:2400000 },
  { id:'charlotte', name:'Charlotte Metro',      states:['NC','SC'],      counties:['Mecklenburg','Union','Cabarrus','Gaston','Iredell'],                                                      pop:2700000 },
]
