"use client"
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Target, BarChart2, Dumbbell, DollarSign, Mail, Clock, ChevronRight, Loader2 } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import {
  T_FONT, T_FONT_NUM, T_BG, T_SURFACE, T_BRD, T_INK, T_INK_DIM,
  T_RED, T_BLUE, T_SHADOW_SM, T_SHADOW_MD, T_TYPE,
} from '../../lib/trainer/ui'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerHomePage — landing page for the Koto Trainer portal.
// Dark hero, quick stats, key facts, news feed, quick links.
// ─────────────────────────────────────────────────────────────────────────────

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
  { label: 'Programs', badge: '549', to: '/trainer/recruiting', icon: Target, color: T_RED },
  { label: 'ProPath Score', to: '/trainer/propath', icon: BarChart2, color: T_BLUE },
  { label: 'Benchmarks', to: '/trainer/benchmarks', icon: Dumbbell, color: '#059669' },
  { label: 'Scholarships', to: '/trainer/scholarships', icon: DollarSign, color: '#d97706' },
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
      {/* ── Dark hero header ── */}
      <div style={{
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
        padding: '56px 40px 48px',
      }}>
        <h1 style={{
          ...T_TYPE.display,
          fontSize: 40,
          color: '#fff',
          margin: 0,
          fontFamily: T_FONT,
        }}>
          Koto Trainer
        </h1>
        <p style={{
          ...T_TYPE.title3,
          color: '#9ca3af',
          margin: '8px 0 0',
          fontWeight: 500,
          fontFamily: T_FONT,
        }}>
          Train. Fuel. Get Recruited.
        </p>
      </div>

      {/* ── Quick stat bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        padding: '0 40px',
        marginTop: -24,
        position: 'relative',
        zIndex: 1,
      }}>
        {STATS.map((s) => (
          <div key={s.label} style={{
            background: T_SURFACE,
            borderRadius: 14,
            padding: '20px 24px',
            boxShadow: T_SHADOW_MD,
            border: `1px solid ${T_BRD}`,
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: T_FONT_NUM,
              fontSize: 36,
              fontWeight: 800,
              color: T_INK,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              {s.value}
            </div>
            <div style={{
              ...T_TYPE.subhead,
              color: T_INK_DIM,
              marginTop: 6,
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Page body ── */}
      <div style={{ padding: '40px 40px 60px' }}>

        {/* ── Key facts section ── */}
        <h2 style={{
          ...T_TYPE.title2,
          color: T_INK,
          margin: '0 0 20px',
          fontFamily: T_FONT,
        }}>
          The Numbers You Need to Know
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 48,
        }}>
          {KEY_FACTS.map((f) => (
            <div key={f.title} style={{
              background: T_SURFACE,
              borderRadius: 14,
              padding: '24px 24px 28px',
              boxShadow: T_SHADOW_SM,
              border: `1px solid ${T_BRD}`,
            }}>
              <div style={{
                ...T_TYPE.headline,
                color: T_INK,
                marginBottom: 8,
              }}>
                {f.title}
              </div>
              <p style={{
                ...T_TYPE.body,
                color: T_INK_DIM,
                margin: 0,
              }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* ── Recruiting news feed ── */}
        <h2 style={{
          ...T_TYPE.title2,
          color: T_INK,
          margin: '0 0 16px',
          fontFamily: T_FONT,
        }}>
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
                padding: '6px 16px',
                borderRadius: 20,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: T_FONT,
                cursor: 'pointer',
                background: activeTab === tab ? T_RED : T_SURFACE,
                color: activeTab === tab ? '#fff' : T_INK_DIM,
                boxShadow: activeTab === tab ? 'none' : T_SHADOW_SM,
                letterSpacing: '-0.005em',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Articles */}
        <div style={{
          background: T_SURFACE,
          borderRadius: 14,
          border: `1px solid ${T_BRD}`,
          boxShadow: T_SHADOW_SM,
          marginBottom: 48,
          overflow: 'hidden',
        }}>
          {loadingNews ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: T_INK_DIM }} />
              <span style={{ ...T_TYPE.body, color: T_INK_DIM }}>Loading news...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : visibleArticles.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', ...T_TYPE.body, color: T_INK_DIM }}>
              No articles found.
            </div>
          ) : (
            <>
              {visibleArticles.map((a, i) => (
                <div
                  key={a.url || i}
                  style={{
                    padding: '14px 24px',
                    borderBottom: i < visibleArticles.length - 1 ? `1px solid ${T_BRD}` : 'none',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                  }}
                >
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...T_TYPE.body,
                      fontWeight: 600,
                      color: T_INK,
                      textDecoration: 'none',
                      flex: 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = T_BLUE }}
                    onMouseLeave={e => { e.currentTarget.style.color = T_INK }}
                  >
                    {a.title}
                  </a>
                  <span style={{ ...T_TYPE.caption, color: T_INK_DIM, whiteSpace: 'nowrap' }}>
                    {a.source}
                  </span>
                  <span style={{ ...T_TYPE.caption, color: T_INK_DIM, whiteSpace: 'nowrap' }}>
                    {relativeDate(a.published_at)}
                  </span>
                </div>
              ))}
              {articles.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + 10)}
                  className="t-press"
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    border: 'none',
                    borderTop: `1px solid ${T_BRD}`,
                    background: 'none',
                    cursor: 'pointer',
                    ...T_TYPE.callout,
                    color: T_BLUE,
                    fontFamily: T_FONT,
                    textAlign: 'center',
                  }}
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Quick links grid ── */}
        <h2 style={{
          ...T_TYPE.title2,
          color: T_INK,
          margin: '0 0 20px',
          fontFamily: T_FONT,
        }}>
          Quick Links
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {QUICK_LINKS.map((lnk) => {
            const Icon = lnk.icon
            return (
              <Link
                key={lnk.to}
                to={lnk.to}
                className="t-press t-lift"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: T_SURFACE,
                  borderRadius: 14,
                  padding: '20px 24px',
                  boxShadow: T_SHADOW_SM,
                  border: `1px solid ${T_BRD}`,
                  textDecoration: 'none',
                  color: T_INK,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: lnk.color + '14',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={20} style={{ color: lnk.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T_TYPE.headline, color: T_INK }}>
                    {lnk.label}
                    {lnk.badge && (
                      <span style={{
                        marginLeft: 8, fontSize: 11, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 20,
                        background: T_BLUE, color: '#fff',
                        verticalAlign: 'middle',
                      }}>
                        {lnk.badge}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: T_INK_DIM, flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      </div>
    </TrainerPortalShell>
  )
}
