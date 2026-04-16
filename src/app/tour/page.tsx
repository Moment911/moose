'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ── Constants ────────────────────────────────────────────────────────────────
const T = '#14b8a6'
const BG = '#0a0a0a'
const CARD_BG = '#ffffff'
const MUTED = '#94a3b8'
const FH = "'Inter','Helvetica Neue',sans-serif"

const STEP_DURATIONS = [4000, 5000, 5000, 5000, 4000, 6000, 6000, 5000, 4000, 5000, 4000, 4000]
const TOTAL_DURATION = STEP_DURATIONS.reduce((a, b) => a + b, 0)

const STEP_TITLES = [
  'Welcome',
  'Connect Google APIs',
  'Quick Scan Running',
  'Unified Keyword Framework',
  'AI Visibility Score',
  'Topical Map Generated',
  '12-Agent Content Pipeline',
  'Content Generated',
  'GMB Images Geo-Tagged',
  'Rank Grid Pro',
  'Quick Win Queue',
  'Client Portal Ready',
]

const TOOLTIPS = [
  'KotoIQ connects to your Google accounts, analyzes your website, and builds a complete SEO strategy — automatically.',
  'KotoIQ pulls data from 5 Google APIs simultaneously. Your keywords, rankings, traffic, ads spend, and local business data — all in one place.',
  'Our AI scans your website, sitemap, and competitors to build your initial keyword universe in under 60 seconds.',
  'Every keyword scored on Opportunity (how valuable), Rank Propensity (how realistic), and AEO (can you win the AI Overview). Categories auto-assigned.',
  'Your AI Visibility Score is a single number that answers: "How visible is this business across ALL search engines — Google, Perplexity, ChatGPT, Bing Copilot?"',
  'KotoIQ builds a topical map — every topic you need to cover to be seen as an authority. Green = you have content. Red = gaps your competitors are winning.',
  'Before writing a single word, 6 AI agents analyze the topic. After writing, 6 more polish it. The result: content engineered to rank #1.',
  'Every page gets a Human Score (is it detectable as AI?) and Topicality Score (does it cover everything Google expects?). Only content scoring 85+ gets published.',
  'Upload or AI-generate images for Google Business Profile. KotoIQ embeds GPS coordinates, camera data, and timestamps — signals that boost local rankings.',
  'See exactly where you rank at every point around your location. Green = top 3. Red = invisible. Dead zones become hyperlocal landing page targets.',
  'Every morning, KotoIQ shows you exactly what to work on — ranked by impact vs effort. No guessing.',
  'Your client gets their own branded portal — a live dashboard they can check anytime. You never have to send a PDF report again.',
]

// ── Animated counter hook ────────────────────────────────────────────────────
function useCounter(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setVal(Math.round(target * progress))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, active])
  return val
}

// ── Step content components ──────────────────────────────────────────────────

function StepWelcome({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
      <div style={{
        fontSize: 48, fontWeight: 900, fontFamily: FH, color: T,
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.8s ease',
      }}>KotoIQ</div>
      <div style={{
        fontSize: 20, fontWeight: 500, color: '#374151',
        opacity: active ? 1 : 0, transition: 'opacity 0.8s ease 0.4s',
      }}>Setting up your SEO Command Center...</div>
      <div style={{
        width: 200, height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden',
        opacity: active ? 1 : 0, transition: 'opacity 0.6s ease 0.8s',
      }}>
        <div style={{
          height: '100%', background: T, borderRadius: 2,
          animation: active ? 'fillBar 3s ease forwards' : 'none', width: 0,
        }} />
      </div>
    </div>
  )
}

function StepAPIs({ active }: { active: boolean }) {
  const apis = [
    { name: 'Google Search Console', delay: 0 },
    { name: 'Google Analytics 4', delay: 600 },
    { name: 'Google Ads', delay: 1200 },
    { name: 'Google Business Profile', delay: 1800 },
    { name: 'Google Keyword Planner', delay: 2400 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '40px 60px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 12 }}>Connecting Data Sources</div>
      {apis.map((api, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb',
          opacity: active ? 1 : 0, transform: active ? 'translateX(0)' : 'translateX(-30px)',
          transition: `all 0.5s ease ${api.delay}ms`,
        }}>
          <span style={{ fontSize: 20 }}>&#x2705;</span>
          <span style={{ fontWeight: 600, color: '#111', fontSize: 14, fontFamily: FH }}>{api.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#10b981', fontWeight: 700 }}>Connected</span>
        </div>
      ))}
    </div>
  )
}

