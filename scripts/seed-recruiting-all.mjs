#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Unified recruiting seed — D1 (with coaches) + D2 + D3 + JUCO.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-recruiting-all.mjs
//
// Idempotent — upserts by (school_name, sport).
// Sources: NCBWA (D1 coaches), compiled knowledge (D2/D3), NJCAA (JUCO).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ── Load JUCO data from the scraped file ──────────────────────────────────
let jucoData = []
try {
  jucoData = JSON.parse(readFileSync(join(__dirname, 'recruiting-data-juco.json'), 'utf-8'))
  console.log(`Loaded ${jucoData.length} JUCO programs from scraped data`)
} catch (e) {
  console.warn('No JUCO data file found, skipping JUCO programs')
}

// ── D1 programs with NCBWA coach data ─────────────────────────────────────
// Source: sportswriters.net/ncbwa/links/ (scraped 2026-04-22)
const D1_WITH_COACHES = [
  // ACC
  { school: 'Boston College', conf: 'ACC', st: 'MA', city: 'Chestnut Hill', coach: 'Mike Gambino', sid_email: 'flynnhu@bc.edu', sid_phone: '617-552-2004' },
  { school: 'Clemson', conf: 'ACC', st: 'SC', city: 'Clemson', coach: 'Monte Lee', sid_email: 'bhennes@clemson.edu', sid_phone: '864-656-1921' },
  { school: 'Duke', conf: 'ACC', st: 'NC', city: 'Durham', coach: 'Chris Pollard', sid_email: 'joshua.foster@duke.edu', sid_phone: '919-684-2668' },
  { school: 'Florida State', conf: 'ACC', st: 'FL', city: 'Tallahassee', coach: 'Mike Martin Jr.', sid_email: 'smccartney@fsu.edu', sid_phone: '850-644-3920' },
  { school: 'Georgia Tech', conf: 'ACC', st: 'GA', city: 'Atlanta', coach: 'Danny Hall', sid_email: 'aclausen@athletics.gatech.edu', sid_phone: '404-894-5445' },
  { school: 'Louisville', conf: 'ACC', st: 'KY', city: 'Louisville', coach: 'Dan McDonnell' },
  { school: 'Miami (FL)', conf: 'ACC', st: 'FL', city: 'Coral Gables', coach: 'Gino DiMare', sid_email: 'd.villavicencio@miami.edu', sid_phone: '305-284-3244' },
  { school: 'North Carolina', conf: 'ACC', st: 'NC', city: 'Chapel Hill', coach: 'Mike Fox', sid_email: 'aury@unc.edu', sid_phone: '919-962-2123' },
  { school: 'NC State', conf: 'ACC', st: 'NC', city: 'Raleigh', coach: 'Elliott Avent', sid_email: 'embundy@ncsu.edu', sid_phone: '919-746-8821' },
  { school: 'Notre Dame', conf: 'ACC', st: 'IN', city: 'Notre Dame', coach: 'Link Jarrett', sid_email: 'mparas1@nd.edu', sid_phone: '574-631-9471' },
  { school: 'Pittsburgh', conf: 'ACC', st: 'PA', city: 'Pittsburgh', coach: 'Mike Bell', sid_email: 'kblucas@athletics.pitt.edu', sid_phone: '412-648-8240' },
  { school: 'Virginia', conf: 'ACC', st: 'VA', city: 'Charlottesville', coach: "Brian O'Connor", sid_email: 's.fitzgerald@virginia.edu', sid_phone: '434-982-9878' },
  { school: 'Virginia Tech', conf: 'ACC', st: 'VA', city: 'Blacksburg', coach: 'John Szefc', sid_email: 'marcm@vt.edu', sid_phone: '540-231-1894' },
  { school: 'Wake Forest', conf: 'ACC', st: 'NC', city: 'Winston-Salem', coach: 'Tom Walter', sid_email: 'garneajp@wfu.edu', sid_phone: '336-758-3229' },

  // SEC
  { school: 'Alabama', conf: 'SEC', st: 'AL', city: 'Tuscaloosa', coach: 'Brad Bohannon', sid_email: 'athompsoni@ia.ua.edu' },
  { school: 'Arkansas', conf: 'SEC', st: 'AR', city: 'Fayetteville', coach: 'Dave Van Horn', sid_email: 'mminshew@uark.edu' },
  { school: 'Auburn', conf: 'SEC', st: 'AL', city: 'Auburn', coach: 'Butch Thompson', sid_email: 'gnunnelley@auburn.edu' },
  { school: 'Florida', conf: 'SEC', st: 'FL', city: 'Gainesville', coach: "Kevin O'Sullivan", sid_email: 'ZachD@gators.ufl.edu' },
  { school: 'Georgia', conf: 'SEC', st: 'GA', city: 'Athens', coach: 'Scott Stricklin', sid_email: 'clakos@sports.uga.edu' },
  { school: 'Kentucky', conf: 'SEC', st: 'KY', city: 'Lexington', coach: 'Nick Mingione', sid_email: 'matt.may@uky.edu' },
  { school: 'LSU', conf: 'SEC', st: 'LA', city: 'Baton Rouge', coach: 'Paul Mainieri', sid_email: 'wfranqu@lsu.edu' },
  { school: 'Ole Miss', conf: 'SEC', st: 'MS', city: 'Oxford', coach: 'Mike Bianco', sid_email: 'apsims@olemiss.edu' },
  { school: 'Mississippi State', conf: 'SEC', st: 'MS', city: 'Starkville', coach: 'Chris Lemonis', sid_email: 'gcampbell@athletics.msstate.edu' },
  { school: 'Missouri', conf: 'SEC', st: 'MO', city: 'Columbia', coach: 'Steve Bieser', sid_email: 'oldenburga@missouri.edu' },
  { school: 'South Carolina', conf: 'SEC', st: 'SC', city: 'Columbia', coach: 'Mark Kingston', sid_email: 'kentr2@mailbox.sc.edu' },
  { school: 'Tennessee', conf: 'SEC', st: 'TN', city: 'Knoxville', coach: 'Tony Vitello', sid_email: 'sbarows@utk.edu' },
  { school: 'Texas', conf: 'SEC', st: 'TX', city: 'Austin', coach: 'David Pierce', sid_email: 'kevin.rodriguez@athletics.utexas.edu' },
  { school: 'Texas A&M', conf: 'SEC', st: 'TX', city: 'College Station', coach: 'Rob Childress', sid_email: 'tddick@athletics.tamu.edu' },
  { school: 'Vanderbilt', conf: 'SEC', st: 'TN', city: 'Nashville', coach: 'Tim Corbin', sid_email: 'andrew.pate@vanderbilt.edu' },
  { school: 'Oklahoma', conf: 'SEC', st: 'OK', city: 'Norman', coach: 'Skip Johnson', sid_email: 'ehollier@ou.edu' },

  // Big 12
  { school: 'Arizona', conf: 'Big 12', st: 'AZ', city: 'Tucson', coach: 'Jay Johnson', sid_email: 'brettgleason@email.arizona.edu' },
  { school: 'Arizona State', conf: 'Big 12', st: 'AZ', city: 'Tempe', coach: 'Tracy Smith', sid_email: 'jdhawkes@asu.edu' },
  { school: 'Baylor', conf: 'Big 12', st: 'TX', city: 'Waco', coach: 'Steve Rodriguez', sid_email: 'rachel_caton@baylor.edu' },
  { school: 'BYU', conf: 'Big 12', st: 'UT', city: 'Provo', coach: 'Mike Littlewood', sid_email: 'jordan_christiansen@byu.edu' },
  { school: 'Cincinnati', conf: 'Big 12', st: 'OH', city: 'Cincinnati', coach: 'Scott Googins', sid_email: 'mollie.radzinski@uc.edu' },
  { school: 'Houston', conf: 'Big 12', st: 'TX', city: 'Houston', coach: 'Todd Whitting', sid_email: 'karoger3@central.uh.edu' },
  { school: 'Kansas', conf: 'Big 12', st: 'KS', city: 'Lawrence', coach: 'Ritch Price', sid_email: 'beerends@ku.edu' },
  { school: 'Kansas State', conf: 'Big 12', st: 'KS', city: 'Manhattan', coach: 'Pete Hughes', sid_email: 'cbrown@kstatesports.com' },
  { school: 'Oklahoma State', conf: 'Big 12', st: 'OK', city: 'Stillwater', coach: 'Josh Holliday', sid_email: 'wade.mcwhorter@okstate.edu' },
  { school: 'Oregon State', conf: 'Big 12', st: 'OR', city: 'Corvallis', coach: 'Mitch Canham', sid_email: 'hank.hager@oregonstate.edu' },
  { school: 'TCU', conf: 'Big 12', st: 'TX', city: 'Fort Worth', coach: 'Jim Schlossnagle', sid_email: 'b.i.davidson@tcu.edu' },
  { school: 'Texas Tech', conf: 'Big 12', st: 'TX', city: 'Lubbock', coach: 'Tim Tadlock', sid_email: 'ty.a.parker@ttu.edu' },
  { school: 'UCF', conf: 'Big 12', st: 'FL', city: 'Orlando', coach: 'Greg Lovelady', sid_email: 'cyeager@athletics.ucf.edu' },
  { school: 'West Virginia', conf: 'Big 12', st: 'WV', city: 'Morgantown', coach: 'Randy Mazey', sid_email: 'jmitchin@mail.wvu.edu' },

  // Big Ten
  { school: 'Illinois', conf: 'Big Ten', st: 'IL', city: 'Champaign', coach: 'Dan Hartleb', sid_email: 'btmoore3@illinois.edu' },
  { school: 'Indiana', conf: 'Big Ten', st: 'IN', city: 'Bloomington', coach: 'Jeff Mercer', sid_email: 'sctburns@indiana.edu' },
  { school: 'Iowa', conf: 'Big Ten', st: 'IA', city: 'Iowa City', coach: 'Rick Heller', sid_email: 'james-allan@hawkeyesports.com' },
  { school: 'Maryland', conf: 'Big Ten', st: 'MD', city: 'College Park', coach: 'Rob Vaughn', sid_email: 'hunterd@umd.edu' },
  { school: 'Michigan', conf: 'Big Ten', st: 'MI', city: 'Ann Arbor', coach: 'Erik Bakich', sid_email: 'kludlow@umich.edu' },
  { school: 'Michigan State', conf: 'Big Ten', st: 'MI', city: 'East Lansing', coach: 'Jake Boss Jr.', sid_email: 'zfisher@ath.msu.edu' },
  { school: 'Minnesota', conf: 'Big Ten', st: 'MN', city: 'Minneapolis', coach: 'John Anderson', sid_email: 'sbortner@umn.edu' },
  { school: 'Nebraska', conf: 'Big Ten', st: 'NE', city: 'Lincoln', coach: 'Will Bolt', sid_email: 'cstange@huskers.com' },
  { school: 'Northwestern', conf: 'Big Ten', st: 'IL', city: 'Evanston', coach: 'Spencer Allen', sid_email: 'amit.malik@northwestern.edu' },
  { school: 'Ohio State', conf: 'Big Ten', st: 'OH', city: 'Columbus', coach: 'Greg Beals', sid_email: 'rybak.13@osu.edu' },
  { school: 'Oregon', conf: 'Big Ten', st: 'OR', city: 'Eugene', coach: 'Mark Wasikowski', sid_email: 'miles@uoregon.edu' },
  { school: 'Penn State', conf: 'Big Ten', st: 'PA', city: 'University Park', coach: 'Rob Cooper', sid_email: 'mgb28@psu.edu' },
  { school: 'Purdue', conf: 'Big Ten', st: 'IN', city: 'West Lafayette', coach: 'Greg Goff', sid_email: 'benturner@purdue.edu' },
  { school: 'Rutgers', conf: 'Big Ten', st: 'NJ', city: 'Piscataway', coach: 'Steve Owens', sid_email: 'jgill@scarletknights.com' },
  { school: 'UCLA', conf: 'Big Ten', st: 'CA', city: 'Los Angeles', coach: 'John Savage', sid_email: 'awagner@athletics.ucla.edu' },
  { school: 'USC', conf: 'Big Ten', st: 'CA', city: 'Los Angeles', coach: 'Jason Gill', sid_email: 'breems@usc.edu' },
  { school: 'Washington', conf: 'Big Ten', st: 'WA', city: 'Seattle', coach: 'Lindsay Meggs', sid_email: 'briantom@u.washington.edu' },
  { school: 'Stanford', conf: 'ACC', st: 'CA', city: 'Stanford', coach: 'David Esquer', sid_email: 'nrsako@stanford.edu' },
  { school: 'California', conf: 'ACC', st: 'CA', city: 'Berkeley', coach: 'Mike Neu', sid_email: 'vangendern@berkeley.edu' },

  // Ivy League
  { school: 'Brown', conf: 'Ivy', st: 'RI', city: 'Providence', coach: 'Grant Achilles', sid_email: 'eric_peterson@brown.edu' },
  { school: 'Columbia', conf: 'Ivy', st: 'NY', city: 'New York', coach: 'Brett Boretti', sid_email: 'mk3531@columbia.edu' },
  { school: 'Cornell', conf: 'Ivy', st: 'NY', city: 'Ithaca', coach: 'Dan Pepicelli', sid_email: 'blt44@cornell.edu' },
  { school: 'Dartmouth', conf: 'Ivy', st: 'NH', city: 'Hanover', coach: 'Bob Whalen', sid_email: 'rick.bender@dartmouth.edu' },
  { school: 'Harvard', conf: 'Ivy', st: 'MA', city: 'Cambridge', coach: 'Bill Decker', sid_email: 'dhorahan@fas.harvard.edu' },
  { school: 'Penn', conf: 'Ivy', st: 'PA', city: 'Philadelphia', coach: 'John Yurkow', sid_email: 'gregmays@upenn.edu' },
  { school: 'Princeton', conf: 'Ivy', st: 'NJ', city: 'Princeton', coach: 'Scott Bradley', sid_email: 'wcroxton@princeton.edu' },
  { school: 'Yale', conf: 'Ivy', st: 'CT', city: 'New Haven', coach: 'John Stuper', sid_email: 'ernie.bertothy@gmail.com' },

  // Additional major conferences (abbreviated — full list in original seed)
  { school: 'Coastal Carolina', conf: 'Sun Belt', st: 'SC', city: 'Conway', coach: 'Gary Gilmore', sid_email: 'kdavis6@coastal.edu' },
  { school: 'East Carolina', conf: 'AAC', st: 'NC', city: 'Greenville', coach: 'Cliff Godwin', sid_email: 'graym@ecu.edu' },
  { school: 'FAU', conf: 'AAC', st: 'FL', city: 'Boca Raton', coach: 'John McCormack', sid_email: 'jfraysur@fau.edu' },
  { school: 'Rice', conf: 'AAC', st: 'TX', city: 'Houston', coach: 'Matt Bragga', sid_email: 'jsully@rice.edu' },
  { school: 'Tulane', conf: 'AAC', st: 'LA', city: 'New Orleans', coach: 'Travis Jewett', sid_email: 'cverdin1@tulane.edu' },
  { school: 'Dallas Baptist', conf: 'MVC', st: 'TX', city: 'Dallas', coach: 'Dan Heefner', sid_email: 'reagan@dbu.edu' },
  { school: 'Gonzaga', conf: 'WCC', st: 'WA', city: 'Spokane', coach: 'Mark Machtolf', sid_email: 'zeidlert@gonzaga.edu' },
  { school: 'Pepperdine', conf: 'WCC', st: 'CA', city: 'Malibu', coach: 'Rick Hirtensteiner', sid_email: 'ricky.davis@pepperdine.edu' },
  { school: 'San Diego', conf: 'WCC', st: 'CA', city: 'San Diego', coach: 'Rich Hill', sid_email: 'rmcpherson@sandiego.edu' },
  { school: 'Fresno State', conf: 'MW', st: 'CA', city: 'Fresno', coach: 'Mike Batesole', sid_email: 'tblanshan@csufresno.edu' },
  { school: 'San Diego State', conf: 'MW', st: 'CA', city: 'San Diego', coach: 'Mark Martinez', sid_email: 'jsolien@sdsu.edu' },
  { school: 'UNLV', conf: 'MW', st: 'NV', city: 'Las Vegas', coach: 'Stan Stolte', sid_email: 'jeff.seals@unlv.edu' },
  { school: 'Grand Canyon', conf: 'WAC', st: 'AZ', city: 'Phoenix', coach: 'Andy Stankiewicz', sid_email: 'josh.hauser@gcu.edu' },
  { school: 'Liberty', conf: 'C-USA', st: 'VA', city: 'Lynchburg', coach: 'Scott Jackson', sid_email: 'rbomberger@liberty.edu' },
  { school: 'Cal State Fullerton', conf: 'Big West', st: 'CA', city: 'Fullerton', coach: 'Rick Vanderhook', sid_email: 'bfreese@fullerton.edu' },
  { school: 'Long Beach State', conf: 'Big West', st: 'CA', city: 'Long Beach', coach: 'Eric Valenzuela', sid_email: 'tyler.hendrickson@csulb.edu' },
  { school: 'UC Irvine', conf: 'Big West', st: 'CA', city: 'Irvine', coach: 'Ben Orloff', sid_email: 'acroteau@uci.edu' },
  { school: 'UC Santa Barbara', conf: 'Big West', st: 'CA', city: 'Santa Barbara', coach: 'Andrew Checketts', sid_email: 'daniel.moebusbowles@athletics.ucsb.edu' },
  { school: 'College of Charleston', conf: 'CAA', st: 'SC', city: 'Charleston', coach: 'Chad Holbrook', sid_email: 'noblew@cofc.edu' },
  { school: 'Oral Roberts', conf: 'Summit', st: 'OK', city: 'Tulsa', coach: 'Ryan Folmar', sid_email: 'tpounds@oru.edu' },
  { school: 'Stetson', conf: 'ASUN', st: 'FL', city: 'DeLand', coach: 'Steve Trimper', sid_email: 'jhazel@stetson.edu' },
  { school: 'FGCU', conf: 'ASUN', st: 'FL', city: 'Fort Myers', coach: 'Dave Tollett', sid_email: 'mellis@fgcu.edu' },
  { school: 'Campbell', conf: 'Big South', st: 'NC', city: 'Buies Creek', coach: 'Justin Haire', sid_email: 'eortiz@campbell.edu' },
  { school: 'Southeastern Louisiana', conf: 'Southland', st: 'LA', city: 'Hammond', coach: 'Matt Riser', sid_email: 'damon.sunde@selu.edu' },
  { school: 'Sam Houston State', conf: 'Southland', st: 'TX', city: 'Huntsville', coach: 'Jay Siriianni', sid_email: 'ben.rickard@shsu.edu' },
]

