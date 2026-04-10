"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, Send, RefreshCw, Loader2, Sparkles } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const RED  = '#E6007E'
const TEAL = '#00C2CB'
const BLK  = '#111111'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"
const KOTO_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

const STARTER_CHIPS = [
  "What should I focus on today?",
  "How is our voice call performance this week?",
  "Which discovery engagements need attention?",
  "Draft a follow-up email for a hot prospect",
  "Give me a quick agency health check",
]

export default function AgentPage() {
  const isMobile = useMobile()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const openedRef = useRef(false)
  const textareaRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, sending])

  const sendMessage = useCallback(async (userText, isKickoff = false) => {
    if (!userText || sending) return
    setSending(true)

    // For normal messages, append user bubble immediately
    const newMessages = isKickoff
      ? [...messages]
      : [...messages, { role: 'user', content: userText }]
    if (!isKickoff) {
      setMessages(newMessages)
      setInput('')
    }

    try {
      const history = newMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch(`/api/cmo-agent?action=chat&agency_id=${KOTO_AGENCY_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          agency_id: KOTO_AGENCY_ID,
          message: userText,
          conversation_history: history,
        }),
      })
      const json = await res.json().catch(() => ({}))
      const aiMsg = json?.data?.message || "Sorry, I couldn't reach the AI backend."
      const actions = Array.isArray(json?.data?.suggested_actions) ? json.data.suggested_actions : []
      setMessages((prev) => [...prev, { role: 'assistant', content: aiMsg, actions }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `(Error: ${e?.message || 'request failed'})`, actions: [] }])
    } finally {
      setSending(false)
    }
  }, [messages, sending])

  // Kickoff contextual greeting on first load
  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    sendMessage('__init__', true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    sendMessage(text, false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const resetConversation = () => {
    setMessages([])
    openedRef.current = false
    setTimeout(() => {
      openedRef.current = true
      sendMessage('__init__', true)
    }, 50)
  }

  const showStarters = messages.filter((m) => m.role === 'user').length === 0 && !sending

  return (
    <div className="page-shell" style={{ display: 'flex', minHeight: '100vh', background: '#f7f8fa', fontFamily: FB, color: BLK }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '14px 16px' : '18px 28px',
          borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar />
            <div>
              <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>AI CMO</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {sending ? 'Thinking…' : 'Strategic advisor with real-time agency data'}
              </div>
            </div>
          </div>
          <button
            onClick={resetConversation}
            disabled={sending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#fff',
              fontFamily: FB, fontSize: 13, fontWeight: 600, color: '#374151',
              cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1,
            }}
          >
            <RefreshCw size={14} />
            {!isMobile && 'New chat'}
          </button>
        </div>

        {/* Chat scroll area */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto',
            padding: isMobile ? '16px 14px' : '28px 40px',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}
        >
          {messages.length === 0 && !sending && (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#9ca3af', fontFamily: FB, fontSize: 14 }}>
              Loading greeting…
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              role={m.role}
              content={m.content}
              actions={m.actions || []}
              isMobile={isMobile}
              onActionClick={(text) => sendMessage(text, false)}
            />
          ))}

          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
              <Avatar small />
              <Loader2 size={14} className="spin" />
              <span>Thinking…</span>
            </div>
          )}
        </div>

        {/* Starter chips */}
        {showStarters && (
          <div style={{
            padding: isMobile ? '10px 14px 0' : '10px 40px 0',
            display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0,
          }}>
            {STARTER_CHIPS.map((chip, i) => (
              <button
                key={i}
                onClick={() => sendMessage(chip, false)}
                disabled={sending}
                style={{
                  padding: '8px 14px', borderRadius: 999,
                  border: `1px solid ${TEAL}40`, background: '#f0fbfc',
                  fontFamily: FB, fontSize: 13, fontWeight: 600, color: TEAL,
                  cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Sparkles size={12} />
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{
          padding: isMobile ? '12px 14px 16px' : '16px 40px 24px',
          borderTop: '1px solid #e5e7eb', background: '#fff', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: '#f7f8fa', border: '1px solid #e5e7eb',
            borderRadius: 14, padding: '10px 12px',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Ask your AI CMO anything…"
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                resize: 'none', fontFamily: FB, fontSize: 14, color: BLK,
                minHeight: 24, maxHeight: 160, lineHeight: '20px',
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 10, border: 'none',
                background: input.trim() && !sending ? TEAL : '#e5e7eb',
                color: '#fff', cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' }}>
            {isMobile ? 'Tap send to submit' : 'Enter to send · Shift+Enter for newline'}
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function Avatar({ small }) {
  const size = small ? 24 : 36
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${TEAL}, ${TEAL}cc)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,194,203,0.3)',
    }}>
      <Brain size={small ? 13 : 18} />
    </div>
  )
}

function MessageBubble({ role, content, actions, isMobile, onActionClick }) {
  const isUser = role === 'user'
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: isMobile ? '85%' : '70%',
          background: BLK, color: '#fff',
          padding: '12px 16px', borderRadius: '16px 16px 4px 16px',
          fontFamily: FB, fontSize: 14, lineHeight: 1.5,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {content}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <Avatar />
      <div style={{ flex: 1, maxWidth: isMobile ? 'calc(100% - 46px)' : '75%' }}>
        <div style={{
          background: '#f0fbfc', border: `1px solid ${TEAL}30`,
          color: BLK, padding: '12px 16px',
          borderRadius: '4px 16px 16px 16px',
          fontFamily: FB, fontSize: 14, lineHeight: 1.55,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {content}
        </div>
        {actions && actions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={() => onActionClick && onActionClick(a)}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  border: `1px solid ${TEAL}60`, background: '#fff',
                  fontFamily: FB, fontSize: 12, fontWeight: 600, color: TEAL,
                  cursor: 'pointer',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