function StepScan({ active }: { active: boolean }) {
  const keywords = useCounter(247, 3500, active)
  const pages = useCounter(89, 3000, active)
  const da = useCounter(34, 2500, active)
  return (
    <div style={{ padding: '40px 60px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 24 }}>Quick Scan in Progress</div>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: '#e5e7eb', marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: `linear-gradient(90deg, ${T}, #10b981)`, borderRadius: 4, animation: active ? 'fillBar 4s ease forwards' : 'none', width: 0 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        {[
          { label: 'Keywords Discovered', value: keywords },
          { label: 'Pages Crawled', value: pages },
          { label: 'Domain Authority', value: da },
        ].map((m, i) => (
          <div key={i} style={{
            textAlign: 'center', padding: '16px 8px', borderRadius: 10,
            background: '#f9fafb', border: '1px solid #e5e7eb',
            opacity: active ? 1 : 0, transition: `opacity 0.5s ease ${i * 300}ms`,
          }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: T, fontFamily: FH }}>{m.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{
        fontSize: 13, color: '#6b7280', fontWeight: 500,
        opacity: active ? 1 : 0, transition: 'opacity 0.8s ease 1.5s',
      }}>Found 4 competitors: ABC Plumbing, XYZ Services, FastFix Pro, CityDrain Co.</div>
    </div>
  )
}

function StepKeywords({ active }: { active: boolean }) {
  const rows = [
    { kw: 'emergency plumber', vol: '2,400', pos: '#14', opp: 87, cat: 'Striking Distance', badge: '#ef4444' },
    { kw: 'drain cleaning near me', vol: '1,800', pos: '#8', opp: 72, cat: 'Quick Win', badge: '#f59e0b' },
    { kw: 'water heater repair cost', vol: '1,200', pos: '#22', opp: 65, cat: 'Content Gap', badge: '#6366f1' },
    { kw: '24 hour plumber', vol: '3,100', pos: '#11', opp: 91, cat: 'Striking Distance', badge: '#ef4444' },
    { kw: 'sewer line replacement', vol: '880', pos: '#5', opp: 58, cat: 'Organic Cannibal', badge: '#10b981' },
  ]
  const cols = ['Keyword', 'Volume', 'Position', 'Opportunity', 'Category']
  return (
    <div style={{ padding: '30px 40px', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 16 }}>Unified Keyword Framework</div>
      <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.4fr', background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb' }}>
          {cols.map(c => <div key={c} style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: FH }}>{c}</div>)}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.4fr', padding: '12px 16px',
            borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
            opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(12px)',
            transition: `all 0.4s ease ${i * 400}ms`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{r.kw}</div>
            <div style={{ fontSize: 13, color: '#374151' }}>{r.vol}</div>
            <div style={{ fontSize: 13, color: '#374151' }}>{r.pos}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T }}>{r.opp}</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: r.badge, padding: '3px 10px', borderRadius: 20 }}>{r.cat}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepVisibility({ active }: { active: boolean }) {
  const score = useCounter(62, 2500, active)
  const subs = [
    { label: 'Topical Authority', val: 45 },
    { label: 'Brand SERP', val: 71 },
    { label: 'E-E-A-T', val: 58 },
    { label: 'AEO', val: 54 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 28 }}>
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        <svg width={160} height={160} viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={80} cy={80} r={70} fill="none" stroke="#e5e7eb" strokeWidth={10} />
          <circle cx={80} cy={80} r={70} fill="none" stroke={T} strokeWidth={10}
            strokeDasharray={440} strokeDashoffset={active ? 440 - (440 * score / 100) : 440}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 2.5s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 900, fontFamily: FH, color: '#111' }}>{score}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>Grade: C</div>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: '#111' }}>AI Visibility Score</div>
      <div style={{ display: 'flex', gap: 20 }}>
        {subs.map((s, i) => (
          <div key={i} style={{
            textAlign: 'center', opacity: active ? 1 : 0,
            transition: `opacity 0.5s ease ${800 + i * 300}ms`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: T }}>{active ? s.val : 0}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', maxWidth: 80 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepTopicalMap({ active }: { active: boolean }) {
  const center = { x: 300, y: 200, label: 'Emergency Plumbing', color: T }
  const inner = [
    { x: 140, y: 100, label: 'Water Heater Repair', color: '#10b981' },
    { x: 460, y: 100, label: 'Drain Cleaning', color: '#10b981' },
    { x: 140, y: 300, label: 'Pipe Repair', color: '#ef4444' },
    { x: 460, y: 300, label: 'Sewer Line', color: '#f59e0b' },
  ]
  const outer = [
    { x: 60, y: 40, label: 'Water Damage', color: '#ef4444' },
    { x: 540, y: 40, label: 'Plumbing Costs', color: '#f59e0b' },
    { x: 60, y: 360, label: 'DIY vs Pro', color: '#ef4444' },
  ]
  const allNodes = [...inner, ...outer]
  return (
    <div style={{ padding: '20px 30px', height: '100%', position: 'relative' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 8 }}>Topical Authority Map</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
        <span style={{ color: '#10b981', fontWeight: 700 }}>Green</span> = Covered &nbsp;
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>Amber</span> = Partial &nbsp;
        <span style={{ color: '#ef4444', fontWeight: 700 }}>Red</span> = Gap
      </div>
      <svg width="100%" height="340" viewBox="0 0 600 400" style={{ opacity: active ? 1 : 0, transition: 'opacity 0.6s ease' }}>
        {allNodes.map((n, i) => (
          <line key={`l${i}`} x1={center.x} y1={center.y} x2={n.x} y2={n.y}
            stroke="#e5e7eb" strokeWidth={2}
            style={{ opacity: active ? 1 : 0, transition: `opacity 0.5s ease ${300 + i * 200}ms` }} />
        ))}
        {[center, ...allNodes].map((n, i) => (
          <g key={`n${i}`} style={{ opacity: active ? 1 : 0, transition: `opacity 0.5s ease ${i * 300}ms` }}>
            <circle cx={n.x} cy={n.y} r={i === 0 ? 40 : 28} fill={n.color + '18'} stroke={n.color} strokeWidth={2} />
            <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: i === 0 ? 11 : 9, fontWeight: 700, fill: n.color, fontFamily: FH }}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function StepPipeline({ active }: { active: boolean }) {
  const pre = ['Query Gap', 'Frame Semantics', 'Named Entities', 'Lexical Relations', 'Safe Answer', 'Title Auditor']
  const post = ['Word Remover', 'Metadiscourse', 'Sentence Filter', 'Entity Inserter', 'Topicality Scorer', 'Triple Generator']
  return (
    <div style={{ padding: '20px 30px', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 16 }}>12-Agent Content Pipeline</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Pre-Generation</div>
          {pre.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              marginBottom: 4, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb',
              opacity: active ? 1 : 0, transform: active ? 'translateX(0)' : 'translateX(-20px)',
              transition: `all 0.4s ease ${i * 250}ms`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? T : '#e5e7eb', transition: `background 0.3s ease ${i * 250 + 200}ms` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: FH }}>{a}</span>
            </div>
          ))}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80,
          opacity: active ? 1 : 0, transition: 'opacity 0.8s ease 1.5s',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: `${T}20`,
            border: `2px solid ${T}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, animation: active ? 'pulse 2s ease-in-out infinite' : 'none',
          }}>&#x1F9E0;</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Post-Generation</div>
          {post.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              marginBottom: 4, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb',
              opacity: active ? 1 : 0, transform: active ? 'translateX(0)' : 'translateX(20px)',
              transition: `all 0.4s ease ${1800 + i * 250}ms`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#10b981' : '#e5e7eb', transition: `background 0.3s ease ${1800 + i * 250 + 200}ms` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: FH }}>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepContent({ active }: { active: boolean }) {
  const human = useCounter(91, 2000, active)
  const topicality = useCounter(88, 2000, active)
  return (
    <div style={{ padding: '30px 50px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 20 }}>Content Generated</div>
      <div style={{
        borderRadius: 12, border: '1px solid #e5e7eb', padding: '24px', background: '#fafafa',
        opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.6s ease',
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: '#111', marginBottom: 4 }}>
          24/7 Emergency Plumber in [City] — Fast Response, Fair Pricing
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>hellokoto.com/services/emergency-plumber</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Human Score', val: human, color: '#10b981' },
            { label: 'Topicality Score', val: topicality, color: T },
            { label: 'Word Count', val: '2,847', color: '#374151' },
            { label: 'Schema', val: '3 types', color: '#6366f1' },
          ].map((m, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '12px', borderRadius: 8, background: '#fff',
              border: '1px solid #e5e7eb', opacity: active ? 1 : 0,
              transition: `opacity 0.5s ease ${400 + i * 300}ms`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{
          display: 'flex', gap: 8, marginTop: 16, opacity: active ? 1 : 0,
          transition: 'opacity 0.5s ease 1.8s',
        }}>
          {['LocalBusiness', 'FAQPage', 'Service'].map(s => (
            <span key={s} style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', background: '#eef2ff', padding: '4px 10px', borderRadius: 20 }}>
              &#x2705; {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepGMB({ active }: { active: boolean }) {
  const imgs = ['Storefront Photo', 'Service Vehicle', 'Team at Work']
  return (
    <div style={{ padding: '40px 50px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 20 }}>GMB Images Geo-Tagged</div>
      <div style={{ display: 'flex', gap: 16 }}>
        {imgs.map((img, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden',
            opacity: active ? 1 : 0, transform: active ? 'scale(1)' : 'scale(0.9)',
            transition: `all 0.5s ease ${i * 500}ms`,
          }}>
            <div style={{ height: 120, background: `linear-gradient(135deg, ${T}30, #6366f130)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36 }}>&#x1F4F7;</span>
            </div>
            <div style={{ padding: '10px 12px', background: '#f9fafb' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111', fontFamily: FH }}>{img}</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>&#x1F4CD; 26.3584 N, 80.0830 W</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Apple iPhone 15 Pro &middot; KotoIQ Geo-Tagger</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepRankGrid({ active }: { active: boolean }) {
  const grid = useMemo(() => {
    const cells: string[] = []
    for (let i = 0; i < 49; i++) {
      const dist = Math.abs(i % 7 - 3) + Math.abs(Math.floor(i / 7) - 3)
      cells.push(dist <= 1 ? '#10b981' : dist <= 2 ? '#f59e0b' : '#ef4444')
    }
    return cells
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111' }}>Rank Grid Pro</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 40px)', gap: 3,
        opacity: active ? 1 : 0, transition: 'opacity 0.8s ease',
      }}>
        {grid.map((color, i) => (
          <div key={i} style={{
            width: 40, height: 40, borderRadius: 6, background: color + '30',
            border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color,
            opacity: active ? 1 : 0, transition: `opacity 0.3s ease ${i * 30}ms`,
          }}>
            {i === 24 ? '&#x1F4CD;' : Math.floor(Math.random() * 15) + 1}
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', gap: 24, opacity: active ? 1 : 0,
        transition: 'opacity 0.5s ease 1.5s',
      }}>
        {[
          { label: 'SoLV', val: '67%', color: '#10b981' },
          { label: 'Top 3 Coverage', val: '43%', color: '#f59e0b' },
          { label: 'Dead Zones', val: '12', color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepQuickWins({ active }: { active: boolean }) {
  const items = [
    { p: 'P1', text: 'Add FAQ schema to /services page', effort: '15 min', impact: '+25% CTR', color: '#ef4444' },
    { p: 'P2', text: 'Push "drain cleaning" from #7 to #3', effort: '30 min', impact: '+180 clicks/mo', color: '#f59e0b' },
    { p: 'P3', text: 'Remove AI watermarks from 3 blog posts', effort: '10 min', impact: '+12 Human Score', color: '#f59e0b' },
    { p: 'P4', text: 'Respond to 4 unresponded Google reviews', effort: '20 min', impact: '+8% local ranking', color: '#6366f1' },
  ]
  return (
    <div style={{ padding: '30px 50px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, color: '#111', marginBottom: 20 }}>Quick Win Queue</div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
          borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 10, background: '#fff',
          opacity: active ? 1 : 0, transform: active ? 'translateX(0)' : 'translateX(-20px)',
          transition: `all 0.5s ease ${i * 400}ms`,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#fff', background: item.color,
            padding: '3px 8px', borderRadius: 6, fontFamily: FH,
          }}>{item.p}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{item.text}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.effort} &middot; {item.impact}</div>
          </div>
          <div style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid #d1d5db' }} />
        </div>
      ))}
    </div>
  )
}

function StepPortal({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
      <div style={{
        width: '80%', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden',
        opacity: active ? 1 : 0, transform: active ? 'scale(1)' : 'scale(0.95)',
        transition: 'all 0.6s ease',
      }}>
        <div style={{ background: T, padding: '16px 24px', color: '#fff' }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH }}>Client Portal — ABC Plumbing</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Last updated: just now</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '20px 24px' }}>
          {[
            { label: 'Keywords Tracked', val: '247' },
            { label: 'Top 3 Rankings', val: '18' },
            { label: 'AI Visibility', val: '62' },
            { label: 'Content Score', val: '91' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '12px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: T }}>{m.val}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
        borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb',
        opacity: active ? 1 : 0, transition: 'opacity 0.5s ease 1s',
      }}>
        <span style={{ fontSize: 14 }}>&#x1F517;</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', fontFamily: FH }}>hellokoto.com/portal/abc123</span>
      </div>
    </div>
  )
}

const STEP_COMPONENTS = [
  StepWelcome, StepAPIs, StepScan, StepKeywords, StepVisibility,
  StepTopicalMap, StepPipeline, StepContent, StepGMB, StepRankGrid,
  StepQuickWins, StepPortal,
]

// ── Main Tour Page ───────────────────────────────────────────────────────────

export default function TourPage() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-advance
  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(() => {
      if (step < 11) setStep(s => s + 1)
    }, STEP_DURATIONS[step])
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [step, paused])

  // Overall progress
  const elapsed = STEP_DURATIONS.slice(0, step).reduce((a, b) => a + b, 0)
  const progress = ((elapsed / TOTAL_DURATION) * 100)

  const StepComponent = STEP_COMPONENTS[step]

  return (
    <>
      <style>{`
        @keyframes fillBar { from { width: 0 } to { width: 100% } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.08); opacity: 0.8 } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; }
      `}</style>
      <div style={{ minHeight: '100vh', background: BG, fontFamily: FH, color: '#fff' }}>
        {/* Top nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 32px', position: 'relative', zIndex: 10,
        }}>
          <a href="/kotoiq" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            &#x2190; Back to KotoIQ
          </a>
          <div style={{ fontSize: 14, fontWeight: 800, color: T }}>KotoIQ Product Tour</div>
          <a href="/kotoiq" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Skip Tour &#x2192;
          </a>
        </div>

        {/* Main content area */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0 24px 80px', gap: 28, maxWidth: 1400, margin: '0 auto',
        }}>
          {/* Browser frame */}
          <div style={{
            width: '100%', maxWidth: 1200, background: CARD_BG, borderRadius: 16,
            overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Browser chrome */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              background: '#f3f4f6', borderBottom: '1px solid #e5e7eb',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
              <div style={{
                flex: 1, marginLeft: 12, padding: '6px 16px', borderRadius: 8,
                background: '#fff', border: '1px solid #e5e7eb', fontSize: 12,
                color: '#6b7280', fontFamily: 'monospace',
              }}>hellokoto.com/kotoiq</div>
            </div>
            {/* Step content */}
            <div style={{ height: 500, position: 'relative', overflow: 'hidden' }}>
              <StepComponent active={true} />
            </div>
          </div>

          {/* Tooltip bubble */}
          <div style={{
            maxWidth: 700, padding: '18px 24px', borderRadius: 12,
            background: '#1e293b', border: `1px solid ${T}40`,
            position: 'relative', animation: 'fadeInUp 0.5s ease',
          }}>
            <div style={{
              position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent', borderBottom: `8px solid ${T}40`,
            }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: T, marginBottom: 6, fontFamily: FH }}>
              Step {step + 1}: {STEP_TITLES[step]}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#cbd5e1' }}>
              {TOOLTIPS[step]}
            </div>
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {STEP_TITLES.map((title, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                title={title}
                style={{
                  width: i === step ? 28 : 10, height: 10, borderRadius: 5,
                  background: i === step ? T : i < step ? `${T}60` : '#334155',
                  border: 'none', cursor: 'pointer', transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => setPaused(p => !p)}
              style={{
                padding: '10px 24px', borderRadius: 8, border: `1px solid ${T}`,
                background: paused ? T : 'transparent', color: paused ? '#fff' : T,
                fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {paused ? '&#9654; Play' : '&#10074;&#10074; Pause'}
            </button>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                padding: '10px 16px', borderRadius: 8, border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}>&#x2190; Prev</button>
            )}
            {step < 11 && (
              <button onClick={() => setStep(s => s + 1)} style={{
                padding: '10px 16px', borderRadius: 8, border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}>Next &#x2192;</button>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: 1200, height: 4, borderRadius: 2, background: '#1e293b' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, ${T}, #10b981)`,
              width: `${progress}%`, transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>
    </>
  )
}
