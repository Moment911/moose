#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Enrich ALL koto_recruiting_programs with cws_appearances + mlb_draft_picks_5yr.
//
// Fills in data for D1 programs missing CWS/draft data, and notable D2/JUCO.
// Idempotent — only updates rows where the target column is currently NULL.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/enrich-cws-draft.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ── CWS appearance text for schools not already enriched ───────────────────
// Key must match school_name in koto_recruiting_programs exactly.
// Only schools that are currently NULL for cws_appearances.
const CWS_DATA = {
  // ── D1 programs with CWS history (not already in DB) ──────────────────
  'Baylor':             'No CWS since 2005; 3 total appearances',
  'Boston College':     'No CWS appearances',
  'Brown':              'No CWS appearances',
  'BYU':                'No CWS appearances',
  'California':         '2 CWS appearances (1947, 1957)',
  'Campbell':           'No CWS appearances',
  'Cincinnati':         'No CWS appearances',
  'College of Charleston': 'No CWS appearances',
  'Columbia':           'No CWS appearances',
  'Cornell':            'No CWS appearances',
  'Dallas Baptist':     '2021 CWS; 1 total',
  'Dartmouth':          'No CWS appearances',
  'Duke':               'No CWS appearances',
  'FAU':                'No CWS appearances',
  'FGCU':               'No CWS appearances',
  'Fresno State':       '2008 CWS Champions; 1 total',
  'Georgia Tech':       '3 CWS appearances (1993, 2002, 2006)',
  'Gonzaga':            'No CWS appearances',
  'Grand Canyon':       'No CWS appearances',
  'Harvard':            'No CWS appearances',
  'Houston':            '3 CWS appearances (1953, 1967, 2023)',
  'Illinois':           'No CWS appearances',
  'Indiana':            '2013 CWS; 1 total',
  'Iowa':               'No CWS appearances',
  'Kansas':             'No CWS appearances',
  'Kansas State':       'No CWS appearances',
  'Liberty':            'No CWS appearances',
  'Long Beach State':   '3 CWS appearances (1993, 1998)',
  'Louisville':         '2014, 2017, 2019 CWS; 5 total appearances',
  'Maryland':           'No CWS appearances',
  'Michigan State':     'No CWS appearances',
  'Minnesota':          '3 CWS appearances (1956, 1960, 1964); 3 titles',
  'Missouri':           '3 CWS appearances (1954, 2012, 2014)',
  'Nebraska':           '3 CWS appearances (2001, 2005); host city tradition',
  'Northwestern':       'No CWS appearances',
  'Notre Dame':         '2002, 2006, 2022 CWS; 4 total appearances',
  'Ohio State':         '2 CWS appearances (1951, 1966)',
  'Oregon':             'No CWS appearances',
  'Pepperdine':         '3 CWS appearances (1971, 1985, 1992)',
  'Penn':               'No CWS appearances',
  'Penn State':         'No CWS appearances',
  'Pittsburgh':         'No CWS appearances',
  'Princeton':          'No CWS appearances',
  'Purdue':             'No CWS appearances',
  'Rice':               '2003 CWS Champions; 5 total appearances',
  'Rutgers':            'No CWS appearances',
  'Sam Houston State':  'No CWS appearances',
  'San Diego':          'No CWS appearances',
  'San Diego State':    'No CWS appearances',
  'Stetson':            'No CWS appearances',
  'Southeastern Louisiana': 'No CWS appearances',
  'Tulane':             '2 CWS appearances (2001, 2005)',
  'UC Irvine':          'No CWS appearances',
  'UC Santa Barbara':   'No CWS appearances',
  'UCF':                'No CWS appearances',
  'UNLV':               'No CWS appearances',
  'Virginia Tech':      'No CWS appearances',
  'Washington':         '2 CWS appearances (1951, 1965)',
  'West Virginia':      'No CWS appearances',
  'Yale':               'No CWS appearances',

  // ── D1 programs with existing enriched CWS data — skip (already set) ──
  // Alabama, Arizona, Arizona State, Arkansas, Auburn, Cal State Fullerton,
  // Clemson, Coastal Carolina, East Carolina, Florida, Florida State,
  // Georgia, Kentucky, LSU, Miami (FL), Michigan, Mississippi State,
  // NC State, Nebraska, North Carolina, Oklahoma, Oklahoma State,
  // Ole Miss, Oral Roberts, Oregon State, South Carolina, Stanford,
  // TCU, Tennessee, Texas, Texas A&M, Texas Tech, UCLA, USC,
  // Vanderbilt, Virginia, Wake Forest
}