// ── D2 programs ──────────────────────────────────────────────────────────
const D2 = [
  { school: 'Tampa', conf: 'SSC', st: 'FL', city: 'Tampa' },
  { school: 'Florida Southern', conf: 'SSC', st: 'FL', city: 'Lakeland' },
  { school: 'Nova Southeastern', conf: 'SSC', st: 'FL', city: 'Fort Lauderdale' },
  { school: 'Lynn University', conf: 'SSC', st: 'FL', city: 'Boca Raton' },
  { school: 'Rollins College', conf: 'SSC', st: 'FL', city: 'Winter Park' },
  { school: 'Embry-Riddle', conf: 'SSC', st: 'FL', city: 'Daytona Beach' },
  { school: 'Saint Leo', conf: 'SSC', st: 'FL', city: 'Saint Leo' },
  { school: 'Palm Beach Atlantic', conf: 'SSC', st: 'FL', city: 'West Palm Beach' },
  { school: 'Barry University', conf: 'SSC', st: 'FL', city: 'Miami Shores' },
  { school: 'Eckerd College', conf: 'SSC', st: 'FL', city: 'St. Petersburg' },
  { school: 'Florida Tech', conf: 'SSC', st: 'FL', city: 'Melbourne' },
  { school: 'Central Missouri', conf: 'MIAA', st: 'MO', city: 'Warrensburg' },
  { school: 'Emporia State', conf: 'MIAA', st: 'KS', city: 'Emporia' },
  { school: 'Pittsburg State', conf: 'MIAA', st: 'KS', city: 'Pittsburg' },
  { school: 'Missouri Western', conf: 'MIAA', st: 'MO', city: 'St. Joseph' },
  { school: 'Northwest Missouri State', conf: 'MIAA', st: 'MO', city: 'Maryville' },
  { school: 'Augustana (SD)', conf: 'NSIC', st: 'SD', city: 'Sioux Falls' },
  { school: 'Minnesota State', conf: 'NSIC', st: 'MN', city: 'Mankato' },
  { school: 'Winona State', conf: 'NSIC', st: 'MN', city: 'Winona' },
  { school: 'St. Cloud State', conf: 'NSIC', st: 'MN', city: 'St. Cloud' },
  { school: 'Southern New Hampshire', conf: 'NE-10', st: 'NH', city: 'Manchester' },
  { school: 'Assumption', conf: 'NE-10', st: 'MA', city: 'Worcester' },
  { school: 'Bentley', conf: 'NE-10', st: 'MA', city: 'Waltham' },
  { school: 'Merrimack', conf: 'NE-10', st: 'MA', city: 'North Andover' },
  { school: 'West Florida', conf: 'GSC', st: 'FL', city: 'Pensacola' },
  { school: 'Delta State', conf: 'GSC', st: 'MS', city: 'Cleveland' },
  { school: 'Valdosta State', conf: 'GSC', st: 'GA', city: 'Valdosta' },
  { school: 'North Greenville', conf: 'GSC', st: 'SC', city: 'Tigerville' },
  { school: 'West Alabama', conf: 'GSC', st: 'AL', city: 'Livingston' },
  { school: 'Anderson (SC)', conf: 'SAC', st: 'SC', city: 'Anderson' },
  { school: 'Wingate', conf: 'SAC', st: 'NC', city: 'Wingate' },
  { school: 'Catawba', conf: 'SAC', st: 'NC', city: 'Salisbury' },
  { school: 'Lenoir-Rhyne', conf: 'SAC', st: 'NC', city: 'Hickory' },
  { school: 'Mount Olive', conf: 'CCAC', st: 'NC', city: 'Mount Olive' },
  { school: 'Angelo State', conf: 'LSC', st: 'TX', city: 'San Angelo' },
  { school: 'Lubbock Christian', conf: 'LSC', st: 'TX', city: 'Lubbock' },
  { school: "St. Edward's", conf: 'LSC', st: 'TX', city: 'Austin' },
  { school: 'Texas A&M-Kingsville', conf: 'LSC', st: 'TX', city: 'Kingsville' },
  { school: 'Columbus State', conf: 'PBC', st: 'GA', city: 'Columbus' },
  { school: 'Lander', conf: 'PBC', st: 'SC', city: 'Greenwood' },
  { school: 'USC Aiken', conf: 'PBC', st: 'SC', city: 'Aiken' },
  { school: 'Young Harris', conf: 'PBC', st: 'GA', city: 'Young Harris' },
  { school: 'Millersville', conf: 'PSAC', st: 'PA', city: 'Millersville' },
  { school: 'West Chester', conf: 'PSAC', st: 'PA', city: 'West Chester' },
  { school: 'Shippensburg', conf: 'PSAC', st: 'PA', city: 'Shippensburg' },
]

