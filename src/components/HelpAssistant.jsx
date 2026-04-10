"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  HelpCircle, X, Send, Brain, Search, ArrowRight, ThumbsUp, ThumbsDown,
  BookOpen, Loader2, ExternalLink, Info, Sparkles,
} from 'lucide-react'

const TEAL = '#00C2CB'
const TEAL_SOFT = '#E6FCFD'
const BLK = '#111'
const BG = '#F7F7F6'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const STARTER_CHIPS = [
  "How do I create a discovery engagement?",
  "How does the voice AI work?",
  "How do I track a sent email?",
  "What is the readiness score?",
  "How do I generate a strategic audit?",
  "How do I share a proposal?",
]

const CONTEXT_HINTS = {
  '/discovery':       'Tip: ask about creating engagements, the tech stack scanner, interview mode, or anything discovery.',
  '/voice':           'Tip: ask about setting up agents, running campaigns, or reading the live monitor.',
  '/email-tracking':  'Tip: ask how to set up pixel tracking, connect Gmail, or read the dashboard.',
  '/opportunities':   'Tip: ask about the pipeline, GHL push, or opportunity sources.',
  '/scout':           'Tip: ask how to search for prospects or spin up voice campaigns from results.',
  '/proposals':       'Tip: ask about sharing proposals, tracking opens, or auto-drafting from the audit.',
  '/reviews':         'Tip: ask about review campaigns or the AI response generator.',
  '/agent':           'Tip: ask about the real-time data the CMO agent sees or how to phrase good questions.',
  '/pixels':          'Tip: ask about installing the pixel or how intent scoring works.',
  '/vault':           'Tip: ask about snapshots, restoring, and the vault timeline.',
}

