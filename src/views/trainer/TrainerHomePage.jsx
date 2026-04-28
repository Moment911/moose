"use client"
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Target, BarChart2, Dumbbell, DollarSign, Mail, Clock, ChevronRight, Loader2 } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerHomePage — Cal-AI aesthetic: white canvas, clean typography.
// ─────────────────────────────────────────────────────────────────────────────

const F    = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const INK  = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const CARD = '#f1f1f6'
const BRD  = '#ececef'
const BLUE = '#5aa0ff'
const RED  = '#e9695c'
const ACCENT = '#d89a6a'

const STATS = [
  { value: '473,503', label: 'HS Baseball Players' },
  { value: '52,200', label: 'Play College Ball' },
  { value: '11%', label: 'Make It to College' },
  { value: '1,727', label: 'Programs Nationwide' },
]

const KEY_FACTS = [
  {
    title: 'D1 Scholarship Reality',
    body: 'Only 11.7 scholarships split across ~35 players. Average D1 baseball scholarship covers ~25% of tuition. Most players get partial, not full rides.',
  },
  {
    title: 'When Coaches Recruit',
    body: '85% of D1 rosters are filled by end of junior year. Sophomores: start emailing NOW. Freshmen: build your video and attend showcases.',
  },
  {
    title: 'What Gets You Recruited',
    body: 'Verified measurables matter more than tournament trophies. Coaches want: velocity (pitchers), exit velo (hitters), 60 time (everyone), and GPA above 3.0.',
  },
]

const NEWS_TABS = ['All', 'D1', 'Transfer Portal', 'MLB Draft', 'CWS']

const QUICK_LINKS = [
  { label: 'Programs', badge: '549', to: '/trainer/recruiting', icon: Target, color: RED },
  { label: 'ProPath Score', to: '/trainer/propath', icon: BarChart2, color: BLUE },
  { label: 'Benchmarks', to: '/trainer/benchmarks', icon: Dumbbell, color: '#16a34a' },
  { label: 'Scholarships', to: '/trainer/scholarships', icon: DollarSign, color: ACCENT },
  { label: 'Email Templates', to: '/trainer/templates', icon: Mail, color: '#7c3aed' },
  { label: 'Recruiting Timeline', to: '/trainer/timeline', icon: Clock, color: '#0891b2' },
]

function relativeDate(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function TrainerHomePage() {
  const [activeTab, setActiveTab] = useState('All')
  const [articles, setArticles] = useState([])
  const [loadingNews, setLoadingNews] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)

  const fetchNews = useCallback(async (division) => {
    setLoadingNews(true)
    setVisibleCount(10)
    try {
      const param = division === 'All' ? '' : division
      const res = await fetch(`/api/trainer/news?division=${encodeURIComponent(param)}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.articles || [])
      } else {
        setArticles([])
      }
    } catch {
      setArticles([])
    } finally {
      setLoadingNews(false)
    }
  }, [])

  useEffect(() => { fetchNews(activeTab) }, [activeTab, fetchNews])

  const visibleArticles = articles.slice(0, visibleCount)

  return (
    <TrainerPortalShell>
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: F }}>

        {/* ── Header ── */}
        <div style={{ padding: '40px 40px 0' }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: INK, letterSpacing: '-0.6px', lineHeight: 1.10 }}>
            Koto Trainer
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 500, color: INK3 }}>
            Train. Fuel. Get Recruited.
          </p>
        </div>

        {/* ── Quick stat bar ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
          padding: '28px 40px 0',
        }}>
          {STATS.map((s) => (
            <div key={s.label} style={{
              background: CARD, borderRadius: 16, padding: '20px 24px', textAlign: 'center',
            }}>
              <div style={{
                fontFamily: '"Barlow Condensed", system-ui, sans-serif',
                fontSize: 36, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: INK3, marginTop: 6 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Page body ── */}
        <div style={{ padding: '36px 40px 60px' }}>

          {/* ── Key facts ── */}
          <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.2px' }}>
            The Numbers You Need to Know
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 48 }}>
            {KEY_FACTS.map((f) => (
              <div key={f.title} style={{
                background: CARD, borderRadius: 16, padding: '24px 24px 28px',
              }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: INK, marginBottom: 8, letterSpacing: '-0.2px' }}>
                  {f.title}
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: INK3, lineHeight: 1.5 }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>

          {/* ── Recruiting news feed ── */}
          <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.2px' }}>
            Recruiting News
          </h2>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {NEWS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="t-press"
                style={{
                  padding: '6px 16px', borderRadius: 999, border: 'none',
                  fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                  background: activeTab === tab ? INK : CARD,
                  color: activeTab === tab ? '#fff' : INK3,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Articles */}
          <div style={{
            background: CARD, borderRadius: 16, marginBottom: 48, overflow: 'hidden',
          }}>
            {loadingNews ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: INK3 }} />
                <span style={{ fontSize: 15, fontWeight: 500, color: INK3 }}>Loading news...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : visibleArticles.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', fontSize: 15, fontWeight: 500, color: INK3 }}>
                No articles found.
              </div>
            ) : (
              <>
                {visibleArticles.map((a, i) => (
                  <div key={a.url || i} style={{
                    padding: '14px 24px',
                    borderBottom: i < visibleArticles.length - 1 ? `1px solid ${BRD}` : 'none',
                    display: 'flex', alignItems: 'baseline', gap: 12,
                    background: '#fff',
                  }}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 15, fontWeight: 600, color: INK, textDecoration: 'none', flex: 1 }}
                      onMouseEnter={e => { e.currentTarget.style.color = BLUE }}
                      onMouseLeave={e => { e.currentTarget.style.color = INK }}>
                      {a.title}
                    </a>
                    <span style={{ fontSize: 13, fontWeight: 500, color: INK4, whiteSpace: 'nowrap' }}>
                      {a.source}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: INK4, whiteSpace: 'nowrap' }}>
                      {relativeDate(a.published_at)}
                    </span>
                  </div>
                ))}
                {articles.length > visibleCount && (
                  <button onClick={() => setVisibleCount(c => c + 10)}
                    className="t-press"
                    style={{
                      width: '100%', padding: '14px 24px', border: 'none',
                      borderTop: `1px solid ${BRD}`, background: '#fff',
                      cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: F,
                      color: BLUE, textAlign: 'center',
                    }}>
                    Load more
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Quick links grid ── */}
          <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.2px' }}>
            Quick Links
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {QUICK_LINKS.map((lnk) => {
              const Icon = lnk.icon
              return (
                <Link key={lnk.to} to={lnk.to} className="t-press t-lift"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: CARD, borderRadius: 16, padding: '20px 24px',
                    textDecoration: 'none', color: INK,
                  }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={20} style={{ color: lnk.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>
                      {lnk.label}
                      {lnk.badge && (
                        <span style={{
                          marginLeft: 8, fontSize: 11, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 999,
                          background: '#fff', color: INK3, border: `1px solid ${BRD}`,
                          verticalAlign: 'middle',
                        }}>
                          {lnk.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: INK4, flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </TrainerPortalShell>
  )
}
