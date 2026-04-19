"use client"
import { useEffect, useRef, useState } from 'react'
import { T, AMB, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.4 page-wide drop zone (D-09) — v1 stub per RESEARCH §11.
 *
 * Wraps WINDOW-level drag events. The entire viewport is the drop target.
 *
 * v1 behavior:
 *   - Koto internal URL drop → onKotoUrl(url) (live ingest)
 *   - File or external URL drop → onDeferredSource(payload) creates a
 *     kotoiq_client_profile.sources row with source_type='deferred_v2'
 *     and shows an amber-bordered "v2" toast. NO file contents are
 *     uploaded in v1 — only filename, file size, extension.
 *
 * Props:
 *   - onKotoUrl(url)
 *   - onDeferredSource({ file_name?, file_size?, ext?, external_url? })
 */
const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''
const KOTO_URL_RE = /\/(onboard|onboarding-dashboard|clients)\/[A-Za-z0-9_-]+/

export default function DropZone({ onKotoUrl, onDeferredSource }) {
  const [dragActive, setDragActive] = useState(false)
  const [toast, setToast] = useState(null)
  const enterCount = useRef(0)
  const toastTimer = useRef(null)

  useEffect(() => {
    const showToast = (msg, kind) => {
      setToast({ msg, kind })
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 5000)
    }

    const onEnter = (e) => {
      e.preventDefault()
      enterCount.current++
      setDragActive(true)
    }
    const onLeave = (e) => {
      e.preventDefault()
      enterCount.current--
      if (enterCount.current <= 0) {
        enterCount.current = 0
        setDragActive(false)
      }
    }
    const onOver = (e) => { e.preventDefault() }
    const onDrop = (e) => {
      e.preventDefault()
      enterCount.current = 0
      setDragActive(false)

      const files = Array.from(e.dataTransfer?.files || [])
      const uriList = e.dataTransfer?.getData('text/uri-list') || ''
      const uris = uriList.split('\n').map((u) => u.trim()).filter(Boolean)

      // URL path takes precedence over file path
      for (const u of uris) {
        if (u.startsWith(APP_URL) && KOTO_URL_RE.test(u)) {
          onKotoUrl?.(u)
          showToast('Pulling now.', 'info')
          return
        }
        showToast('Got it. External URL parsing lands in v2 — noted as a source for now.', 'warn')
        onDeferredSource?.({ external_url: u })
        return
      }

      // File path — metadata only (T-07-23 — no file contents uploaded in v1)
      for (const f of files) {
        const ext = (f.name.split('.').pop() || '').toLowerCase()
        showToast(
          `Got it. I can't parse ${ext.toUpperCase()} yet — that lands in v2. For now, I'll note it as a source.`,
          'warn'
        )
        onDeferredSource?.({ file_name: f.name, file_size: f.size, ext })
      }
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [onKotoUrl, onDeferredSource])

  return (
    <>
      {dragActive && (
        <div
          role="region"
          aria-label="Drop zone active"
          style={{
            position: 'fixed',
            inset: 12,
            zIndex: 60,
            pointerEvents: 'none',
            border: `2px dashed ${T}`,
            borderRadius: 16,
            background: 'transparent',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '16px 24px',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(4px)',
              fontFamily: FH,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Drop it anywhere — I&apos;ll figure out what it is.
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 70,
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fff',
            borderLeft: `4px solid ${toast.kind === 'warn' ? AMB : T}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            fontFamily: FB,
            fontSize: 14,
            maxWidth: 480,
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  )
}