// ── D3 programs ──────────────────────────────────────────────────────────
const D3 = [
  { school: 'Trinity (TX)', conf: 'SCAC', st: 'TX', city: 'San Antonio' },
  { school: 'Emory', conf: 'UAA', st: 'GA', city: 'Atlanta' },
  { school: 'Johns Hopkins', conf: 'Centennial', st: 'MD', city: 'Baltimore' },
  { school: 'Amherst', conf: 'NESCAC', st: 'MA', city: 'Amherst' },
  { school: 'Williams', conf: 'NESCAC', st: 'MA', city: 'Williamstown' },
  { school: 'Middlebury', conf: 'NESCAC', st: 'VT', city: 'Middlebury' },
  { school: 'Tufts', conf: 'NESCAC', st: 'MA', city: 'Medford' },
  { school: 'Wesleyan', conf: 'NESCAC', st: 'CT', city: 'Middletown' },
  { school: 'Bowdoin', conf: 'NESCAC', st: 'ME', city: 'Brunswick' },
  { school: 'Bates', conf: 'NESCAC', st: 'ME', city: 'Lewiston' },
  { school: 'Colby', conf: 'NESCAC', st: 'ME', city: 'Waterville' },
  { school: 'Hamilton', conf: 'NESCAC', st: 'NY', city: 'Clinton' },
  { school: 'Chapman', conf: 'SCIAC', st: 'CA', city: 'Orange' },
  { school: 'Pomona-Pitzer', conf: 'SCIAC', st: 'CA', city: 'Claremont' },
  { school: 'Claremont-Mudd-Scripps', conf: 'SCIAC', st: 'CA', city: 'Claremont' },
  { school: 'Redlands', conf: 'SCIAC', st: 'CA', city: 'Redlands' },
  { school: 'Adrian College', conf: 'MIAA-D3', st: 'MI', city: 'Adrian' },
  { school: 'Webster University', conf: 'SLIAC', st: 'MO', city: 'Webster Groves' },
  { school: 'UT Dallas', conf: 'ASC', st: 'TX', city: 'Richardson' },
  { school: 'Concordia (TX)', conf: 'ASC', st: 'TX', city: 'Austin' },
  { school: 'Randolph-Macon', conf: 'ODAC', st: 'VA', city: 'Ashland' },
  { school: 'Shenandoah', conf: 'ODAC', st: 'VA', city: 'Winchester' },
  { school: 'Salisbury', conf: 'CAC', st: 'MD', city: 'Salisbury' },
  { school: 'Christopher Newport', conf: 'CAC', st: 'VA', city: 'Newport News' },
  { school: 'Rowan', conf: 'NJAC', st: 'NJ', city: 'Glassboro' },
  { school: 'TCNJ', conf: 'NJAC', st: 'NJ', city: 'Ewing' },
  { school: 'Ramapo', conf: 'NJAC', st: 'NJ', city: 'Mahwah' },
  { school: 'Montclair State', conf: 'NJAC', st: 'NJ', city: 'Montclair' },
  { school: 'SUNY Cortland', conf: 'SUNYAC', st: 'NY', city: 'Cortland' },
  { school: 'RPI', conf: 'Liberty', st: 'NY', city: 'Troy' },
  { school: 'WPI', conf: 'NEWMAC', st: 'MA', city: 'Worcester' },
  { school: 'MIT', conf: 'NEWMAC', st: 'MA', city: 'Cambridge' },
  { school: 'Babson', conf: 'NEWMAC', st: 'MA', city: 'Wellesley' },
  { school: 'Endicott', conf: 'CCC', st: 'MA', city: 'Beverly' },
  { school: 'Wheaton (MA)', conf: 'NEWMAC', st: 'MA', city: 'Norton' },
  { school: 'Case Western Reserve', conf: 'UAA', st: 'OH', city: 'Cleveland' },
  { school: 'Carnegie Mellon', conf: 'UAA', st: 'PA', city: 'Pittsburgh' },
  { school: 'Washington (MO)', conf: 'UAA', st: 'MO', city: 'St. Louis' },
  { school: 'NYU', conf: 'UAA', st: 'NY', city: 'New York' },
  { school: 'Brandeis', conf: 'UAA', st: 'MA', city: 'Waltham' },
]

