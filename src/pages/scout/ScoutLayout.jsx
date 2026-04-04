"use client";
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
      {/* Thin left rail - desktop only */}
      <aside className="hidden md:flex w-16 flex-col items-center py-4 flex-shrink-0" style={{ background: '#0F172A' }}>
        <Link to="/scout" className="mb-4"><Target size={22} className="text-orange-500" /></Link>
        <div className="w-8 h-px bg-white/10 mb-4" />
        <div className="flex-1 flex flex-col gap-1">
          {NAV.map(n => {
            const active = location.pathname === n.path || (n.path === '/scout' && location.pathname.startsWith('/scout/lead/'))
            const I = n.icon
            return (
              <Link key={n.path} to={n.path} title={n.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-orange-500/20 text-orange-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                <I size={18} strokeWidth={1.5} />
              </Link>
            )
          })}
        </div>
        <div className="w-8 h-px bg-white/10 my-3" />
        <Link to="/" title="Back to Lucy" className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </Link>
      </aside>
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">{children}</main>
    </div>
  )
}
