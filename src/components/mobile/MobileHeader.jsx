"use client"
import { Menu, ChevronLeft, Zap } from 'lucide-react'

const R = '#ea2729'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"

export default function MobileHeader({ title, onMenuPress, onBack, backLabel, rightAction, showLogo = false }) {
  return (
    <header className="md:hidden" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
      background: 'rgba(10,10,10,0.97)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,.06)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, padding: '0 12px' }}>
        {/* Left */}
        <div style={{ width: 80, display: 'flex', alignItems: 'center' }}>
          {onBack ? (
            <button onClick={onBack} style={{
              display: 'flex', alignItems: 'center', gap: 2, color: R,
              background: 'none', border: 'none', fontSize: 17, cursor: 'pointer',
              padding: '8px 0', WebkitTapHighlightColor: 'transparent', minHeight: 44,
            }}>
              <ChevronLeft size={26} strokeWidth={2.5} color={R} />
              {backLabel && <span>{backLabel}</span>}
            </button>
          ) : onMenuPress ? (
            <button onClick={onMenuPress} style={{
              background: 'none', border: 'none', padding: 8, cursor: 'pointer',
              marginLeft: -8, WebkitTapHighlightColor: 'transparent', minHeight: 44,
            }}>
              <Menu size={22} strokeWidth={1.8} color="rgba(255,255,255,.7)" />
            </button>
          ) : <div style={{ width: 32 }} />}
        </div>
        {/* Center */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          {showLogo ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: R, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={12} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>Koto</span>
            </div>
          ) : (
            <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: -0.2, fontFamily: FH }}>{title}</span>
          )}
        </div>
        {/* Right */}
        <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {rightAction || <div style={{ width: 32 }} />}
        </div>
      </div>
    </header>
  )
}