// ── Build and upsert ─────────────────────────────────────────────────────

const programRows = []
const coachRows = [] // { school_name, coach, sid_email, sid_phone }

// D1 with coaches
for (const e of D1_WITH_COACHES) {
  programRows.push({
    sport: 'baseball',
    school_name: e.school,
    division: 'D1',
    conference: e.conf,
    state: e.st,
    city: e.city,
    scholarship_available: true,
    source_url: 'https://www.sportswriters.net/ncbwa/links/',
  })
  if (e.coach) {
    coachRows.push({ school_name: e.school, full_name: e.coach, title: 'Head Coach', email: e.sid_email || null, phone: e.sid_phone || null })
  }
}

// D2
for (const e of D2) {
  programRows.push({
    sport: 'baseball',
    school_name: e.school,
    division: 'D2',
    conference: e.conf,
    state: e.st,
    city: e.city,
    scholarship_available: true,
  })
}

// D3
for (const e of D3) {
  programRows.push({
    sport: 'baseball',
    school_name: e.school,
    division: 'D3',
    conference: e.conf,
    state: e.st,
    city: e.city,
    scholarship_available: false,
  })
}

// JUCO
for (const e of jucoData) {
  programRows.push({
    sport: 'baseball',
    school_name: e.school,
    division: 'JUCO',
    conference: e.conference || null,
    state: e.state || null,
    city: e.city || null,
    scholarship_available: true,
    source_url: e.source_url || null,
  })
}

