// ─────────────────────────────────────────────────────────────
// KotoIQ Conversational Bot — floating overlay chat widget
// Click launcher → slide-in panel → chat with assistant →
// auto-fill / execute KotoIQ actions.
// ─────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Minimize2, Send, Mic, Brain, Sparkles, ChevronRight, Loader, History, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, label: 'Write me a blog post about...' },
  { icon: Sparkles, label: 'I want to rank for...' },
  { icon: Sparkles, label: 'Audit my homepage' },
  { icon: Sparkles, label: 'Find me backlink opportunities' },
  { icon: Sparkles, label: 'Build my topical map' },
  { icon: Sparkles, label: 'What should I work on this week?' },
]

const PANEL_WIDTH = 420

export default function ConversationalBot({ clientId, agencyId, currentTab, onSwitchTab }) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [messages, setMessages] = useState([]) // {role, content, action?, action_executed?, action_result?, error?}
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [executing, setExecuting] = useState(null) // index of message being executed
  const [hasNewSuggestion, setHasNewSuggestion] = useState(false)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, thinking])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input])

  // Load conversation list when toggling history
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_bot_conversations', client_id: clientId, agency_id: agencyId, limit: 30 }),
      })
      const j = await res.json()
      setConversations(j.conversations || [])
    } catch {}
  }, [clientId, agencyId])

  useEffect(() => {
    if (showHistory) loadConversations()
  }, [showHistory, loadConversations])

  const loadConversation = async (id) => {
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_bot_conversation', conversation_id: id }),
      })
      const j = await res.json()
      const msgs = (j.messages || []).map(m => ({
        role: m.role,
        content: m.content,
        action: m.action_data || null,
        action_executed: m.action_executed,
        action_result: m.action_result,
      }))
      setMessages(msgs)
      setConversationId(id)
      setShowHistory(false)
    } catch {}
  }

  const startNew = () => {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
  }

  const send = async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || thinking) return
    const userMsg = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setThinking(true)
    setHasNewSuggestion(false)
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_conversational_bot',
          client_id: clientId,
          agency_id: agencyId,
          conversation_id: conversationId,
          message: trimmed,
          conversation_history: history,
          current_tab: currentTab,
        }),
      })
      const j = await res.json()
      if (j.error) {
        setMessages(m => [...m, { role: 'assistant', content: 'Hmm, I hit an error: ' + j.error, error: true }])
      } else {
        setConversationId(j.conversation_id || conversationId)
        setMessages(m => [...m, { role: 'assistant', content: j.message || '...', action: j.action || null }])
        if (j.action) setHasNewSuggestion(true)
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Please try again.', error: true }])
    } finally {
      setThinking(false)
    }
  }

  // Run the proposed action: switch tab + (optionally) execute the API
  const runAction = async (msgIdx, executeNow) => {
    const msg = messages[msgIdx]
    if (!msg?.action) return
    const { intent, tab_to_open, form_fields, should_execute } = msg.action
    // Always switch tab + prefill
    if (onSwitchTab) onSwitchTab(tab_to_open, form_fields || {})
    if (!executeNow || !should_execute) {
      // Just open and prefill — confirm in chat
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { mode: 'prefill' } } : x))
      return
    }
    setExecuting(msgIdx)
    try {
      const apiAction = INTENT_TO_API[intent]
      if (!apiAction) {
        setMessages(m => [...m, { role: 'assistant', content: `Switched to ${tab_to_open}. Form is pre-filled — review and run when ready.` }])
        setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { mode: 'prefill' } } : x))
        return
      }
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: apiAction, client_id: clientId, agency_id: agencyId, ...form_fields }),
      })
      const j = await res.json()
      const ok = res.ok && !j.error
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { ok, summary: j.error || summarizeResult(j) } } : x))
      setMessages(m => [...m, {
        role: 'assistant',
        content: ok
          ? `Done. ${summarizeResult(j)} I switched you to the ${tab_to_open} tab so you can see the full result.`
          : `That run failed: ${j.error || 'unknown error'}. Want me to try something else?`,
      }])
    } catch (e) {
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { ok: false, summary: e?.message || 'error' } } : x))
    } finally {
      setExecuting(null)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimized(false) }}
        title="KotoIQ Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
          background: T, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0,194,203,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, transition: 'transform .15s', animation: hasNewSuggestion ? 'kotoiqBotPulse 1.6s infinite' : 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <MessageCircle size={26} />
        <style>{`@keyframes kotoiqBotPulse { 0%,100% { box-shadow: 0 6px 20px rgba(0,194,203,0.45); } 50% { box-shadow: 0 6px 30px rgba(0,194,203,0.85); } }`}</style>
      </button>
    )
  }

  const panelStyle = isMobile
    ? { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9999 }
    : { position: 'fixed', top: 0, right: 0, width: PANEL_WIDTH, height: '100vh', zIndex: 9999 }

  return (
    <div style={{ ...panelStyle, background: '#fff', borderLeft: `1px solid #e5e7eb`, boxShadow: '-8px 0 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, background: BLK, color: '#fff' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH }}>KotoIQ Assistant</div>
          <div style={{ fontSize: 11, opacity: 0.6, fontFamily: FB }}>{thinking ? 'Thinking…' : 'Ready to help'}</div>
        </div>
        <button onClick={startNew} title="New conversation"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <Plus size={18} />
        </button>
        <button onClick={() => setShowHistory(s => !s)} title="History"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <History size={18} />
        </button>
        <button onClick={() => { setOpen(false); setMinimized(true) }} title="Minimize"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <Minimize2 size={18} />
        </button>
        <button onClick={() => setOpen(false)} title="Close"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <X size={18} />
        </button>
      </div>

      {showHistory ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 8px', fontFamily: FH }}>Past Conversations</div>
          {conversations.length === 0 && (
            <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center', fontFamily: FB }}>No conversations yet.</div>
          )}
          {conversations.map(c => (
            <button key={c.id} onClick={() => loadConversation(c.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: FB }}
              onMouseEnter={e => e.currentTarget.style.background = GRY}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize: 13, color: BLK, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Untitled'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ''}</div>
            </button>
          ))}
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: GRY }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: T, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Brain size={32} color="#fff" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BLK, fontFamily: FH }}>Hi! Tell me what you want to do.</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontFamily: FB }}>I can write briefs, audit pages, build topical maps, find backlinks — just describe it.</div>
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTED_PROMPTS.map(p => (
                  <button key={p.label} onClick={() => send(p.label)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: BLK, fontFamily: FB, display: 'flex', alignItems: 'center', gap: 10, transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T; e.currentTarget.style.background = '#f0fdfe' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}>
                    <p.icon size={14} color={T} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <ChevronRight size={14} color="#9ca3af" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} idx={i} onRun={runAction} executing={executing === i} />
          ))}

          {thinking && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Brain size={15} color="#fff" />
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '10px 14px' }}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <Dot delay={0} /><Dot delay={0.15} /><Dot delay={0.3} />
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      {!showHistory && (
        <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Describe what you want to do…"
              rows={1}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: FB, color: BLK, resize: 'none', outline: 'none', maxHeight: 140, lineHeight: 1.4 }}
              onFocus={e => e.currentTarget.style.borderColor = T}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
            <button title="Voice (coming soon)" disabled
              style={{ background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: 10, padding: 10, cursor: 'not-allowed' }}>
              <Mic size={18} />
            </button>
            <button onClick={() => send()} disabled={thinking || !input.trim()}
              style={{ background: input.trim() && !thinking ? T : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, padding: 10, cursor: input.trim() && !thinking ? 'pointer' : 'not-allowed' }}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes kotoiqBotFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Message bubble subcomponent ───────────────────────────────────────────
