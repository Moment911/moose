"use client"
import { ArrowLeft } from 'lucide-react'
import { T } from './tokens'

// Cal-AI-style page header: 44×44 light-grey circle back button at top-left,
// optional thin progress bar on the same row, then a giant headline + optional
// subtitle. Content below begins ~24-32px down.
//
// Usage:
//   <PageHeader title="You have great potential to crush your goal" onBack={...} progress={0.65} />
//   <PageHeader title="Profile" subtitle="Edit your goals & tracking" />  // no progress = main-app screen

export default function PageHeader({
  title,
  subtitle,
  onBack,
  progress,           // 0–1 to show the progress bar; omit to hide
  rightSlot,          // optional element pinned top-right (e.g. a bell icon)
}) {
  const showProgress = typeof progress === 'number' && progress >= 0 && progress <= 1

  return (
    <header style={{ paddingTop: T.s7, paddingBottom: T.s6 }}>
      {/* Top row: back + progress + right slot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: T.s4, marginBottom: T.s7 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              flexShrink: 0,
              width: 44, height: 44, borderRadius: T.rPill,
              background: T.card, border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={20} color={T.ink} strokeWidth={2.25} />
          </button>
        ) : <div style={{ width: 44, flexShrink: 0 }} />}

        {showProgress && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={progress}
            style={{
              flex: 1, height: 3, borderRadius: T.rPill,
              background: T.divider, overflow: 'hidden',
            }}
          >
            <div style={{
              width: `${Math.round(progress * 100)}%`, height: '100%',
              background: T.ink, borderRadius: T.rPill,
              transition: 'width .3s ease',
            }} />
          </div>
        )}
        {!showProgress && <div style={{ flex: 1 }} />}

        {rightSlot ? <div style={{ flexShrink: 0 }}>{rightSlot}</div> : null}
      </div>

      {/* Title + optional subtitle */}
      <h1 style={{
        margin: 0,
        fontFamily: T.font,
        fontSize: T.size.display,
        lineHeight: T.lh.display,
        letterSpacing: T.track.display,
        fontWeight: T.weight.display,
        color: T.ink,
      }}>
        {title}
      </h1>

      {subtitle ? (
        <p style={{
          margin: `${T.s3}px 0 0`,
          fontFamily: T.font,
          fontSize: T.size.subtitle,
          lineHeight: T.lh.subtitle,
          fontWeight: T.weight.body,
          color: T.ink3,
        }}>
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
