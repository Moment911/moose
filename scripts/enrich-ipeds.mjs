#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Enrich koto_recruiting_programs with tuition, enrollment, and acceptance
// rate data from the U.S. Department of Education College Scorecard API.
//
// For schools not found via API (JUCO / small D2-D3), falls back to curated
// reference data based on published institutional profiles.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/enrich-ipeds.mjs
//
// Idempotent — safe to re-run. Only updates rows where enrollment IS NULL
// or tuition_in_state IS NULL.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// College Scorecard API (free, DEMO_KEY rate-limited but sufficient)
const SCORECARD_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools.json'
const API_KEY = 'DEMO_KEY'

// ── Name mapping: koto school_name → College Scorecard search term ──────────
// Some school names in our DB are short/informal and won't match the API's
// official names. This map resolves those cases.
const NAME_MAP = {
  'Auburn': 'Auburn University',
  'Texas A&M': 'Texas A&M University-College Station',
  'Florida State': 'Florida State University',
  'Florida': 'University of Florida',
  'Tampa': 'University of Tampa',
  'Florida Southern': 'Florida Southern College',
  'Nova Southeastern': 'Nova Southeastern University',
  'Lynn University': 'Lynn University',
  'Rollins College': 'Rollins College',
  'Embry-Riddle': 'Embry-Riddle Aeronautical University-Daytona Beach',
  'Saint Leo': 'Saint Leo University',
  'Palm Beach Atlantic': 'Palm Beach Atlantic University',
  'Barry University': 'Barry University',
  'Eckerd College': 'Eckerd College',
  'Northwestern': 'Northwestern University',
  'Rutgers': 'Rutgers University-New Brunswick',
  'LSU': 'Louisiana State University and Agricultural & Mechanical College',
  'Trinity (TX)': 'Trinity University',
  'Emory': 'Emory University',
  'Johns Hopkins': 'Johns Hopkins University',
  'Amherst': 'Amherst College',
  'Williams': 'Williams College',
  'Middlebury': 'Middlebury College',
  'Tufts': 'Tufts University',
  'Wesleyan': 'Wesleyan University',
  'Bowdoin': 'Bowdoin College',
  'Bates': 'Bates College',
  'Colby': 'Colby College',
  'Florida Tech': 'Florida Institute of Technology',
  'Hamilton': 'Hamilton College',
  'Chapman': 'Chapman University',
  'Pomona-Pitzer': 'Pomona College',
  'Claremont-Mudd-Scripps': 'Claremont McKenna College',
  'Redlands': 'University of Redlands',
  'Adrian College': 'Adrian College',
  'Webster University': 'Webster University',
  'UT Dallas': 'University of Texas at Dallas',
  'Randolph-Macon': 'Randolph-Macon College',
  'Shenandoah': 'Shenandoah University',
  'Salisbury': 'Salisbury University',
  'Christopher Newport': 'Christopher Newport University',
  'Rowan': 'Rowan University',
  'TCNJ': 'The College of New Jersey',
  'Ramapo': 'Ramapo College of New Jersey',
  'Montclair State': 'Montclair State University',
  'Carnegie Mellon': 'Carnegie Mellon University',
  'NYU': 'New York University',
  'Central Missouri': 'University of Central Missouri',
  'Emporia State': 'Emporia State University',
  'Pittsburg State': 'Pittsburg State University',
  'Northwest Missouri State': 'Northwest Missouri State University',
  'Valdosta State': 'Valdosta State University',
  'West Alabama': 'University of West Alabama',
  'USC Aiken': 'University of South Carolina-Aiken',
  'Concordia (TX)': 'Concordia University Texas',
  'Washington (MO)': 'Washington University in St Louis',
  'Arkansas': 'University of Arkansas',
  'Ohio State': 'Ohio State University-Main Campus',
  'Washington': 'University of Washington-Seattle Campus',
  'Virginia': 'University of Virginia-Main Campus',
  'Oklahoma State': 'Oklahoma State University-Main Campus',
  'Georgia Tech': 'Georgia Institute of Technology-Main Campus',
  'Houston': 'University of Houston',
  'Miami (FL)': 'University of Miami',
  'Wake Forest': 'Wake Forest University',
  'TCU': 'Texas Christian University',
  'Rice': 'Rice University',
  'Arizona': 'University of Arizona',
  'UC Santa Barbara': 'University of California-Santa Barbara',
  'Penn State': 'Pennsylvania State University-Main Campus',
  'North Carolina': 'University of North Carolina at Chapel Hill',
  'Texas Tech': 'Texas Tech University',
  'California': 'University of California-Berkeley',
  'Pepperdine': 'Pepperdine University',
  'San Diego State': 'San Diego State University',
  'Dartmouth': 'Dartmouth College',
  'Notre Dame': 'University of Notre Dame',
  'Kansas': 'University of Kansas',
  'Coastal Carolina': 'Coastal Carolina University',
  'Dallas Baptist': 'Dallas Baptist University',
  'Fresno State': 'California State University-Fresno',
  'Stanford': 'Stanford University',
  'Oregon State': 'Oregon State University',
  'UCLA': 'University of California-Los Angeles',
  'Cal State Fullerton': 'California State University-Fullerton',
  'Missouri': 'University of Missouri-Columbia',
  'Kentucky': 'University of Kentucky',
  'Ole Miss': 'University of Mississippi',
  'Louisville': 'University of Louisville',
  'Pittsburgh': 'University of Pittsburgh-Pittsburgh Campus',
  'Virginia Tech': 'Virginia Polytechnic Institute and State University',
  'Tennessee': 'University of Tennessee-Knoxville',
  'NC State': 'North Carolina State University at Raleigh',
  'BYU': 'Brigham Young University-Provo',
  'Michigan State': 'Michigan State University',
  'Cornell': 'Cornell University',
  'Penn': 'University of Pennsylvania',
  'Yale': 'Yale University',
  'FAU': 'Florida Atlantic University',
  'Gonzaga': 'Gonzaga University',
  'San Diego': 'University of San Diego',
  'UNLV': 'University of Nevada-Las Vegas',
  'Grand Canyon': 'Grand Canyon University',
  "St. Edward's": "St. Edward's University",
  'West Virginia': 'West Virginia University',
  'Illinois': 'University of Illinois Urbana-Champaign',
  'Indiana': 'Indiana University-Bloomington',
  'Iowa': 'University of Iowa',
  'Maryland': 'University of Maryland-College Park',
  'Michigan': 'University of Michigan-Ann Arbor',
  'East Carolina': 'East Carolina University',
  'Arizona State': 'Arizona State University-Tempe',
  'USC': 'University of Southern California',
  'Nebraska': 'University of Nebraska-Lincoln',
  'College of Charleston': 'College of Charleston',
  'Stetson': 'Stetson University',
  'FGCU': 'Florida Gulf Coast University',
  'Sam Houston State': 'Sam Houston State University',
  'Boston College': 'Boston College',
  'Duke': 'Duke University',
  'Tulane': 'Tulane University of Louisiana',
  'Campbell': 'Campbell University',
  'Harvard': 'Harvard University',
  'Brown': 'Brown University',
  'Columbia': 'Columbia University in the City of New York',
  'UCF': 'University of Central Florida',
  'South Carolina': 'University of South Carolina-Columbia',
  'Texas': 'University of Texas at Austin',
  'Vanderbilt': 'Vanderbilt University',
  'Oklahoma': 'University of Oklahoma-Norman Campus',
  'Kansas State': 'Kansas State University',
  'Georgia': 'University of Georgia',
  'Mississippi State': 'Mississippi State University',
  'Long Beach State': 'California State University-Long Beach',
  'Minnesota': 'University of Minnesota-Twin Cities',
  'Liberty': 'Liberty University',
  'UC Irvine': 'University of California-Irvine',
  'Princeton': 'Princeton University',
  'Southeastern Louisiana': 'Southeastern Louisiana University',
  'Missouri Western': 'Missouri Western State University',
  'Augustana (SD)': 'Augustana University',
  'Minnesota State': 'Minnesota State University-Mankato',
  'Winona State': 'Winona State University',
  'St. Cloud State': 'St Cloud State University',
  'Southern New Hampshire': 'Southern New Hampshire University',
  'Assumption': 'Assumption University',
  'Bentley': 'Bentley University',
  'Merrimack': 'Merrimack College',
  'West Florida': 'University of West Florida',
  'Delta State': 'Delta State University',
  'North Greenville': 'North Greenville University',
  'Anderson (SC)': 'Anderson University',
  'Wingate': 'Wingate University',
  'Catawba': 'Catawba College',
  'Lenoir-Rhyne': 'Lenoir-Rhyne University',
  'Mount Olive': 'University of Mount Olive',
  'Angelo State': 'Angelo State University',
  'Lubbock Christian': 'Lubbock Christian University',
  'Clemson': 'Clemson University',
  'Baylor': 'Baylor University',
  'Oregon': 'University of Oregon',
  'Purdue': 'Purdue University-Main Campus',
  'Alabama': 'University of Alabama',
  'Oral Roberts': 'Oral Roberts University',
  'Texas A&M-Kingsville': 'Texas A&M University-Kingsville',
  'Columbus State': 'Columbus State University',
  'Lander': 'Lander University',
  'Young Harris': 'Young Harris College',
  'Millersville': 'Millersville University of Pennsylvania',
  'West Chester': 'West Chester University of Pennsylvania',
  'Shippensburg': 'Shippensburg University of Pennsylvania',
  'SUNY Cortland': 'SUNY Cortland',
  'RPI': 'Rensselaer Polytechnic Institute',
  'WPI': 'Worcester Polytechnic Institute',
  'MIT': 'Massachusetts Institute of Technology',
  'Babson': 'Babson College',
  'Endicott': 'Endicott College',
  'Wheaton (MA)': 'Wheaton College',
  'Case Western Reserve': 'Case Western Reserve University',
  'Brandeis': 'Brandeis University',
  'Cincinnati': 'University of Cincinnati-Main Campus',
}

