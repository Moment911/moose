"use client"
import { useEffect, useRef, useState } from 'react'
import { T, BLK, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.1 streaming narration (D-07).
 *
 * Renders Claude's narration as new lines fade in, with the in-progress
 * sentence italicized + a blinking teal cursor at the end. Reduced-motion
 * disables fades and the cursor blink (sentences appear instantly).
 *
 * Props:
 *   - lines: string[] (accumulated narration lines)
 *   - streaming: boolean (true while the SSE reader is active)
 */
export default function StreamingNarration({ lines = [], streaming = false }) {
  const containerRef = useRef(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e) => setReducedMotion(e.matches)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else if (mq.addListener) mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else if (mq.removeListener) mq.removeListener(onChange)
    }
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  return (
    <section
      ref={containerRef}
      aria-live="polite"
      aria-atomic="false"
      aria-label="Ingest narration"
      style={{
        maxWidth: 720,
        margin: '24px auto',
        padding: '0 40px',
        minHeight: 120,
        fontFamily: FB,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.55,
        color: BLK,
      }}
    >
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1
        const italic = streaming && isLast
        return (
          <div
            key={i}
            style={{
              padding: '4px 0',
              fontStyle: italic ? 'italic' : 'normal',
              opacity: 1,
              animation: reducedMotion ? undefined : 'kotoiqBotFadeIn 180ms ease-out',
            }}
          >
            {line}
            {italic && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 18,
                  background: T,
                  marginLeft: 4,
                  verticalAlign: 'middle',
                  animation: reducedMotion
                    ? 'none'
                    : 'kotoCursorBlink 1.2s ease-in-out infinite',
                }}
              />
            )}
          </div>
        )
      })}
    </section>
  )
}
