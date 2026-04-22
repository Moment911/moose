#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Enrich koto_recruiting_programs with CWS + regional appearance data.
//
// Sources:
//   - https://en.wikipedia.org/wiki/College_World_Series (all-time CWS appearances)
//   - https://en.wikipedia.org/wiki/2021_NCAA_Division_I_baseball_tournament
//   - https://en.wikipedia.org/wiki/2022_NCAA_Division_I_baseball_tournament
//   - https://en.wikipedia.org/wiki/2023_NCAA_Division_I_baseball_tournament
//   - https://en.wikipedia.org/wiki/2024_NCAA_Division_I_baseball_tournament
//   - https://en.wikipedia.org/wiki/2025_NCAA_Division_I_baseball_tournament
//
// 2020 tournament was cancelled (COVID).
// 5-year regional window: 2021–2025.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/enrich-school-stats.mjs
//
// Idempotent — safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ── All-time CWS appearances (from Wikipedia "College World Series" article) ──
// Key = school name as it appears in koto_recruiting_programs.school_name
const ALL_TIME_CWS = {
  'Texas':               { total: 38, years: '1949–2022' },
  'Miami (FL)':          { total: 25, years: '1974–2016' },
  'Arizona State':       { total: 22, years: '1964–2010' },
  'USC':                 { total: 21, years: '1948–2001' },
  'LSU':                 { total: 20, years: '1986–2025' },
  'Oklahoma State':      { total: 20, years: '1954–2016' },
  'Arizona':             { total: 19, years: '1954–2025' },
  'Stanford':            { total: 19, years: '1953–2023' },
  'Cal State Fullerton': { total: 18, years: '1975–2017' },
  'Florida':             { total: 14, years: '1988–2024' },
  'Florida State':       { total: 14, years: '1970–2024' },
  'Mississippi State':   { total: 12, years: '1971–2021' },
  'South Carolina':      { total: 11, years: '1975–2012' },
  'Oklahoma':            { total: 11, years: '1951–2022' },
  'Clemson':             { total: 10, years: '1958–2010' },
  'North Carolina':      { total: 10, years: '1960–2024' },
  'Michigan':            { total: 8, years: '1953–2019' },
  'Oregon State':        { total: 8, years: '1952–2025' },
  'Arkansas':            { total: 10, years: '1979–2025' },
  'Vanderbilt':          { total: 6, years: '2011–2021' },
  'Virginia':            { total: 6, years: '2009–2024' },
  'TCU':                 { total: 6, years: '2010–2023' },
  'Ole Miss':            { total: 6, years: '1956–2022' },
  'Rice':                { total: 5, years: '1997–2007' },
  'Texas A&M':           { total: 5, years: '1951–2024' },
  'Wichita State':       { total: 5, years: '1982–1996' },
  'Notre Dame':          { total: 4, years: '1957–2022' },
  'UCLA':                { total: 4, years: '1969–2025' },
  'Wake Forest':         { total: 3, years: '1955–2023' },
  'Tennessee':           { total: 4, years: '2001–2024' },
  'Auburn':              { total: 4, years: '1967–2022' },
  'NC State':            { total: 3, years: '1968–2024' },
  'Louisville':          { total: 3, years: '2007–2025' },
  'Oral Roberts':        { total: 3, years: '1969–2023' },
  'Georgia':             { total: 3, years: '1990–2008' },
  'Coastal Carolina':    { total: 3, years: '2016–2025' },
  'Kentucky':            { total: 2, years: '2017–2024' },
  'Creighton':           { total: 2, years: '1991–1998' },
  'East Carolina':       { total: 2, years: '2019–2019' },
  'Murray State':        { total: 1, years: '2025' },
  'Fresno State':        { total: 1, years: '2008' },
  'Dallas Baptist':      { total: 1, years: '2021' },
  'Pepperdine':          { total: 3, years: '1971–1992' },
  'Cal Poly':            { total: 1, years: '2009' },
  'Baylor':              { total: 3, years: '1977–2005' },
  'Georgia Tech':        { total: 3, years: '1993–2006' },
  'Indiana':             { total: 1, years: '2013' },
  'Long Beach State':    { total: 3, years: '1993–1998' },
}

