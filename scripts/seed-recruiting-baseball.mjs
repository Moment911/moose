#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Seed koto_recruiting_programs with NCAA D1/D2/D3 baseball programs.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-recruiting-baseball.mjs
//
// Idempotent — upserts by (school_name, sport).  Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ── D1 Baseball Programs (all 306 NCAA Division I baseball programs) ─────────
const D1 = [
  // ACC
  { school: 'Boston College', conference: 'ACC', state: 'MA', city: 'Chestnut Hill' },
  { school: 'Clemson University', conference: 'ACC', state: 'SC', city: 'Clemson' },
  { school: 'Duke University', conference: 'ACC', state: 'NC', city: 'Durham' },
  { school: 'Florida State University', conference: 'ACC', state: 'FL', city: 'Tallahassee' },
  { school: 'Georgia Tech', conference: 'ACC', state: 'GA', city: 'Atlanta' },
  { school: 'Louisville', conference: 'ACC', state: 'KY', city: 'Louisville' },
  { school: 'Miami (FL)', conference: 'ACC', state: 'FL', city: 'Coral Gables' },
  { school: 'North Carolina', conference: 'ACC', state: 'NC', city: 'Chapel Hill' },
  { school: 'NC State', conference: 'ACC', state: 'NC', city: 'Raleigh' },
  { school: 'Notre Dame', conference: 'ACC', state: 'IN', city: 'Notre Dame' },
  { school: 'Pittsburgh', conference: 'ACC', state: 'PA', city: 'Pittsburgh' },
  { school: 'Virginia', conference: 'ACC', state: 'VA', city: 'Charlottesville' },
  { school: 'Virginia Tech', conference: 'ACC', state: 'VA', city: 'Blacksburg' },
  { school: 'Wake Forest', conference: 'ACC', state: 'NC', city: 'Winston-Salem' },
  { school: 'California', conference: 'ACC', state: 'CA', city: 'Berkeley' },
  { school: 'SMU', conference: 'ACC', state: 'TX', city: 'Dallas' },
  { school: 'Stanford', conference: 'ACC', state: 'CA', city: 'Stanford' },

  // SEC
  { school: 'Alabama', conference: 'SEC', state: 'AL', city: 'Tuscaloosa' },
  { school: 'Arkansas', conference: 'SEC', state: 'AR', city: 'Fayetteville' },
  { school: 'Auburn', conference: 'SEC', state: 'AL', city: 'Auburn' },
  { school: 'Florida', conference: 'SEC', state: 'FL', city: 'Gainesville' },
  { school: 'Georgia', conference: 'SEC', state: 'GA', city: 'Athens' },
  { school: 'Kentucky', conference: 'SEC', state: 'KY', city: 'Lexington' },
  { school: 'LSU', conference: 'SEC', state: 'LA', city: 'Baton Rouge' },
  { school: 'Mississippi State', conference: 'SEC', state: 'MS', city: 'Starkville' },
  { school: 'Missouri', conference: 'SEC', state: 'MO', city: 'Columbia' },
  { school: 'Ole Miss', conference: 'SEC', state: 'MS', city: 'Oxford' },
  { school: 'Oklahoma', conference: 'SEC', state: 'OK', city: 'Norman' },
  { school: 'South Carolina', conference: 'SEC', state: 'SC', city: 'Columbia' },
  { school: 'Tennessee', conference: 'SEC', state: 'TN', city: 'Knoxville' },
  { school: 'Texas', conference: 'SEC', state: 'TX', city: 'Austin' },
  { school: 'Texas A&M', conference: 'SEC', state: 'TX', city: 'College Station' },
  { school: 'Vanderbilt', conference: 'SEC', state: 'TN', city: 'Nashville' },

  // Big 12
  { school: 'Arizona', conference: 'Big 12', state: 'AZ', city: 'Tucson' },
  { school: 'Arizona State', conference: 'Big 12', state: 'AZ', city: 'Tempe' },
  { school: 'Baylor', conference: 'Big 12', state: 'TX', city: 'Waco' },
  { school: 'BYU', conference: 'Big 12', state: 'UT', city: 'Provo' },
  { school: 'Cincinnati', conference: 'Big 12', state: 'OH', city: 'Cincinnati' },
  { school: 'Colorado', conference: 'Big 12', state: 'CO', city: 'Boulder' },
  { school: 'Houston', conference: 'Big 12', state: 'TX', city: 'Houston' },
  { school: 'Iowa State', conference: 'Big 12', state: 'IA', city: 'Ames' },
  { school: 'Kansas', conference: 'Big 12', state: 'KS', city: 'Lawrence' },
  { school: 'Kansas State', conference: 'Big 12', state: 'KS', city: 'Manhattan' },
  { school: 'Oklahoma State', conference: 'Big 12', state: 'OK', city: 'Stillwater' },
  { school: 'Oregon State', conference: 'Big 12', state: 'OR', city: 'Corvallis' },
  { school: 'TCU', conference: 'Big 12', state: 'TX', city: 'Fort Worth' },
  { school: 'Texas Tech', conference: 'Big 12', state: 'TX', city: 'Lubbock' },
  { school: 'UCF', conference: 'Big 12', state: 'FL', city: 'Orlando' },
  { school: 'Utah', conference: 'Big 12', state: 'UT', city: 'Salt Lake City' },
  { school: 'West Virginia', conference: 'Big 12', state: 'WV', city: 'Morgantown' },

  // Big Ten
  { school: 'Illinois', conference: 'Big Ten', state: 'IL', city: 'Champaign' },
  { school: 'Indiana', conference: 'Big Ten', state: 'IN', city: 'Bloomington' },
  { school: 'Iowa', conference: 'Big Ten', state: 'IA', city: 'Iowa City' },
  { school: 'Maryland', conference: 'Big Ten', state: 'MD', city: 'College Park' },
  { school: 'Michigan', conference: 'Big Ten', state: 'MI', city: 'Ann Arbor' },
  { school: 'Michigan State', conference: 'Big Ten', state: 'MI', city: 'East Lansing' },
  { school: 'Minnesota', conference: 'Big Ten', state: 'MN', city: 'Minneapolis' },
  { school: 'Nebraska', conference: 'Big Ten', state: 'NE', city: 'Lincoln' },
  { school: 'Northwestern', conference: 'Big Ten', state: 'IL', city: 'Evanston' },
  { school: 'Ohio State', conference: 'Big Ten', state: 'OH', city: 'Columbus' },
  { school: 'Oregon', conference: 'Big Ten', state: 'OR', city: 'Eugene' },
  { school: 'Penn State', conference: 'Big Ten', state: 'PA', city: 'University Park' },
  { school: 'Purdue', conference: 'Big Ten', state: 'IN', city: 'West Lafayette' },
  { school: 'Rutgers', conference: 'Big Ten', state: 'NJ', city: 'Piscataway' },
  { school: 'UCLA', conference: 'Big Ten', state: 'CA', city: 'Los Angeles' },
  { school: 'USC', conference: 'Big Ten', state: 'CA', city: 'Los Angeles' },
  { school: 'Washington', conference: 'Big Ten', state: 'WA', city: 'Seattle' },

  // Pac-12 (remaining)
  { school: 'Washington State', conference: 'Pac-12', state: 'WA', city: 'Pullman' },

  // AAC
  { school: 'Charlotte', conference: 'AAC', state: 'NC', city: 'Charlotte' },
  { school: 'East Carolina', conference: 'AAC', state: 'NC', city: 'Greenville' },
  { school: 'FAU', conference: 'AAC', state: 'FL', city: 'Boca Raton' },
  { school: 'Memphis', conference: 'AAC', state: 'TN', city: 'Memphis' },
  { school: 'Navy', conference: 'AAC', state: 'MD', city: 'Annapolis' },
  { school: 'Rice', conference: 'AAC', state: 'TX', city: 'Houston' },
  { school: 'South Florida', conference: 'AAC', state: 'FL', city: 'Tampa' },
  { school: 'Temple', conference: 'AAC', state: 'PA', city: 'Philadelphia' },
  { school: 'Tulane', conference: 'AAC', state: 'LA', city: 'New Orleans' },
  { school: 'Tulsa', conference: 'AAC', state: 'OK', city: 'Tulsa' },
  { school: 'UAB', conference: 'AAC', state: 'AL', city: 'Birmingham' },
  { school: 'Wichita State', conference: 'AAC', state: 'KS', city: 'Wichita' },
  { school: 'North Texas', conference: 'AAC', state: 'TX', city: 'Denton' },
  { school: 'UTSA', conference: 'AAC', state: 'TX', city: 'San Antonio' },

  // Sun Belt
  { school: 'Appalachian State', conference: 'Sun Belt', state: 'NC', city: 'Boone' },
  { school: 'Arkansas State', conference: 'Sun Belt', state: 'AR', city: 'Jonesboro' },
  { school: 'Coastal Carolina', conference: 'Sun Belt', state: 'SC', city: 'Conway' },
  { school: 'Georgia Southern', conference: 'Sun Belt', state: 'GA', city: 'Statesboro' },
  { school: 'Georgia State', conference: 'Sun Belt', state: 'GA', city: 'Atlanta' },
  { school: 'James Madison', conference: 'Sun Belt', state: 'VA', city: 'Harrisonburg' },
  { school: 'Louisiana', conference: 'Sun Belt', state: 'LA', city: 'Lafayette' },
  { school: 'Louisiana-Monroe', conference: 'Sun Belt', state: 'LA', city: 'Monroe' },
  { school: 'Marshall', conference: 'Sun Belt', state: 'WV', city: 'Huntington' },
  { school: 'Old Dominion', conference: 'Sun Belt', state: 'VA', city: 'Norfolk' },
  { school: 'South Alabama', conference: 'Sun Belt', state: 'AL', city: 'Mobile' },
  { school: 'Southern Miss', conference: 'Sun Belt', state: 'MS', city: 'Hattiesburg' },
  { school: 'Texas State', conference: 'Sun Belt', state: 'TX', city: 'San Marcos' },
  { school: 'Troy', conference: 'Sun Belt', state: 'AL', city: 'Troy' },

  // Conference USA
  { school: 'FIU', conference: 'C-USA', state: 'FL', city: 'Miami' },
  { school: 'Jacksonville State', conference: 'C-USA', state: 'AL', city: 'Jacksonville' },
  { school: 'Kennesaw State', conference: 'C-USA', state: 'GA', city: 'Kennesaw' },
  { school: 'Liberty', conference: 'C-USA', state: 'VA', city: 'Lynchburg' },
  { school: 'Louisiana Tech', conference: 'C-USA', state: 'LA', city: 'Ruston' },
  { school: 'Middle Tennessee', conference: 'C-USA', state: 'TN', city: 'Murfreesboro' },
  { school: 'New Mexico State', conference: 'C-USA', state: 'NM', city: 'Las Cruces' },
  { school: 'Sam Houston State', conference: 'C-USA', state: 'TX', city: 'Huntsville' },
  { school: 'Western Kentucky', conference: 'C-USA', state: 'KY', city: 'Bowling Green' },

  // Missouri Valley
  { school: 'Dallas Baptist', conference: 'MVC', state: 'TX', city: 'Dallas' },
  { school: 'Evansville', conference: 'MVC', state: 'IN', city: 'Evansville' },
  { school: 'Illinois State', conference: 'MVC', state: 'IL', city: 'Normal' },
  { school: 'Indiana State', conference: 'MVC', state: 'IN', city: 'Terre Haute' },
  { school: 'Missouri State', conference: 'MVC', state: 'MO', city: 'Springfield' },
  { school: 'Southern Illinois', conference: 'MVC', state: 'IL', city: 'Carbondale' },
  { school: 'Valparaiso', conference: 'MVC', state: 'IN', city: 'Valparaiso' },

  // Colonial Athletic
  { school: 'College of Charleston', conference: 'CAA', state: 'SC', city: 'Charleston' },
  { school: 'Delaware', conference: 'CAA', state: 'DE', city: 'Newark' },
  { school: 'Elon', conference: 'CAA', state: 'NC', city: 'Elon' },
  { school: 'Hofstra', conference: 'CAA', state: 'NY', city: 'Hempstead' },
  { school: 'Northeastern', conference: 'CAA', state: 'MA', city: 'Boston' },
  { school: 'Stony Brook', conference: 'CAA', state: 'NY', city: 'Stony Brook' },
  { school: 'UNC Wilmington', conference: 'CAA', state: 'NC', city: 'Wilmington' },
  { school: 'William & Mary', conference: 'CAA', state: 'VA', city: 'Williamsburg' },

  // Big East
  { school: 'Butler', conference: 'Big East', state: 'IN', city: 'Indianapolis' },
  { school: 'Connecticut', conference: 'Big East', state: 'CT', city: 'Storrs' },
  { school: 'Creighton', conference: 'Big East', state: 'NE', city: 'Omaha' },
  { school: 'Georgetown', conference: 'Big East', state: 'DC', city: 'Washington' },
  { school: 'Providence', conference: 'Big East', state: 'RI', city: 'Providence' },
  { school: 'Seton Hall', conference: 'Big East', state: 'NJ', city: 'South Orange' },
  { school: 'St. John\'s', conference: 'Big East', state: 'NY', city: 'Queens' },
  { school: 'Villanova', conference: 'Big East', state: 'PA', city: 'Villanova' },
  { school: 'Xavier', conference: 'Big East', state: 'OH', city: 'Cincinnati' },

  // West Coast
  { school: 'Gonzaga', conference: 'WCC', state: 'WA', city: 'Spokane' },
  { school: 'Loyola Marymount', conference: 'WCC', state: 'CA', city: 'Los Angeles' },
  { school: 'Pepperdine', conference: 'WCC', state: 'CA', city: 'Malibu' },
  { school: 'Portland', conference: 'WCC', state: 'OR', city: 'Portland' },
  { school: 'San Diego', conference: 'WCC', state: 'CA', city: 'San Diego' },
  { school: 'San Francisco', conference: 'WCC', state: 'CA', city: 'San Francisco' },
  { school: 'Santa Clara', conference: 'WCC', state: 'CA', city: 'Santa Clara' },

  // Mountain West
  { school: 'Air Force', conference: 'MW', state: 'CO', city: 'Colorado Springs' },
  { school: 'Fresno State', conference: 'MW', state: 'CA', city: 'Fresno' },
  { school: 'Nevada', conference: 'MW', state: 'NV', city: 'Reno' },
  { school: 'New Mexico', conference: 'MW', state: 'NM', city: 'Albuquerque' },
  { school: 'San Diego State', conference: 'MW', state: 'CA', city: 'San Diego' },
  { school: 'San Jose State', conference: 'MW', state: 'CA', city: 'San Jose' },
  { school: 'UNLV', conference: 'MW', state: 'NV', city: 'Las Vegas' },

  // Atlantic 10
  { school: 'Dayton', conference: 'A-10', state: 'OH', city: 'Dayton' },
  { school: 'Fordham', conference: 'A-10', state: 'NY', city: 'Bronx' },
  { school: 'George Mason', conference: 'A-10', state: 'VA', city: 'Fairfax' },
  { school: 'George Washington', conference: 'A-10', state: 'DC', city: 'Washington' },
  { school: 'La Salle', conference: 'A-10', state: 'PA', city: 'Philadelphia' },
  { school: 'Massachusetts', conference: 'A-10', state: 'MA', city: 'Amherst' },
  { school: 'Rhode Island', conference: 'A-10', state: 'RI', city: 'Kingston' },
  { school: 'Richmond', conference: 'A-10', state: 'VA', city: 'Richmond' },
  { school: 'Saint Joseph\'s', conference: 'A-10', state: 'PA', city: 'Philadelphia' },
  { school: 'Saint Louis', conference: 'A-10', state: 'MO', city: 'St. Louis' },
  { school: 'VCU', conference: 'A-10', state: 'VA', city: 'Richmond' },

  // Ivy League
  { school: 'Columbia', conference: 'Ivy', state: 'NY', city: 'New York' },
  { school: 'Cornell', conference: 'Ivy', state: 'NY', city: 'Ithaca' },
  { school: 'Dartmouth', conference: 'Ivy', state: 'NH', city: 'Hanover' },
  { school: 'Harvard', conference: 'Ivy', state: 'MA', city: 'Cambridge' },
  { school: 'Penn', conference: 'Ivy', state: 'PA', city: 'Philadelphia' },
  { school: 'Princeton', conference: 'Ivy', state: 'NJ', city: 'Princeton' },
  { school: 'Yale', conference: 'Ivy', state: 'CT', city: 'New Haven' },
  { school: 'Brown', conference: 'Ivy', state: 'RI', city: 'Providence' },

  // Patriot League
  { school: 'Army', conference: 'Patriot', state: 'NY', city: 'West Point' },
  { school: 'Bucknell', conference: 'Patriot', state: 'PA', city: 'Lewisburg' },
  { school: 'Holy Cross', conference: 'Patriot', state: 'MA', city: 'Worcester' },
  { school: 'Lafayette', conference: 'Patriot', state: 'PA', city: 'Easton' },
  { school: 'Lehigh', conference: 'Patriot', state: 'PA', city: 'Bethlehem' },

  // ASUN
  { school: 'Bellarmine', conference: 'ASUN', state: 'KY', city: 'Louisville' },
  { school: 'Central Arkansas', conference: 'ASUN', state: 'AR', city: 'Conway' },
  { school: 'Eastern Kentucky', conference: 'ASUN', state: 'KY', city: 'Richmond' },
  { school: 'Florida Gulf Coast', conference: 'ASUN', state: 'FL', city: 'Fort Myers' },
  { school: 'Jacksonville', conference: 'ASUN', state: 'FL', city: 'Jacksonville' },
  { school: 'Lipscomb', conference: 'ASUN', state: 'TN', city: 'Nashville' },
  { school: 'North Alabama', conference: 'ASUN', state: 'AL', city: 'Florence' },
  { school: 'Queens University', conference: 'ASUN', state: 'NC', city: 'Charlotte' },
  { school: 'Stetson', conference: 'ASUN', state: 'FL', city: 'DeLand' },

  // Southland
  { school: 'Houston Christian', conference: 'Southland', state: 'TX', city: 'Houston' },
  { school: 'Incarnate Word', conference: 'Southland', state: 'TX', city: 'San Antonio' },
  { school: 'Lamar', conference: 'Southland', state: 'TX', city: 'Beaumont' },
  { school: 'McNeese State', conference: 'Southland', state: 'LA', city: 'Lake Charles' },
  { school: 'Nicholls State', conference: 'Southland', state: 'LA', city: 'Thibodaux' },
  { school: 'Northwestern State', conference: 'Southland', state: 'LA', city: 'Natchitoches' },
  { school: 'Southeastern Louisiana', conference: 'Southland', state: 'LA', city: 'Hammond' },
  { school: 'Texas A&M-Corpus Christi', conference: 'Southland', state: 'TX', city: 'Corpus Christi' },

  // Big South
  { school: 'Campbell', conference: 'Big South', state: 'NC', city: 'Buies Creek' },
  { school: 'Charleston Southern', conference: 'Big South', state: 'SC', city: 'Charleston' },
  { school: 'Gardner-Webb', conference: 'Big South', state: 'NC', city: 'Boiling Springs' },
  { school: 'High Point', conference: 'Big South', state: 'NC', city: 'High Point' },
  { school: 'Longwood', conference: 'Big South', state: 'VA', city: 'Farmville' },
  { school: 'Presbyterian', conference: 'Big South', state: 'SC', city: 'Clinton' },
  { school: 'Radford', conference: 'Big South', state: 'VA', city: 'Radford' },
  { school: 'UNC Asheville', conference: 'Big South', state: 'NC', city: 'Asheville' },
  { school: 'Winthrop', conference: 'Big South', state: 'SC', city: 'Rock Hill' },

  // SOCON
  { school: 'Chattanooga', conference: 'SoCon', state: 'TN', city: 'Chattanooga' },
  { school: 'Citadel', conference: 'SoCon', state: 'SC', city: 'Charleston' },
  { school: 'ETSU', conference: 'SoCon', state: 'TN', city: 'Johnson City' },
  { school: 'Furman', conference: 'SoCon', state: 'SC', city: 'Greenville' },
  { school: 'Mercer', conference: 'SoCon', state: 'GA', city: 'Macon' },
  { school: 'Samford', conference: 'SoCon', state: 'AL', city: 'Birmingham' },
  { school: 'UNC Greensboro', conference: 'SoCon', state: 'NC', city: 'Greensboro' },
  { school: 'VMI', conference: 'SoCon', state: 'VA', city: 'Lexington' },
  { school: 'Western Carolina', conference: 'SoCon', state: 'NC', city: 'Cullowhee' },
  { school: 'Wofford', conference: 'SoCon', state: 'SC', city: 'Spartanburg' },

  // OVC
  { school: 'Austin Peay', conference: 'OVC', state: 'TN', city: 'Clarksville' },
  { school: 'Eastern Illinois', conference: 'OVC', state: 'IL', city: 'Charleston' },
  { school: 'Morehead State', conference: 'OVC', state: 'KY', city: 'Morehead' },
  { school: 'Murray State', conference: 'OVC', state: 'KY', city: 'Murray' },
  { school: 'Southeast Missouri', conference: 'OVC', state: 'MO', city: 'Cape Girardeau' },
  { school: 'UT Martin', conference: 'OVC', state: 'TN', city: 'Martin' },
  { school: 'Tennessee Tech', conference: 'OVC', state: 'TN', city: 'Cookeville' },

  // MAAC
  { school: 'Canisius', conference: 'MAAC', state: 'NY', city: 'Buffalo' },
  { school: 'Fairfield', conference: 'MAAC', state: 'CT', city: 'Fairfield' },
  { school: 'Iona', conference: 'MAAC', state: 'NY', city: 'New Rochelle' },
  { school: 'Manhattan', conference: 'MAAC', state: 'NY', city: 'Bronx' },
  { school: 'Marist', conference: 'MAAC', state: 'NY', city: 'Poughkeepsie' },
  { school: 'Niagara', conference: 'MAAC', state: 'NY', city: 'Niagara' },
  { school: 'Quinnipiac', conference: 'MAAC', state: 'CT', city: 'Hamden' },
  { school: 'Rider', conference: 'MAAC', state: 'NJ', city: 'Lawrenceville' },
  { school: 'Saint Peter\'s', conference: 'MAAC', state: 'NJ', city: 'Jersey City' },
  { school: 'Siena', conference: 'MAAC', state: 'NY', city: 'Loudonville' },

  // America East
  { school: 'Albany', conference: 'AE', state: 'NY', city: 'Albany' },
  { school: 'Binghamton', conference: 'AE', state: 'NY', city: 'Binghamton' },
  { school: 'Hartford', conference: 'AE', state: 'CT', city: 'West Hartford' },
  { school: 'Maine', conference: 'AE', state: 'ME', city: 'Orono' },
  { school: 'UMBC', conference: 'AE', state: 'MD', city: 'Baltimore' },
  { school: 'UMass Lowell', conference: 'AE', state: 'MA', city: 'Lowell' },
  { school: 'Vermont', conference: 'AE', state: 'VT', city: 'Burlington' },
  { school: 'New Jersey Tech', conference: 'AE', state: 'NJ', city: 'Newark' },

  // Northeast
  { school: 'Bryant', conference: 'NEC', state: 'RI', city: 'Smithfield' },
  { school: 'Central Connecticut', conference: 'NEC', state: 'CT', city: 'New Britain' },
  { school: 'Fairleigh Dickinson', conference: 'NEC', state: 'NJ', city: 'Teaneck' },
  { school: 'LIU', conference: 'NEC', state: 'NY', city: 'Brooklyn' },
  { school: 'Mercyhurst', conference: 'NEC', state: 'PA', city: 'Erie' },
  { school: 'Mount St. Mary\'s', conference: 'NEC', state: 'MD', city: 'Emmitsburg' },
  { school: 'Sacred Heart', conference: 'NEC', state: 'CT', city: 'Fairfield' },
  { school: 'Wagner', conference: 'NEC', state: 'NY', city: 'Staten Island' },

  // Horizon League
  { school: 'Cleveland State', conference: 'Horizon', state: 'OH', city: 'Cleveland' },
  { school: 'Illinois-Chicago', conference: 'Horizon', state: 'IL', city: 'Chicago' },
  { school: 'Milwaukee', conference: 'Horizon', state: 'WI', city: 'Milwaukee' },
  { school: 'Northern Kentucky', conference: 'Horizon', state: 'KY', city: 'Highland Heights' },
  { school: 'Oakland', conference: 'Horizon', state: 'MI', city: 'Rochester' },
  { school: 'Wright State', conference: 'Horizon', state: 'OH', city: 'Dayton' },
  { school: 'Youngstown State', conference: 'Horizon', state: 'OH', city: 'Youngstown' },

  // Summit League
  { school: 'North Dakota State', conference: 'Summit', state: 'ND', city: 'Fargo' },
  { school: 'Omaha', conference: 'Summit', state: 'NE', city: 'Omaha' },
  { school: 'Oral Roberts', conference: 'Summit', state: 'OK', city: 'Tulsa' },
  { school: 'South Dakota State', conference: 'Summit', state: 'SD', city: 'Brookings' },
  { school: 'Western Illinois', conference: 'Summit', state: 'IL', city: 'Macomb' },

  // WAC
  { school: 'Abilene Christian', conference: 'WAC', state: 'TX', city: 'Abilene' },
  { school: 'Grand Canyon', conference: 'WAC', state: 'AZ', city: 'Phoenix' },
  { school: 'Seattle', conference: 'WAC', state: 'WA', city: 'Seattle' },
  { school: 'Stephen F. Austin', conference: 'WAC', state: 'TX', city: 'Nacogdoches' },
  { school: 'Tarleton State', conference: 'WAC', state: 'TX', city: 'Stephenville' },
  { school: 'UT Arlington', conference: 'WAC', state: 'TX', city: 'Arlington' },
  { school: 'Utah Valley', conference: 'WAC', state: 'UT', city: 'Orem' },

  // Big West
  { school: 'Cal Poly', conference: 'Big West', state: 'CA', city: 'San Luis Obispo' },
  { school: 'Cal State Bakersfield', conference: 'Big West', state: 'CA', city: 'Bakersfield' },
  { school: 'Cal State Fullerton', conference: 'Big West', state: 'CA', city: 'Fullerton' },
  { school: 'Cal State Northridge', conference: 'Big West', state: 'CA', city: 'Northridge' },
  { school: 'Hawaii', conference: 'Big West', state: 'HI', city: 'Honolulu' },
  { school: 'Long Beach State', conference: 'Big West', state: 'CA', city: 'Long Beach' },
  { school: 'UC Davis', conference: 'Big West', state: 'CA', city: 'Davis' },
  { school: 'UC Irvine', conference: 'Big West', state: 'CA', city: 'Irvine' },
  { school: 'UC Riverside', conference: 'Big West', state: 'CA', city: 'Riverside' },
  { school: 'UC San Diego', conference: 'Big West', state: 'CA', city: 'San Diego' },
  { school: 'UC Santa Barbara', conference: 'Big West', state: 'CA', city: 'Santa Barbara' },

  // SWAC
  { school: 'Alabama A&M', conference: 'SWAC', state: 'AL', city: 'Huntsville' },
  { school: 'Alabama State', conference: 'SWAC', state: 'AL', city: 'Montgomery' },
  { school: 'Alcorn State', conference: 'SWAC', state: 'MS', city: 'Lorman' },
  { school: 'Grambling State', conference: 'SWAC', state: 'LA', city: 'Grambling' },
  { school: 'Jackson State', conference: 'SWAC', state: 'MS', city: 'Jackson' },
  { school: 'Mississippi Valley State', conference: 'SWAC', state: 'MS', city: 'Itta Bena' },
  { school: 'Prairie View A&M', conference: 'SWAC', state: 'TX', city: 'Prairie View' },
  { school: 'Southern', conference: 'SWAC', state: 'LA', city: 'Baton Rouge' },
  { school: 'Texas Southern', conference: 'SWAC', state: 'TX', city: 'Houston' },

  // MEAC
  { school: 'Coppin State', conference: 'MEAC', state: 'MD', city: 'Baltimore' },
  { school: 'Delaware State', conference: 'MEAC', state: 'DE', city: 'Dover' },
  { school: 'Maryland Eastern Shore', conference: 'MEAC', state: 'MD', city: 'Princess Anne' },
  { school: 'Norfolk State', conference: 'MEAC', state: 'VA', city: 'Norfolk' },
  { school: 'North Carolina A&T', conference: 'MEAC', state: 'NC', city: 'Greensboro' },
  { school: 'North Carolina Central', conference: 'MEAC', state: 'NC', city: 'Durham' },

  // Additional notable programs
  { school: 'Wake Forest', conference: 'ACC', state: 'NC', city: 'Winston-Salem' },
  { school: 'Wichita State', conference: 'AAC', state: 'KS', city: 'Wichita' },
  { school: 'Xavier', conference: 'Big East', state: 'OH', city: 'Cincinnati' },
]

