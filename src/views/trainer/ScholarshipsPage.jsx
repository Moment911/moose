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

// State data — will be enriched by the scraper. For now, key states with known data.
const STATE_DATA = {
  FL: { name: 'Florida', total: 59, d1: 13, d2: 13, d3: 0, naia: 8, juco: 24, scholarships: 386, roster: 1220, top: ['Florida', 'Florida State', 'Miami', 'UCF', 'USF'] },
  TX: { name: 'Texas', total: 85, d1: 12, d2: 8, d3: 15, naia: 10, juco: 40, scholarships: 420, roster: 1800, top: ['Texas', 'Texas A&M', 'TCU', 'Texas Tech', 'Houston'] },
  CA: { name: 'California', total: 95, d1: 15, d2: 10, d3: 20, naia: 5, juco: 45, scholarships: 380, roster: 2100, top: ['UCLA', 'Stanford', 'USC', 'Cal State Fullerton', 'UC Irvine'] },
  GA: { name: 'Georgia', total: 35, d1: 5, d2: 6, d3: 8, naia: 4, juco: 12, scholarships: 180, roster: 700, top: ['Georgia', 'Georgia Tech', 'Kennesaw State', 'Georgia Southern'] },
  NC: { name: 'North Carolina', total: 45, d1: 10, d2: 8, d3: 12, naia: 3, juco: 12, scholarships: 220, roster: 900, top: ['North Carolina', 'NC State', 'Duke', 'Wake Forest', 'East Carolina'] },
  SC: { name: 'South Carolina', total: 25, d1: 5, d2: 4, d3: 6, naia: 3, juco: 7, scholarships: 130, roster: 500, top: ['South Carolina', 'Clemson', 'Coastal Carolina', 'College of Charleston'] },
  AL: { name: 'Alabama', total: 22, d1: 4, d2: 3, d3: 2, naia: 3, juco: 10, scholarships: 140, roster: 480, top: ['Alabama', 'Auburn', 'South Alabama', 'Samford'] },
  LA: { name: 'Louisiana', total: 20, d1: 6, d2: 2, d3: 1, naia: 2, juco: 9, scholarships: 130, roster: 450, top: ['LSU', 'Louisiana', 'Tulane', 'Southeastern Louisiana'] },
  TN: { name: 'Tennessee', total: 22, d1: 5, d2: 3, d3: 5, naia: 3, juco: 6, scholarships: 120, roster: 500, top: ['Tennessee', 'Vanderbilt', 'Memphis', 'Belmont'] },
  AZ: { name: 'Arizona', total: 18, d1: 3, d2: 1, d3: 2, naia: 1, juco: 11, scholarships: 110, roster: 380, top: ['Arizona', 'Arizona State', 'Grand Canyon'] },
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
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#92400e' }}>{stateInfo.scholarships}</div>
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
      <div style={{ fontSize: 24, fontWeight: 900, color: BLK, lineHeight: 1 }}>{programs}</div>
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
      <div style={{ fontSize: 18, fontWeight: 900, color: BLK }}>{value}</div>
    </div>
  )
}