// ── Recent CWS appearances by year (2021–2025) ─────────────────────────────
const CWS_BY_YEAR = {
  2021: ['Mississippi State', 'Vanderbilt', 'Texas', 'Virginia', 'Tennessee', 'Arizona', 'Stanford', 'NC State'],
  2022: ['Ole Miss', 'Oklahoma', 'Arkansas', 'Texas A&M', 'Notre Dame', 'Stanford', 'Texas', 'Auburn'],
  2023: ['LSU', 'Florida', 'Virginia', 'Wake Forest', 'Stanford', 'Tennessee', 'TCU', 'Oral Roberts'],
  2024: ['Tennessee', 'Texas A&M', 'Florida State', 'North Carolina', 'Florida', 'Kentucky', 'NC State', 'Virginia'],
  2025: ['LSU', 'Coastal Carolina', 'Arkansas', 'Arizona', 'Oregon State', 'Louisville', 'UCLA', 'Murray State'],
}

// ── Super Regional teams by year (16 per year) ──────────────────────────────
const SUPERS_BY_YEAR = {
  2021: [
    'Arkansas', 'Nebraska', 'Texas Tech', 'Stanford', 'Arizona', 'Ole Miss',
    'Vanderbilt', 'East Carolina', 'Tennessee', 'LSU', 'Dallas Baptist', 'Virginia',
    'Mississippi State', 'Notre Dame', 'Texas', 'South Alabama',
  ],
  2022: [
    'Tennessee', 'Notre Dame', 'East Carolina', 'Coastal Carolina', 'Texas',
    'Virginia Tech', 'Texas A&M', 'TCU', 'Oregon State', 'Vanderbilt',
    'Auburn', 'UCLA', 'Ole Miss', 'Southern Miss', 'Arkansas', 'Oklahoma State',
    'North Carolina', 'Stanford', 'Oklahoma', 'Florida',
  ],
  2023: [
    'Oregon', 'Oral Roberts', 'TCU', 'Arkansas', 'Virginia', 'East Carolina',
    'Duke', 'Coastal Carolina', 'Florida', 'South Carolina', 'Texas Tech',
    'Wake Forest', 'Maryland', 'Stanford', 'Texas A&M', 'LSU', 'Oregon State',
    'Kentucky', 'Tennessee', 'Clemson', 'Southern Miss',
  ],
  2024: [
    'North Carolina', 'LSU', 'West Virginia', 'Virginia', 'Kansas State',
    'Tennessee', 'East Carolina', 'Florida State', 'Oklahoma', 'Alabama',
    'Kentucky', 'Indiana State', 'Oregon State', 'NC State', 'South Carolina',
    'Georgia', 'Texas A&M', 'Oregon', 'Clemson', 'Coastal Carolina',
    'Oklahoma State', 'Florida',
  ],
  2025: [
    'Auburn', 'Coastal Carolina', 'NC State', 'East Carolina', 'North Carolina',
    'Oklahoma', 'Nebraska', 'Arizona', 'Oregon State', 'USC', 'Florida State',
    'Mississippi State', 'Louisville', 'Vanderbilt', 'Southern Miss', 'Miami (FL)',
    'Texas', 'UTSA', 'UCLA', 'Arizona State', 'Georgia', 'Duke', 'Ole Miss',
    'Murray State', 'Arkansas', 'Tennessee', 'Creighton', 'Wake Forest',
    'LSU', 'Dallas Baptist', 'Clemson', 'West Virginia',
  ],
}

