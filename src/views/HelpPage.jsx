"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  HelpCircle, Search, ChevronRight, ThumbsUp, ThumbsDown, BookOpen,
  MessageSquare, Sparkles, ArrowLeft, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import { useMobile } from '../hooks/useMobile'
import { renderMarkdown } from '../components/HelpAssistant'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const TEAL = T
const TEAL_SOFT = '#E6FCFD'
const BG = '#f9fafb'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

export default function HelpPage() {
  const [sp, setSp] = useSearchParams()
  const isMobile = useMobile()

  const [modules, setModules] = useState([])
  const [allArticles, setAllArticles] = useState([])
  const [selectedModule, setSelectedModule] = useState(sp.get('module') || null)
  const [article, setArticle] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(false)

  // Search
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)

  // Feedback state
  const [feedbackGiven, setFeedbackGiven] = useState({}) // slug → boolean

  // ── Initial loads
  useEffect(() => {
    fetch('/api/help?action=modules')
      .then((r) => r.json())
      .then((r) => setModules(r?.data || []))
      .catch(() => {})
    fetch('/api/help?action=list')
      .then((r) => r.json())
      .then((r) => setAllArticles(r?.data || []))
      .catch(() => {})
  }, [])

  // ── Deep-link: ?article=slug
  useEffect(() => {
    const slug = sp.get('article')
    if (slug) loadArticle(slug)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp])

  const loadArticle = useCallback(async (slug) => {
    setLoadingArticle(true)
    try {
      const r = await fetch(`/api/help?action=get&slug=${slug}`).then((r) => r.json())
      setArticle(r?.data || null)
      if (r?.data?.module) setSelectedModule(r.data.module)
    } catch {
      toast.error('Failed to load article')
    } finally {
      setLoadingArticle(false)
    }
  }, [])

  // ── Search debounce
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/help?action=search&q=${encodeURIComponent(q)}`).then((r) => r.json())
        setSearchResults(r?.data || [])
        setSearchOpen(true)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ])

  const articlesInModule = useMemo(() => {
    if (!selectedModule) return []
    return allArticles
      .filter((a) => a.module === selectedModule)
      .sort((a, b) => a.order_in_module - b.order_in_module)
  }, [allArticles, selectedModule])

  const relatedArticles = useMemo(() => {
    if (!article) return []
    return allArticles
      .filter((a) => a.module === article.module && a.slug !== article.slug)
      .slice(0, 5)
  }, [article, allArticles])

  const selectArticle = (slug) => {
    const next = new URLSearchParams(sp)
    next.set('article', slug)
    setSp(next)
  }

  const selectModule = (moduleSlug) => {
    setSelectedModule(moduleSlug)
    setArticle(null)
    const next = new URLSearchParams(sp)
    next.delete('article')
    next.set('module', moduleSlug)
    setSp(next)
  }

  const clearSelection = () => {
    setSelectedModule(null)
    setArticle(null)
    setSp(new URLSearchParams())
  }

  const submitFeedback = async (helpful) => {
    if (!article) return
    try {
      await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          question: `article:${article.slug}`,
          answer: article.title,
          was_helpful: helpful,
        }),
      })
      setFeedbackGiven((prev) => ({ ...prev, [article.slug]: helpful }))
      toast.success(helpful ? 'Thanks for the feedback!' : 'Thanks — noted.')
    } catch { /* ignore */ }
  }

  const askAIAboutArticle = () => {
    if (typeof window === 'undefined' || !article) return
    // Open the help assistant and pre-fill a question
    window.dispatchEvent(new CustomEvent('koto:open-help-article', { detail: { slug: article.slug } }))
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: BG, fontFamily: FB, color: BLK }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left nav ── */}
        <div style={{
          width: isMobile ? '100%' : 260, flexShrink: 0,
          borderRight: isMobile ? 'none' : `1px solid ${BORDER}`,
          background: '#fff',
          display: isMobile && (selectedModule || article) ? 'none' : 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '20px 18px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <HelpCircle size={22} color={TEAL} />
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Help Center</div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: BG, borderRadius: 8, padding: '9px 12px',
                border: `1px solid ${BORDER}`,
              }}>
                <Search size={14} color={MUTED} />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search articles…"
                  style={{
                    border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, fontFamily: FB, flex: 1,
                  }}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                />
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)', maxHeight: 320, overflowY: 'auto',
                  zIndex: 20,
                }}>
                  {searchResults.map((r) => (
                    <button
                      key={r.slug}
                      onClick={() => { selectArticle(r.slug); setSearchOpen(false); setSearchQ('') }}
                      style={{
                        width: '100%', textAlign: 'left', background: 'none', border: 'none',
                        padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.summary}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Module list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px 20px' }}>
            <button
              onClick={clearSelection}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                background: !selectedModule && !article ? TEAL_SOFT : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontFamily: FH, fontSize: 13, fontWeight: 700,
                color: !selectedModule && !article ? '#0e7490' : BLK,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              🏠 All modules
            </button>
            {modules.map((m) => {
              const isActive = selectedModule === m.slug || article?.module === m.slug
              return (
                <button
                  key={m.slug}
                  onClick={() => selectModule(m.slug)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: isActive ? TEAL_SOFT : 'transparent',
                    border: 'none', borderRadius: 8, cursor: 'pointer', marginTop: 2,
                    fontFamily: FH, fontSize: 13, fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#0e7490' : BLK,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                  <span style={{ flex: 1 }}>{m.label}</span>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{m.article_count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loadingArticle ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
              <Loader2 size={22} className="spin" />
            </div>
          ) : article ? (
            <ArticleView
              article={article}
              related={relatedArticles}
              onBack={() => { setArticle(null); const next = new URLSearchParams(sp); next.delete('article'); setSp(next) }}
              onRelatedClick={selectArticle}
              onFeedback={submitFeedback}
              feedbackGiven={feedbackGiven[article.slug]}
              onAskAI={askAIAboutArticle}
              isMobile={isMobile}
            />
          ) : selectedModule ? (
            <ModuleView
              module={modules.find((m) => m.slug === selectedModule)}
              articles={articlesInModule}
              onArticleClick={selectArticle}
              onBack={isMobile ? clearSelection : null}
            />
          ) : (
            <LandingView modules={modules} onModuleClick={selectModule} />
          )}
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Landing view — module card grid
// ─────────────────────────────────────────────────────────────
function LandingView({ modules, onModuleClick }) {
  return (
    <div style={{ padding: '40px 36px', maxWidth: 960 }}>
      <div style={{ fontFamily: FH, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
        Koto Help Center
      </div>
      <div style={{ fontSize: 14, color: MUTED, marginBottom: 26 }}>
        Everything you need to know about running your agency on Koto. Click a module to get started — or use the search bar to jump straight to an article.
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {modules.map((m) => (
          <button
            key={m.slug}
            onClick={() => onModuleClick(m.slug)}
            style={{
              background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14,
              padding: 20, textAlign: 'left', cursor: 'pointer',
              transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 10 }}>{m.icon}</div>
            <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>{m.description}</div>
            <div style={{ fontSize: 12, color: TEAL, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              {m.article_count} article{m.article_count === 1 ? '' : 's'} <ChevronRight size={12} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Module view — article list within a module
// ─────────────────────────────────────────────────────────────
function ModuleView({ module, articles, onArticleClick, onBack }) {
  return (
    <div style={{ padding: '36px 32px', maxWidth: 760 }}>
      {onBack && (
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={14} /> All modules
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 34 }}>{module?.icon}</div>
        <div>
          <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{module?.label}</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{module?.description}</div>
        </div>
      </div>

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {articles.map((a) => (
          <button
            key={a.slug}
            onClick={() => onArticleClick(a.slug)}
            style={{
              textAlign: 'left', padding: 18, borderRadius: 12,
              background: '#fff', border: `1px solid ${BORDER}`,
              cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: TEAL_SOFT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: TEAL,
            }}>
              <BookOpen size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 3 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{a.summary}</div>
            </div>
            <ChevronRight size={16} color={MUTED} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Article view
// ─────────────────────────────────────────────────────────────
function ArticleView({ article, related, onBack, onRelatedClick, onFeedback, feedbackGiven, onAskAI, isMobile }) {
  return (
    <div style={{
      display: 'flex', flexDirection: isMobile ? 'column' : 'row',
      padding: '32px 36px', gap: 28, maxWidth: 1100,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={14} /> Back
        </button>

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>
          Help / {article.module} / {article.title}
        </div>

        <h1 style={{ fontFamily: FH, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          {article.title}
        </h1>
        <div style={{ fontSize: 14, color: MUTED, marginBottom: 20 }}>{article.summary}</div>

        <div
          style={{ fontSize: 15, color: '#111', lineHeight: 1.65 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />

        {/* Feedback row */}
        <div style={{
          marginTop: 36, padding: '16px 20px',
          background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, flex: 1 }}>
            {feedbackGiven == null ? 'Was this helpful?' : feedbackGiven ? 'Thanks for the feedback!' : 'Thanks — noted.'}
          </div>
          {feedbackGiven == null && (
            <div style={{ display: 'flex', gap: 8 }}>
              <FeedbackBtn icon={ThumbsUp} label="Yes" onClick={() => onFeedback(true)} />
              <FeedbackBtn icon={ThumbsDown} label="No" onClick={() => onFeedback(false)} />
            </div>
          )}
          <button
            onClick={onAskAI}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: TEAL, color: '#fff', border: 'none',
              fontFamily: FH, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Sparkles size={12} /> Ask AI about this
          </button>
        </div>
      </div>

      {/* Related articles sidebar */}
      {!isMobile && related.length > 0 && (
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, marginTop: 60 }}>
            Related
          </div>
          {related.map((a) => (
            <button
              key={a.slug}
              onClick={() => onRelatedClick(a.slug)}
              style={{
                width: '100%', textAlign: 'left', padding: 12,
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10,
                cursor: 'pointer', marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH }}>{a.title}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {a.summary}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FeedbackBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8,
        background: '#fff', border: `1px solid ${BORDER}`,
        fontFamily: FH, fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}
    >
      <Icon size={13} /> {label}
    </button>
  )
}

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none', color: MUTED,
  fontFamily: FH, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', marginBottom: 14, padding: 0,
}
