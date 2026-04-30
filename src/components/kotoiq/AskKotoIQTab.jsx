"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Brain, Send, Loader2, Plus, MessageSquare, Trash2, Sparkles,
  FileText, AlertCircle, ChevronRight, User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const QUICK_PROMPTS = [
  { label: 'What should I work on?', text: 'What are the top 3 things I should work on this week for this client?' },
  { label: 'Monthly report', text: 'Generate a monthly performance report summarizing progress, wins, and areas that need attention.' },
  { label: 'Why did rankings change?', text: 'Why did rankings change recently? Correlate snapshots with any content or technical issues.' },
  { label: 'Generate a brief', text: 'Recommend the best keyword to build a new content brief for, and explain why.' },
  { label: 'Quick wins', text: 'What are the quickest wins available right now? Focus on striking-distance keywords and low-effort fixes.' },
]

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

// ── Lightweight markdown renderer (no deps) ────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let listBuf = []

  const flushList = () => {
    if (listBuf.length) {
      blocks.push({ type: 'ul', items: listBuf })
      listBuf = []
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (/^[-*]\s+/.test(trimmed)) {
      listBuf.push(trimmed.replace(/^[-*]\s+/, ''))
    } else if (/^#{1,3}\s+/.test(trimmed)) {
      flushList()
      const level = trimmed.match(/^(#{1,3})/)[1].length
      blocks.push({ type: 'h', level, text: trimmed.replace(/^#{1,3}\s+/, '') })
    } else if (trimmed === '') {
      flushList()
      blocks.push({ type: 'br' })
    } else {
      flushList()
      blocks.push({ type: 'p', text: trimmed })
    }
  })
  flushList()

  const renderInline = (txt) => {
    // **bold**, *italic*, `code`
    const parts = []
    let remaining = txt
    let key = 0
    // Simple single-pass replacement for bold
    const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/
    while (remaining) {
      const m = remaining.match(regex)
      if (!m) { parts.push(remaining); break }
      if (m.index > 0) parts.push(remaining.slice(0, m.index))
      if (m[2]) parts.push(<strong key={`b-${key++}`} style={{ fontWeight: 700 }}>{m[2]}</strong>)
      else if (m[3]) parts.push(<code key={`c-${key++}`} style={{ background: '#f1f1f6', padding: '1px 5px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>{m[3]}</code>)
      else if (m[4]) parts.push(<em key={`i-${key++}`} style={{ fontStyle: 'italic' }}>{m[4]}</em>)
      remaining = remaining.slice(m.index + m[0].length)
    }
    return parts
  }

  return blocks.map((b, i) => {
    if (b.type === 'h') {
      const sizes = { 1: 20, 2: 17, 3: 15 }
      return <div key={i} style={{ fontSize: sizes[b.level], fontWeight: 800, color: BLK, margin: '14px 0 6px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{renderInline(b.text)}</div>
    }
    if (b.type === 'ul') {
      return (
        <ul key={i} style={{ margin: '4px 0 10px', paddingLeft: 20, color: '#1f1f22', lineHeight: 1.7, fontSize: 14 }}>
          {b.items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{renderInline(it)}</li>)}
        </ul>
      )
    }
    if (b.type === 'br') return <div key={i} style={{ height: 6 }} />
    return <div key={i} style={{ color: '#1f1f22', lineHeight: 1.7, fontSize: 14, marginBottom: 8 }}>{renderInline(b.text)}</div>
  })
}

export default function AskKotoIQTab({ clientId, agencyId }) {
  const [conversations, setConversations] = useState([])
  const [convId, setConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [convLoading, setConvLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const api = useCallback(async (action, extra = {}) => {
    const res = await fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId, ...extra }),
    })
    return res.json()
  }, [clientId, agencyId])

  // Load conversation list
  const loadConversations = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await api('list_chat_conversations')
      setConversations(res.conversations || [])
    } catch {
      toast.error('Could not load conversations')
    }
    setLoading(false)
  }, [clientId, api])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  const loadConversation = useCallback(async (id) => {
    setConvLoading(true)
    setConvId(id)
    try {
      const res = await api('get_chat_conversation', { conversation_id: id })
      setMessages(res.messages || [])
    } catch {
      toast.error('Could not load conversation')
    }
    setConvLoading(false)
  }, [api])

  const newConversation = useCallback(() => {
    setConvId(null)
    setMessages([])
    setInput('')
    textareaRef.current?.focus()
  }, [])

  const deleteConversation = useCallback(async (id, e) => {
    e?.stopPropagation?.()
    if (!confirm('Delete this conversation?')) return
    try {
      await api('delete_chat_conversation', { conversation_id: id })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (convId === id) {
        setConvId(null)
        setMessages([])
      }
      toast.success('Conversation deleted')
    } catch {
      toast.error('Delete failed')
    }
  }, [api, convId])

  const send = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return

    const userMsg = { role: 'user', content: text, created_at: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const history = newMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const res = await api('ask_kotoiq', {
        message: text,
        conversation_id: convId || undefined,
        conversation_history: history.slice(0, -1), // exclude the just-sent message (server gets it via `message`)
      })

      if (res.error) {
        toast.error(res.error)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I ran into an error: ${res.error}`,
          created_at: new Date().toISOString(),
        }])
      } else {
        const assistantMsg = {
          role: 'assistant',
          content: res.message || '(no response)',
          data_used: res.data_used || [],
          suggested_actions: res.suggested_actions || [],
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])

        if (res.conversation_id && res.conversation_id !== convId) {
          setConvId(res.conversation_id)
          // refresh sidebar
          loadConversations()
        } else {
          loadConversations()
        }
      }
    } catch (err) {
      toast.error('Request failed')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Request failed: ${err.message}`,
        created_at: new Date().toISOString(),
      }])
    }
    setSending(false)
  }, [input, sending, messages, api, convId, loadConversations])

  const handleSuggestedAction = useCallback(async (action) => {
    toast.success(`Triggering ${action.label}`)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action.action_name,
          client_id: clientId,
          agency_id: agencyId,
          ...(action.params || {}),
        }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else {
        const summary = typeof data === 'object' ? JSON.stringify(data).slice(0, 300) : String(data).slice(0, 300)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `**Ran ${action.label}**\n\nResult: ${summary}...`,
          created_at: new Date().toISOString(),
        }])
      }
    } catch (e) {
      toast.error('Action failed')
    }
  }, [clientId, agencyId])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }, [send])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', gap: 0, background: '#fff', borderRadius: 14, border: '1px solid #ececef', overflow: 'hidden' }}>

      {/* ── Conversation list sidebar ────────────────────────────── */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #ececef', background: GRY, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 14, borderBottom: '1px solid #ececef' }}>
          <button onClick={newConversation}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 10, border: 'none', background: "#0a0a0a", color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
            }}>
            <Plus size={14} /> New conversation
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && <div style={{ padding: 20, color: '#8e8e93', fontSize: 12, textAlign: 'center' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /></div>}
          {!loading && conversations.length === 0 && (
            <div style={{ padding: '20px 16px', color: '#8e8e93', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
              No conversations yet. Ask your first question below.
            </div>
          )}
          {conversations.map(c => (
            <div key={c.id} onClick={() => loadConversation(c.id)}
              style={{
                padding: '10px 14px', cursor: 'pointer', borderLeft: convId === c.id ? `3px solid ${T}` : '3px solid transparent',
                background: convId === c.id ? '#fff' : 'transparent',
                display: 'flex', alignItems: 'flex-start', gap: 8, transition: 'background .1s',
              }}
              onMouseEnter={e => { if (convId !== c.id) e.currentTarget.style.background = '#f1f1f6' }}
              onMouseLeave={e => { if (convId !== c.id) e.currentTarget.style.background = 'transparent' }}
            >
              <MessageSquare size={13} color="#8e8e93" style={{ marginTop: 3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title || 'Untitled'}
                </div>
                <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{formatTime(c.updated_at || c.created_at)}</div>
              </div>
              <button onClick={(e) => deleteConversation(c.id, e)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#8e8e93', display: 'flex' }}
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main chat area ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #ececef', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={18} color="#0a0a0a" />
          </div>
          <div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK }}>Ask KotoIQ</div>
            <div style={{ fontSize: 11, color: '#6b6b70' }}>Conversational intelligence across all client data</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {convLoading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#8e8e93' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {!convLoading && messages.length === 0 && (
            <div style={{ maxWidth: 620, margin: '60px auto 0', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: T + '15', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={32} color="#0a0a0a" />
              </div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color: BLK, marginBottom: 6 }}>
                What do you want to know?
              </div>
              <div style={{ fontSize: 14, color: '#6b6b70', marginBottom: 24, lineHeight: 1.6 }}>
                Ask anything about this client&rsquo;s SEO, rankings, content, or what to do next.<br />
                KotoIQ pulls from live data — rankings, audits, keywords, recommendations, and calendars.
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {QUICK_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => send(p.text)}
                    style={{
                      padding: '8px 14px', borderRadius: 20, border: `1.5px solid #ececef`, background: '#fff',
                      color: T, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <Sparkles size={11} /> {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!convLoading && messages.length > 0 && (
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  onActionClick={handleSuggestedAction}
                />
              ))}

              {sending && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Brain size={15} color="#0a0a0a" />
                  </div>
                  <div style={{ padding: '12px 16px', background: GRY, borderRadius: 12, color: '#6b6b70', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    KotoIQ is thinking&hellip;
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ borderTop: '1px solid #ececef', padding: '12px 20px', background: '#fff' }}>
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
                <button key={i} onClick={() => send(p.text)} disabled={sending}
                  style={{
                    padding: '5px 11px', borderRadius: 16, border: '1px solid #ececef', background: '#fff',
                    color: '#4b5563', fontSize: 11, fontWeight: 600, cursor: sending ? 'wait' : 'pointer',
                    opacity: sending ? 0.5 : 1, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, border: '1px solid #ececef', borderRadius: 12, padding: '8px 10px 8px 14px', background: '#fff' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this client's SEO, rankings, or next steps... (Shift+Enter for newline)"
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', resize: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                fontSize: 14, color: BLK, background: 'transparent', minHeight: 24, maxHeight: 160, padding: '4px 0',
              }}
            />
            <button onClick={() => send()} disabled={sending || !input.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: sending || !input.trim() ? '#ececef' : T,
                color: '#fff', cursor: sending || !input.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}>
              {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({ message, onActionClick }) {
  const isUser = message.role === 'user'
  const dataUsed = message.data_used || []
  const actions = message.suggested_actions || []

  if (isUser) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, flexDirection: 'row-reverse' }}>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={15} color="#0a0a0a" />
        </div>
        <div style={{ padding: '10px 14px', background: "#0a0a0a", color: '#fff', borderRadius: 12, fontSize: 14, lineHeight: 1.6, maxWidth: '75%', whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
      <div style={{ width: 30, height: 30, borderRadius: 10, background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Brain size={15} color="#0a0a0a" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '12px 16px', background: GRY, borderRadius: 12, maxWidth: '92%' }}>
          <div>{renderMarkdown(message.content)}</div>

          {dataUsed.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #ececef', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 4 }}>
                <FileText size={10} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                Used:
              </span>
              {dataUsed.map((d, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: '#fff', color: '#4b5563', fontWeight: 600,
                  border: '1px solid #ececef',
                }}>
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {actions.map((a, i) => (
              <button key={i} onClick={() => onActionClick(a)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${T}`, background: '#fff',
                  color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 5, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                }}>
                {a.label} <ChevronRight size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
