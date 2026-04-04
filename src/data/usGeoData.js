export const US_STATES = [
  { code: 'AL', name: 'Alabama', fips: '01' }, { code: 'AK', name: 'Alaska', fips: '02' },
  { code: 'AZ', name: 'Arizona', fips: '04' }, { code: 'AR', name: 'Arkansas', fips: '05' },
  { code: 'CA', name: 'California', fips: '06' }, { code: 'CO', name: 'Colorado', fips: '08' },
  { code: 'CT', name: 'Connecticut', fips: '09' }, { code: 'DE', name: 'Delaware', fips: '10' },
  { code: 'FL', name: 'Florida', fips: '12' }, { code: 'GA', name: 'Georgia', fips: '13' },
  { code: 'HI', name: 'Hawaii', fips: '15' }, { code: 'ID', name: 'Idaho', fips: '16' },
  { code: 'IL', name: 'Illinois', fips: '17' }, { code: 'IN', name: 'Indiana', fips: '18' },
  { code: 'IA', name: 'Iowa', fips: '19' }, { code: 'KS', name: 'Kansas', fips: '20' },
  { code: 'KY', name: 'Kentucky', fips: '21' }, { code: 'LA', name: 'Louisiana', fips: '22' },
  { code: 'ME', name: 'Maine', fips: '23' }, { code: 'MD', name: 'Maryland', fips: '24' },
  { code: 'MA', name: 'Massachusetts', fips: '25' }, { code: 'MI', name: 'Michigan', fips: '26' },
  { code: 'MN', name: 'Minnesota', fips: '27' }, { code: 'MS', name: 'Mississippi', fips: '28' },
  { code: 'MO', name: 'Missouri', fips: '29' }, { code: 'MT', name: 'Montana', fips: '30' },
  { code: 'NE', name: 'Nebraska', fips: '31' }, { code: 'NV', name: 'Nevada', fips: '32' },
  { code: 'NH', name: 'New Hampshire', fips: '33' }, { code: 'NJ', name: 'New Jersey', fips: '34' },
  { code: 'NM', name: 'New Mexico', fips: '35' }, { code: 'NY', name: 'New York', fips: '36' },
  { code: 'NC', name: 'North Carolina', fips: '37' }, { code: 'ND', name: 'North Dakota', fips: '38' },
  { code: 'OH', name: 'Ohio', fips: '39' }, { code: 'OK', name: 'Oklahoma', fips: '40' },
  { code: 'OR', name: 'Oregon', fips: '41' }, { code: 'PA', name: 'Pennsylvania', fips: '42' },
  { code: 'RI', name: 'Rhode Island', fips: '44' }, { code: 'SC', name: 'South Carolina', fips: '45' },
  { code: 'SD', name: 'South Dakota', fips: '46' }, { code: 'TN', name: 'Tennessee', fips: '47' },
  { code: 'TX', name: 'Texas', fips: '48' }, { code: 'UT', name: 'Utah', fips: '49' },
  { code: 'VT', name: 'Vermont', fips: '50' }, { code: 'VA', name: 'Virginia', fips: '51' },
  { code: 'WA', name: 'Washington', fips: '53' }, { code: 'WV', name: 'West Virginia', fips: '54' },
  { code: 'WI', name: 'Wisconsin', fips: '55' }, { code: 'WY', name: 'Wyoming', fips: '56' },
  { code: 'DC', name: 'Washington DC', fips: '11' },
]

