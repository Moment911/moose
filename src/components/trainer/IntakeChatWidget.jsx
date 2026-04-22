import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { T, BLK, R } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// IntakeChatWidget — conversational intake panel.
//
// Streams AI responses via NDJSON from /api/trainer/intake-chat.
// On each turn: text_delta events build the AI bubble in real time,
// fields events push extracted data to the parent via onFieldsUpdate.
// ─────────────────────────────────────────────────────────────────────────────

export default function IntakeChatWidget({ extracted, onFieldsUpdate, onAboutYouAppend, userName }) {
  const [messages, setMessages] = useState([]) // {role: 'user'|'assistant', content: string}
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const initRef = useRef(false)

  // Auto-scroll on new content.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Auto-grow textarea.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  // Stream a turn from the API.
  const streamTurn = useCallback(async (turnMessages) => {
    setStreaming(true)
    setStreamingText('')
    setError(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) {
        setError('Session expired. Please sign in again.')
        setStreaming(false)
        return
      }

      const res = await fetch('/api/trainer/intake-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: turnMessages, extracted }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Error (${res.status})`)
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError('No response stream')
        setStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let event
          try { event = JSON.parse(line) } catch { continue }

          if (event.type === 'text_delta' && typeof event.text === 'string') {
            fullText += event.text
            setStreamingText(fullText)
          }

          if (event.type === 'fields') {
            if (event.extracted && typeof event.extracted === 'object') {
              onFieldsUpdate(event.extracted)
            }
            if (event.about_you_append && typeof event.about_you_append === 'string') {
              onAboutYouAppend(event.about_you_append)
            }
          }

          if (event.type === 'error') {
            setError(event.error || 'Stream error')
          }
        }
      }

      // Commit the assistant message.
      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
      }
    } catch (e) {
      setError(e?.message || 'Network error')
    }

    setStreamingText('')
    setStreaming(false)
  }, [extracted, onFieldsUpdate, onAboutYouAppend])

  // Auto-fire first turn on mount to get the AI greeting.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    streamTurn([])
  }, [streamTurn])

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    streamTurn(newMessages)
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
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      overflow: 'hidden',
      height: '100%',
      minHeight: 500,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: BLK,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: T, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff',
        }}>
          K
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Koto Coach</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Building your profile</div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming && streamingText && (
          <MessageBubble role="assistant" content={streamingText} />
        )}
        {streaming && !streamingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Thinking...
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}
        {error && (
          <div style={{ padding: '8px 10px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
            {error}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          rows={1}
          disabled={streaming}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: 14,
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
            color: BLK,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          style={{
            width: 38, height: 38,
            borderRadius: 10,
            border: 'none',
            background: input.trim() && !streaming ? R : '#e5e7eb',
            color: input.trim() && !streaming ? '#fff' : '#9ca3af',
            cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? R : '#f3f4f6',
        color: isUser ? '#fff' : BLK,
        fontSize: 14,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
    </div>
  )
}