function getContextHint(pathname) {
  const entries = Object.entries(CONTEXT_HINTS)
  for (const [prefix, hint] of entries) {
    if (pathname.startsWith(prefix)) return hint
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Lightweight markdown renderer — headings, bold, italics,
// inline code, code blocks, lists, links, paragraphs.
// Shared between HelpAssistant and HelpPage.
// ─────────────────────────────────────────────────────────────
export function renderMarkdown(src = '') {
  // Escape HTML
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Split into blocks
  const lines = src.split('\n')
  const out = []
  let i = 0
  let inList = false
  let listType = null
  let inCode = false
  let codeBuf = []

  const flushList = () => {
    if (inList) {
      out.push(`</${listType}>`)
      inList = false
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(`<pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:ui-monospace,monospace;"><code>${esc(codeBuf.join('\n'))}</code></pre>`)
        inCode = false
        codeBuf = []
      } else {
        flushList()
        inCode = true
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushList()
      const level = h[1].length
      const sizes = [0, 22, 18, 16, 15, 14, 13]
      out.push(`<h${level} style="font-family:${FH};font-weight:800;font-size:${sizes[level]}px;margin:${level === 1 ? '0 0 10px' : '16px 0 6px'};color:${BLK};">${inlineMd(esc(h[2]))}</h${level}>`)
      i++
      continue
    }

    // Lists
    const ul = line.match(/^[\s]*[-*]\s+(.*)$/)
    const ol = line.match(/^[\s]*(\d+)\.\s+(.*)$/)
    if (ul) {
      if (!inList || listType !== 'ul') { flushList(); out.push('<ul style="padding-left:18px;margin:6px 0;line-height:1.55;">'); inList = true; listType = 'ul' }
      out.push(`<li style="margin-bottom:4px;">${inlineMd(esc(ul[1]))}</li>`)
      i++
      continue
    }
    if (ol) {
      if (!inList || listType !== 'ol') { flushList(); out.push('<ol style="padding-left:22px;margin:6px 0;line-height:1.55;">'); inList = true; listType = 'ol' }
      out.push(`<li style="margin-bottom:4px;">${inlineMd(esc(ol[2]))}</li>`)
      i++
      continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushList()
      out.push(`<blockquote style="border-left:3px solid ${TEAL};padding:6px 12px;margin:8px 0;color:${MUTED};font-style:italic;">${inlineMd(esc(line.replace(/^>\s?/, '')))}</blockquote>`)
      i++
      continue
    }

    // Blank line
    if (!line.trim()) {
      flushList()
      i++
      continue
    }

    // Paragraph (group consecutive non-blank lines)
    flushList()
    const buf = [line]
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^#{1,6}\s/.test(lines[i + 1]) && !/^[\s]*[-*]\s/.test(lines[i + 1]) && !/^[\s]*\d+\.\s/.test(lines[i + 1]) && !/^```/.test(lines[i + 1]) && !/^>\s?/.test(lines[i + 1])) {
      i++
      buf.push(lines[i])
    }
    out.push(`<p style="margin:6px 0;line-height:1.6;">${inlineMd(esc(buf.join(' ')))}</p>`)
    i++
  }
  flushList()
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`)
  return out.join('\n')
}

function inlineMd(s) {
  return s
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-family:ui-monospace,monospace;font-size:0.9em;">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:#00C2CB;text-decoration:underline;">$1</a>')
}

// ─────────────────────────────────────────────────────────────
// Main HelpAssistant component
// ─────────────────────────────────────────────────────────────
export default function HelpAssistant() {
  const loc = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('ask') // 'ask' | 'browse'
  const [pulse, setPulse] = useState(false)

  // Ask tab state
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  // Browse tab state
  const [modules, setModules] = useState([])
  const [activeModule, setActiveModule] = useState('all')
  const [articleList, setArticleList] = useState([])
  const [modalArticle, setModalArticle] = useState(null) // full article object

  const agencyId = '00000000-0000-0000-0000-000000000099'

  // ── First-time pulse ring (localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const seen = localStorage.getItem('koto_help_seen')
      if (!seen) {
        setPulse(true)
        setTimeout(() => {
          setPulse(false)
          localStorage.setItem('koto_help_seen', '1')
        }, 8000)
      }
    } catch { /* ignore */ }
  }, [])

  // ── Global help mode flag — synced with panel open state
  useEffect(() => {
    if (typeof window !== 'undefined') window.__kotoHelpMode = open
  }, [open])

  // ── Listen for deep-link open requests from HelpTooltip
  useEffect(() => {
    const handler = async (e) => {
      const slug = e?.detail?.slug
      if (!slug) return
      setOpen(true)
      setTab('browse')
      try {
        const r = await fetch(`/api/help?action=get&slug=${slug}`).then((r) => r.json())
        if (r?.data) setModalArticle(r.data)
      } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('koto:open-help-article', handler)
      return () => window.removeEventListener('koto:open-help-article', handler)
    }
  }, [])

  // ── Auto-scroll chat
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  // ── Load modules once when panel first opens
  useEffect(() => {
    if (!open || modules.length > 0) return
    fetch('/api/help?action=modules')
      .then((r) => r.json())
      .then((r) => setModules(r?.data || []))
      .catch(() => {})
  }, [open, modules.length])

  // ── Load article list when active module changes
  useEffect(() => {
    if (!open || tab !== 'browse') return
    const p = activeModule === 'all' ? '' : `&module=${activeModule}`
    fetch(`/api/help?action=list${p}`)
      .then((r) => r.json())
      .then((r) => setArticleList(r?.data || []))
      .catch(() => {})
  }, [open, tab, activeModule])

  // ── Initial AI greeting
  useEffect(() => {
    if (!open || messages.length > 0) return
    setMessages([{
      role: 'assistant',
      content: "Hi! I'm here to help with anything in Koto. Ask me how to use any feature, or browse the help articles. What are you working on?",
    }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const contextHint = useMemo(() => getContextHint(loc.pathname), [loc.pathname])

  const sendQuestion = useCallback(async (text) => {
    if (!text || sending) return
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          question: text,
          context_page: loc.pathname,
          agency_id: agencyId,
        }),
      })
      const json = await res.json()
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: json?.data?.answer || '(no answer)',
        related: json?.data?.related_articles || [],
        question: text,
      }])
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `(Error: ${e?.message || 'failed'})`,
      }])
    } finally {
      setSending(false)
    }
  }, [sending, loc.pathname])

  const handleSend = () => {
    const t = input.trim()
    if (t) sendQuestion(t)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sendFeedback = async (msg, helpful) => {
    try {
      await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          question: msg.question,
          answer: msg.content,
          was_helpful: helpful,
          agency_id: agencyId,
        }),
      })
      // Locally mark the message
      setMessages((prev) => prev.map((m) => m === msg ? { ...m, feedback: helpful } : m))
    } catch { /* ignore */ }
  }

  const openArticleModal = async (slug) => {
    try {
      const r = await fetch(`/api/help?action=get&slug=${slug}`).then((r) => r.json())
      if (r?.data) {
        setTab('browse')
        setModalArticle(r.data)
      }
    } catch { /* ignore */ }
  }

  const closeModal = () => setModalArticle(null)

  // Helper: hide trigger on mobile (tab bar collision)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  if (isMobile) return null

  return (
    <>
      {/* ── Floating trigger button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Koto Help"
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 380,
            width: 52, height: 52, borderRadius: '50%',
            background: TEAL, color: '#fff', border: 'none',
            cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,194,203,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <HelpCircle size={22} />
          {pulse && (
            <span style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: `2px solid ${TEAL}`, animation: 'koto-help-pulse 1.6s ease-out infinite',
              pointerEvents: 'none',
            }} />
          )}
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 400,
            width: 380, maxHeight: 'min(620px, calc(100vh - 48px))',
            background: '#fff', borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: FB, color: BLK,
          }}
        >
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: TEAL + '20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: TEAL, flexShrink: 0,
            }}>
              <HelpCircle size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>Koto Help</div>
              <div style={{ fontSize: 11, color: MUTED }}>Ask anything about Koto</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 4, minHeight: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
            <TabBtn active={tab === 'ask'} onClick={() => setTab('ask')} label="Ask AI" icon={Sparkles} />
            <TabBtn active={tab === 'browse'} onClick={() => { setTab('browse'); setModalArticle(null) }} label="Browse Help" icon={BookOpen} />
          </div>

          {/* Context hint */}
          {contextHint && (
            <div style={{
              padding: '8px 14px', background: TEAL_SOFT, color: '#0e7490',
              fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: `1px solid ${TEAL}30`,
            }}>
              <Info size={11} /> {contextHint}
            </div>
          )}

          {/* Content */}
          {tab === 'ask' ? (
            <AskTab
              messages={messages}
              sending={sending}
              input={input}
              setInput={setInput}
              scrollRef={scrollRef}
              onSend={handleSend}
              onKey={handleKey}
              onChipClick={(q) => sendQuestion(q)}
              onFeedback={sendFeedback}
              onArticleClick={openArticleModal}
            />
          ) : modalArticle ? (
            <ArticleModalContent
              article={modalArticle}
              onClose={closeModal}
              onOpenFull={() => {
                navigate(`/help?article=${modalArticle.slug}`)
                setOpen(false)
              }}
            />
          ) : (
            <BrowseTab
              modules={modules}
              activeModule={activeModule}
              setActiveModule={setActiveModule}
              articles={articleList}
              onArticleClick={openArticleModal}
            />
          )}
        </div>
      )}

      <style>{`
        @keyframes koto-help-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.6); opacity: 0;   }
          100% { transform: scale(1.6); opacity: 0;   }
        }
        .koto-help-spin { animation: koto-help-spin 1s linear infinite; }
        @keyframes koto-help-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}

