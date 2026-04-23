"use client"
import { useState } from 'react'
import { DollarSign, GraduationCap, Users, MapPin } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/scholarships — Baseball scholarship overview + interactive US map.
// Click a state to see programs, scholarship counts, roster spots.
// ─────────────────────────────────────────────────────────────────────────────

const RED = '#dc2626'
const BLUE = '#2563eb'
const BLK = '#0a0a0a'

// National totals from NCSA
const NATIONAL = {
  totalPrograms: 1727,
  d1: { programs: 311, scholarshipsPerSchool: 11.7, athletes: 10400 },
  d2: { programs: 260, scholarshipsPerSchool: 9, athletes: 9000 },
  d3: { programs: 404, scholarshipsPerSchool: 0, athletes: 11200 },
  naia: { programs: 199, scholarshipsPerSchool: 12, athletes: 6300 },
  juco: { programs: 538, scholarshipsPerSchool: 24, athletes: 15300 },
  hsAthletes: 473503,
}

// State data — all 48 states with baseball programs (scraped from NCSA).
const STATE_DATA = {
  FL: { name: "Florida", total: 59, d1: 13, d2: 13, d3: 0, naia: 8, juco: 24, scholarships: 386, roster: 1220, top: ["University of Florida", "Florida State University", "University of Miami", "University of South Florida", "University of Central Florida"] },
  TX: { name: "Texas", total: 92, d1: 22, d2: 10, d3: 14, naia: 10, juco: 35, scholarships: 500, roster: 1970, top: ["Rice University", "University of Texas - Austin", "Texas A&M University", "Baylor University", "Texas Christian University"] },
  CA: { name: "California", total: 149, d1: 26, d2: 16, d3: 11, naia: 6, juco: 89, scholarships: 580, roster: 2180, top: ["Stanford University", "UCLA", "University of California - Berkeley", "University of Southern California", "University of California - San Diego"] },
  GA: { name: "Georgia", total: 38, d1: 7, d2: 12, d3: 6, naia: 8, juco: 4, scholarships: 304, roster: 1155, top: ["Georgia Institute of Technology", "University of Georgia", "Georgia Southern University", "Kennesaw State University", "Mercer University"] },
  NC: { name: "North Carolina", total: 53, d1: 18, d2: 9, d3: 8, naia: 2, juco: 16, scholarships: 328, roster: 1275, top: ["Davidson College", "Appalachian State University", "Campbell University", "East Carolina University", "North Carolina State University"] },
  SC: { name: "South Carolina", total: 33, d1: 10, d2: 12, d3: 1, naia: 4, juco: 6, scholarships: 282, roster: 955, top: ["Clemson University", "University of South Carolina", "Coastal Carolina University", "College of Charleston", "Winthrop University"] },
  AL: { name: "Alabama", total: 41, d1: 10, d2: 7, d3: 1, naia: 5, juco: 18, scholarships: 252, roster: 835, top: ["Auburn University", "The University of Alabama"] },
  LA: { name: "Louisiana", total: 25, d1: 12, d2: 0, d3: 1, naia: 7, juco: 5, scholarships: 224, roster: 660, top: ["Tulane University"] },
  TN: { name: "Tennessee", total: 41, d1: 9, d2: 10, d3: 3, naia: 9, juco: 10, scholarships: 315, roster: 1060, top: ["Vanderbilt University", "University of Tennessee, Knoxville"] },
  AZ: { name: "Arizona", total: 20, d1: 3, d2: 0, d3: 0, naia: 3, juco: 14, scholarships: 95, roster: 255, top: ["Arizona State University", "University of Arizona"] },
  OH: { name: "Ohio", total: 55, d1: 12, d2: 8, d3: 21, naia: 6, juco: 8, scholarships: 308, roster: 1570, top: ["The Ohio State University", "Miami University"] },
  PA: { name: "Pennsylvania", total: 98, d1: 9, d2: 20, d3: 57, naia: 2, juco: 10, scholarships: 321, roster: 2970, top: ["University of Pennsylvania", "Villanova University", "University of Pittsburgh", "Lehigh University", "Penn State"] },
  NY: { name: "New York", total: 102, d1: 17, d2: 9, d3: 47, naia: 0, juco: 29, scholarships: 321, roster: 2580, top: ["Iona University", "St. John Fisher University", "Stony Brook University", "St. Thomas Aquinas College", "SUNY Plattsburgh"] },
  NJ: { name: "New Jersey", total: 39, d1: 8, d2: 3, d3: 15, naia: 0, juco: 13, scholarships: 121, roster: 835, top: ["Fairleigh Dickinson University", "NJIT", "Monmouth University", "Rider University", "Saint Peter's University"] },
  VA: { name: "Virginia", total: 39, d1: 13, d2: 3, d3: 15, naia: 1, juco: 6, scholarships: 200, roster: 1105, top: ["University of Virginia", "William & Mary", "Virginia Tech", "University of Richmond", "James Madison University"] },
  MS: { name: "Mississippi", total: 30, d1: 6, d2: 2, d3: 3, naia: 4, juco: 14, scholarships: 136, roster: 490, top: ["University of Mississippi"] },
  OK: { name: "Oklahoma", total: 32, d1: 3, d2: 11, d3: 0, naia: 6, juco: 11, scholarships: 206, roster: 670, top: ["University of Oklahoma", "Oklahoma State University", "Oral Roberts University"] },
  MO: { name: "Missouri", total: 45, d1: 5, d2: 12, d3: 4, naia: 14, juco: 10, scholarships: 344, roster: 1200, top: ["University of Missouri", "Saint Louis University"] },
  IN: { name: "Indiana", total: 38, d1: 10, d2: 2, d3: 9, naia: 14, juco: 3, scholarships: 315, roster: 1140, top: ["University of Notre Dame", "Purdue University", "Indiana University - Bloomington", "Ball State University", "Indiana State University"] },
  IL: { name: "Illinois", total: 82, d1: 10, d2: 5, d3: 21, naia: 4, juco: 42, scholarships: 234, roster: 1335, top: ["Northwestern University", "University of Illinois Urbana-Champaign"] },
  MI: { name: "Michigan", total: 43, d1: 6, d2: 7, d3: 6, naia: 7, juco: 16, scholarships: 229, roster: 965, top: ["University of Michigan", "Michigan State University"] },
  WI: { name: "Wisconsin", total: 28, d1: 1, d2: 0, d3: 22, naia: 1, juco: 4, scholarships: 33, roster: 760, top: ["University of Wisconsin - Milwaukee"] },
  MN: { name: "Minnesota", total: 43, d1: 2, d2: 8, d3: 16, naia: 0, juco: 17, scholarships: 95, roster: 890, top: ["University of Minnesota Twin Cities"] },
  IA: { name: "Iowa", total: 34, d1: 1, d2: 1, d3: 10, naia: 11, juco: 11, scholarships: 153, roster: 700, top: ["University of Iowa"] },
  KS: { name: "Kansas", total: 40, d1: 3, d2: 5, d3: 0, naia: 13, juco: 18, scholarships: 248, roster: 700, top: ["The University of Kansas"] },
  AR: { name: "Arkansas", total: 31, d1: 5, d2: 7, d3: 3, naia: 5, juco: 9, scholarships: 182, roster: 660, top: ["University of Arkansas"] },
  KY: { name: "Kentucky", total: 24, d1: 8, d2: 2, d3: 5, naia: 9, juco: 0, scholarships: 241, roster: 835, top: ["University of Kentucky", "University of Louisville", "Eastern Kentucky University", "Morehead State University", "Northern Kentucky University"] },
  MD: { name: "Maryland", total: 28, d1: 7, d2: 1, d3: 8, naia: 0, juco: 12, scholarships: 91, roster: 520, top: ["University of Maryland", "US Naval Academy", "Towson University", "Mount St. Mary's University", "University of Maryland Eastern Shore"] },
  CT: { name: "Connecticut", total: 20, d1: 7, d2: 3, d3: 9, naia: 0, juco: 1, scholarships: 109, roster: 620, top: ["Yale University", "University of Connecticut"] },
  MA: { name: "Massachusetts", total: 53, d1: 8, d2: 3, d3: 33, naia: 1, juco: 8, scholarships: 133, roster: 1435, top: ["Harvard University", "UMass Amherst", "Boston College", "Northeastern University", "College of the Holy Cross"] },
  WV: { name: "West Virginia", total: 17, d1: 2, d2: 12, d3: 1, naia: 1, juco: 1, scholarships: 152, roster: 585, top: ["West Virginia University", "Marshall University"] },
  NE: { name: "Nebraska", total: 15, d1: 3, d2: 1, d3: 1, naia: 7, juco: 3, scholarships: 128, roster: 380, top: ["Creighton University", "University of Nebraska - Lincoln", "University of Nebraska at Omaha"] },
  CO: { name: "Colorado", total: 15, d1: 2, d2: 8, d3: 0, naia: 0, juco: 5, scholarships: 95, roster: 350, top: ["US Air Force Academy", "University of Northern Colorado"] },
  OR: { name: "Oregon", total: 22, d1: 3, d2: 1, d3: 4, naia: 5, juco: 9, scholarships: 104, roster: 440, top: ["University of Oregon"] },
  WA: { name: "Washington", total: 27, d1: 4, d2: 2, d3: 4, naia: 0, juco: 17, scholarships: 65, roster: 330, top: ["University of Washington", "Gonzaga University"] },
  NV: { name: "Nevada", total: 3, d1: 2, d2: 0, d3: 0, naia: 0, juco: 1, scholarships: 23, roster: 70, top: ["UNLV", "University of Nevada, Reno"] },
  NM: { name: "New Mexico", total: 8, d1: 2, d2: 2, d3: 0, naia: 1, juco: 3, scholarships: 53, roster: 170, top: ["New Mexico State University", "University of New Mexico"] },
  UT: { name: "Utah", total: 5, d1: 4, d2: 0, d3: 0, naia: 0, juco: 1, scholarships: 47, roster: 140, top: ["Brigham Young University", "University of Utah"] },
  ID: { name: "Idaho", total: 4, d1: 0, d2: 1, d3: 0, naia: 2, juco: 1, scholarships: 33, roster: 95, top: [] },
  MT: { name: "Montana", total: 3, d1: 0, d2: 1, d3: 0, naia: 0, juco: 2, scholarships: 9, roster: 35, top: [] },
  ND: { name: "North Dakota", total: 11, d1: 1, d2: 3, d3: 0, naia: 3, juco: 4, scholarships: 75, roster: 230, top: ["North Dakota State University"] },
  SD: { name: "South Dakota", total: 7, d1: 1, d2: 3, d3: 0, naia: 3, juco: 0, scholarships: 75, roster: 230, top: ["South Dakota State University"] },
  NH: { name: "New Hampshire", total: 10, d1: 1, d2: 3, d3: 5, naia: 0, juco: 1, scholarships: 39, roster: 290, top: ["Dartmouth College"] },
  VT: { name: "Vermont", total: 6, d1: 0, d2: 1, d3: 4, naia: 0, juco: 1, scholarships: 9, roster: 185, top: [] },
  ME: { name: "Maine", total: 14, d1: 1, d2: 0, d3: 9, naia: 1, juco: 3, scholarships: 24, roster: 335, top: ["University of Maine"] },
  RI: { name: "Rhode Island", total: 8, d1: 3, d2: 0, d3: 4, naia: 0, juco: 1, scholarships: 35, roster: 225, top: ["University of Rhode Island", "Brown University", "Bryant University"] },
  DE: { name: "Delaware", total: 5, d1: 2, d2: 2, d3: 0, naia: 0, juco: 1, scholarships: 41, roster: 140, top: ["University of Delaware"] },
  HI: { name: "Hawaii", total: 4, d1: 1, d2: 3, d3: 0, naia: 0, juco: 0, scholarships: 39, roster: 140, top: ["University of Hawaii at Manoa"] },
}