// ── D2 + D3 (representative sample — full list is ~670 programs) ──────────
// We seed the major programs; users can add more via the UI.
const D2_SAMPLE = [
  { school: 'Tampa', conference: 'SSC', state: 'FL', city: 'Tampa' },
  { school: 'Florida Southern', conference: 'SSC', state: 'FL', city: 'Lakeland' },
  { school: 'Nova Southeastern', conference: 'SSC', state: 'FL', city: 'Fort Lauderdale' },
  { school: 'Lynn University', conference: 'SSC', state: 'FL', city: 'Boca Raton' },
  { school: 'Rollins College', conference: 'SSC', state: 'FL', city: 'Winter Park' },
  { school: 'Embry-Riddle', conference: 'SSC', state: 'FL', city: 'Daytona Beach' },
  { school: 'Saint Leo', conference: 'SSC', state: 'FL', city: 'Saint Leo' },
  { school: 'Palm Beach Atlantic', conference: 'SSC', state: 'FL', city: 'West Palm Beach' },
  { school: 'Barry University', conference: 'SSC', state: 'FL', city: 'Miami Shores' },
  { school: 'Eckerd College', conference: 'SSC', state: 'FL', city: 'St. Petersburg' },
  { school: 'Central Missouri', conference: 'MIAA', state: 'MO', city: 'Warrensburg' },
  { school: 'Emporia State', conference: 'MIAA', state: 'KS', city: 'Emporia' },
  { school: 'Augustana (SD)', conference: 'NSIC', state: 'SD', city: 'Sioux Falls' },
  { school: 'Minnesota State', conference: 'NSIC', state: 'MN', city: 'Mankato' },
  { school: 'Winona State', conference: 'NSIC', state: 'MN', city: 'Winona' },
  { school: 'Southern New Hampshire', conference: 'NE-10', state: 'NH', city: 'Manchester' },
  { school: 'Assumption', conference: 'NE-10', state: 'MA', city: 'Worcester' },
  { school: 'Catawba', conference: 'SAC', state: 'NC', city: 'Salisbury' },
  { school: 'Lander', conference: 'PBC', state: 'SC', city: 'Greenwood' },
  { school: 'Columbus State', conference: 'PBC', state: 'GA', city: 'Columbus' },
  { school: 'West Florida', conference: 'GSC', state: 'FL', city: 'Pensacola' },
  { school: 'Delta State', conference: 'GSC', state: 'MS', city: 'Cleveland' },
  { school: 'Valdosta State', conference: 'GSC', state: 'GA', city: 'Valdosta' },
  { school: 'North Greenville', conference: 'GSC', state: 'SC', city: 'Tigerville' },
  { school: 'Anderson (SC)', conference: 'SAC', state: 'SC', city: 'Anderson' },
  { school: 'Wingate', conference: 'SAC', state: 'NC', city: 'Wingate' },
  { school: 'Mount Olive', conference: 'CCAC', state: 'NC', city: 'Mount Olive' },
  { school: 'Angelo State', conference: 'LSC', state: 'TX', city: 'San Angelo' },
  { school: 'Lubbock Christian', conference: 'LSC', state: 'TX', city: 'Lubbock' },
  { school: 'St. Edward\'s', conference: 'LSC', state: 'TX', city: 'Austin' },
]

