import { Home, CheckSquare, Search, MessageSquare, Grid3X3 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Search, label: 'Scout', path: '/scout' },
  { icon: MessageSquare, label: 'Inbox', path: '/messages' },
  { icon: Grid3X3, label: 'More', path: null },
]

export default function TabBar({ onMorePress, unreadCount = 0 }) {
  const location = useLocation()

  return (
    <nav className="md:hidden" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '0.5px solid #D1D1D6', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', height: 49 }}>
        {TABS.map(tab => {
          const isActive = tab.path && (tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path))
          const I = tab.icon
          const color = isActive ? '#E8551A' : '#8E8E93'

          const inner = (
            <>
              <div style={{ position: 'relative' }}>
                <I size={24} strokeWidth={isActive ? 2.5 : 1.8} color={color} />
                {tab.label === 'Inbox' && unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -8, background: '#E8551A', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '1.5px solid #fff' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500, color, lineHeight: 1 }}>{tab.label}</span>
            </>
          )

          const style = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, height: 49, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent', padding: 0 }

          return tab.path
            ? <Link key={tab.path} to={tab.path} style={style}>{inner}</Link>
            : <button key="more" onClick={onMorePress} style={style}>{inner}</button>
        })}
      </div>
    </nav>
  )
}
