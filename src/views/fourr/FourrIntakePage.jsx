"use client"
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import FourrChatWidget from '../../components/fourr/FourrChatWidget'
import FourrIntakeProgress from '../../components/fourr/FourrIntakeProgress'
import {
  NAVY, GOLD, CREAM, WHITE,
  TEXT_BODY, TEXT_MUTED,
  CARD_BG, CARD_BORDER,
  FONT_HEADING, FONT_BODY,
} from '../../lib/fourr/fourrTheme'

// ─────────────────────────────────────────────────────────────────────────────
// /4r/intake — anonymous-first conversational chat intake for the 4R Method.
//
// No login required.  Session identified by a localStorage UUID.
// Full-screen chat interface with 4R branding.
// ─────────────────────────────────────────────────────────────────────────────

function getOrCreateSessionId() {
  const KEY = 'fourr_session_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

export default function FourrIntakePage() {
  const navigate = useNavigate()
  const [sessionId] = useState(() => getOrCreateSessionId())
  const [progress, setProgress] = useState({ extracted_count: 0, total_required: 21 })
  const [patientId, setPatientId] = useState(null)
  const [intakeComplete, setIntakeComplete] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  const handleProgress = useCallback((p) => {
    setProgress(p)
  }, [])

  const handleComplete = useCallback((pid) => {
    setPatientId(pid)
    setIntakeComplete(true)
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/fourr/self-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenerateError(body?.error || `Protocol generation failed (${res.status})`)
        setGenerating(false)
        return
      }
      navigate('/4r/my-protocol')
    } catch (err) {
      setGenerateError(err?.message || 'Network error during protocol generation.')
      setGenerating(false)
    }
  }

  if (generating) {
    return <GeneratingScreen />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: NAVY,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_BODY,
    }}>
      {/* Header */}
      <header style={{
        padding: '12px 20px',
        borderBottom: `1px solid ${CARD_BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: GOLD,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
          }}>
            4R Method Assessment
          </div>
          <div style={{
            fontSize: 13,
            color: TEXT_BODY,
            marginTop: 2,
          }}>
            Tell us about your condition — one question at a time
          </div>
        </div>
        <div style={{ flexShrink: 0, minWidth: 200 }}>
          <FourrIntakeProgress
            extractedCount={progress.extracted_count}
            totalRequired={progress.total_required}
          />
        </div>
      </header>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <FourrChatWidget
          sessionId={sessionId}
          onComplete={handleComplete}
          onProgress={handleProgress}
        />
      </div>

      {/* Generate CTA */}
      {intakeComplete && !generating && (
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${CARD_BORDER}`,
          background: CARD_BG,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          {generateError && (
            <div style={{
              padding: '10px 12px',
              background: '#3b1111',
              border: '1px solid #7f1d1d',
              borderRadius: 8,
              color: '#fca5a5',
              fontSize: 13,
              width: '100%',
              maxWidth: 500,
              textAlign: 'center',
            }}>
              {generateError}
            </div>
          )}
          <button
            onClick={handleGenerate}
            style={{
              padding: '14px 28px',
              background: GOLD,
              color: NAVY,
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={16} /> Generate My Protocol
          </button>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>
            Your doctors will review the results and develop your personalized plan.
          </div>
        </div>
      )}
    </div>
  )
}

function GeneratingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: NAVY,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_BODY,
    }}>
      <div style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: '40px 36px',
        maxWidth: 480,
        textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48,
          margin: '0 auto 20px',
          border: `4px solid ${CARD_BORDER}`,
          borderTopColor: GOLD,
          borderRadius: '50%',
          animation: 'fourr-gen-spin 0.9s linear infinite',
        }} />
        <style>{`@keyframes fourr-gen-spin{to{transform:rotate(360deg)}}`}</style>

        <h1 style={{
          margin: '0 0 10px',
          fontSize: 22,
          fontWeight: 400,
          color: CREAM,
          fontFamily: FONT_HEADING,
          fontStyle: 'italic',
        }}>
          Building Your Protocol
        </h1>

        <p style={{
          margin: '0 0 20px',
          fontSize: 14,
          color: TEXT_BODY,
          lineHeight: 1.55,
        }}>
          Your clinical assessment, phase recommendation, modality plan, and protocol
          schedule are being generated. This takes about 30-45 seconds.
        </p>

        <ul style={{
          textAlign: 'left',
          margin: '0 auto',
          fontSize: 12,
          color: TEXT_BODY,
          lineHeight: 1.9,
          maxWidth: 340,
          listStyle: 'none',
          padding: 0,
        }}>
          {[
            'Clinical assessment + severity classification',
            '4R phase recommendation with rationale',
            'Personalized modality selection',
            'Week-by-week protocol schedule',
          ].map((item) => (
            <li key={item} style={{
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ color: GOLD, fontSize: 10 }}>&#9670;</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