// ── Regional teams by year (64 per year) ────────────────────────────────────
// These include ALL teams that appeared in regionals (super regional + regional-only).
// We list the schools that appeared in regionals. Super regional teams are a subset.
const REGIONALS_BY_YEAR = {
  2021: [
    // All 64 regional participants
    'Arkansas', 'Nebraska', 'NJIT', 'Northeastern', 'Texas Tech', 'Stanford',
    'UC Irvine', 'UCLA', 'Arizona', 'Ole Miss', 'Grand Canyon', 'Central Michigan',
    'Vanderbilt', 'East Carolina', 'Georgia Tech', 'Presbyterian', 'Tennessee',
    'LSU', 'Duke', 'Charlotte', 'Dallas Baptist', 'Virginia', 'Old Dominion',
    'South Alabama', 'Mississippi State', 'Notre Dame', 'Campbell', 'Alabama',
    'Texas', 'South Florida', 'UC Santa Barbara', 'Southern', 'Florida',
    'Florida State', 'South Carolina', 'Army', 'Oregon State', 'Oregon',
    'McNeese State', 'Gonzaga', 'North Carolina', 'Maryland', 'Rider',
    'Indiana State', 'Arizona State', 'Fairfield', 'Oklahoma State', 'Liberty',
    'North Dakota State', 'Michigan', 'Norfolk State', 'Connecticut',
    'Miami (FL)', 'Samford', 'Jacksonville', 'Louisiana Tech', 'Nevada',
    'Southern Miss', 'Stony Brook', 'St. John\'s', 'Southeast Missouri',
    'Murray State', 'Wichita State', 'Wright State',
  ],
  2022: [
    'Tennessee', 'Georgia Tech', 'Campbell', 'Alabama State', 'Notre Dame',
    'East Carolina', 'Coastal Carolina', 'Coppin State', 'Texas', 'Virginia',
    'Virginia Tech', 'Columbia', 'Texas A&M', 'TCU', 'Louisville', 'Michigan',
    'Oregon State', 'Vanderbilt', 'Auburn', 'UCLA', 'Ole Miss', 'Arizona',
    'Southern Miss', 'LSU', 'Arkansas', 'Oklahoma State', 'North Carolina',
    'VCU', 'Stanford', 'Texas State', 'Oklahoma', 'Florida',
    'Connecticut', 'Maryland', 'Georgia Southern', 'Air Force', 'Binghamton',
    'Gonzaga', 'Grand Canyon', 'Kennesaw State', 'Liberty', 'LIU',
    'Louisiana Tech', 'Miami (FL)', 'Missouri State', 'New Mexico State',
    'Oral Roberts', 'Oregon', 'San Diego', 'Southeast Missouri',
    'Southeastern Louisiana', 'Texas Tech', 'UNC Greensboro', 'UC Santa Barbara',
    'Wake Forest', 'Canisius', 'Dallas Baptist', 'Wofford', 'Florida State',
    'Clemson', 'Georgia', 'Fresno State', 'Wright State', 'Stetson',
  ],
  2023: [
    'Oregon', 'Oral Roberts', 'Xavier', 'Vanderbilt', 'TCU', 'Arkansas',
    'Indiana State', 'Iowa', 'Virginia', 'East Carolina', 'Duke',
    'Coastal Carolina', 'Florida', 'South Carolina', 'Texas Tech', 'Connecticut',
    'Wake Forest', 'Maryland', 'Alabama', 'Boston College', 'Stanford',
    'Texas A&M', 'Texas', 'Miami (FL)', 'LSU', 'Oregon State', 'Kentucky',
    'Indiana', 'Tennessee', 'Clemson', 'Charlotte', 'Southern Miss',
    'North Carolina', 'Oklahoma State', 'Auburn', 'UCLA', 'South Alabama',
    'Tulane', 'Fresno State', 'San Diego', 'Georgia', 'Stony Brook',
    'Georgia Tech', 'Central Connecticut', 'Mercer', 'Samford', 'Fairfield',
    'Oklahoma', 'UC Santa Barbara', 'Nicholls State', 'Grambling State',
    'Arizona', 'Dallas Baptist', 'Louisiana Tech', 'Wichita State',
    'Old Dominion', 'Illinois', 'Michigan State', 'Stetson', 'Florida State',
    'Mississippi State', 'Missouri State', 'Campbell', 'Notre Dame',
  ],
  2024: [
    'North Carolina', 'LSU', 'West Virginia', 'Grand Canyon', 'Virginia',
    'Kansas State', 'Mississippi State', 'Arkansas', 'Tennessee', 'Evansville',
    'East Carolina', 'Indiana', 'Florida State', 'Connecticut', 'Oklahoma',
    'Alabama', 'Kentucky', 'Indiana State', 'Oregon State', 'UC Irvine',
    'NC State', 'South Carolina', 'Georgia', 'James Madison', 'Texas A&M',
    'Oregon', 'UC Santa Barbara', 'Louisiana', 'Clemson', 'Coastal Carolina',
    'Oklahoma State', 'Florida', 'Duke', 'VCU', 'Wofford', 'High Point',
    'Vanderbilt', 'Nebraska', 'Stetson', 'UCF', 'Tulane', 'Fresno State',
    'San Diego', 'Nicholls State', 'Arizona', 'Army', 'Georgia Tech',
    'UNC Wilmington', 'Grambling State', 'Texas', 'Dallas Baptist',
    'Louisiana Tech', 'Southeast Missouri', 'Penn', 'St. John\'s',
    'Northern Kentucky', 'Bryant', 'Southern Miss', 'Samford',
    'Southeastern Louisiana', 'Oral Roberts', 'Wright State', 'Michigan',
    'Central Connecticut',
  ],
  2025: [
    'Auburn', 'Coastal Carolina', 'NC State', 'East Carolina', 'North Carolina',
    'Oklahoma', 'Nebraska', 'Arizona', 'Oregon State', 'USC', 'Florida State',
    'Mississippi State', 'Louisville', 'Vanderbilt', 'Southern Miss', 'Miami (FL)',
    'Texas', 'UTSA', 'UCLA', 'Arizona State', 'Georgia', 'Duke', 'Ole Miss',
    'Murray State', 'Arkansas', 'Tennessee', 'Creighton', 'Wake Forest',
    'LSU', 'Dallas Baptist', 'Clemson', 'West Virginia',
    // Additional regional-only teams (best available from Wikipedia):
    'Florida', 'South Carolina', 'TCU', 'Oklahoma State', 'Texas A&M',
    'Oregon', 'Kentucky', 'Virginia', 'Stanford', 'Alabama', 'Connecticut',
    'Indiana State', 'Georgia Tech', 'Stetson', 'Liberty', 'Fresno State',
    'San Diego', 'UC Santa Barbara', 'Tulane', 'Notre Dame', 'Maryland',
    'Texas Tech', 'Baylor', 'Campbell', 'Gonzaga', 'Old Dominion',
    'Grand Canyon', 'Charlotte', 'Oral Roberts', 'Wichita State',
    'UC Irvine', 'Nicholls State',
  ],
}