function TabBtn({ active, onClick, label, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 8px', background: 'none',
        border: 'none', borderBottom: active ? `2px solid ${TEAL}` : '2px solid transparent',
        fontFamily: FH, fontSize: 12, fontWeight: 700,
        color: active ? BLK : MUTED, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: 0,
      }}
    >
      <Icon size={12} /> {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Ask tab
// ─────────────────────────────────────────────────────────────
function AskTab({ messages, sending, input, setInput, scrollRef, onSend, onKey, onChipClick, onFeedback, onArticleClick }) {
  const showStarters = messages.length <= 1 && !sending
  return (
    <>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <MsgBubble key={i} msg={m} onFeedback={onFeedback} onArticleClick={onArticleClick} />
        ))}
        {sending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: TEAL + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL }}>
              <Brain size={12} />
            </div>
            <TypingDots />
          </div>
        )}

        {showStarters && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STARTER_CHIPS.map((c, i) => (
              <button
                key={i}
                onClick={() => onChipClick(c)}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                  background: TEAL_SOFT, border: `1px solid ${TEAL}30`,
                  color: '#0e7490', fontFamily: FB, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', minHeight: 0,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${BORDER}` }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: BG, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '6px 10px',
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Ask about any Koto feature…"
            disabled={sending}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              resize: 'none', fontFamily: FB, fontSize: 13, color: BLK,
              minHeight: 20, maxHeight: 100, lineHeight: '18px',
            }}
          />
          <button
            onClick={onSend}
            disabled={sending || !input.trim()}
            aria-label="Send"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: input.trim() && !sending ? TEAL : '#e5e7eb',
              color: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0, minHeight: 0,
            }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

