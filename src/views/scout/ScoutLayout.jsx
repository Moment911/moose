"use client"
import { Link, useLocation } from 'react-router-dom'
import { Target, Search, ListFilter, Bookmark, BarChart3, Settings, ArrowLeft } from 'lucide-react'

const NAV = [
  { path: '/scout', icon: Search, label: 'Search' },
  { path: '/scout/leads', icon: ListFilter, label: 'My Leads' },
  { path: '/scout/saved', icon: Bookmark, label: 'Saved' },
  { path: '/scout/reports', icon: BarChart3, label: 'Reports' },
  { path: '/scout/settings', icon: Settings, label: 'Settings' },
]

export default function ScoutLayout({ children }) {
  const location = useLocation()
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Dark nav rail */}
      <aside className="hidden md:flex w-[52px] flex-col items-center py-3 flex-shrink-0" style={{ background: '#18181b' }}>
        <Link to="/scout" className="mb-3 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Target size={20} className="text-orange-500" />
        </Link>
        <div className="w-6 h-px bg-white/10 mb-3" />
        <div className="flex-1 flex flex-col gap-0.5">
          {NAV.map(n => {
            const active = location.pathname === n.path || (n.path === '/scout' && location.pathname.startsWith('/scout/company/'))
            const I = n.icon
            return (
              <Link key={n.path} to={n.path} title={n.label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-orange-500/15 text-orange-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
                <I size={17} strokeWidth={1.5} />
              </Link>
            )
          })}
        </div>
        <div className="w-6 h-px bg-white/10 my-2" />
        <Link to="/" title="Back to Dashboard" className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
          <ArrowLeft size={17} strokeWidth={1.5} />
        </Link>
      </aside>
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50">{children}</main>
    </div>
  )
}