// Dedupe
const seen = new Set()
const unique = programRows.filter(r => {
  const key = `${r.school_name}|${r.sport}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

const d1Count = unique.filter(r => r.division === 'D1').length
const d2Count = unique.filter(r => r.division === 'D2').length
const d3Count = unique.filter(r => r.division === 'D3').length
const jucoCount = unique.filter(r => r.division === 'JUCO').length
console.log(`Seeding ${unique.length} programs: ${d1Count} D1, ${d2Count} D2, ${d3Count} D3, ${jucoCount} JUCO`)

// Upsert programs in batches.
const BATCH = 50
for (let i = 0; i < unique.length; i += BATCH) {
  const batch = unique.slice(i, i + BATCH)
  const { error } = await sb.from('koto_recruiting_programs').upsert(batch, { onConflict: 'school_name,sport', ignoreDuplicates: false })
  if (error) console.error(`  Programs batch ${i}: ${error.message}`)
  else process.stdout.write('.')
}
console.log('\nPrograms done.')

// Now insert coaches — need to look up program IDs first.
if (coachRows.length > 0) {
  console.log(`\nSeeding ${coachRows.length} D1 head coaches...`)
  for (const c of coachRows) {
    const { data: prog } = await sb.from('koto_recruiting_programs').select('id').eq('school_name', c.school_name).eq('sport', 'baseball').maybeSingle()
    if (!prog) { console.warn(`  Skip coach ${c.full_name} — program ${c.school_name} not found`); continue }

    // Check if coach already exists for this program.
    const { data: existing } = await sb.from('koto_recruiting_coaches').select('id').eq('program_id', prog.id).eq('full_name', c.full_name).maybeSingle()
    if (existing) { process.stdout.write('.'); continue }

    const { error } = await sb.from('koto_recruiting_coaches').insert({
      program_id: prog.id,
      full_name: c.full_name,
      title: c.title,
      email: c.email,
      phone: c.phone,
    })
    if (error) console.error(`  Coach ${c.full_name}: ${error.message}`)
    else process.stdout.write('+')
  }
  console.log('\nCoaches done.')
}

console.log('\nAll done!')