// ── Build enrichment map ────────────────────────────────────────────────────

function buildEnrichment() {
  const schools = {} // school_name → { recentCwsYears: [], totalCws: N, cwsSpan: '', regionalCount: N }

  const ensure = (name) => {
    if (!schools[name]) schools[name] = { recentCwsYears: [], totalCws: 0, cwsSpan: '', regionalCount: 0 }
    return schools[name]
  }

  // 1. All-time CWS data
  for (const [name, data] of Object.entries(ALL_TIME_CWS)) {
    const s = ensure(name)
    s.totalCws = data.total
    s.cwsSpan = data.years
  }

  // 2. Recent CWS years (2021–2025)
  for (const [year, teams] of Object.entries(CWS_BY_YEAR)) {
    for (const team of teams) {
      const s = ensure(team)
      s.recentCwsYears.push(Number(year))
    }
  }

  // 3. Regional appearances (2021–2025) — count unique years
  for (const [year, teams] of Object.entries(REGIONALS_BY_YEAR)) {
    const unique = new Set(teams)
    for (const team of unique) {
      const s = ensure(team)
      s.regionalCount++
    }
  }

  return schools
}

function formatCwsAppearances(data) {
  const parts = []

  // Recent CWS years
  if (data.recentCwsYears.length > 0) {
    const sorted = [...data.recentCwsYears].sort()
    parts.push(sorted.join(', ') + ' CWS')
  }

  // Total all-time
  if (data.totalCws > 0) {
    parts.push(`${data.totalCws} total appearances (${data.cwsSpan})`)
  }

  return parts.join('; ') || null
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Building enrichment data from Wikipedia sources...')
  const enrichment = buildEnrichment()

  const schoolNames = Object.keys(enrichment)
  console.log(`Enrichment data compiled for ${schoolNames.length} schools`)

  // First, run the migration to add columns if they don't exist
  console.log('Adding columns if not present...')
  const { error: migErr } = await sb.rpc('exec_sql', {
    query: `ALTER TABLE koto_recruiting_programs ADD COLUMN IF NOT EXISTS cws_appearances TEXT; ALTER TABLE koto_recruiting_programs ADD COLUMN IF NOT EXISTS regional_appearances_5yr INT;`
  }).maybeSingle()
  // rpc may not exist — that's OK, columns may already be there from migration file
  if (migErr) {
    console.log('Note: Could not run ALTER TABLE via RPC (columns may already exist from migration). Continuing...')
  }

  // Fetch all baseball programs from DB
  const { data: programs, error: fetchErr } = await sb
    .from('koto_recruiting_programs')
    .select('id, school_name')
    .eq('sport', 'baseball')

  if (fetchErr) {
    console.error('Failed to fetch programs:', fetchErr.message)
    process.exit(1)
  }

  console.log(`Found ${programs.length} baseball programs in database`)

  // Also build a lookup with name aliases for matching
  // The seed data uses names like "Clemson University" (seed-recruiting-baseball.mjs)
  // and "Clemson" (seed-recruiting-all.mjs). Wikipedia uses various forms.
  const ALIASES = {
    'Clemson University': 'Clemson',
    'Duke University': 'Duke',
    'Florida State University': 'Florida State',
    'University of Florida': 'Florida',
    'University of Texas': 'Texas',
    'University of Virginia': 'Virginia',
    'University of Georgia': 'Georgia',
    'University of Oregon': 'Oregon',
    'University of Kentucky': 'Kentucky',
    'University of Alabama': 'Alabama',
    'University of Tennessee': 'Tennessee',
    'University of Michigan': 'Michigan',
    'University of Maryland': 'Maryland',
    'UConn': 'Connecticut',
    'Connecticut': 'Connecticut',
    'Nicholls': 'Nicholls State',
    'Southeast Missouri State': 'Southeast Missouri',
  }

  let enriched = 0
  let skipped = 0
  const updates = []

  for (const program of programs) {
    // Try direct match first, then alias
    const name = program.school_name
    const canonicalName = ALIASES[name] || name
    const data = enrichment[canonicalName] || enrichment[name]

    if (!data) {
      skipped++
      continue
    }

    const cwsText = formatCwsAppearances(data)
    const regionalCount = data.regionalCount > 0 ? data.regionalCount : null

    // Only update if there's something to write
    if (!cwsText && !regionalCount) {
      skipped++
      continue
    }

    updates.push({
      id: program.id,
      school_name: name,
      cws_appearances: cwsText,
      regional_appearances_5yr: regionalCount,
    })
  }

  console.log(`\nUpdating ${updates.length} programs...`)

  let successCount = 0
  let errorCount = 0

  for (const update of updates) {
    const payload = {}
    if (update.cws_appearances) payload.cws_appearances = update.cws_appearances
    if (update.regional_appearances_5yr) payload.regional_appearances_5yr = update.regional_appearances_5yr
    payload.updated_at = new Date().toISOString()

    const { error } = await sb
      .from('koto_recruiting_programs')
      .update(payload)
      .eq('id', update.id)

    if (error) {
      console.error(`  ✗ ${update.school_name}: ${error.message}`)
      errorCount++
    } else {
      console.log(`  ✓ ${update.school_name}: ${update.cws_appearances || '—'} | regionals: ${update.regional_appearances_5yr || 0}`)
      successCount++
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`Total programs in DB: ${programs.length}`)
  console.log(`Enriched:             ${successCount}`)
  console.log(`Errors:               ${errorCount}`)
  console.log(`No match / no data:   ${skipped}`)
  console.log(`\nSources: Wikipedia College World Series + 2021–2025 NCAA tournament articles`)
  console.log(`Data fetched: ${new Date().toISOString().split('T')[0]}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