// Fetch counties from US Census Bureau API (free, no key)
export async function fetchCounties(stateFips) {
  try {
    const res = await fetch(`https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`)
    if (!res.ok) return []
    const data = await res.json()
    // First row is headers, rest is data. Format: [["County Name, State Name", "stateFips", "countyFips"]]
    return data.slice(1).map(row => ({
      name: row[0].split(',')[0].replace(' County', '').replace(' Parish', '').replace(' Borough', '').replace(' Census Area', '').trim(),
      fips: row[2],
      stateFips: row[1],
    })).sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

// Fetch cities/places from Census Bureau
export async function fetchCities(stateFips) {
  try {
    const res = await fetch(`https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:${stateFips}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.slice(1).map(row => ({
      name: row[0].split(',')[0].replace(' city', '').replace(' town', '').replace(' village', '').replace(' CDP', '').trim(),
      population: parseInt(row[1]) || 0,
      fips: row[3],
      stateFips: row[2],
    })).filter(c => c.population > 500).sort((a, b) => b.population - a.population)
  } catch { return [] }
}

// Format population for display
export function formatPop(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'K'
  return String(n)
}

// Major metro areas with their counties
export const METRO_AREAS = [
  { id: 'miami', name: 'Miami Metro', states: ['FL'], counties: ['Miami-Dade', 'Broward', 'Palm Beach'], pop: 6100000 },
  { id: 'nyc', name: 'New York Metro', states: ['NY', 'NJ', 'CT'], counties: ['New York', 'Kings', 'Queens', 'Bronx', 'Richmond', 'Nassau', 'Suffolk', 'Westchester', 'Bergen', 'Hudson', 'Essex', 'Passaic', 'Middlesex', 'Fairfield'], pop: 19800000 },
  { id: 'la', name: 'Los Angeles Metro', states: ['CA'], counties: ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'Ventura'], pop: 13200000 },
  { id: 'chicago', name: 'Chicago Metro', states: ['IL', 'IN', 'WI'], counties: ['Cook', 'DuPage', 'Lake', 'Will', 'Kane', 'McHenry'], pop: 9500000 },
  { id: 'dallas', name: 'Dallas-Fort Worth', states: ['TX'], counties: ['Dallas', 'Tarrant', 'Collin', 'Denton', 'Ellis', 'Kaufman', 'Rockwall'], pop: 7600000 },
  { id: 'houston', name: 'Houston Metro', states: ['TX'], counties: ['Harris', 'Fort Bend', 'Montgomery', 'Brazoria', 'Galveston', 'Liberty'], pop: 7100000 },
  { id: 'dc', name: 'Washington DC Metro', states: ['DC', 'VA', 'MD'], counties: ['District of Columbia', 'Arlington', 'Fairfax', 'Prince George\'s', 'Montgomery', 'Loudoun'], pop: 6300000 },
  { id: 'atlanta', name: 'Atlanta Metro', states: ['GA'], counties: ['Fulton', 'DeKalb', 'Gwinnett', 'Cobb', 'Clayton', 'Cherokee'], pop: 6100000 },
  { id: 'phoenix', name: 'Phoenix Metro', states: ['AZ'], counties: ['Maricopa', 'Pinal'], pop: 4900000 },
  { id: 'boston', name: 'Boston Metro', states: ['MA'], counties: ['Suffolk', 'Middlesex', 'Norfolk', 'Essex', 'Plymouth'], pop: 4900000 },
  { id: 'sf', name: 'San Francisco Bay Area', states: ['CA'], counties: ['San Francisco', 'Alameda', 'Santa Clara', 'San Mateo', 'Contra Costa', 'Marin'], pop: 4700000 },
  { id: 'seattle', name: 'Seattle Metro', states: ['WA'], counties: ['King', 'Snohomish', 'Pierce', 'Kitsap'], pop: 4000000 },
  { id: 'tampa', name: 'Tampa Bay Metro', states: ['FL'], counties: ['Hillsborough', 'Pinellas', 'Pasco', 'Hernando'], pop: 3200000 },
  { id: 'denver', name: 'Denver Metro', states: ['CO'], counties: ['Denver', 'Arapahoe', 'Jefferson', 'Adams', 'Douglas', 'Broomfield', 'Boulder'], pop: 2900000 },
  { id: 'orlando', name: 'Orlando Metro', states: ['FL'], counties: ['Orange', 'Seminole', 'Osceola', 'Lake'], pop: 2700000 },
  { id: 'austin', name: 'Austin Metro', states: ['TX'], counties: ['Travis', 'Williamson', 'Hays', 'Bastrop'], pop: 2300000 },
  { id: 'charlotte', name: 'Charlotte Metro', states: ['NC', 'SC'], counties: ['Mecklenburg', 'Union', 'Cabarrus', 'Gaston', 'York', 'Lancaster'], pop: 2700000 },
  { id: 'portland', name: 'Portland Metro', states: ['OR', 'WA'], counties: ['Multnomah', 'Washington', 'Clackamas', 'Clark'], pop: 2500000 },
  { id: 'vegas', name: 'Las Vegas Metro', states: ['NV'], counties: ['Clark'], pop: 2300000 },
  { id: 'detroit', name: 'Detroit Metro', states: ['MI'], counties: ['Wayne', 'Oakland', 'Macomb', 'Washtenaw', 'Livingston'], pop: 4300000 },
]
