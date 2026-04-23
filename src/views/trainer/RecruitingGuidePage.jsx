"use client"
import { useState, useRef, useEffect } from 'react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { T_RED, T_BLUE, T_BG, T_FONT, T_FONT_NUM } from '../../lib/trainer/ui'

// ─────────────────────────────────────────────────────────────────────────────
// RecruitingGuidePage — long-form 6-section college baseball recruiting guide.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'get-recruited', label: 'How to Get Recruited' },
  { id: 'rules-calendar', label: 'Rules & Calendar' },
  { id: 'academics', label: 'Academic Requirements' },
  { id: 'video', label: 'Recruiting Video' },
  { id: 'camps', label: 'Camps & Showcases' },
  { id: 'scholarships', label: 'Scholarship Facts' },
]

/* ── Shared styles ──────────────────────────────────────────────────────── */

const card = {
  background: '#fff',
  borderRadius: 14,
  padding: '32px 36px',
  marginBottom: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.04)',
}

const sectionTitle = {
  fontSize: 24, fontWeight: 700, color: T_RED,
  letterSpacing: '-.016em', lineHeight: 1.15, marginBottom: 20,
  fontFamily: T_FONT,
}

const subTitle = {
  fontSize: 18, fontWeight: 700, color: '#111827',
  letterSpacing: '-.01em', lineHeight: 1.25, marginBottom: 12,
  marginTop: 28,
}

const bodyText = {
  fontSize: 15, lineHeight: 1.65, color: '#374151',
  letterSpacing: '-.003em',
}

const bulletList = {
  margin: '8px 0 16px 0', padding: 0, listStyle: 'none',
}

const bulletItem = {
  ...bodyText,
  position: 'relative', paddingLeft: 20, marginBottom: 8,
}

const bulletDot = {
  position: 'absolute', left: 0, top: 9,
  width: 6, height: 6, borderRadius: '50%',
  background: T_RED,
}

const calloutBox = {
  background: '#fef3c7', borderRadius: 10, padding: '16px 20px',
  marginBottom: 16, marginTop: 16,
  fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: '#92400e',
  borderLeft: `4px solid #f59e0b`,
}

const tipBox = {
  background: '#f8fafc', borderRadius: 10, padding: '16px 20px',
  marginBottom: 16, marginTop: 16,
  fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: '#1e3a5f',
  borderLeft: `4px solid ${T_BLUE}`,
}

const statBadge = {
  fontFamily: T_FONT_NUM, fontWeight: 700, fontSize: 15,
  color: T_RED,
}

const dividerBar = {
  height: 4, background: 'linear-gradient(90deg, rgba(220,38,38,.15) 0%, transparent 100%)',
  borderRadius: 2, margin: '32px 0',
}

/* ── Bullet helper ──────────────────────────────────────────────────────── */

function Bullet({ children }) {
  return (
    <li style={bulletItem}>
      <span style={bulletDot} />
      {children}
    </li>
  )
}

function SectionDivider() {
  return <div style={dividerBar} />
}

/* ── Section 1: How to Get Recruited ────────────────────────────────────── */