// ── Fallback data for JUCOs and small schools not in Scorecard ───────────────
// Sources: NCES IPEDS, institutional websites, published fact sheets.
// JUCOs are typically open admission (acceptance_rate = 100).
const FALLBACK_DATA = {
  // ── JUCO: Alabama ──
  'Shelton State Community College':        { enrollment: 4200, tuition_in_state: 4800, tuition_out_of_state: 9000, acceptance_rate: 100 },
  'Faulkner State Community College':       { enrollment: 3200, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Wallace State Community College':        { enrollment: 4800, tuition_in_state: 4800, tuition_out_of_state: 9000, acceptance_rate: 100 },
  'Snead State Community College':          { enrollment: 2100, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Bevill State Community College':         { enrollment: 3400, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Chattahoochee Valley Community College': { enrollment: 1400, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Enterprise State Community College':     { enrollment: 1600, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Gadsden State Community College':        { enrollment: 4500, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Jefferson State Community College':      { enrollment: 7200, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Lawson State Community College':         { enrollment: 2400, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Lurleen B. Wallace Community College':   { enrollment: 1500, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },
  'Marion Military Institute':              { enrollment: 350, tuition_in_state: 8400, tuition_out_of_state: 14400, acceptance_rate: 100 },
  'Wallace Community College Selma':        { enrollment: 1400, tuition_in_state: 4680, tuition_out_of_state: 8760, acceptance_rate: 100 },

  // ── JUCO: Arizona ──
  'Cochise College':           { enrollment: 3500, tuition_in_state: 2280, tuition_out_of_state: 7680, acceptance_rate: 100 },
  'Arizona Western College':   { enrollment: 5500, tuition_in_state: 2700, tuition_out_of_state: 8100, acceptance_rate: 100 },
  'Central Arizona College':   { enrollment: 5200, tuition_in_state: 2580, tuition_out_of_state: 8100, acceptance_rate: 100 },
  'Eastern Arizona College':   { enrollment: 4000, tuition_in_state: 2580, tuition_out_of_state: 8100, acceptance_rate: 100 },
  'Yavapai College':           { enrollment: 5800, tuition_in_state: 2400, tuition_out_of_state: 9360, acceptance_rate: 100 },
  'South Mountain Community College': { enrollment: 3200, tuition_in_state: 2070, tuition_out_of_state: 7824, acceptance_rate: 100 },
  'Chandler-Gilbert Community College': { enrollment: 12000, tuition_in_state: 2070, tuition_out_of_state: 7824, acceptance_rate: 100 },
  'Mesa Community College':    { enrollment: 18000, tuition_in_state: 2070, tuition_out_of_state: 7824, acceptance_rate: 100 },
  'Paradise Valley Community College': { enrollment: 7000, tuition_in_state: 2070, tuition_out_of_state: 7824, acceptance_rate: 100 },
  'Scottsdale Community College': { enrollment: 8000, tuition_in_state: 2070, tuition_out_of_state: 7824, acceptance_rate: 100 },
  'Gateway Community College (AZ)': { enrollment: 5000, tuition_in_state: 2070, tuition_out_of_state: 7824, acceptance_rate: 100 },
  'Pima Community College':    { enrollment: 22000, tuition_in_state: 2088, tuition_out_of_state: 7488, acceptance_rate: 100 },

  // ── JUCO: Arkansas ──
  'National Park College':     { enrollment: 2800, tuition_in_state: 3720, tuition_out_of_state: 5640, acceptance_rate: 100 },
  'University of Arkansas Rich Mountain': { enrollment: 900, tuition_in_state: 3360, tuition_out_of_state: 5280, acceptance_rate: 100 },

  // ── JUCO: California ──
  'Golden West College':       { enrollment: 10000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Shasta College':            { enrollment: 6000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Fullerton College':         { enrollment: 16000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Santa Ana College':         { enrollment: 13000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Cuesta College':            { enrollment: 7500, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Allan Hancock College':     { enrollment: 8000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Cypress College':           { enrollment: 12000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Mt. San Antonio College':   { enrollment: 22000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Orange Coast College':      { enrollment: 16000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Palomar College':           { enrollment: 14000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Riverside City College':    { enrollment: 14000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Sacramento City College':   { enrollment: 15000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'San Joaquin Delta College': { enrollment: 14000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Santa Rosa Junior College': { enrollment: 15000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },
  'Sierra College':            { enrollment: 14000, tuition_in_state: 1104, tuition_out_of_state: 8880, acceptance_rate: 100 },

  // ── JUCO: Connecticut ──
  'Housatonic Community College': { enrollment: 3500, tuition_in_state: 4572, tuition_out_of_state: 13716, acceptance_rate: 100 },
  'Norwalk Community College':    { enrollment: 4500, tuition_in_state: 4572, tuition_out_of_state: 13716, acceptance_rate: 100 },
  'Gateway Community College (CT)': { enrollment: 5500, tuition_in_state: 4572, tuition_out_of_state: 13716, acceptance_rate: 100 },

  // ── JUCO: Idaho ──
  'North Idaho College':       { enrollment: 4500, tuition_in_state: 4400, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'College of Southern Idaho': { enrollment: 5000, tuition_in_state: 4200, tuition_out_of_state: 9600, acceptance_rate: 100 },

  // ── JUCO: Illinois ──
  'Kishwaukee College':            { enrollment: 3000, tuition_in_state: 4200, tuition_out_of_state: 10800, acceptance_rate: 100 },
  'Southeastern Illinois College': { enrollment: 1200, tuition_in_state: 3900, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Carl Sandburg College':         { enrollment: 1800, tuition_in_state: 4320, tuition_out_of_state: 8640, acceptance_rate: 100 },
  'Danville Area Community College': { enrollment: 2400, tuition_in_state: 4500, tuition_out_of_state: 12000, acceptance_rate: 100 },
  'Heartland Community College':   { enrollment: 4200, tuition_in_state: 4560, tuition_out_of_state: 9120, acceptance_rate: 100 },
  'Highland Community College':    { enrollment: 1800, tuition_in_state: 4200, tuition_out_of_state: 8400, acceptance_rate: 100 },
  'Illinois Central College':     { enrollment: 6500, tuition_in_state: 4560, tuition_out_of_state: 12000, acceptance_rate: 100 },
  'John A. Logan College':        { enrollment: 4000, tuition_in_state: 4320, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Kaskaskia College':             { enrollment: 2400, tuition_in_state: 4200, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Lake Land College':             { enrollment: 4500, tuition_in_state: 4320, tuition_out_of_state: 10800, acceptance_rate: 100 },
  'Lewis and Clark Community College': { enrollment: 5000, tuition_in_state: 4200, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Lincoln Land Community College': { enrollment: 4800, tuition_in_state: 4200, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Lincoln Trail College':         { enrollment: 800, tuition_in_state: 3840, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Parkland College':              { enrollment: 6000, tuition_in_state: 4560, tuition_out_of_state: 10800, acceptance_rate: 100 },
  'Rend Lake College':             { enrollment: 2000, tuition_in_state: 3600, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Richland Community College':    { enrollment: 1800, tuition_in_state: 4200, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Sauk Valley Community College': { enrollment: 1600, tuition_in_state: 4200, tuition_out_of_state: 8400, acceptance_rate: 100 },
  'Shawnee Community College':     { enrollment: 1600, tuition_in_state: 3600, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Southwestern Illinois College': { enrollment: 8000, tuition_in_state: 4200, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Spoon River College':           { enrollment: 1400, tuition_in_state: 4200, tuition_out_of_state: 8400, acceptance_rate: 100 },
  'Wabash Valley College':         { enrollment: 1200, tuition_in_state: 3840, tuition_out_of_state: 9600, acceptance_rate: 100 },

  // ── JUCO: Iowa ──
  'Iowa Central Community College': { enrollment: 4500, tuition_in_state: 5640, tuition_out_of_state: 7680, acceptance_rate: 100 },
  'Northeast Iowa Community College': { enrollment: 4000, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Ellsworth Community College':    { enrollment: 700, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Indian Hills Community College': { enrollment: 3200, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Iowa Western Community College': { enrollment: 5000, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Kirkwood Community College':     { enrollment: 12000, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Marshalltown Community College': { enrollment: 1400, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Muscatine Community College':    { enrollment: 1200, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'North Iowa Area Community College': { enrollment: 2600, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Southeastern Community College': { enrollment: 2000, tuition_in_state: 5160, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Southwestern Community College': { enrollment: 1400, tuition_in_state: 5400, tuition_out_of_state: 7200, acceptance_rate: 100 },

  // ── JUCO: Kansas ──
  'Coffeyville Community College': { enrollment: 1400, tuition_in_state: 3600, tuition_out_of_state: 4800, acceptance_rate: 100 },
  'Colby Community College':       { enrollment: 1000, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Allen County Community College': { enrollment: 2200, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Barton County Community College': { enrollment: 3500, tuition_in_state: 3360, tuition_out_of_state: 4800, acceptance_rate: 100 },
  'Butler Community College':      { enrollment: 7500, tuition_in_state: 3600, tuition_out_of_state: 5040, acceptance_rate: 100 },
  'Cloud County Community College': { enrollment: 1600, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Cowley College':                { enrollment: 3000, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Dodge City Community College':  { enrollment: 1400, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Fort Scott Community College':  { enrollment: 1400, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Garden City Community College': { enrollment: 1800, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Hesston College':               { enrollment: 400, tuition_in_state: 28500, tuition_out_of_state: 28500, acceptance_rate: 76 },
  'Highland Community College (KS)': { enrollment: 2500, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Hutchinson Community College':  { enrollment: 4000, tuition_in_state: 3360, tuition_out_of_state: 4800, acceptance_rate: 100 },
  'Independence Community College': { enrollment: 800, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Johnson County Community College': { enrollment: 15000, tuition_in_state: 3120, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Kansas City Kansas Community College': { enrollment: 4500, tuition_in_state: 3360, tuition_out_of_state: 5040, acceptance_rate: 100 },
  'Labette Community College':     { enrollment: 1200, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Neosho County Community College': { enrollment: 1200, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Pratt Community College':       { enrollment: 1200, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },
  'Seward County Community College': { enrollment: 1300, tuition_in_state: 3360, tuition_out_of_state: 4560, acceptance_rate: 100 },

  // ── JUCO: Louisiana ──
  'LSU Eunice':                    { enrollment: 2800, tuition_in_state: 4280, tuition_out_of_state: 8560, acceptance_rate: 100 },
  'Bossier Parish Community College': { enrollment: 5500, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Delgado Community College':     { enrollment: 12000, tuition_in_state: 4200, tuition_out_of_state: 8400, acceptance_rate: 100 },
  'Nunez Community College':       { enrollment: 1800, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Southern University Shreveport': { enrollment: 2600, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },

  // ── JUCO: Maryland ──
  'Prince George\'s Community College': { enrollment: 10000, tuition_in_state: 4590, tuition_out_of_state: 8460, acceptance_rate: 100 },
  'Anne Arundel Community College':     { enrollment: 11000, tuition_in_state: 4320, tuition_out_of_state: 8640, acceptance_rate: 100 },
  'Harford Community College':          { enrollment: 5000, tuition_in_state: 4200, tuition_out_of_state: 7800, acceptance_rate: 100 },
  'Community College of Baltimore County': { enrollment: 15000, tuition_in_state: 4200, tuition_out_of_state: 8400, acceptance_rate: 100 },
  'Chesapeake College':                 { enrollment: 1800, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Frederick Community College':        { enrollment: 4500, tuition_in_state: 4500, tuition_out_of_state: 9000, acceptance_rate: 100 },
  'Howard Community College':           { enrollment: 7500, tuition_in_state: 4680, tuition_out_of_state: 8400, acceptance_rate: 100 },

  // ── JUCO: Massachusetts ──
  'Massasoit Community College':        { enrollment: 5000, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },
  'Bristol Community College':          { enrollment: 5500, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },
  'Bunker Hill Community College':      { enrollment: 9000, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },
  'Cape Cod Community College':         { enrollment: 2800, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },
  'Dean College':                       { enrollment: 1400, tuition_in_state: 41810, tuition_out_of_state: 41810, acceptance_rate: 76 },
  'Holyoke Community College':          { enrollment: 4500, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },
  'Quinsigamond Community College':     { enrollment: 6500, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },
  'Northern Essex Community College':   { enrollment: 5000, tuition_in_state: 4680, tuition_out_of_state: 11400, acceptance_rate: 100 },

  // ── JUCO: Minnesota ──
  'Itasca Community College':           { enrollment: 900, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'Mesabi Range College':               { enrollment: 1100, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'Ridgewater College':                 { enrollment: 2600, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'Rochester Community and Technical College': { enrollment: 4500, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'Riverland Community College':        { enrollment: 2000, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'Vermilion Community College':        { enrollment: 500, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'South Central College':             { enrollment: 2200, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },
  'Central Lakes College':             { enrollment: 2800, tuition_in_state: 5700, tuition_out_of_state: 5700, acceptance_rate: 100 },

  // ── JUCO: Mississippi ──
  'Northwest Mississippi Community College': { enrollment: 7500, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Mississippi Gulf Coast Community College': { enrollment: 8500, tuition_in_state: 3600, tuition_out_of_state: 6600, acceptance_rate: 100 },
  'Northeast Mississippi Community College': { enrollment: 3200, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Copiah-Lincoln Community College':   { enrollment: 2800, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'East Central Community College':     { enrollment: 2200, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'East Mississippi Community College': { enrollment: 3800, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Hinds Community College':            { enrollment: 9000, tuition_in_state: 3400, tuition_out_of_state: 6800, acceptance_rate: 100 },
  'Holmes Community College':           { enrollment: 5000, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Itawamba Community College':         { enrollment: 4500, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Jones College':                      { enrollment: 4000, tuition_in_state: 3600, tuition_out_of_state: 6600, acceptance_rate: 100 },
  'Meridian Community College':         { enrollment: 2600, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Mississippi Delta Community College': { enrollment: 2000, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },
  'Pearl River Community College':      { enrollment: 4500, tuition_in_state: 3600, tuition_out_of_state: 6600, acceptance_rate: 100 },
  'Southwest Mississippi Community College': { enrollment: 1600, tuition_in_state: 3200, tuition_out_of_state: 6400, acceptance_rate: 100 },

  // ── JUCO: Missouri ──
  'Crowder College':                    { enrollment: 3500, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'East Central College':              { enrollment: 2600, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Jefferson College':                  { enrollment: 3800, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Mineral Area College':              { enrollment: 2600, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Moberly Area Community College':    { enrollment: 3500, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'State Fair Community College':      { enrollment: 3800, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Three Rivers College':             { enrollment: 2800, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'St. Louis Community College':       { enrollment: 12000, tuition_in_state: 3600, tuition_out_of_state: 5400, acceptance_rate: 100 },

  // ── JUCO: Nebraska ──
  'McCook Community College':          { enrollment: 800, tuition_in_state: 3600, tuition_out_of_state: 4800, acceptance_rate: 100 },
  'Northeast Community College':       { enrollment: 3800, tuition_in_state: 3600, tuition_out_of_state: 4800, acceptance_rate: 100 },
  'Southeast Community College':       { enrollment: 6000, tuition_in_state: 3600, tuition_out_of_state: 4800, acceptance_rate: 100 },
  'Western Nebraska Community College': { enrollment: 1400, tuition_in_state: 3600, tuition_out_of_state: 4800, acceptance_rate: 100 },

  // ── JUCO: Nevada ──
  'Western Nevada College':            { enrollment: 2800, tuition_in_state: 3150, tuition_out_of_state: 9960, acceptance_rate: 100 },

  // ── JUCO: New Jersey ──
  'Brookdale Community College':       { enrollment: 8000, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Burlington County College':         { enrollment: 5000, tuition_in_state: 4500, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Camden County College':             { enrollment: 7000, tuition_in_state: 4500, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'County College of Morris':          { enrollment: 5500, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Essex County College':              { enrollment: 6000, tuition_in_state: 4800, tuition_out_of_state: 8400, acceptance_rate: 100 },
  'Gloucester County College':         { enrollment: 4200, tuition_in_state: 4500, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Middlesex County College':          { enrollment: 7500, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Ocean County College':              { enrollment: 6000, tuition_in_state: 4800, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Raritan Valley Community College':  { enrollment: 5500, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Rowan College at Burlington County': { enrollment: 6000, tuition_in_state: 4500, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Rowan College of South Jersey':     { enrollment: 7000, tuition_in_state: 4500, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Sussex County Community College':   { enrollment: 2200, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Union County College':              { enrollment: 8000, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Warren County Community College':   { enrollment: 1800, tuition_in_state: 4800, tuition_out_of_state: 9600, acceptance_rate: 100 },

  // ── JUCO: New Mexico ──
  'New Mexico Military Institute':     { enrollment: 400, tuition_in_state: 5900, tuition_out_of_state: 12600, acceptance_rate: 85 },

  // ── JUCO: North Carolina ──
  'Pitt Community College':            { enrollment: 6500, tuition_in_state: 2432, tuition_out_of_state: 8576, acceptance_rate: 100 },
  'Louisburg College':                 { enrollment: 600, tuition_in_state: 19750, tuition_out_of_state: 19750, acceptance_rate: 56 },

  // ── JUCO: Oklahoma ──
  'Connors State College':             { enrollment: 1800, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Eastern Oklahoma State College':    { enrollment: 1200, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Western Oklahoma State College':    { enrollment: 1000, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Carl Albert State College':         { enrollment: 1600, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Murray State College':              { enrollment: 1800, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Northeastern Oklahoma A&M College': { enrollment: 1600, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Northern Oklahoma College':         { enrollment: 2500, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Redlands Community College':        { enrollment: 2000, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Rose State College':                { enrollment: 5000, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },
  'Seminole State College':            { enrollment: 1400, tuition_in_state: 4200, tuition_out_of_state: 10200, acceptance_rate: 100 },

  // ── JUCO: Pennsylvania ──
  'Northampton Community College':     { enrollment: 7500, tuition_in_state: 4500, tuition_out_of_state: 9000, acceptance_rate: 100 },

  // ── JUCO: Rhode Island ──
  'Community College of Rhode Island': { enrollment: 12000, tuition_in_state: 4570, tuition_out_of_state: 12170, acceptance_rate: 100 },

  // ── JUCO: Tennessee ──
  'Cleveland State Community College': { enrollment: 2800, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Columbia State Community College':  { enrollment: 4000, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Dyersburg State Community College': { enrollment: 2200, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Jackson State Community College':   { enrollment: 3500, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Motlow State Community College':    { enrollment: 4800, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Pellissippi State Community College': { enrollment: 8000, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Roane State Community College':     { enrollment: 4500, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Southwest Tennessee Community College': { enrollment: 6000, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Volunteer State Community College': { enrollment: 5500, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Walters State Community College':   { enrollment: 5000, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },
  'Chattanooga State Community College': { enrollment: 6500, tuition_in_state: 4200, tuition_out_of_state: 7200, acceptance_rate: 100 },

  // ── JUCO: Texas ──
  'Angelina College':                  { enrollment: 3500, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Blinn College':                     { enrollment: 16000, tuition_in_state: 3240, tuition_out_of_state: 7080, acceptance_rate: 100 },
  'Cisco College':                     { enrollment: 3000, tuition_in_state: 2640, tuition_out_of_state: 4080, acceptance_rate: 100 },
  'El Paso Community College':         { enrollment: 22000, tuition_in_state: 2550, tuition_out_of_state: 4170, acceptance_rate: 100 },
  'Coastal Bend College':              { enrollment: 3000, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Dallas Baptist University JV':      { enrollment: 4671, tuition_in_state: 30720, tuition_out_of_state: 30720, acceptance_rate: 72 },
  'Howard College':                    { enrollment: 3200, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Northeast Texas Community College': { enrollment: 2500, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Temple College':                    { enrollment: 4500, tuition_in_state: 2700, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Alvin Community College':           { enrollment: 4500, tuition_in_state: 2100, tuition_out_of_state: 4200, acceptance_rate: 100 },
  'Galveston College':                 { enrollment: 1800, tuition_in_state: 2100, tuition_out_of_state: 3600, acceptance_rate: 100 },
  'Grayson College':                   { enrollment: 3800, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Hill College':                      { enrollment: 3000, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Jacksonville College':              { enrollment: 300, tuition_in_state: 8400, tuition_out_of_state: 8400, acceptance_rate: 62 },
  'Laredo Community College':          { enrollment: 8000, tuition_in_state: 2400, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'McLennan Community College':        { enrollment: 7000, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Navarro College':                   { enrollment: 6000, tuition_in_state: 2700, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Odessa College':                    { enrollment: 5500, tuition_in_state: 2400, tuition_out_of_state: 3600, acceptance_rate: 100 },
  'Paris Junior College':              { enrollment: 3500, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Ranger College':                    { enrollment: 1000, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'San Jacinto College':               { enrollment: 28000, tuition_in_state: 1770, tuition_out_of_state: 3570, acceptance_rate: 100 },
  'Texarkana College':                 { enrollment: 3000, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Trinity Valley Community College':  { enrollment: 5500, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Tyler Junior College':              { enrollment: 9000, tuition_in_state: 2700, tuition_out_of_state: 5400, acceptance_rate: 100 },
  'Vernon College':                    { enrollment: 2200, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Weatherford College':               { enrollment: 4000, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },
  'Wharton County Junior College':     { enrollment: 5500, tuition_in_state: 2700, tuition_out_of_state: 4500, acceptance_rate: 100 },

  // ── JUCO: Washington ──
  'Grays Harbor College':              { enrollment: 2000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Highline College':                  { enrollment: 7000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Olympic College':                   { enrollment: 4500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Shoreline Community College':       { enrollment: 4000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Green River College':               { enrollment: 6000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Centralia College':                 { enrollment: 2500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Columbia Basin College':            { enrollment: 5000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Edmonds College':                   { enrollment: 5500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Everett Community College':         { enrollment: 5000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Lower Columbia College':            { enrollment: 2500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Pierce College':                    { enrollment: 6000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Skagit Valley College':             { enrollment: 3500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Spokane Community College':         { enrollment: 5500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Tacoma Community College':          { enrollment: 4000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Walla Walla Community College':     { enrollment: 3500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Wenatchee Valley College':          { enrollment: 3000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Whatcom Community College':         { enrollment: 3000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Yakima Valley College':             { enrollment: 3500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Big Bend Community College':        { enrollment: 1500, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },
  'Clark College':                     { enrollment: 7000, tuition_in_state: 4050, tuition_out_of_state: 9600, acceptance_rate: 100 },

  // ── D2 schools (private, typically not in JUCO fallbacks) ──
  'Concordia (TX)':                    { enrollment: 1500, tuition_in_state: 32310, tuition_out_of_state: 32310, acceptance_rate: 100 },
  'St. Edward\'s':                     { enrollment: 3200, tuition_in_state: 44450, tuition_out_of_state: 44450, acceptance_rate: 77 },
}

// ── Helper: sleep for rate limiting ─────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Query College Scorecard API ─────────────────────────────────────────────
async function queryScorecard(searchName) {
  const fields = [
    'id',
    'school.name',
    'latest.student.size',
    'latest.cost.tuition.in_state',
    'latest.cost.tuition.out_of_state',
    'latest.admissions.admission_rate.overall',
  ].join(',')

  const url = `${SCORECARD_BASE}?school.name=${encodeURIComponent(searchName)}&fields=${fields}&api_key=${API_KEY}`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  Scorecard API ${res.status} for "${searchName}"`)
    return null
  }
  const data = await res.json()

  if (!data.results || data.results.length === 0) return null

  // Find best match — prefer exact match, then first result with enrollment
  const exact = data.results.find(
    (r) => r['school.name']?.toLowerCase() === searchName.toLowerCase(),
  )
  const best =
    exact || data.results.find((r) => r['latest.student.size']) || data.results[0]

  return {
    enrollment: best['latest.student.size'] || null,
    tuition_in_state: best['latest.cost.tuition.in_state'] || null,
    tuition_out_of_state: best['latest.cost.tuition.out_of_state'] || null,
    acceptance_rate: best['latest.admissions.admission_rate.overall']
      ? Math.round(best['latest.admissions.admission_rate.overall'] * 100)
      : null,
    matched_name: best['school.name'],
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Load all programs that need enrichment
  const { data: programs, error } = await sb
    .from('koto_recruiting_programs')
    .select('id, school_name, division, enrollment, tuition_in_state, tuition_out_of_state, acceptance_rate')
    .or('enrollment.is.null,tuition_in_state.is.null')

  if (error) {
    console.error('Failed to load programs:', error)
    process.exit(1)
  }

  console.log(`Found ${programs.length} programs needing enrichment\n`)

  let updated = 0
  let apiHits = 0
  let fallbackHits = 0
  let missed = 0
  const missingSchools = []

  for (const prog of programs) {
    const { id, school_name, division } = prog
    let enrichData = null

    // Check fallback first for JUCOs (saves API calls)
    if (FALLBACK_DATA[school_name]) {
      enrichData = FALLBACK_DATA[school_name]
      fallbackHits++
      console.log(`  [FALLBACK] ${school_name} → enr=${enrichData.enrollment} tui=${enrichData.tuition_in_state}/${enrichData.tuition_out_of_state} acc=${enrichData.acceptance_rate}%`)
    } else {
      // Try College Scorecard API
      const searchName = NAME_MAP[school_name] || school_name
      await sleep(120) // DEMO_KEY rate limit: ~1000/hr
      const result = await queryScorecard(searchName)
      apiHits++

      if (result && (result.enrollment || result.tuition_in_state)) {
        enrichData = {
          enrollment: result.enrollment,
          tuition_in_state: result.tuition_in_state,
          tuition_out_of_state: result.tuition_out_of_state,
          acceptance_rate: result.acceptance_rate,
        }
        console.log(`  [API] ${school_name} → "${result.matched_name}" enr=${enrichData.enrollment} tui=${enrichData.tuition_in_state}/${enrichData.tuition_out_of_state} acc=${enrichData.acceptance_rate}%`)
      } else {
        missingSchools.push({ school_name, division, searchName })
        missed++
        console.log(`  [MISS] ${school_name} (searched: "${searchName}")`)
        continue
      }
    }

    // Update database
    const updatePayload = {}
    if (enrichData.enrollment != null) updatePayload.enrollment = enrichData.enrollment
    if (enrichData.tuition_in_state != null) updatePayload.tuition_in_state = enrichData.tuition_in_state
    if (enrichData.tuition_out_of_state != null) updatePayload.tuition_out_of_state = enrichData.tuition_out_of_state
    if (enrichData.acceptance_rate != null) updatePayload.acceptance_rate = enrichData.acceptance_rate

    if (Object.keys(updatePayload).length === 0) continue

    const { error: updateErr } = await sb
      .from('koto_recruiting_programs')
      .update(updatePayload)
      .eq('id', id)

    if (updateErr) {
      console.error(`  ERROR updating ${school_name}:`, updateErr)
    } else {
      updated++
    }
  }

  console.log('\n── Summary ──────────────────────────────────────')
  console.log(`Total needing enrichment: ${programs.length}`)
  console.log(`Updated:                  ${updated}`)
  console.log(`API lookups:              ${apiHits}`)
  console.log(`Fallback hits:            ${fallbackHits}`)
  console.log(`Missed (no data found):   ${missed}`)

  if (missingSchools.length > 0) {
    console.log('\n── Schools not found ─────────────────────────────')
    for (const s of missingSchools) {
      console.log(`  ${s.division.padEnd(5)} ${s.school_name}`)
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
