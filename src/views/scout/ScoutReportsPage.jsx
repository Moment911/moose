"use client";
import { useState, useEffect } from 'react'
import { Target, Search, Users, Mail, DollarSign, TrendingUp, Flame } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { supabase } from '../../lib/supabase'

export default function ScoutReportsPage() {
  const [stats, setStats] = useState({ scouted: 0, imported: 0, hot: 0, contacted: 0 })
  const [searches, setSearches] = useState([])

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    try {
      const [{ data: contacts }, { data: ss }] = await Promise.all([
        supabase.from('contacts').select('id,tags,outreach_status').contains('tags', ['SCOUT Import']),
        supabase.from('scout_searches').select('*').order('created_at', { ascending: false }).limit(10),
      ])
      const c = contacts || []
      setStats({
        scouted: (ss || []).reduce((a, s) => a + (s.result_count || 0), 0),
        imported: c.length,
        hot: c.filter(x => (x.tags || []).some(t => t.includes('Hot'))).length,
        contacted: c.filter(x => x.outreach_status === 'email_sent').length,
      })
      setSearches(ss || [])
    } catch {}
  }

  return (
    <ScoutLayout>
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-orange-500" />
        <span className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>SCOUT</span>
        <span className="text-sm text-slate-400 ml-1">Reports</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Scouted', value: stats.scouted, icon: Search, color: '#0F172A' },
            { label: 'Imported', value: stats.imported, icon: Users, color: '#f97316' },
            { label: 'Hot Leads', value: stats.hot, icon: Flame, color: '#ef4444' },
            { label: 'Contacted', value: stats.contacted, icon: Mail, color: '#22c55e' },
          ].map(s => { const I = s.icon; return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <I size={18} className="mb-2" style={{ color: s.color }} strokeWidth={1.5} />
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
            </div>
          )})}
        </div>

        {/* ROI Calculator */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><DollarSign size={16} className="text-green-500" /> Revenue Potential Calculator</h3>
          <ROICalc hotLeads={stats.hot} warmLeads={stats.imported - stats.hot} />
        </div>

        {/* Recent searches */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-orange-500" /> Recent Searches</h3>
          {searches.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No searches yet</p>}
          <div className="space-y-2">
            {searches.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                <Target size={14} className="text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm text-slate-700 truncate">{s.name}</p></div>
                <span className="text-sm text-slate-500">{s.result_count || 0} results</span>
                {s.hot_count > 0 && <span className="text-sm text-red-500">{s.hot_count} 🔥</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScoutLayout>
  )
}

function ROICalc({ hotLeads, warmLeads }) {
  const [dealValue, setDealValue] = useState(3000)
  const [winRate, setWinRate] = useState(15)
  const hotRevenue = Math.round(hotLeads * (winRate * 2 / 100) * dealValue)
  const warmRevenue = Math.round(warmLeads * (winRate / 100) * dealValue)
  const total = hotRevenue + warmRevenue
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="text-sm text-slate-500 block mb-1">Avg Deal Value</label>
        <input type="number" className="input text-sm" value={dealValue} onChange={e => setDealValue(+e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-slate-500 block mb-1">Win Rate %</label>
        <input type="number" className="input text-sm" min={1} max={100} value={winRate} onChange={e => setWinRate(+e.target.value)} />
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-sm text-slate-400">Potential Revenue</p>
        <p className="text-2xl font-bold text-green-600">${total.toLocaleString()}</p>
        <p className="text-[13px] text-slate-400">{hotLeads} hot leads at {winRate * 2}% &middot; {warmLeads} warm at {winRate}%</p>
      </div>
    </div>
  )
}