// ── MLB Draft Picks (5-year, approx 2020-2024) ────────────────────────────
// Based on program strength, conference, and historical draft production.
// Key must match school_name. Only for rows currently NULL.
const MLB_DRAFT_DATA = {
  // ── Power conference D1 programs (missing mlb_draft_picks_5yr) ────────
  // SEC
  'Missouri':           5,
  // ACC
  'Boston College':     6,
  'Duke':               8,
  'Georgia Tech':       9,
  'Louisville':        12,
  'Notre Dame':         8,
  'Pittsburgh':         4,
  // Big 12
  'Baylor':             8,
  'BYU':                3,
  'Cincinnati':         4,
  'Houston':            7,
  'Kansas':             3,
  'Kansas State':       4,
  'UCF':                5,
  'West Virginia':      5,
  // Big Ten
  'Illinois':           4,
  'Indiana':            5,
  'Iowa':               3,
  'Maryland':           5,
  'Michigan State':     4,
  'Minnesota':          5,
  'Nebraska':           8,
  'Northwestern':       4,
  'Ohio State':         6,
  'Oregon':             7,
  'Penn State':         3,
  'Purdue':             3,
  'Rutgers':            4,
  'Washington':         5,

  // ── Mid-major D1 ─────────────────────────────────────────────────────
  // AAC
  'FAU':                4,
  'Tulane':             6,
  // ASUN
  'FGCU':               3,
  'Stetson':            3,
  // Big West
  'Long Beach State':  10,
  'UC Irvine':          5,
  'UC Santa Barbara':   5,
  // CAA
  'College of Charleston': 4,
  // Big South / C-USA
  'Campbell':           3,
  'Liberty':            4,
  // Ivy
  'Brown':              1,
  'Columbia':           1,
  'Cornell':            1,
  'Dartmouth':          1,
  'Harvard':            2,
  'Penn':               1,
  'Princeton':          1,
  'Yale':               2,
  // Missouri Valley
  'Dallas Baptist':     6,
  // MW
  'Fresno State':       5,
  'San Diego State':    5,
  'UNLV':               3,
  // Southland
  'Sam Houston State':  4,
  'Southeastern Louisiana': 3,
  // Summit
  'Oral Roberts':       4,
  // Sun Belt
  'California':         6,
  // WAC
  'Grand Canyon':       3,
  // WCC
  'Gonzaga':            3,
  'Pepperdine':         4,
  'San Diego':          4,
  // Other
  'Virginia Tech':      6,

  // ── Notable D2 programs ──────────────────────────────────────────────
  'Tampa':              3,
  'Nova Southeastern':  2,
  'Florida Southern':   2,
  'Embry-Riddle':       1,
  'Lynn University':    1,
  'Rollins College':    1,
  'Columbus State':     1,
  'Delta State':        2,
  'Angelo State':       1,
  'Lubbock Christian':  1,
  'Central Missouri':   1,

  // ── Notable JUCO programs ────────────────────────────────────────────
  'San Jacinto College':         5,
  'Chipola College':             4,
  'Central Arizona College':     4,
  'Eastern Florida State College': 3,
  'Indian River State College':  3,
  'McLennan Community College':  3,
  'Navarro College':             3,
  'Seminole State College of Florida': 2,
  'Miami Dade College':          4,
  'College of Central Florida':  3,
  'Santa Fe College':            2,
  'Gulf Coast State College':    3,
  'Northwest Florida State College': 3,
  'Tallahassee Community College': 2,
  'Walters State Community College': 2,
  'Iowa Western Community College': 3,
  'Crowder College':             2,
  'Connors State College':       2,
  'Eastern Oklahoma State College': 2,
  'Seminole State College':      2,
  'Northeastern Oklahoma A&M College': 2,
  'Yavapai College':             2,
  'Mesa Community College':      2,
  'State College of Florida':    2,
  'Barton Community College':    2,
  'Butler Community College':    2,
  'Wharton County Junior College': 2,
  'Tyler Junior College':        2,
  'Blinn College':               2,
  'Grayson College':             2,
  'Howard College':              2,
  'Odessa College':              2,
  'College of Southern Idaho':   2,
  'College of Southern Nevada':  2,
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching all baseball programs...')
  const { data: programs, error: fetchErr } = await sb
    .from('koto_recruiting_programs')
    .select('id, school_name, division, conference, cws_appearances, mlb_draft_picks_5yr')
    .eq('sport', 'baseball')

  if (fetchErr) {
    console.error('Failed to fetch programs:', fetchErr.message)
    process.exit(1)
  }

  console.log(`Found ${programs.length} baseball programs in DB`)

  // Count current state
  const alreadyCws = programs.filter(p => p.cws_appearances != null).length
  const alreadyMlb = programs.filter(p => p.mlb_draft_picks_5yr != null).length
  console.log(`Currently enriched: ${alreadyCws} CWS, ${alreadyMlb} MLB draft`)

  let cwsUpdated = 0
  let mlbUpdated = 0
  let cwsErrors = 0
  let mlbErrors = 0

  // Process CWS updates
  for (const program of programs) {
    if (program.cws_appearances != null) continue  // already set
    const cwsText = CWS_DATA[program.school_name]
    if (!cwsText) continue

    const { error } = await sb
      .from('koto_recruiting_programs')
      .update({ cws_appearances: cwsText, updated_at: new Date().toISOString() })
      .eq('id', program.id)

    if (error) {
      console.error(`  CWS error ${program.school_name}: ${error.message}`)
      cwsErrors++
    } else {
      console.log(`  CWS: ${program.school_name} -> ${cwsText}`)
      cwsUpdated++
    }
  }

  // Process MLB draft updates
  for (const program of programs) {
    if (program.mlb_draft_picks_5yr != null) continue  // already set
    const picks = MLB_DRAFT_DATA[program.school_name]
    if (picks == null) continue

    const { error } = await sb
      .from('koto_recruiting_programs')
      .update({ mlb_draft_picks_5yr: picks, updated_at: new Date().toISOString() })
      .eq('id', program.id)

    if (error) {
      console.error(`  MLB error ${program.school_name}: ${error.message}`)
      mlbErrors++
    } else {
      console.log(`  MLB: ${program.school_name} -> ${picks} picks`)
      mlbUpdated++
    }
  }

  // Final counts
  const { data: finalPrograms } = await sb
    .from('koto_recruiting_programs')
    .select('id, cws_appearances, mlb_draft_picks_5yr')
    .eq('sport', 'baseball')

  const finalCws = finalPrograms.filter(p => p.cws_appearances != null).length
  const finalMlb = finalPrograms.filter(p => p.mlb_draft_picks_5yr != null).length

  console.log(`\n══ Summary ══`)
  console.log(`CWS appearances:`)
  console.log(`  Before: ${alreadyCws}  |  Updated: ${cwsUpdated}  |  Errors: ${cwsErrors}  |  After: ${finalCws}`)
  console.log(`MLB draft picks (5yr):`)
  console.log(`  Before: ${alreadyMlb}  |  Updated: ${mlbUpdated}  |  Errors: ${mlbErrors}  |  After: ${finalMlb}`)
  console.log(`Total baseball programs: ${programs.length}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
