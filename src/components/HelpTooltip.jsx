"use client"
import { useState, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

const TEAL = '#00C2CB'

/**
 * Wraps any element with a small (?) help icon.
 *
 * When the global help mode is ON (set by HelpAssistant when the
 * floating help panel is opened), every HelpTooltip's (?) icon is
 * visible. Otherwise the icon only appears on hover of the wrapped
 * element.
 *
 * Usage:
 *   <HelpTooltip content="Short description" articleSlug="discovery-research">
 *     <button>Run AI Research</button>
 *   </HelpTooltip>
 */
export default function HelpTooltip({
  content,
  articleSlug,
  position = 'top',
  children,
}) {
  const [helpMode, setHelpMode] = useState(false)
  const [hover, setHover] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  // Listen for global help mode toggles from HelpAssistant
  useEffect(() => {
    const check = () => setHelpMode(!!(typeof window !== 'undefined' && window.__kotoHelpMode))
    check()
    const id = setInterval(check, 400) // lightweight poll — no extra dep
    return () => clearInterval(id)
  }, [])

  const showIcon = helpMode || hover
  const showTooltip = tooltipVisible

  const openArticle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!articleSlug) return
    // Fire a global event HelpAssistant listens to so the article
    // opens in the floating panel without leaving the current page.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('koto:open-help-article', { detail: { slug: articleSlug } }))
    }
  }

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setTooltipVisible(false) }}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {children}
      {showIcon && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTooltipVisible((v) => !v) }}
          onMouseEnter={() => setTooltipVisible(true)}
          aria-label="Help tip"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: '50%',
            background: 'transparent', border: 'none',
            color: TEAL, cursor: 'pointer', padding: 0, flexShrink: 0,
            minHeight: 16,
          }}
        >
          <HelpCircle size={14} />
        </button>
      )}
      {showTooltip && (
        <div
          role="tooltip"
          style={tooltipStyle(position)}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#fff', marginBottom: articleSlug ? 6 : 0 }}>
            {content}
          </div>
          {articleSlug && (
            <button
              onClick={openArticle}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: '#fff', padding: '4px 10px', borderRadius: 6,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                minHeight: 0,
              }}
            >
              Learn more →
            </button>
          )}
        </div>
      )}
    </span>
  )
}

function tooltipStyle(position) {
  const base = {
    position: 'absolute',
    background: '#111', color: '#fff',
    padding: '10px 12px', borderRadius: 8,
    maxWidth: 280, width: 260,
    fontFamily: "'Raleway','Helvetica Neue',sans-serif",
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    zIndex: 450,
  }
  switch (position) {
    case 'bottom':
      return { ...base, top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }
    case 'left':
      return { ...base, right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
    case 'right':
      return { ...base, left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
    case 'top':
    default:
      return { ...base, bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }
  }
}