function SectionGetRecruited() {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>How to Get Recruited</h2>
      <p style={bodyText}>
        No one is going to recruit you. You recruit yourself. Here is the playbook, year by year.
      </p>

      <h3 style={subTitle}>Step 1: Build Your Profile (Freshman Year)</h3>
      <ul style={bulletList}>
        <Bullet>Create a recruiting email: <strong>firstname.lastname.baseball@gmail.com</strong></Bullet>
        <Bullet>Start filming skills videos — bullpens, BP, fielding, everything</Bullet>
        <Bullet>Register with the NCAA Eligibility Center (do it now, not later)</Bullet>
        <Bullet>Make a target list of <span style={statBadge}>30-50</span> schools at every level</Bullet>
        <Bullet>Focus on academics — your GPA matters from day one. Not junior year. Day one.</Bullet>
      </ul>

      <div style={tipBox}>
        Start your target list broad. Include D1, D2, D3, NAIA, and JUCO programs. You can narrow it later once you know where you fit.
      </div>

      <h3 style={subTitle}>Step 2: Get on the Radar (Sophomore Year)</h3>
      <ul style={bulletList}>
        <Bullet>Send intro emails to coaches at target schools (use our templates)</Bullet>
        <Bullet>Attend <span style={statBadge}>2-3</span> college camps at schools you actually want to attend</Bullet>
        <Bullet>Play in at least one national showcase — PBR, PG, or WWBA</Bullet>
        <Bullet>Take the PSAT and start SAT/ACT prep</Bullet>
        <Bullet>Update your highlight video with current footage — freshman tape is stale</Bullet>
      </ul>

      <h3 style={subTitle}>Step 3: Peak Recruiting Year (Junior Year)</h3>
      <div style={calloutBox}>
        This is IT. <span style={statBadge}>85%</span> of D1 rosters are filled by the end of junior summer. If you wait until senior year you are already behind.
      </div>
      <ul style={bulletList}>
        <Bullet>Send follow-up emails to every target school with updated stats and video</Bullet>
        <Bullet>Take the SAT/ACT — aim for <span style={statBadge}>1000+</span> SAT or <span style={statBadge}>20+</span> ACT for D1</Bullet>
        <Bullet>Schedule unofficial visits to your top <span style={statBadge}>5-10</span> schools</Bullet>
        <Bullet>Attend camps at your top target schools — this is where coaches evaluate you in their environment</Bullet>
        <Bullet>Have your HS and travel coach make calls to college coaches on your behalf</Bullet>
        <Bullet>Be responsive — reply to every coach email within <span style={statBadge}>24</span> hours</Bullet>
      </ul>

      <h3 style={subTitle}>Step 4: Close the Deal (Senior Year)</h3>
      <ul style={bulletList}>
        <Bullet>Follow up with every school still in play</Bullet>
        <Bullet>Schedule official visits — D1 allows <span style={statBadge}>5</span></Bullet>
        <Bullet>Compare financial aid packages side by side</Bullet>
        <Bullet>Sign Early (November) or Regular (April)</Bullet>
        <Bullet>Keep your grades up — admission can be revoked for academic decline</Bullet>
        <Bullet>If you are uncommitted, JUCO is a legitimate and strong development path</Bullet>
      </ul>

      <div style={tipBox}>
        JUCO is not a consolation prize. Hundreds of D1 players came through the JUCO route. If you need more development time or your grades need work, it is the smart move.
      </div>
    </div>
  )
}

/* ── Section 2: Rules & Calendar ────────────────────────────────────────── */

function SectionRulesCalendar() {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>Rules & Calendar</h2>
      <p style={bodyText}>
        The NCAA has strict rules about when coaches can contact you. Know the rules so you know what to expect — and what is a violation.
      </p>

      <h3 style={subTitle}>D1 Contact Periods</h3>
      <ul style={bulletList}>
        <Bullet>Coaches can call starting <strong>June 15 after sophomore year</strong></Bullet>
        <Bullet>Unlimited calls and texts after June 15</Bullet>
        <Bullet>Official visits: unlimited starting junior year</Bullet>
        <Bullet>Dead periods: check the NCAA website for current dates — they shift each year</Bullet>
        <Bullet>Quiet periods: coaches can meet you on campus only (no off-campus contact)</Bullet>
      </ul>

      <h3 style={subTitle}>D2 Contact Rules</h3>
      <ul style={bulletList}>
        <Bullet>Coaches can call starting June 15 after sophomore year</Bullet>
        <Bullet>Similar structure to D1 but generally less restrictive</Bullet>
      </ul>

      <h3 style={subTitle}>D3 Contact Rules</h3>
      <ul style={bulletList}>
        <Bullet>No athletic scholarships, but coaches actively recruit</Bullet>
        <Bullet>Coaches can contact you anytime starting junior year</Bullet>
        <Bullet>More flexible than D1/D2 — fewer dead and quiet period restrictions</Bullet>
      </ul>

      <SectionDivider />

      <h3 style={subTitle}>Key Dates</h3>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {[
          ['June 15 (after sophomore year)', 'D1/D2 coaches can call you'],
          ['August 1 (before junior year)', 'Coaches can send written materials'],
          ['Early Signing Period: November', 'Exact dates vary by year'],
          ['Regular Signing Period: April', 'Exact dates vary by year'],
          ['Transfer Portal windows', 'April 15-30 and August 1-15'],
        ].map(([date, desc]) => (
          <div key={date} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
            <span style={{ ...statBadge, fontSize: 14, minWidth: 220, flexShrink: 0 }}>{date}</span>
            <span style={{ ...bodyText, fontSize: 14, color: '#4b5563' }}>{desc}</span>
          </div>
        ))}
      </div>

      <div style={calloutBox}>
        June 15 after sophomore year is the most important date on this list. Be ready before it arrives — have your email, video, and target list locked in.
      </div>
    </div>
  )
}

/* ── Section 3: Academic Requirements ───────────────────────────────────── */