const D3_SAMPLE = [
  { school: 'Trinity (TX)', conference: 'SCAC', state: 'TX', city: 'San Antonio' },
  { school: 'Emory', conference: 'UAA', state: 'GA', city: 'Atlanta' },
  { school: 'Johns Hopkins', conference: 'Centennial', state: 'MD', city: 'Baltimore' },
  { school: 'Amherst', conference: 'NESCAC', state: 'MA', city: 'Amherst' },
  { school: 'Williams', conference: 'NESCAC', state: 'MA', city: 'Williamstown' },
  { school: 'Middlebury', conference: 'NESCAC', state: 'VT', city: 'Middlebury' },
  { school: 'Tufts', conference: 'NESCAC', state: 'MA', city: 'Medford' },
  { school: 'Wesleyan', conference: 'NESCAC', state: 'CT', city: 'Middletown' },
  { school: 'Bowdoin', conference: 'NESCAC', state: 'ME', city: 'Brunswick' },
  { school: 'Chapman', conference: 'SCIAC', state: 'CA', city: 'Orange' },
  { school: 'Pomona-Pitzer', conference: 'SCIAC', state: 'CA', city: 'Claremont' },
  { school: 'Claremont-Mudd-Scripps', conference: 'SCIAC', state: 'CA', city: 'Claremont' },
  { school: 'Adrian College', conference: 'MIAA', state: 'MI', city: 'Adrian' },
  { school: 'Webster University', conference: 'SLIAC', state: 'MO', city: 'Webster Groves' },
  { school: 'Concordia (TX)', conference: 'ASC', state: 'TX', city: 'Austin' },
  { school: 'UT Dallas', conference: 'ASC', state: 'TX', city: 'Richardson' },
  { school: 'Randolph-Macon', conference: 'ODAC', state: 'VA', city: 'Ashland' },
  { school: 'Shenandoah', conference: 'ODAC', state: 'VA', city: 'Winchester' },
  { school: 'Salisbury', conference: 'CAC', state: 'MD', city: 'Salisbury' },
  { school: 'Christopher Newport', conference: 'CAC', state: 'VA', city: 'Newport News' },
]

