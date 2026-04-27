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

// Canonical pill sets — fallback when Haiku doesn't produce suggested_replies
const CANONICAL_PILLS = {
  sex: ['Male', 'Female', 'Other'],
  primary_goal: ['Gain muscle', 'Get stronger', 'Throw harder', 'Hit harder', 'Run faster', 'Lose weight', 'Stay healthy', 'Get recruited'],
  sports: ['Baseball', 'Football', 'Basketball', 'Soccer', 'Track', 'Swimming', 'Multiple sports', 'None'],
  other_sports: ['Baseball', 'Football', 'Basketball', 'Soccer', 'Track', 'Swimming', 'Wrestling', 'None'],
  training_experience_years: ['Less than 1 year', '1-2 years', '3-5 years', '5+ years'],
  training_days_per_week: ['2', '3', '4', '5', '6'],
  equipment_access: ['Full gym', 'Home gym', 'Bands only', 'No equipment'],
  dietary_preference: ['No preference', 'Vegetarian', 'Vegan', 'Keto', 'Paleo'],
  occupation_activity: ['Desk job', 'Light activity', 'On my feet all day', 'Physical labor'],
  medical_flags: ['None', 'Yes — let me explain'],
  injuries: ['None', 'Yes — let me explain'],
  allergies: ['None', 'Yes — let me explain'],
  sleep_hours_avg: ['5-6', '7', '8', '9+'],
  stress_level: ['1-3 (low)', '4-6 (moderate)', '7-8 (high)', '9-10 (very high)'],
  meals_per_day: ['3', '4', '5', '6'],
  throwing_hand: ['Right', 'Left'],
  batting_hand: ['Right', 'Left', 'Switch'],
  position_primary: ['RHP', 'LHP', 'C', 'SS', '2B', '3B', '1B', 'OF'],
  preferred_divisions: ['D1', 'D2', 'D3', 'JUCO', 'Wherever I fit'],
  grad_year: ['2026', '2027', '2028', '2029'],
  practices_per_week: ['2-3', '4-5', '6+'],
  bullpen_sessions_per_week: ['1', '2', '3+'],
  games_per_week: ['2-3', '4-5', '6+'],
  avg_pitch_count: ['40-60', '60-80', '80-100', '100+'],
  pitch_arsenal: ['FB only', 'FB + CB', 'FB + SL', 'FB + CH', '3+ pitches'],
  long_toss_routine: ['Yes', 'No', 'Sometimes'],
  arm_soreness: ['None', 'Sometimes after games', 'Frequent', 'Currently sore'],
  offseason_training: ['Lift + throw', 'Just throw', 'Nothing structured'],
  other_sports: ['Baseball only', 'Yes — let me list them'],
}

export default function IntakeChatWidget({ extracted, onFieldsUpdate, onAboutYouAppend, onMessagesChange, initialMessages, userName, mode = 'onboarding' }) {
  const [messages, setMessages] = useState(initialMessages || []) // {role: 'user'|'assistant', content: string}
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)
  const [suggestedReplies, setSuggestedReplies] = useState([])
  const [selectedPills, setSelectedPills] = useState([])
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
        body: JSON.stringify({ messages: turnMessages, extracted, mode }),
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
            // Use AI-provided pills, or fall back to canonical set for the field
            const pills = Array.isArray(event.suggested_replies) && event.suggested_replies.length > 0
              ? event.suggested_replies
              : CANONICAL_PILLS[event.asking_field] || []
            setSuggestedReplies(pills)
          }

          if (event.type === 'error') {
            setError(event.error || 'Stream error')
          }
        }
      }

      // Commit the assistant message and persist.
      if (fullText) {
        setMessages((prev) => {
          const next = [...prev, { role: 'assistant', content: fullText }]
          onMessagesChange?.(next)
          return next
        })
      }
    } catch (e) {
      setError(e?.message || 'Network error')
    }

    setStreamingText('')
    setStreaming(false)
  }, [extracted, onFieldsUpdate, onAboutYouAppend])

  // Auto-fire first turn on mount to get the AI greeting — skip if we have saved messages.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (messages.length > 0) return // Already have history — don't re-greet
    streamTurn([])
  }, [streamTurn])

  function handleSend(overrideText) {
    const text = (overrideText || input).trim()
    if (!text || streaming) return
    setInput('')
    setSuggestedReplies([])
    setSelectedPills([])

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    onMessagesChange?.(newMessages)
    streamTurn(newMessages)
  }

  function togglePill(reply) {
    setSelectedPills((prev) =>
      prev.includes(reply) ? prev.filter((p) => p !== reply) : [...prev, reply]
    )
  }

  function sendSelectedPills() {
    if (selectedPills.length === 0) return
    handleSend(selectedPills.join(', '))
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

      {/* Suggested reply pills — multi-select with send */}
      {suggestedReplies.length > 0 && !streaming && (
        <div style={{
          padding: '8px 12px 6px',
          borderTop: '1px solid #f3f4f6',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestedReplies.map((reply, i) => {
              const selected = selectedPills.includes(reply)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    // If only 1 option makes sense (yes/no, none), send immediately
                    if (suggestedReplies.length <= 3 && !selectedPills.length) {
                      handleSend(reply)
                    } else {
                      togglePill(reply)
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: selected ? R + '12' : '#fff',
                    border: `1.5px solid ${selected ? R : '#e5e7eb'}`,
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: selected ? 600 : 500,
                    color: selected ? R : BLK,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all .12s',
                  }}
                >
                  {selected ? '✓ ' : ''}{reply}
                </button>
              )
            })}
          </div>
          {selectedPills.length > 0 && (
            <button
              type="button"
              onClick={sendSelectedPills}
              style={{
                marginTop: 8,
                padding: '10px 20px',
                background: R,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              Send ({selectedPills.length} selected)
            </button>
          )}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: '10px 12px',
        borderTop: suggestedReplies.length > 0 ? 'none' : '1px solid #f3f4f6',
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