function SectionAcademics() {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>Academic Requirements</h2>

      <h3 style={subTitle}>NCAA Eligibility Center (Clearinghouse)</h3>
      <ul style={bulletList}>
        <Bullet>Register at <strong>eligibilitycenter.org</strong></Bullet>
        <Bullet>You must be certified to play D1 or D2 — no exceptions</Bullet>
      </ul>

      <h3 style={subTitle}>D1 Academic Requirements</h3>
      <ul style={bulletList}>
        <Bullet><span style={statBadge}>2.3</span> minimum GPA in 16 core courses</Bullet>
        <Bullet>Sliding scale: higher GPA = lower test score needed</Bullet>
        <Bullet><span style={statBadge}>10</span> core courses must be completed before senior year</Bullet>
        <Bullet><span style={statBadge}>7</span> of those 10 must be in English, math, or science</Bullet>
        <Bullet>SAT: combined math + reading (writing section not included)</Bullet>
        <Bullet>ACT: sum of English, math, reading, and science sections</Bullet>
      </ul>

      <h3 style={subTitle}>D2 Academic Requirements</h3>
      <ul style={bulletList}>
        <Bullet><span style={statBadge}>2.2</span> minimum GPA in 16 core courses</Bullet>
        <Bullet>SAT: <span style={statBadge}>840</span> minimum or ACT: <span style={statBadge}>70</span> sum score</Bullet>
        <Bullet>Simpler sliding scale than D1</Bullet>
      </ul>

      <h3 style={subTitle}>D3</h3>
      <ul style={bulletList}>
        <Bullet>Must be admitted by the school directly — no NCAA eligibility requirement</Bullet>
        <Bullet>Schools set their own academic standards (often higher than D1)</Bullet>
      </ul>

      <SectionDivider />

      <h3 style={subTitle}>GPA Reality Check</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {[
          ['3.5+ GPA', 'Opens doors to academic D3, Ivy League, and top D1 programs', '#dcfce7', '#166534'],
          ['3.0+ GPA', 'Opens doors everywhere — you will not be limited academically', '#dbeafe', '#1e40af'],
          ['Below 2.5 GPA', 'Limits your D1 options significantly', '#fef3c7', '#92400e'],
          ['Below 2.0 GPA', 'Some coaches will not recruit you regardless of talent', '#fee2e2', '#991b1b'],
        ].map(([gpa, desc, bg, color]) => (
          <div key={gpa} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderRadius: 10, background: bg }}>
            <span style={{ fontFamily: T_FONT_NUM, fontWeight: 700, fontSize: 15, color, minWidth: 100 }}>{gpa}</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color }}>{desc}</span>
          </div>
        ))}
      </div>

      <div style={calloutBox}>
        Your GPA is not just about eligibility. It is your leverage. A 3.5 GPA makes you cheaper to scholarship because academic aid can stack on top of athletic aid.
      </div>
    </div>
  )
}

/* ── Section 4: Recruiting Video ────────────────────────────────────────── */

function SectionVideo() {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>Recruiting Video</h2>
      <p style={bodyText}>
        Your video is your resume. Coaches will not watch more than 5 minutes. Make every second count.
      </p>

      <h3 style={subTitle}>Format</h3>
      <ul style={bulletList}>
        <Bullet><span style={statBadge}>3-5</span> minutes max — coaches will not watch longer</Bullet>
        <Bullet>Start with a title card: Name, Grad Year, Position, Height/Weight, School, Contact</Bullet>
        <Bullet>Show skills in this order: primary position first, then secondary</Bullet>
      </ul>

      <h3 style={subTitle}>For Pitchers</h3>
      <ul style={bulletList}>
        <Bullet>Bullpen footage showing all pitches with radar gun visible</Bullet>
        <Bullet>Game footage: show full at-bats, not just strikeouts</Bullet>
        <Bullet>Mechanics from side view AND behind the mound</Bullet>
        <Bullet>Show velocity data (Rapsodo/Trackman if available)</Bullet>
      </ul>

      <h3 style={subTitle}>For Position Players</h3>
      <ul style={bulletList}>
        <Bullet>Batting practice: cage + live BP</Bullet>
        <Bullet>Game at-bats — <span style={statBadge}>3-5</span> quality ABs</Bullet>
        <Bullet>Defensive plays at your primary position</Bullet>
        <Bullet>Arm throws (infield and outfield)</Bullet>
        <Bullet>60-yard dash, timed and on film</Bullet>
      </ul>

      <h3 style={subTitle}>For Catchers</h3>
      <ul style={bulletList}>
        <Bullet>Pop times — multiple throws to second base</Bullet>
        <Bullet>Blocking drills</Bullet>
        <Bullet>Game receiving footage</Bullet>
        <Bullet>Batting (same as position players)</Bullet>
      </ul>

      <SectionDivider />

      <h3 style={subTitle}>Technical Tips</h3>
      <ul style={bulletList}>
        <Bullet>Film in good lighting — outdoor and daytime is best</Bullet>
        <Bullet>Use a tripod. Handheld footage looks amateur.</Bullet>
        <Bullet>Show your jersey number clearly in at least one shot</Bullet>
        <Bullet>Include slow-motion replays of key moments</Bullet>
        <Bullet>Upload to YouTube (unlisted is fine)</Bullet>
        <Bullet>Put the YouTube link in EVERY email you send to coaches</Bullet>
      </ul>

      <div style={tipBox}>
        Your video should be updated at least twice a year. Freshman footage is useless by junior year. Keep it current.
      </div>
    </div>
  )
}

