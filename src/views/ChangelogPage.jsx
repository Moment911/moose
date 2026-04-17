"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { Clock, Zap, Bug, RefreshCw, Search, Filter, Shield, BookOpen, Wrench, Eye, TrendingUp, ChevronDown } from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const TYPE_CONFIG = {
  feat:     { label: 'New Feature', icon: Zap, color: GRN, bg: GRN + '12' },
  fix:      { label: 'Bug Fix', icon: Bug, color: R, bg: R + '12' },
  refactor: { label: 'Improvement', icon: RefreshCw, color: T, bg: T + '12' },
  perf:     { label: 'Performance', icon: TrendingUp, color: AMB, bg: AMB + '12' },
  docs:     { label: 'Documentation', icon: BookOpen, color: '#6b7280', bg: '#f3f4f6' },
  chore:    { label: 'Maintenance', icon: Wrench, color: '#6b7280', bg: '#f3f4f6' },
  style:    { label: 'Visual Update', icon: Eye, color: T, bg: T + '12' },
  update:   { label: 'Update', icon: Clock, color: '#6b7280', bg: '#f3f4f6' },
}

export default function ChangelogPage() {
  const { agencyId, user } = useAuth()
  const [commits, setCommits] = useState([])
  const [grouped, setGrouped] = useState({})
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedDays, setExpandedDays] = useState(new Set())
  const [isAdmin, setIsAdmin] = useState(false)

  // Check if Koto admin
  useEffect(() => {
    // Koto admin check — super admin or specific agency
    const adminId = '00000000-0000-0000-0000-000000000099'
    setIsAdmin(agencyId === adminId || user?.email === 'adam@momentamktg.com' || user?.email === 'adam@unifiedmktg.com')
  }, [agencyId, user])

  useEffect(() => {
    fetch('/api/changelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', limit: 200, type_filter: typeFilter !== 'all' ? typeFilter : undefined, search: search || undefined }),
    })
      .then(r => r.json())
      .then(res => {
        setCommits(res.commits || [])
        setGrouped(res.grouped || {})
        setStats(res.stats || null)
        // Auto-expand first 3 days
        const days = Object.keys(res.grouped || {}).slice(0, 3)
        setExpandedDays(new Set(days))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [typeFilter, search])

  // Block non-admins
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Shield size={48} color={R} style={{ margin: '0 auto 16px', opacity: .4 }} />
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK, marginBottom: 8 }}>Koto Admin Only</div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>The changelog is only visible to Koto administrators.</div>
          </div>
        </div>
      </div>
    )
  }

  const toggleDay = (day) => {
    const next = new Set(expandedDays)
    next.has(day) ? next.delete(day) : next.add(day)
    setExpandedDays(next)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.03em' }}>Platform Changelog</div>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Everything that's been built, fixed, and improved — in plain English.</div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              ['Total Changes', stats.total, T, Clock],
              ['New Features', stats.features, GRN, Zap],
              ['Bug Fixes', stats.fixes, R, Bug],
              ['Last Update', stats.last_update || '—', AMB, Clock],
            ].map(([label, val, color, Icon]) => (
              <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search changes..." style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', background: '#fff' }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['all', 'All'], ['feat', 'Features'], ['fix', 'Fixes'], ['refactor', 'Improvements'], ['docs', 'Docs']].map(([key, label]) => (
              <button key={key} onClick={() => setTypeFilter(key)}
                style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${typeFilter === key ? T : '#e5e7eb'}`, background: typeFilter === key ? T + '12' : '#fff', color: typeFilter === key ? T : '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading changelog...</div>
        ) : (
          <div>
            {Object.entries(grouped).map(([day, dayCommits]) => {
              const isExpanded = expandedDays.has(day)
              const dateObj = new Date(day + 'T12:00:00')
              const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              const featCount = dayCommits.filter(c => c.type === 'feat').length
              const fixCount = dayCommits.filter(c => c.type === 'fix').length

              return (
                <div key={day} style={{ marginBottom: 8 }}>
                  {/* Day header */}
                  <button onClick={() => toggleDay(day)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: featCount > 0 ? GRN : fixCount > 0 ? R : '#d1d5db' }} />
                      <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>{dateLabel}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {featCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: GRN + '12', color: GRN }}>{featCount} feature{featCount > 1 ? 's' : ''}</span>}
                        {fixCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: R + '12', color: R }}>{fixCount} fix{fixCount > 1 ? 'es' : ''}</span>}
                        {dayCommits.length - featCount - fixCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280' }}>+{dayCommits.length - featCount - fixCount}</span>}
                      </div>
                    </div>
                    <ChevronDown size={16} color="#9ca3af" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                  </button>

                  {/* Day commits */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 24, borderLeft: `2px solid #e5e7eb`, marginLeft: 22, marginTop: 4, paddingTop: 4 }}>
                      {dayCommits.map((c, i) => {
                        const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.update
                        const Icon = cfg.icon
                        return (
                          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < dayCommits.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                              <Icon size={14} color={cfg.color} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{cfg.label}</span>
                                {c.scope && <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>{c.scope}</span>}
                                <span style={{ fontSize: 10, color: '#d1d5db', marginLeft: 'auto' }}>{c.date_relative}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: BLK, marginTop: 4, lineHeight: 1.4 }}>{c.title}</div>
                              {c.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>{c.description.slice(0, 200)}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {commits.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No changes match your search.</div>
        )}
      </div>
    </div>
  )
}
