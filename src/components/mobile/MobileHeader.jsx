"use client";
import { Menu, ChevronLeft } from 'lucide-react'
import LucyLogo from '../LucyLogo'

export default function MobileHeader({ title, onMenuPress, onBack, backLabel, rightAction, showLogo = false }) {
  return (
    <header className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, background: 'rgba(24,24,27,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.1)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44, padding: '0 12px' }}>
        {/* Left */}
        <div style={{ width: 80, display: 'flex', alignItems: 'center' }}>
          {onBack ? (
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#ea2729', background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', padding: '8px 0', WebkitTapHighlightColor: 'transparent' }}>
              <ChevronLeft size={26} strokeWidth={2.5} color="#ea2729" />
              {backLabel && <span>{backLabel}</span>}
            </button>
          ) : onMenuPress ? (
            <button onClick={onMenuPress} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', marginLeft: -8, WebkitTapHighlightColor: 'transparent' }}>
              <Menu size={22} strokeWidth={1.8} color="#d4d4d8" />
            </button>
          ) : <div style={{ width: 32 }} />}
        </div>
        {/* Center */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          {showLogo
            ? <LucyLogo size="sm" />
            : <span style={{ fontSize: 17, fontWeight: 600, color: '#f4f4f5', letterSpacing: -0.2 }}>{title}</span>}
        </div>
        {/* Right */}
        <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {rightAction || <div style={{ width: 32 }} />}
        </div>
      </div>
    </header>
  )
}