/* ── Section 5: Camps & Showcases ───────────────────────────────────────── */

function SectionCamps() {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>Camps & Showcases</h2>
      <p style={bodyText}>
        Not all events are created equal. Here is how to prioritize.
      </p>

      <h3 style={subTitle}>Tier 1 — National Showcases (coaches attend in droves)</h3>
      <ul style={bulletList}>
        <Bullet><strong>Perfect Game (PG)</strong>: National, Underclass, World Series events</Bullet>
        <Bullet><strong>Prep Baseball Report (PBR)</strong>: State and regional showcases</Bullet>
        <Bullet><strong>USA Baseball</strong>: 15U, 16U, 18U national teams</Bullet>
        <Bullet><strong>East Coast Pro</strong></Bullet>
        <Bullet><strong>WWBA</strong> (World Wood Bat Association)</Bullet>
        <Bullet><strong>Area Code Games</strong></Bullet>
      </ul>

      <h3 style={subTitle}>Tier 2 — Regional/State</h3>
      <ul style={bulletList}>
        <Bullet>PBR state-level showcases (available in most states)</Bullet>
        <Bullet>Perfect Game regional tournaments</Bullet>
        <Bullet>Top 96 events</Bullet>
        <Bullet>Five Star camps</Bullet>
      </ul>

      <h3 style={subTitle}>Tier 3 — College Camps (HIGH VALUE for targeting specific schools)</h3>
      <ul style={bulletList}>
        <Bullet>Attend camps at YOUR target schools — coaches evaluate you in their environment</Bullet>
        <Bullet>Often the single best way to get noticed by a specific program</Bullet>
        <Bullet>Cost: <span style={statBadge}>$100-300</span> per camp</Bullet>
        <Bullet>Go to <span style={statBadge}>3-5</span> camps at your top schools</Bullet>
      </ul>

      <div style={calloutBox}>
        College camps are the highest-ROI events on this list. A $200 camp at your top school beats a $1,000 national showcase where no one knows your name.
      </div>

      <SectionDivider />

      <h3 style={subTitle}>When to Attend</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {[
          ['Freshman', 'Local/regional showcases, 1-2 college camps'],
          ['Sophomore', '1 national showcase + 3-4 college camps'],
          ['Junior', '2-3 national showcases + camps at top 5 targets — THIS IS YOUR YEAR'],
          ['Senior', 'Only attend if still uncommitted'],
        ].map(([year, plan]) => (
          <div key={year} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
            <span style={{ fontFamily: T_FONT_NUM, fontWeight: 700, fontSize: 15, color: T_RED, minWidth: 100 }}>{year}</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: '#374151' }}>{plan}</span>
          </div>
        ))}
      </div>

      <h3 style={subTitle}>How to Choose</h3>
      <ul style={bulletList}>
        <Bullet>Ask yourself: "Will college coaches I care about be there?" If not, it is just practice.</Bullet>
        <Bullet>Priority order: college camps at target schools &gt; national showcases &gt; regional events</Bullet>
        <Bullet>Do not over-showcase — <span style={statBadge}>4-6</span> events per year is enough</Bullet>
        <Bullet>Quality over quantity, every time</Bullet>
      </ul>
    </div>
  )
}

/* ── Section 6: Scholarship Facts ───────────────────────────────────────── */

