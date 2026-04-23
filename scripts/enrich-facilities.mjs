#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Enrich koto_recruiting_programs with facilities_notes for top D1 programs.
//
// Sources: general knowledge of notable college baseball facilities.
// These are well-known, publicly documented facts about stadiums.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/enrich-facilities.mjs
//
// Idempotent — safe to re-run. Only updates rows where facilities_notes is NULL.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ── Facilities data for top 40 D1 programs ──────────────────────────────────
// school_name must match koto_recruiting_programs.school_name exactly
// (uses the short names from seed-recruiting-baseball.mjs).

const FACILITIES = [
  { school: 'Florida', notes: 'Florida Ballpark (2020, $65M, 7,000 capacity). State-of-the-art hitting and pitching labs.' },
  { school: 'Vanderbilt', notes: 'Hawkins Field (3,700 capacity). New indoor hitting/pitching facility opened 2022.' },
  { school: 'LSU', notes: 'Alex Box Stadium / Skip Bertman Field (10,326 capacity, opened 2009). Largest on-campus college baseball venue.' },
  { school: 'Arkansas', notes: 'Baum-Walker Stadium (10,737 capacity). Largest on-campus baseball stadium in the nation. Full indoor practice facility.' },
  { school: 'Tennessee', notes: 'Lindsey Nelson Stadium (4,000+ capacity, $48M renovation completed 2024). Premium indoor training center.' },
  { school: 'Ole Miss', notes: 'Swayze Field (10,000+ capacity with temp seating). Oxford known as one of the best college baseball atmospheres.' },
  { school: 'Mississippi State', notes: 'Dudy Noble Field / Polk-DeMent Stadium (15,000 capacity). Famous Left Field Lounge. Largest college baseball venue.' },
  { school: 'Texas A&M', notes: 'Blue Bell Park (Olsen Field, 7,053 capacity, opened 2012). Full indoor facility.' },
  { school: 'Texas', notes: 'UFCU Disch-Falk Field (7,273 capacity). Historic venue, opened 1975, renovated multiple times.' },
  { school: 'TCU', notes: 'Lupton Stadium (4,500 capacity, opened 2003). Outstanding intimate atmosphere.' },
  { school: 'Texas Tech', notes: 'Dan Law Field at Rip Griffin Park (4,432 capacity). Complete indoor training facility.' },
  { school: 'Stanford', notes: 'Klein Field at Sunken Diamond (4,000 capacity). Historic venue dating to 1931.' },
  { school: 'Virginia', notes: 'Disharoon Park (5,074 capacity, opened 2021, $45M). Top-tier modern facility.' },
  { school: 'Clemson', notes: 'Doug Kingsmore Stadium (6,217 capacity). $36M renovation completed 2020.' },
  { school: 'South Carolina', notes: 'Founders Park (8,242 capacity, opened 2009). Adjacent indoor hitting facility.' },
  { school: 'NC State', notes: 'Doak Field at Dail Park (3,000 capacity). Renovated 2017.' },
  { school: 'North Carolina', notes: 'Boshamer Stadium (4,100 capacity). Renovated with new clubhouse and indoor facility.' },
  { school: 'Wake Forest', notes: 'David F. Couch Ballpark (3,000 capacity, opened 2017, $28M).' },
  { school: 'Louisville', notes: 'Jim Patterson Stadium (4,000 capacity, opened 2005). Indoor practice facility.' },
  { school: 'Miami (FL)', notes: 'Mark Light Field at Alex Rodriguez Park (5,000 capacity). $28M renovation by Alex Rodriguez.' },
  { school: 'Florida State', notes: 'Dick Howser Stadium (6,700 capacity). Named for former manager Dick Howser. Indoor batting cages.' },
  { school: 'Oregon', notes: 'PK Park (4,000 capacity). Indoor hitting and pitching facility.' },
  { school: 'Oregon State', notes: 'Goss Stadium at Coleman Field (3,248 capacity). Known for passionate fan base and atmosphere.' },
  { school: 'Arizona', notes: 'Hi Corbett Field (9,500 capacity). Historic venue, former spring training site.' },
  { school: 'Arizona State', notes: 'Phoenix Municipal Stadium (8,775 capacity). Former MLB spring training home.' },
  { school: 'UCLA', notes: 'Jackie Robinson Stadium (1,820 capacity). Named after the legendary Bruin.' },
  { school: 'USC', notes: 'Dedeaux Field (2,500 capacity). Named after legendary coach Rod Dedeaux. 12 national titles.' },
  { school: 'Georgia', notes: 'Foley Field (3,291 capacity). Indoor hitting and pitching facility adjacent.' },
  { school: 'Auburn', notes: 'Plainsman Park (4,096 capacity). $31M renovation completed 2003.' },
  { school: 'Alabama', notes: 'Sewell-Thomas Stadium (6,602 capacity, opened 2008).' },
  { school: 'Kentucky', notes: 'Kentucky Proud Park (4,000 capacity, opened 2019, $49M). State-of-the-art.' },
  { school: 'Oklahoma', notes: 'L. Dale Mitchell Park (3,180 capacity). Full indoor facility.' },
  { school: 'Oklahoma State', notes: "O'Brate Stadium (4,000 capacity, opened 2021, $60M). One of newest D1 venues." },
  { school: 'Notre Dame', notes: 'Frank Eck Stadium (2,500 capacity, opened 1994). Indoor hitting facility.' },
  { school: 'Duke', notes: 'Jack Coombs Field (2,000 capacity). Intimate campus venue.' },
  { school: 'Connecticut', notes: 'J.O. Christian Field (1,500 capacity). Indoor practice facility.' },
  { school: 'Coastal Carolina', notes: 'Springs Brooks Stadium (3,500 capacity). 2016 national champions. Teal Monster wall.' },
  { school: 'East Carolina', notes: 'Clark-LeClair Stadium (3,000 capacity). Strong fan support.' },
  { school: 'Dallas Baptist', notes: 'Horner Ballpark (2,000 capacity). Well-maintained facility for mid-major.' },
  { school: 'Baylor', notes: 'Baylor Ballpark (5,000 capacity). Adjacent indoor training facility.' },
]

async function main() {
  let updated = 0
  let notFound = 0
  let skipped = 0
  let errors = 0

  for (const { school, notes } of FACILITIES) {
    // Check if the program exists
    const { data: prog, error: fetchErr } = await sb
      .from('koto_recruiting_programs')
      .select('id, facilities_notes')
      .eq('school_name', school)
      .eq('sport', 'baseball')
      .maybeSingle()

    if (fetchErr || !prog) {
      console.log(`  SKIP (not found): ${school}`)
      notFound++
      continue
    }

    // Only update if facilities_notes is currently empty
    if (prog.facilities_notes) {
      console.log(`  SKIP (already set): ${school}`)
      skipped++
      continue
    }

    const { error: upErr } = await sb
      .from('koto_recruiting_programs')
      .update({ facilities_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', prog.id)

    if (upErr) {
      console.log(`  ERROR: ${school} — ${upErr.message}`)
      errors++
    } else {
      console.log(`  OK: ${school}`)
      updated++
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already set): ${skipped}, Not found: ${notFound}, Errors: ${errors}, Total: ${FACILITIES.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