function MsgBubble({ msg, onFeedback, onArticleClick }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '85%', background: BLK, color: '#fff',
          padding: '8px 12px', borderRadius: '12px 12px 4px 12px',
          fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: TEAL + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL, flexShrink: 0 }}>
        <Brain size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: TEAL_SOFT, border: `1px solid ${TEAL}30`,
          padding: '10px 12px', borderRadius: '4px 12px 12px 12px',
          fontSize: 13, lineHeight: 1.55, color: BLK,
        }}>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        </div>
        {msg.related && msg.related.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {msg.related.map((a, i) => (
              <button
                key={i}
                onClick={() => onArticleClick(a.slug)}
                style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: '#fff', border: `1px solid ${TEAL}60`,
                  color: TEAL, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, minHeight: 0,
                }}
              >
                📖 {a.title}
              </button>
            ))}
          </div>
        )}
        {msg.question && msg.feedback == null && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: MUTED }}>
            Helpful?
            <button
              onClick={() => onFeedback(msg, true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 2, minHeight: 0 }}
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => onFeedback(msg, false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 2, minHeight: 0 }}
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}
        {msg.feedback === true && (
          <div style={{ fontSize: 11, color: TEAL, marginTop: 4 }}>Thanks for the feedback!</div>
        )}
        {msg.feedback === false && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Thanks — I'll do better.</div>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: MUTED, animation: `koto-dot 1.2s ${i * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`
        @keyframes koto-dot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(0.9); }
          30%           { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Browse tab
// ─────────────────────────────────────────────────────────────
function BrowseTab({ modules, activeModule, setActiveModule, articles, onArticleClick }) {
  return (
    <>
      <div style={{
        padding: '8px 10px', borderBottom: `1px solid ${BORDER}`,
        display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0,
      }}>
        <ModPill active={activeModule === 'all'} label="All" icon="🧭" onClick={() => setActiveModule('all')} />
        {modules.map((m) => (
          <ModPill
            key={m.slug}
            active={activeModule === m.slug}
            label={m.label}
            icon={m.icon}
            onClick={() => setActiveModule(m.slug)}
          />
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {articles.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 12 }}>No articles in this module yet.</div>
        )}
        {articles.map((a) => (
          <button
            key={a.slug}
            onClick={() => onArticleClick(a.slug)}
            style={{
              width: '100%', textAlign: 'left', padding: 10, borderRadius: 8,
              background: '#fff', border: `1px solid ${BORDER}`, marginBottom: 6,
              cursor: 'pointer', minHeight: 0,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH }}>{a.title}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {a.summary}
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function ModPill({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 999,
        background: active ? BLK : '#fff', color: active ? '#fff' : MUTED,
        border: `1px solid ${active ? BLK : BORDER}`,
        fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        fontFamily: FH, minHeight: 0,
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span>{icon}</span> {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Article modal (inline inside the help panel)
// ─────────────────────────────────────────────────────────────
function ArticleModalContent({ article, onClose, onOpenFull }) {
  return (
    <>
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 11, padding: 0, minHeight: 0 }}
        >
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 11, color: MUTED, fontFamily: FH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {article.module}
        </div>
        <button
          onClick={onOpenFull}
          style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: 0, minHeight: 0 }}
        >
          Full help <ExternalLink size={10} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <h1 style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          {article.title}
        </h1>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>{article.summary}</div>
        <div style={{ fontSize: 13, color: BLK }} dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }} />
      </div>
    </>
  )
}