function SectionScholarships() {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>Scholarship Facts</h2>
      <p style={{ ...bodyText, marginBottom: 16 }}>
        Updated for the 2025-26 NCAA rules. The landscape has changed dramatically.
      </p>

      <h3 style={subTitle}>Scholarships by Division</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {[
          ['D1', '34', 'per team (up from 11.7 — massive change). Each must be at least 50% of full cost of attendance.'],
          ['D2', '9', 'per team (equivalency model — can split across players)'],
          ['D3', '0', 'athletic scholarships. Merit + need-based aid only, but can be substantial.'],
          ['NAIA', '12', 'per team'],
          ['JUCO', '24', 'per team'],
        ].map(([div, num, desc]) => (
          <div key={div} style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '14px 18px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
            <span style={{ fontFamily: T_FONT_NUM, fontWeight: 800, fontSize: 18, color: T_RED, minWidth: 44 }}>{div}</span>
            <span style={{ fontFamily: T_FONT_NUM, fontWeight: 800, fontSize: 22, color: '#111827', minWidth: 36 }}>{num}</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: '#4b5563' }}>{desc}</span>
          </div>
        ))}
      </div>

      <div style={calloutBox}>
        The jump from 11.7 to 34 D1 scholarships is the biggest structural change in college baseball history. More players will get meaningful money. Walk-on opportunities may decrease as more roster spots are funded.
      </div>

      <h3 style={subTitle}>What "Full Ride" Actually Means</h3>
      <ul style={bulletList}>
        <Bullet>Tuition + fees + room + board + books</Bullet>
        <Bullet>Very few baseball players get full rides, even at D1</Bullet>
        <Bullet>The new 34-scholarship limit with 50% minimum changes the math — more players will get meaningful money, fewer will get full rides</Bullet>
      </ul>

      <h3 style={subTitle}>How to Maximize Financial Aid</h3>
      <ul style={bulletList}>
        <Bullet>Apply for FAFSA early — the earlier you apply, the more aid is available</Bullet>
        <Bullet>Compare in-state vs out-of-state costs before you commit</Bullet>
        <Bullet>Academic scholarships can STACK with athletic aid at some schools</Bullet>
        <Bullet>D3 schools often have generous merit aid — do not dismiss them</Bullet>
        <Bullet>JUCO is nearly free and a strong development path if you need time</Bullet>
      </ul>

      <div style={tipBox}>
        Run the numbers. A 50% scholarship at a $60k/year private school still costs $30k. A full academic ride at a D3 school might be the smarter financial play.
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function RecruitingGuidePage() {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const sectionRefs = useRef({})
  const tabBarRef = useRef(null)

  const scrollToSection = (id) => {
    setActiveTab(id)
    const el = sectionRefs.current[id]
    if (el) {
      const offset = 160 // header + sticky tabs
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  // Update active tab on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY + 200
      let current = TABS[0].id
      for (const tab of TABS) {
        const el = sectionRefs.current[tab.id]
        if (el && el.offsetTop <= scrollY) current = tab.id
      }
      setActiveTab(current)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <TrainerPortalShell>
      {/* Dark gradient header */}
      <div style={{
        background: 'linear-gradient(135deg, #111827 0%, #1f2937 60%, #111827 100%)',
        padding: '56px 40px 40px',
        borderBottom: `3px solid ${T_RED}`,
      }}>
        <h1 style={{
          fontSize: 36, fontWeight: 800, color: '#fff',
          letterSpacing: '-.024em', lineHeight: 1.1,
          marginBottom: 10,
          fontFamily: T_FONT,
        }}>
          College Baseball Recruiting Guide
        </h1>
        <p style={{
          fontSize: 17, fontWeight: 400, color: '#9ca3af',
          letterSpacing: '-.005em', lineHeight: 1.5,
          maxWidth: 560,
        }}>
          Everything you need to know — from freshman year to signing day.
        </p>
      </div>

      {/* Sticky tab navigation */}
      <div
        ref={tabBarRef}
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 40px',
          display: 'flex', gap: 0,
          overflowX: 'auto',
          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              style={{
                padding: '14px 18px',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? T_RED : '#6b7280',
                background: 'none', border: 'none',
                borderBottom: active ? `2px solid ${T_RED}` : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                letterSpacing: '-.005em',
                transition: 'color 150ms, border-color 150ms',
                fontFamily: T_FONT,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div ref={el => { sectionRefs.current['get-recruited'] = el }}>
          <SectionGetRecruited />
        </div>
        <div ref={el => { sectionRefs.current['rules-calendar'] = el }}>
          <SectionRulesCalendar />
        </div>
        <div ref={el => { sectionRefs.current['academics'] = el }}>
          <SectionAcademics />
        </div>
        <div ref={el => { sectionRefs.current['video'] = el }}>
          <SectionVideo />
        </div>
        <div ref={el => { sectionRefs.current['camps'] = el }}>
          <SectionCamps />
        </div>
        <div ref={el => { sectionRefs.current['scholarships'] = el }}>
          <SectionScholarships />
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          /* Force single column, reduce padding */
        }
      `}</style>
    </TrainerPortalShell>
  )
}