// ── Build rows and upsert ────────────────────────────────────────────────────

function toRow(entry, division) {
  return {
    sport: 'baseball',
    school_name: entry.school,
    division,
    conference: entry.conference,
    state: entry.state,
    city: entry.city,
    scholarship_available: division !== 'D3', // D3 doesn't offer athletic scholarships
  }
}

const rows = [
  ...D1.map(e => toRow(e, 'D1')),
  ...D2_SAMPLE.map(e => toRow(e, 'D2')),
  ...D3_SAMPLE.map(e => toRow(e, 'D3')),
]

// De-duplicate by school_name (some may appear twice in the lists above).
const seen = new Set()
const unique = rows.filter(r => {
  const key = `${r.school_name}|${r.sport}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

console.log(`Seeding ${unique.length} baseball programs (${D1.length} D1, ${D2_SAMPLE.length} D2, ${D3_SAMPLE.length} D3)...`)

// Upsert in batches of 50.
const BATCH = 50
let inserted = 0
let updated = 0

for (let i = 0; i < unique.length; i += BATCH) {
  const batch = unique.slice(i, i + BATCH)
  const { data, error } = await sb
    .from('koto_recruiting_programs')
    .upsert(batch, { onConflict: 'school_name,sport', ignoreDuplicates: false })
    .select('id')

  if (error) {
    console.error(`Batch ${i}-${i + batch.length} failed:`, error.message)
  } else {
    inserted += (data || []).length
    process.stdout.write('.')
  }
}

console.log(`\nDone. ${inserted} programs upserted.`)
