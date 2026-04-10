// ─────────────────────────────────────────────────────────────
// useLiveTranscription
//
// Thin React wrapper around the browser Web Speech API
// (SpeechRecognition / webkitSpeechRecognition). Designed for the
// Discovery live session feature:
//
// - Continuous recognition that auto-restarts if the browser stops
//   the stream (Chrome times out every ~60s on its own).
// - Fires an onFinalResult callback as soon as the browser flags a
//   segment as final, so the parent can immediately run extraction
//   on that sentence — no polling.
// - Swallows the noisy "no-speech" and "aborted" errors that fire
//   during normal use; surfaces anything else via the error state.
//
// Browser support: Chrome + Edge (stable). Safari has limited
// support. Firefox does not implement it. The `supported` flag
// lets callers gate the UI.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react'

export type TranscriptSegment = {
  id: string
  text: string
  at: number
}

type OnFinalResult = (sentence: string, fullTranscript: string) => void

export function useLiveTranscription(onFinalResult?: OnFinalResult) {
  const [isListening, setIsListening] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [fullTranscript, setFullTranscript] = useState('')
  const [lastSegment, setLastSegment] = useState<TranscriptSegment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)

  // Keep the latest callback in a ref so the recognition instance
  // (created once per start) always calls the freshest version even
  // if the parent re-renders with new closures.
  const onFinalResultRef = useRef<OnFinalResult | undefined>(onFinalResult)
  useEffect(() => {
    onFinalResultRef.current = onFinalResult
  }, [onFinalResult])

  const recognitionRef = useRef<any>(null)
  const shouldListenRef = useRef(false)
  const fullTranscriptRef = useRef('')

  // Detect browser support once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition not supported in this browser')
      return
    }

    // Stop any previous instance first
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event: any) => {
      // Web Speech groups results into finalized + interim segments.
      // We only emit the callback when a segment is marked final.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = (result[0]?.transcript || '').trim()
        if (!text) continue

        if (result.isFinal && text.length > 5) {
          const segment: TranscriptSegment = {
            id: `seg-${Date.now()}-${i}`,
            text,
            at: Date.now(),
          }

          // Append to rolling transcript synchronously via the ref so
          // concurrent onresult batches compose without clobbering each
          // other (React setState in a loop can drop updates).
          fullTranscriptRef.current =
            (fullTranscriptRef.current ? fullTranscriptRef.current + ' ' : '') + text

          setSegments((prev) => [...prev, segment])
          setFullTranscript(fullTranscriptRef.current)
          setLastSegment(segment)

          // Fire the callback immediately with the new sentence
          // + the full cumulative transcript so the parent has both
          // the just-spoken line and full context for extraction.
          try {
            onFinalResultRef.current?.(text, fullTranscriptRef.current)
          } catch {
            // Never let a parent callback error stop the stream.
          }
        }
      }
    }

    recognition.onerror = (event: any) => {
      // These are normal mid-session signals, not real failures.
      const benign = new Set(['no-speech', 'aborted', 'audio-capture'])
      if (benign.has(event.error)) return
      setError(event.error || 'Speech recognition error')
    }

    recognition.onend = () => {
      // Chrome stops the stream after ~60s of silence or on its own
      // schedule. If the caller still wants to listen, restart it.
      if (shouldListenRef.current) {
        try {
          recognition.start()
          return
        } catch {
          // If start() throws (e.g. the instance is in a bad state),
          // fall through and report the session as stopped.
        }
      }
      setIsListening(false)
    }

    shouldListenRef.current = true
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (e: any) {
      setError(e?.message || 'Failed to start recognition')
      shouldListenRef.current = false
    }
  }, [])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
    }
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setSegments([])
    setFullTranscript('')
    setLastSegment(null)
    fullTranscriptRef.current = ''
  }, [])

  // Clean up if the component unmounts while listening
  useEffect(() => {
    return () => {
      shouldListenRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch { /* ignore */ }
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    isListening,
    segments,
    fullTranscript,
    lastSegment,
    supported,
    error,
    startListening,
    stopListening,
    clearTranscript,
  }
}
