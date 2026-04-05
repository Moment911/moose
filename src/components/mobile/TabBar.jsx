"use client"
import { Home, Users, Star, Ticket, BarChart2, Search, Settings, FileText, Grid3X3, MessageSquare, CheckSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const RED = '#ea2729'

const TABS = [
  { icon: Home,        label: 'Home',    path: '/' },
  { icon: Users,       label: 'Clients', path: '/clients' },
  { icon: Search,      label: 'Scout',   path: '/scout' },
  { icon: Star,        label: 'Reviews', path: '/reviews' },
  { icon: Grid3X3,     label: 'More',    path: null },
]

const MORE_ITEMS = [
  { icon: BarChart2,   label: 'SEO Hub',   path: '/seo' },
  { icon: Ticket,      label: 'KotoDesk',  path: '/desk' },
  { icon: CheckSquare, label: 'Tasks',     path: '/tasks' },
  { icon: FileText,    label: 'Proposals', path: '/proposals' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: Settings,    label: 'Settings',  path: '/agency-settings' },
]

export default function TabBar({ onMorePress, unreadCount = 0, showMore = false, onCloseMore }) {
  const location = useLocation()

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div style={{ position:'fixed', inset:0, zIndex:49, background:'rgba(0,0,0,.4)' }} onClick={onCloseMore}>
          <div style={{ position:'absolute', bottom:57, left:0, right:0, background:'#fff', borderRadius:'20px 20px 0 0', padding:'16px 12px 8px', boxShadow:'0 -8px 32px rgba(0,0,0,.15)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, borderRadius:2, background:'#e5e7eb', margin:'0 auto 16px' }}/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {MORE_ITEMS.map(item => {
                const I = item.icon
                const active = location.pathname.startsWith(item.path)
                return (
                  <Link key={item.path} to={item.path} onClick={onCloseMore}
                    style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'14px 8px', borderRadius:14, background: active ? RED+'10' : '#f9fafb', textDecoration:'none' }}>
                    <I size={22} color={active ? RED : '#374151'} strokeWidth={active?2.5:1.8}/>
                    <span style={{ fontSize:12, fontWeight:600, color: active ? RED : '#374151' }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="md:hidden" style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50, background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:'0.5px solid #D1D1D6', paddingBottom:'env(safe-area-inset-bottom, 0px)' }}>
        <div style={{ display:'flex', alignItems:'stretch', height:49 }}>
          {TABS.map(tab => {
            const isActive = tab.path && (tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path))
            const I = tab.icon
            const color = isActive ? RED : '#8E8E93'
            const style = { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, height:49, background:'transparent', border:'none', cursor:'pointer', textDecoration:'none', WebkitTapHighlightColor:'transparent', padding:0 }
            const inner = (
              <>
                <div style={{ position:'relative' }}>
                  <I size={24} strokeWidth={isActive?2.5:1.8} color={isActive&&tab.path===null&&showMore?RED:color}/>
                  {tab.label === 'Reviews' && unreadCount > 0 && (
                    <span style={{ position:'absolute', top:-5, right:-8, background:RED, color:'#fff', fontSize:10, fontWeight:700, borderRadius:8, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', border:'1.5px solid #fff' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span style={{ fontSize:10, fontWeight:isActive?600:500, color, lineHeight:1 }}>{tab.label}</span>
              </>
            )
            return tab.path
              ? <Link key={tab.path} to={tab.path} style={style}>{inner}</Link>
              : <button key="more" onClick={onMorePress} style={style}>{inner}</button>
          })}
        </div>
      </nav>
    </>
  )
}