function MessageBubble({ msg, idx, onRun, executing }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexDirection: isUser ? 'row-reverse' : 'row', animation: 'kotoiqBotFadeIn .25s ease' }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Brain size={15} color="#fff" />
        </div>
      )}
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          background: isUser ? T : (msg.error ? '#fee2e2' : '#fff'),
          color: isUser ? '#fff' : (msg.error ? '#991b1b' : BLK),
          border: isUser ? 'none' : `1px solid ${msg.error ? '#fecaca' : '#e5e7eb'}`,
          borderRadius: 14,
          padding: '10px 14px',
          fontSize: 13.5,
          lineHeight: 1.5,
          fontFamily: FB,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>
        {msg.action && !isUser && (
          <ActionCard action={msg.action} idx={idx} onRun={onRun} executing={executing} executed={msg.action_executed} result={msg.action_result} />
        )}
      </div>
    </div>
  )
}

// ── Action proposal card ──────────────────────────────────────────────────
function ActionCard({ action, idx, onRun, executing, executed, result }) {
  const fields = action.form_fields || {}
  const fieldKeys = Object.keys(fields)
  return (
    <div style={{ marginTop: 8, border: `1px solid ${T}`, borderRadius: 12, background: '#f0fdfe', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color={T} />
        <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {prettyIntent(action.intent)}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280', background: '#fff', padding: '2px 6px', borderRadius: 4 }}>
          → {action.tab_to_open}
        </div>
      </div>
      {fieldKeys.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 8, marginBottom: 10 }}>
          {fieldKeys.map(k => (
            <div key={k} style={{ display: 'flex', fontSize: 12, padding: '3px 0', fontFamily: FB }}>
              <span style={{ color: '#6b7280', minWidth: 90, fontWeight: 600 }}>{k}:</span>
              <span style={{ color: BLK, flex: 1, wordBreak: 'break-word' }}>{String(fields[k])}</span>
            </div>
          ))}
        </div>
      )}
      {executed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: result?.ok === false ? '#991b1b' : GRN, fontFamily: FB }}>
          {result?.ok === false ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{result?.ok === false ? 'Failed' : (result?.mode === 'prefill' ? 'Form pre-filled — opened the tab' : 'Run complete')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {action.should_execute ? (
            <button onClick={() => onRun(idx, true)} disabled={executing}
              style={{ flex: 1, padding: '8px 12px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: executing ? 'wait' : 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {executing ? <><Loader size={14} className="kotoiq-bot-spin" /> Running…</> : <>Run This</>}
            </button>
          ) : null}
          <button onClick={() => onRun(idx, false)} disabled={executing}
            style={{ flex: action.should_execute ? 'none' : 1, padding: '8px 12px', background: '#fff', color: BLK, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: executing ? 'wait' : 'pointer', fontFamily: FH }}>
            {action.should_execute ? 'Modify First' : 'Open Form'}
          </button>
        </div>
      )}
      {action.next_question && !executed && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic', fontFamily: FB }}>
          {action.next_question}
        </div>
      )}
      <style>{`.kotoiq-bot-spin { animation: kotoiqBotSpin 1s linear infinite; } @keyframes kotoiqBotSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Dot({ delay }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: '#9ca3af',
      animation: `kotoiqBotBounce 1.2s ${delay}s infinite`,
      display: 'inline-block',
    }}>
      <style>{`@keyframes kotoiqBotBounce { 0%,80%,100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }`}</style>
    </span>
  )
}

function prettyIntent(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function summarizeResult(j) {
  if (!j || typeof j !== 'object') return ''
  if (j.brief?.title) return `Brief generated: ${j.brief.title}.`
  if (j.audit?.score != null) return `Score: ${j.audit.score}.`
  if (j.aeo_score != null) return `AEO score: ${j.aeo_score}.`
  if (Array.isArray(j.opportunities)) return `${j.opportunities.length} opportunities found.`
  if (Array.isArray(j.urls)) return `${j.urls.length} URLs found.`
  if (j.message) return j.message
  return 'See the tab for full results.'
}

// Map intent → existing API action name
const INTENT_TO_API = {
  generate_brief: 'generate_brief',
  run_on_page_audit: 'analyze_on_page',
  score_aeo: 'aeo_deep_analysis',
  aeo_multi_engine: 'aeo_deep_analysis',
  build_topical_map: 'generate_topical_map',
  check_plagiarism: 'check_plagiarism',
  analyze_competitor: 'extract_competitor_topical_map',
  crawl_sitemap: 'crawl_sitemaps',
  audit_eeat: 'audit_eeat',
  find_backlinks: 'scan_backlink_opportunities',
  analyze_reviews: 'analyze_reviews',
  run_pipeline: 'run_autonomous_pipeline',
  analyze_backlinks: 'analyze_backlinks',
  audit_schema: 'audit_schema',
  scan_internal_links: 'scan_internal_links',
  analyze_query_paths: 'analyze_query_paths',
  analyze_semantic_network: 'analyze_semantic_network',
  audit_technical_deep: 'audit_technical_deep',
  build_content_calendar: 'build_content_calendar',
  content_refresh_plan: 'build_content_inventory',
  gsc_audit: 'gsc_audit',
  bing_audit: 'bing_audit',
  brand_serp_scan: 'scan_brand_serp',
  generate_schema: 'generate_schema_for_url',
  hyperlocal_content: 'generate_hyperlocal',
  // intents below open a tab without auto-running (need extra UI choices)
  geo_tag_image: null,
  generate_strategic_plan: null,
  run_rank_grid: null,
  knowledge_graph_export: null,
  watermark_remove: null,
  upwork_checklist: null,
  passage_optimize: null,
  context_align: null,
  topical_authority: null,
  content_decay: null,
  ask_kotoiq: null,
  competitor_watch: null,
  bulk_operation: null,
}
