"use client"
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2 } from 'lucide-react'
import {
  NAVY, GOLD, CREAM, WHITE,
  TEXT_BODY, TEXT_MUTED,
  CHAT_BG, CHAT_USER_BUBBLE, CHAT_AI_BUBBLE,
  CHAT_INPUT_BG, CHAT_INPUT_BORDER,
  FONT_BODY,
} from '../../lib/fourr/fourrTheme'

// ─────────────────────────────────────────────────────────────────────────────
// FourrChatWidget — conversational intake chat for the 4R Method.
//
// Props:
//   token      — Supabase access_token for API calls
//   onComplete — callback when intake is complete (receives patient_id)
//   onProgress — callback on each turn with { extracted_count, total_required }
// ─────────────────────────────────────────────────────────────────────────────

export default function FourrChatWidget({ token, onComplete, onProgress }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-send greeting on mount
  useEffect(() => {
    if (initialized || !token) return
    setInitialized(true)
    sendTurn(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialized])

  async function sendTurn(userMessage) {
    setSending(true)

    if (userMessage) {
      setMessages((prev) => [...prev, {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      }])
    }

    try {
      const res = await fetch('/api/fourr/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data?.error || 'Something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
          isError: true,
        }])
        return
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.assistant_message,
        timestamp: new Date().toISOString(),
        fieldsExtracted: data.fields_extracted_this_turn,
      }])

      onProgress?.({
        extracted_count: data.extracted_count,
        total_required: data.total_required,
      })

      if (data.is_complete) {
        setIsComplete(true)
        onComplete?.(data.patient_id)
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Network error. Please check your connection and try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      }])
    } finally {
      setSending(false)
      // Focus the input after the AI responds
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleSend(e) {
    e?.preventDefault?.()
    const msg = input.trim()
    if (!msg || sending || isComplete) return
    setInput('')
    sendTurn(msg)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: CHAT_BG,
      borderRadius: 12,
      overflow: 'hidden',
      fontFamily: FONT_BODY,
    }}>
      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {sending && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: CHAT_AI_BUBBLE,
            borderRadius: '12px 12px 12px 4px',
            alignSelf: 'flex-start',
            maxWidth: '85%',
          }}>
            <TypingIndicator />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!isComplete ? (
        <form onSubmit={handleSend} style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderTop: `1px solid ${CHAT_INPUT_BORDER}`,
          background: CHAT_INPUT_BG,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sending ? 'Waiting for response...' : 'Type your answer...'}
            disabled={sending}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: NAVY,
              border: `1px solid ${CHAT_INPUT_BORDER}`,
              borderRadius: 8,
              color: CREAM,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
            }}
            autoFocus
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              padding: '10px 14px',
              background: sending || !input.trim() ? TEXT_MUTED : GOLD,
              color: sending || !input.trim() ? WHITE : NAVY,
              border: 'none',
              borderRadius: 8,
              cursor: sending || !input.trim() ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {sending ? <Loader2 size={14} style={{ animation: 'fourr-spin 1s linear infinite' }} /> : <Send size={14} />}
          </button>
          <style>{`@keyframes fourr-spin{to{transform:rotate(360deg)}}`}</style>
        </form>
      ) : (
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${CHAT_INPUT_BORDER}`,
          background: CHAT_INPUT_BG,
          textAlign: 'center',
          color: TEXT_BODY,
          fontSize: 13,
        }}>
          Assessment complete. Your protocol is being prepared.
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isError = message.isError

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        padding: '12px 16px',
        background: isError ? '#3b1111' : isUser ? CHAT_USER_BUBBLE : CHAT_AI_BUBBLE,
        color: isError ? '#fca5a5' : CREAM,
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        maxWidth: '85%',
        fontSize: 14,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        border: isError ? '1px solid #7f1d1d' : 'none',
      }}>
        {message.content}
      </div>

      {message.fieldsExtracted && message.fieldsExtracted.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 4,
          marginTop: 4,
          flexWrap: 'wrap',
        }}>
          {message.fieldsExtracted.map((f) => (
            <span key={f} style={{
              fontSize: 10,
              padding: '2px 6px',
              background: GOLD + '20',
              color: GOLD,
              borderRadius: 4,
              fontWeight: 600,
            }}>
              {f.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: GOLD,
          opacity: 0.5,
          animation: `fourr-typing 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes fourr-typing{0%,60%,100%{opacity:.3;transform:scale(1)}30%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  )
}