// All states for the map (abbreviated names + positions for a simple grid map)
const US_STATES = [
  ['', '', '', '', '', '', '', '', '', '', '', 'ME'],
  ['WA', 'MT', 'ND', 'MN', 'WI', 'MI', '', '', 'NY', 'VT', 'NH', ''],
  ['OR', 'ID', 'SD', 'IA', 'IL', 'IN', 'OH', 'PA', 'NJ', 'CT', 'MA', 'RI'],
  ['CA', 'NV', 'NE', 'MO', 'KY', 'WV', 'VA', 'MD', 'DE', '', '', ''],
  ['', 'UT', 'CO', 'KS', 'AR', 'TN', 'NC', 'SC', 'DC', '', '', ''],
  ['', 'AZ', 'NM', 'OK', 'LA', 'MS', 'AL', 'GA', '', '', '', ''],
  ['', '', '', 'TX', '', '', '', 'FL', '', '', '', ''],
  ['', 'HI', '', '', '', '', '', '', '', '', '', ''],
]

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'D.C.', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

export default function ScholarshipsPage() {
  const [selectedState, setSelectedState] = useState(null)
  const stateInfo = selectedState ? (STATE_DATA[selectedState] || { name: STATE_NAMES[selectedState] || selectedState, total: 0 }) : null

  return (
    <TrainerPortalShell>
      <div style={{ background: '#f3f4f6', minHeight: '100vh' }}>
        {/* Dark header */}
        <div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', padding: '28px 40px 24px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-.5px' }}>
            Baseball Scholarships
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            {NATIONAL.totalPrograms.toLocaleString()} programs across all divisions — click a state to explore
          </p>
        </div>

        <div style={{ padding: '24px 40px 40px' }}>
          {/* National stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            <DivisionCard label="D1" programs={NATIONAL.d1.programs} perSchool={NATIONAL.d1.scholarshipsPerSchool} athletes={NATIONAL.d1.athletes} color={RED} />
            <DivisionCard label="D2" programs={NATIONAL.d2.programs} perSchool={NATIONAL.d2.scholarshipsPerSchool} athletes={NATIONAL.d2.athletes} color={BLUE} />
            <DivisionCard label="D3" programs={NATIONAL.d3.programs} perSchool={0} athletes={NATIONAL.d3.athletes} color="#6b7280" note="No athletic scholarships" />
            <DivisionCard label="NAIA" programs={NATIONAL.naia.programs} perSchool={NATIONAL.naia.scholarshipsPerSchool} athletes={NATIONAL.naia.athletes} color="#7c3aed" />
            <DivisionCard label="JUCO" programs={NATIONAL.juco.programs} perSchool={NATIONAL.juco.scholarshipsPerSchool} athletes={NATIONAL.juco.athletes} color="#f59e0b" />
          </div>

          {/* HS funnel stat */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Users size={18} color={RED} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: BLK }}>{NATIONAL.hsAthletes.toLocaleString()} high school baseball players</span>
              <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>→ {(NATIONAL.d1.athletes + NATIONAL.d2.athletes + NATIONAL.d3.athletes + NATIONAL.naia.athletes + NATIONAL.juco.athletes).toLocaleString()} play college ball</span>
              <span style={{ fontSize: 13, color: RED, fontWeight: 600, marginLeft: 8 }}>({Math.round(((NATIONAL.d1.athletes + NATIONAL.d2.athletes + NATIONAL.d3.athletes + NATIONAL.naia.athletes + NATIONAL.juco.athletes) / NATIONAL.hsAthletes) * 100)}% make it)</span>
            </div>
          </div>

          {/* Map + state detail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            {/* Interactive grid map */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: BLK, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <MapPin size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Select a State
              </h3>
              <div style={{ display: 'grid', gap: 3 }}>
                {US_STATES.map((row, ri) => (
                  <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
                    {row.map((st, ci) => {
                      if (!st) return <div key={ci} />
                      const hasData = !!STATE_DATA[st]
                      const isSelected = selectedState === st
                      return (
                        <button
                          key={ci}
                          onClick={() => setSelectedState(isSelected ? null : st)}
                          style={{
                            padding: '6px 2px', borderRadius: 4, border: 'none',
                            fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            background: isSelected ? RED : hasData ? BLUE + '15' : '#f3f4f6',
                            color: isSelected ? '#fff' : hasData ? BLUE : '#9ca3af',
                            transition: 'all .15s',
                          }}
                        >
                          {st}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: BLUE + '15', marginRight: 4, verticalAlign: -1 }} />Data available</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f3f4f6', marginRight: 4, verticalAlign: -1 }} />Coming soon</span>
              </div>
            </div>

            {/* State detail panel */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px' }}>
              {stateInfo && stateInfo.total > 0 ? (
                <>
                  <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: BLK }}>{stateInfo.name}</h3>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>{stateInfo.total} baseball programs</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <MiniStat label="D1 Programs" value={stateInfo.d1 || 0} color={RED} />
                    <MiniStat label="D2 Programs" value={stateInfo.d2 || 0} color={BLUE} />
                    <MiniStat label="NAIA" value={stateInfo.naia || 0} color="#7c3aed" />
                    <MiniStat label="JUCO" value={stateInfo.juco || 0} color="#f59e0b" />
                  </div>

                  {stateInfo.scholarships > 0 && (
                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em' }}>Scholarships</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#92400e', fontFamily: '"Barlow Condensed", system-ui, sans-serif' }}>{stateInfo.scholarships}</div>
                      <div style={{ fontSize: 11, color: '#b45309' }}>{stateInfo.roster?.toLocaleString()} total roster spots</div>
                    </div>
                  )}

                  {stateInfo.top && stateInfo.top.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Top Programs</div>
                      {stateInfo.top.map((s, i) => (
                        <div key={i} style={{ padding: '4px 0', fontSize: 13, color: BLK, borderBottom: i < stateInfo.top.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          {i + 1}. {s}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : selectedState ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <GraduationCap size={24} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{STATE_NAMES[selectedState] || selectedState}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Detailed data coming soon</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <MapPin size={24} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Click a state</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>See programs, scholarships, and roster spots</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TrainerPortalShell>
  )
}

function DivisionCard({ label, programs, perSchool, athletes, color, note }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: BLK, lineHeight: 1, fontFamily: '"Barlow Condensed", system-ui, sans-serif' }}>{programs}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>programs</div>
      {perSchool > 0 && <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 6 }}>{perSchool} scholarships/school</div>}
      {note && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{note}</div>}
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{athletes.toLocaleString()} athletes</div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: BLK, fontFamily: '"Barlow Condensed", system-ui, sans-serif' }}>{value}</div>
    </div>
  )
}
