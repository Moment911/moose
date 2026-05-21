"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Smartphone, Tablet, Monitor, Code2, Eye, Copy, Check,
  Maximize2, Minimize2, RotateCcw,
} from 'lucide-react'
import { FH, FB, BLK, DESIGN } from '../../lib/theme'

/**
 * HtmlComposer — split-pane visual HTML editor
 *
 * Left: code editor (textarea with syntax highlighting via monospace)
 * Right: live rendered preview in sandboxed iframe
 * Top: responsive toggle (mobile 375px / tablet 768px / desktop 1280px)
 *
 * Props:
 *   html          string — initial HTML body content
 *   onChange      (html: string) => void — called on every edit
 *   onSave        (html: string) => void — called when user clicks Save
 *   onClose       () => void — close the composer
 *   title         string — page title for display
 */
export default function HtmlComposer({ html: initialHtml, onChange, onSave, onClose, title }) {
  const [html, setHtml] = useState(initialHtml || '')
  const [viewMode, setViewMode] = useState('split') // 'split' | 'code' | 'preview'
  const [device, setDevice] = useState('desktop')   // 'mobile' | 'tablet' | 'desktop'
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const iframeRef = useRef(null)
  const textareaRef = useRef(null)

  // Device widths
  const DEVICE_WIDTHS = { mobile: 375, tablet: 768, desktop: '100%' }

  // Update preview when HTML changes
  useEffect(() => {
    updatePreview()
  }, [html, device])

  // Notify parent of changes
  useEffect(() => {
    onChange?.(html)
  }, [html])

  function updatePreview() {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return

    const width = DEVICE_WIDTHS[device]
    const viewportMeta = device !== 'desktop'
      ? `<meta name="viewport" content="width=${typeof width === 'number' ? width : 1280}">`
      : ''

    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${viewportMeta}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px; line-height: 1.6; color: #374151;
      padding: 24px; max-width: 100%;
    }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 16px; color: #111; }
    h2 { font-size: 22px; font-weight: 700; margin: 24px 0 12px; color: #111; }
    h3 { font-size: 18px; font-weight: 600; margin: 20px 0 8px; color: #111; }
    p { margin-bottom: 14px; }
    ul, ol { margin: 12px 0; padding-left: 24px; }
    li { margin-bottom: 6px; }
    a { color: #2563eb; text-decoration: underline; }
    strong { font-weight: 600; }
    section { margin-bottom: 32px; }
    details { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
    summary { font-weight: 600; cursor: pointer; }
    details p { margin-top: 8px; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    @media (max-width: 640px) {
      body { padding: 16px; font-size: 15px; }
      h1 { font-size: 24px; }
      h2 { font-size: 20px; }
    }
  </style>
</head>
<body>${html}</body>
</html>`)
    doc.close()
  }

  function handleCopy() {
    navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setHtml(initialHtml || '')
  }

  const containerStyle = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 10000, background: '#fff', display: 'flex', flexDirection: 'column' }
    : { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  const innerStyle = fullscreen
    ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }
    : { width: '95vw', maxWidth: 1400, height: '90vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return (
    <div style={containerStyle} onClick={fullscreen ? undefined : onClose}>
      <div style={innerStyle} onClick={e => e.stopPropagation()}>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid #ececef', background: '#fafafa',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK }}>
              {title || 'HTML Composer'}
            </span>

            {/* View mode toggles */}
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
              <ToolbarBtn active={viewMode === 'code'} onClick={() => setViewMode('code')}>
                <Code2 size={14} /> Code
              </ToolbarBtn>
              <ToolbarBtn active={viewMode === 'split'} onClick={() => setViewMode('split')}>
                Split
              </ToolbarBtn>
              <ToolbarBtn active={viewMode === 'preview'} onClick={() => setViewMode('preview')}>
                <Eye size={14} /> Preview
              </ToolbarBtn>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Responsive device toggles */}
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
              <ToolbarBtn active={device === 'mobile'} onClick={() => setDevice('mobile')}>
                <Smartphone size={14} /> 375
              </ToolbarBtn>
              <ToolbarBtn active={device === 'tablet'} onClick={() => setDevice('tablet')}>
                <Tablet size={14} /> 768
              </ToolbarBtn>
              <ToolbarBtn active={device === 'desktop'} onClick={() => setDevice('desktop')}>
                <Monitor size={14} /> Full
              </ToolbarBtn>
            </div>

            <button onClick={handleCopy} style={iconBtn}>
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            </button>
            <button onClick={handleReset} style={iconBtn} title="Reset to original">
              <RotateCcw size={14} />
            </button>
            <button onClick={() => setFullscreen(!fullscreen)} style={iconBtn}>
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {onSave && (
              <button onClick={() => onSave(html)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: '#111', color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: FH, cursor: 'pointer',
              }}>
                Save
              </button>
            )}

            <button onClick={onClose} style={iconBtn}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Editor / Preview Panes ───────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Code editor */}
          {(viewMode === 'code' || viewMode === 'split') && (
            <div style={{
              flex: viewMode === 'split' ? '1 1 50%' : '1 1 100%',
              display: 'flex', flexDirection: 'column',
              borderRight: viewMode === 'split' ? '1px solid #ececef' : 'none',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, borderBottom: '1px solid #f3f4f6' }}>
                HTML BODY (no header/footer)
              </div>
              <textarea
                ref={textareaRef}
                value={html}
                onChange={e => setHtml(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1, padding: 14, border: 'none', outline: 'none', resize: 'none',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
                  fontSize: 13, lineHeight: 1.6, color: '#1e293b', background: '#fafafa',
                  tabSize: 2,
                }}
              />
            </div>
          )}

          {/* Live preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div style={{
              flex: viewMode === 'split' ? '1 1 50%' : '1 1 100%',
              display: 'flex', flexDirection: 'column', background: '#f9fafb',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>LIVE PREVIEW {device !== 'desktop' ? `(${DEVICE_WIDTHS[device]}px)` : ''}</span>
                <span style={{ fontSize: 10, color: '#d1d5db' }}>
                  {html.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <div style={{
                flex: 1, display: 'flex', justifyContent: 'center', padding: 16,
                overflow: 'auto', background: device !== 'desktop' ? '#e5e7eb' : '#fff',
              }}>
                <iframe
                  ref={iframeRef}
                  sandbox="allow-same-origin"
                  style={{
                    width: typeof DEVICE_WIDTHS[device] === 'number' ? DEVICE_WIDTHS[device] : '100%',
                    height: '100%', border: device !== 'desktop' ? '1px solid #d1d5db' : 'none',
                    borderRadius: device !== 'desktop' ? 12 : 0,
                    background: '#fff',
                    boxShadow: device !== 'desktop' ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Toolbar button ──────────────────────────────────────────────────────────

function ToolbarBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 6, border: 'none',
        background: active ? '#fff' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        color: active ? '#111' : '#6b7280',
        fontSize: 12, fontWeight: 600, fontFamily: FH, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const iconBtn = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: '1px solid #ececef', background: '#fff', cursor: 'pointer',
  color: '#6b7280',
}
