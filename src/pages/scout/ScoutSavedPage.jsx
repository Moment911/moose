"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Bookmark, Play, Trash2, Clock, Flame } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export default function ScoutSavedPage() {
  const navigate = useNavigate()
  const [searches, setSearches] = useState([])

  useEffect(() => { loadSearches() }, [])

  async function loadSearches() {
    try {
      const { data } = await supabase.from('scout_searches').select('*').order('created_at', { ascending: false })
      setSearches(data || [])
    } catch { setSearches([]) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this saved search?')) return
    await supabase.from('scout_searches').delete().eq('id', id).catch(() => {})
    toast.success('Deleted'); loadSearches()
  }

  return (
    <ScoutLayout>
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-orange-500" />
        <span className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>SCOUT</span>
        <span className="text-xs text-slate-400 ml-1">Saved Searches</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {searches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Bookmark size={40} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-slate-700 mb-1">No saved searches yet</h3>
            <p className="text-sm text-slate-400 mb-4">Your SCOUT searches will appear here automatically.</p>
            <button onClick={() => navigate('/scout')} className="text-sm font-semibold text-orange-500 hover:text-orange-600">Run your first search →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searches.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{s.name || 'Untitled Search'}</h3>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} /> {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : ''}</p>
                  </div>
                  <button onClick={() => handleDelete(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
                  <span>{s.result_count || 0} results</span>
                  {s.hot_count > 0 && <span className="text-red-500 flex items-center gap-1"><Flame size={11} /> {s.hot_count} hot</span>}
                  {s.warm_count > 0 && <span className="text-orange-500">{s.warm_count} warm</span>}
                </div>
                {(s.industries || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(s.industries || []).map(i => <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{i}</span>)}
                  </div>
                )}
                <button onClick={() => navigate('/scout')} className="w-full btn-secondary text-xs justify-center"><Play size={12} /> Run Again</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScoutLayout>
  )
}
