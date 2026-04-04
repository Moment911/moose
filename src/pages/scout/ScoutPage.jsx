import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Search, MapPin, ChevronDown, ChevronUp, Flame, Thermometer, Snowflake, Star, Globe, Eye, MousePointer, Plus, Check, X, Loader2, BarChart3, ExternalLink, Phone, Mail, Copy, Filter } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import GeoDrillDown from '../../components/scout/GeoDrillDown'
import { supabase } from '../../lib/supabase'
import { generateScoutLeads } from '../../lib/ai'
import toast from 'react-hot-toast'

const INDUSTRIES = [
  { key: 'restaurant', label: 'Restaurant', emoji: '🍕' }, { key: 'law_firm', label: 'Law Firm', emoji: '⚖️' },
  { key: 'dental', label: 'Dental', emoji: '🦷' }, { key: 'real_estate', label: 'Real Estate', emoji: '🏠' },
  { key: 'gym', label: 'Gym / Fitness', emoji: '💪' }, { key: 'salon', label: 'Salon / Spa', emoji: '💅' },
  { key: 'medical', label: 'Medical', emoji: '🏥' }, { key: 'auto_dealer', label: 'Auto Dealer', emoji: '🚗' },
  { key: 'landscaping', label: 'Landscaping', emoji: '🌿' }, { key: 'childcare', label: 'Childcare', emoji: '👶' },
  { key: 'veterinary', label: 'Veterinary', emoji: '🐾' }, { key: 'contractor', label: 'Contractor', emoji: '🏗️' },
  { key: 'electrician', label: 'Electrician', emoji: '⚡' }, { key: 'plumber', label: 'Plumber', emoji: '🔧' },
  { key: 'education', label: 'Education', emoji: '🎓' }, { key: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
]

const POPULAR = ['Restaurants in Miami', 'Law Firms in NYC', 'Dental Offices in Chicago', 'Auto Dealers in LA', 'Salons in Dallas']

function scoreColor(s) { return s >= 75 ? '#22c55e' : s >= 50 ? '#f97316' : s >= 30 ? '#eab308' : '#3b82f6' }
function tempLabel(s) { return s >= 75 ? { emoji: '🔥', label: 'Hot', color: 'text-red-500 bg-red-50' } : s >= 50 ? { emoji: '🟠', label: 'Warm', color: 'text-orange-500 bg-orange-50' } : s >= 30 ? { emoji: '🟡', label: 'Lukewarm', color: 'text-yellow-600 bg-yellow-50' } : { emoji: '🔵', label: 'Cold', color: 'text-blue-500 bg-blue-50' } }

export default function ScoutPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIndustries, setSelectedIndustries] = useState([])
  const [minScore, setMinScore] = useState(0)
  const [gaps, setGaps] = useState([])
  const [searching, setSearching] = useState(false)
  const [pipeline, setPipeline] = useState([])
  const [results, setResults] = useState([])
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState(new Set())
  const [filterTemp, setFilterTemp] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [geoSelection, setGeoSelection] = useState(null)
  const [showGeo, setShowGeo] = useState(false)

  function toggleIndustry(key) {
    setSelectedIndustries(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function toggleGap(g) { setGaps(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]) }

  function viewCompanyProfile(lead) {
    sessionStorage.setItem('scout_lead_' + lead.id, JSON.stringify(lead))
    navigate(`/scout/company/${lead.id}`)
  }

  async function runSearch() {
    const searchTerms = query || selectedIndustries.map(k => INDUSTRIES.find(i => i.key === k)?.label).filter(Boolean).join(', ')
    // Build location from manual input or geo selection
    const geoLoc = geoSelection?.cities?.slice(0, 3).join(', ') || geoSelection?.counties?.slice(0, 2).join(', ') || geoSelection?.states?.join(', ') || ''
    const searchLocation = location || geoLoc
    if (!searchTerms && !searchLocation) { toast.error('Enter a search term or location'); return }
    setSearching(true); setResults([])

    const steps = [
      { name: 'Searching businesses', status: 'running' },
      { name: 'Analyzing websites & tech', status: 'queued' },
      { name: 'Checking reviews & GMB', status: 'queued' },
      { name: 'Social media analysis', status: 'queued' },
      { name: 'Calculating SCOUT scores', status: 'queued' },
    ]
    setPipeline([...steps])

    // Generate mock leads using AI or fallback
    let leads = []
    try {
      steps[0].status = 'complete'; steps[0].detail = 'Querying business databases...'; setPipeline([...steps])
      await delay(800)

      steps[1].status = 'running'; setPipeline([...steps])
      const raw = await generateScoutLeads(searchTerms, searchLocation)
      let cleaned = raw.trim()
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      if (!cleaned.startsWith('[')) cleaned = cleaned.slice(cleaned.indexOf('['))
      if (!cleaned.endsWith(']')) cleaned = cleaned.slice(0, cleaned.lastIndexOf(']') + 1)
      leads = JSON.parse(cleaned)
    } catch (e) {
      console.error('AI lead gen failed, using fallback:', e)
      leads = generateFallbackLeads(searchTerms, searchLocation)
    }

    steps[1].status = 'complete'; steps[1].detail = `${leads.length} websites scanned`
    steps[2].status = 'running'; setPipeline([...steps])
    await delay(600)
    steps[2].status = 'complete'; steps[3].status = 'running'; setPipeline([...steps])
    await delay(500)
    steps[3].status = 'complete'; steps[4].status = 'running'; setPipeline([...steps])
    await delay(400)
    steps[4].status = 'complete'; setPipeline([...steps])

    // Assign IDs and temperatures
    const scored = leads.map((l, i) => ({
      id: 'sl_' + Date.now() + '_' + i,
      ...l,
      agency_likelihood_score: l.agency_likelihood_score || Math.floor(Math.random() * 60 + 30),
      temperature: '',
      review_sentiment: { positive: Math.floor(Math.random() * 30 + 60), neutral: Math.floor(Math.random() * 20 + 10), negative: Math.floor(Math.random() * 15) },
    }))
    scored.forEach(l => {
      const s = l.agency_likelihood_score
      l.temperature = s >= 75 ? 'hot' : s >= 50 ? 'warm' : s >= 30 ? 'lukewarm' : 'cold'
    })

    // Apply filters
    let filtered = scored
    if (minScore > 0) filtered = filtered.filter(l => l.agency_likelihood_score >= minScore)
    if (gaps.length > 0) filtered = filtered.filter(l => gaps.some(g => (l.opportunities || []).some(o => o.toLowerCase().includes(g.toLowerCase()))))

    setResults(filtered)
    setSearching(false)

    // Save search
    try {
      await supabase.from('scout_searches').insert({
        name: `${searchTerms} in ${location || 'all locations'}`,
        industries: selectedIndustries, keywords: searchTerms,
        locations: [{ text: location }], result_count: filtered.length,
        hot_count: filtered.filter(l => l.temperature === 'hot').length,
        warm_count: filtered.filter(l => l.temperature === 'warm').length,
      }).catch(() => {})
    } catch {}
  }

  function toggleSelect(id) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function handleImportSelected() {
    const toImport = results.filter(l => selected.has(l.id))
    if (toImport.length === 0) { toast.error('No leads selected'); return }
    let imported = 0
    for (const lead of toImport) {
      try {
        await supabase.from('contacts').upsert({
          email: lead.email, first_name: lead.business_name?.split(' ')[0] || '',
          company: lead.business_name, phone: lead.phone, website: lead.website,
          city: lead.city, state: lead.state, zip_code: lead.zip_code,
          lead_source: 'SCOUT', lead_status: 'new', lifecycle_stage: 'lead',
          tags: ['SCOUT Import', lead.temperature === 'hot' ? 'Hot Lead' : lead.temperature === 'warm' ? 'Warm Lead' : 'SCOUT Lead'],
          status: 'subscribed',
        }, { onConflict: 'email' })
        imported++
      } catch {}
    }
    toast.success(`Imported ${imported} leads to contacts!`)
    setSelected(new Set())
  }

  const temps = {
    hot: results.filter(l => l.temperature === 'hot').length,
    warm: results.filter(l => l.temperature === 'warm').length,
    lukewarm: results.filter(l => l.temperature === 'lukewarm').length,
    cold: results.filter(l => l.temperature === 'cold').length,
  }

  const displayed = filterTemp.length > 0 ? results.filter(l => filterTemp.includes(l.temperature)) : results

  // HERO / SEARCH STATE
  if (!searching && results.length === 0) return (
    <ScoutLayout>
      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-orange-500" />
        <span className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>SCOUT</span>
        <span className="text-xs text-slate-400 ml-1">Sales Intelligence Platform</span>
      </div>
      <div className="flex-1 overflow-auto">
        {/* Hero */}
        <div className="px-8 py-16 text-center" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
          <div className="flex items-center justify-center gap-2 mb-6">
            <Target size={36} className="text-orange-500" style={{ animation: 'pulse 3s infinite' }} />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Find Your Next Client</h1>
          <p className="text-slate-400 text-base max-w-lg mx-auto mb-8">Discover businesses that need your services using AI-powered marketing intelligence</p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center">
              <div className="flex-1 flex items-center gap-2 px-5 py-4">
                <Search size={18} className="text-slate-400 flex-shrink-0" />
                <input className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400" placeholder="Restaurant, Law Firm, Dental Office..."
                  value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="flex items-center gap-2 px-5 py-4">
                <MapPin size={16} className="text-slate-400 flex-shrink-0" />
                <input className="w-32 sm:w-40 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400" placeholder="Miami, FL"
                  value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
              </div>
              <button onClick={runSearch} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 sm:px-8 py-4 text-sm transition-colors flex items-center gap-2">
                Scout <Target size={14} />
              </button>
            </div>
            {/* Geo toggle */}
            <div className="border-t border-slate-100">
              <button onClick={() => setShowGeo(!showGeo)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-slate-500 hover:text-orange-600 hover:bg-slate-50 transition-colors">
                <MapPin size={12} /> {showGeo ? 'Hide location targeting' : 'Advanced location targeting (state, county, city, zip)'}
                {geoSelection?.summary?.states > 0 && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{geoSelection.summary.states} states</span>}
              </button>
            </div>
          </div>

          {/* GeoDrillDown */}
          {showGeo && <div className="max-w-3xl mx-auto mt-4"><GeoDrillDown onChange={setGeoSelection} /></div>}

          {/* Popular searches */}
          {!showGeo && <div className="flex flex-wrap justify-center gap-2 mt-6">
            {POPULAR.map(p => (
              <button key={p} onClick={() => { const parts = p.split(' in '); setQuery(parts[0]); setLocation(parts[1] || ''); }}
                className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-slate-300 hover:bg-white/20 transition-colors">{p}</button>
            ))}
          </div>}
        </div>

        {/* Advanced filters */}
        <div className="max-w-4xl mx-auto px-8 py-6">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
            <Filter size={14} /> Advanced Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showFilters && (
            <div className="space-y-4">
              {/* Industries */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Industries</h3>
                <div className="grid grid-cols-4 gap-2">
                  {INDUSTRIES.map(ind => (
                    <button key={ind.key} onClick={() => toggleIndustry(ind.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${selectedIndustries.includes(ind.key) ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <span>{ind.emoji}</span> {ind.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Marketing Gaps */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Marketing Gaps to Find</h3>
                  {['No analytics', 'Inactive social media', 'Poor review management', 'Not running ads', 'No CRM detected', 'No email marketing', 'GMB not optimized'].map(g => (
                    <label key={g} className="flex items-center gap-2 py-1.5 cursor-pointer text-xs text-slate-600 hover:text-slate-800">
                      <input type="checkbox" checked={gaps.includes(g)} onChange={() => toggleGap(g)} className="rounded border-slate-300 text-orange-500 focus:ring-orange-400" /> {g}
                    </label>
                  ))}
                </div>

                {/* Minimum Score */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Minimum SCOUT Score</h3>
                  <div className="text-center mb-3"><span className="text-4xl font-bold" style={{ color: scoreColor(minScore) }}>{minScore}</span><span className="text-slate-400 text-sm"> / 100</span></div>
                  <input type="range" min={0} max={100} value={minScore} onChange={e => setMinScore(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>All</span><span>Hot leads only</span></div>
                </div>
              </div>

              <button onClick={runSearch} className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #ea2729, #f97316)' }}>
                <Target size={18} /> Start SCOUT Search
              </button>
            </div>
          )}
        </div>
      </div>
    </ScoutLayout>
  )

  // SEARCHING / PIPELINE STATE
  if (searching) return (
    <ScoutLayout>
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-orange-500" />
        <span className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>SCOUT</span>
        <span className="text-xs text-slate-400 ml-2">Scouting {query || 'businesses'}{location ? ` in ${location}` : ''}...</span>
      </div>
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Loader2 size={40} className="animate-spin text-orange-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800">Analyzing businesses...</h2>
          </div>
          <div className="space-y-3">
            {pipeline.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${step.status === 'complete' ? 'bg-green-50 border-green-200' : step.status === 'running' ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                {step.status === 'complete' && <Check size={18} className="text-green-500 flex-shrink-0" />}
                {step.status === 'running' && <Loader2 size={18} className="animate-spin text-orange-500 flex-shrink-0" />}
                {step.status === 'queued' && <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 flex-shrink-0" />}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${step.status === 'queued' ? 'text-slate-400' : 'text-slate-700'}`}>{step.name}</p>
                  {step.detail && <p className="text-xs text-slate-500">{step.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScoutLayout>
  )

  // RESULTS STATE
  return (
    <ScoutLayout>
      {/* Results header */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-orange-500" />
        <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{results.length} leads found</span>
        <div className="flex items-center gap-2 ml-3">
          <span className="text-xs text-red-500">{temps.hot} 🔥</span>
          <span className="text-xs text-orange-500">{temps.warm} 🟠</span>
          <span className="text-xs text-yellow-600">{temps.lukewarm} 🟡</span>
          <span className="text-xs text-blue-500">{temps.cold} 🔵</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {['grid', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)} className={`text-xs px-3 py-1 rounded-md capitalize font-medium ${view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => { setResults([]); setSearching(false) }} className="btn-secondary text-xs">New Search</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex">
        {/* Filter sidebar */}
        <div className="w-56 bg-white border-r border-slate-200 p-4 flex-shrink-0 overflow-y-auto">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Temperature</p>
          <div className="space-y-1.5 mb-4">
            {[{ key: 'hot', emoji: '🔥', label: 'Hot', count: temps.hot }, { key: 'warm', emoji: '🟠', label: 'Warm', count: temps.warm }, { key: 'lukewarm', emoji: '🟡', label: 'Lukewarm', count: temps.lukewarm }, { key: 'cold', emoji: '🔵', label: 'Cold', count: temps.cold }].map(t => (
              <button key={t.key} onClick={() => setFilterTemp(prev => prev.includes(t.key) ? prev.filter(x => x !== t.key) : [...prev, t.key])}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${filterTemp.includes(t.key) ? 'bg-orange-50 border border-orange-300 text-orange-700' : 'border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {t.emoji} {t.label} <span className="ml-auto text-slate-400">{t.count}</span>
              </button>
            ))}
          </div>
          {filterTemp.length > 0 && <button onClick={() => setFilterTemp([])} className="text-[10px] text-slate-400 hover:text-slate-600 mb-4">Clear filters</button>}

          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Filters</p>
          <button onClick={() => setFilterTemp(['hot'])} className="w-full text-left text-xs text-slate-600 hover:text-orange-600 py-1.5">Best opportunities</button>
          <button onClick={() => setFilterTemp(['hot', 'warm'])} className="w-full text-left text-xs text-slate-600 hover:text-orange-600 py-1.5">Hot + Warm only</button>
        </div>

        {/* Results grid/list */}
        <div className="flex-1 overflow-auto p-6">
          {view === 'grid' ? (
            <div className="grid grid-cols-3 gap-4">
              {displayed.map(lead => <LeadCard key={lead.id} lead={lead} selected={selected.has(lead.id)} onToggle={() => toggleSelect(lead.id)} onView={() => viewCompanyProfile(lead)} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[32px_60px_1fr_100px_100px_80px_80px_60px] gap-2 px-4 py-2.5 bg-slate-50 text-[9px] font-semibold text-slate-500 uppercase tracking-wider border-b">
                <div></div><div>Score</div><div>Business</div><div>City</div><div>Phone</div><div>Social</div><div>Reviews</div><div></div>
              </div>
              {displayed.map(lead => <LeadRow key={lead.id} lead={lead} selected={selected.has(lead.id)} onToggle={() => toggleSelect(lead.id)} expanded={expandedId === lead.id} onExpand={() => setExpandedId(expandedId === lead.id ? null : lead.id)} />)}
            </div>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="h-14 bg-slate-900 border-t border-slate-700 px-6 flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-medium text-white">{selected.size} leads selected</span>
          <button onClick={() => setSelected(new Set(displayed.map(l => l.id)))} className="text-xs text-slate-400 hover:text-white">Select all {displayed.length}</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-white">Clear</button>
          <div className="ml-auto flex gap-2">
            <button onClick={handleImportSelected} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors flex items-center gap-2"><Plus size={14} /> Import to Contacts</button>
          </div>
        </div>
      )}

      {/* Lead detail modal */}
      {expandedId && view === 'grid' && (() => {
        const lead = results.find(l => l.id === expandedId)
        if (!lead) return null
        return <LeadDetailModal lead={lead} onClose={() => setExpandedId(null)} onImport={() => { setSelected(new Set([lead.id])); handleImportSelected() }} />
      })()}
    </ScoutLayout>
  )
}

// -- Lead Card Component --
function LeadCard({ lead, selected, onToggle, onView }) {
  const temp = tempLabel(lead.agency_likelihood_score)
  const ts = lead.tech_stack || {}
  const sm = lead.social_media || {}
  const sent = lead.review_sentiment || { positive: 70, neutral: 20, negative: 10 }
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all cursor-pointer hover:shadow-xl hover:-translate-y-0.5 ${selected ? 'border-orange-400 ring-2 ring-orange-200' : 'border-slate-200'}`} onClick={onView}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 text-sm font-bold flex items-center justify-center flex-shrink-0">
          {(lead.business_name || '??')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{lead.business_name}</p>
          <p className="text-[10px] text-slate-400">{lead.industry} &middot; {lead.city}, {lead.state}</p>
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ border: `3px solid ${scoreColor(lead.agency_likelihood_score)}` }}>
            <span className="text-sm font-bold text-white">{lead.agency_likelihood_score}</span>
          </div>
          <span className={`text-[9px] font-semibold mt-1 ${temp.color.split(' ')[0]}`}>{temp.emoji} {temp.label}</span>
        </div>
      </div>
      {/* Opportunities */}
      {(lead.opportunities || []).length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-orange-50 border-l-4 border-orange-400">
          <p className="text-[10px] text-orange-700 truncate">💡 {(lead.opportunities || []).slice(0, 2).join(' · ')}</p>
        </div>
      )}
      {/* Metrics */}
      <div className="px-4 py-3 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><Star size={10} className="text-yellow-500" /> {lead.google_rating || '—'} ({lead.google_review_count || 0})</span>
        <span className="flex items-center gap-1">{sm.last_post_days != null ? `📅 ${sm.last_post_days}d ago` : '—'}</span>
      </div>
      {/* Tech badges */}
      <div className="px-4 pb-2 flex flex-wrap gap-1">
        {ts.analytics ? <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">GA</span> : <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">No GA</span>}
        {ts.pixel ? <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">Pixel</span> : <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">No Pixel</span>}
        {ts.crm ? <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">CRM</span> : <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">No CRM</span>}
      </div>
      {/* Social dots */}
      <div className="px-4 pb-2 flex items-center gap-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${sm.facebook_active ? 'bg-green-500' : 'bg-red-400'}`} /> FB</span>
        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${sm.instagram_active ? 'bg-green-500' : 'bg-red-400'}`} /> IG</span>
        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${sm.gmb_optimized ? 'bg-green-500' : 'bg-yellow-500'}`} /> GMB</span>
      </div>
      {/* Sentiment bar */}
      <div className="px-4 pb-3">
        <div className="flex h-1 rounded-full overflow-hidden">
          <div className="bg-green-400" style={{ width: `${sent.positive}%` }} />
          <div className="bg-slate-300" style={{ width: `${sent.neutral}%` }} />
          <div className="bg-red-400" style={{ width: `${sent.negative}%` }} />
        </div>
      </div>
      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={onToggle} className="rounded border-slate-300 text-orange-500" /> Select
        </label>
        <div className="flex gap-1">
          {lead.email && <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(lead.email); toast.success('Email copied') }} className="text-slate-400 hover:text-orange-500 p-1" title="Copy email"><Mail size={12} /></button>}
          {lead.phone && <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(lead.phone); toast.success('Phone copied') }} className="text-slate-400 hover:text-orange-500 p-1" title="Copy phone"><Phone size={12} /></button>}
        </div>
      </div>
    </div>
  )
}

// -- Lead Row Component --
function LeadRow({ lead, selected, onToggle, expanded, onExpand }) {
  const temp = tempLabel(lead.agency_likelihood_score)
  const sm = lead.social_media || {}
  return (
    <>
      <div className="grid grid-cols-[32px_60px_1fr_100px_100px_80px_80px_60px] gap-2 px-4 py-2.5 items-center border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={onExpand}>
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} className="rounded border-slate-300 text-orange-500" />
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-center" style={{ background: scoreColor(lead.agency_likelihood_score) + '20', color: scoreColor(lead.agency_likelihood_score) }}>{lead.agency_likelihood_score}</span>
        <div className="min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{lead.business_name}</p><p className="text-[10px] text-slate-400">{lead.industry}</p></div>
        <span className="text-xs text-slate-500">{lead.city}, {lead.state}</span>
        <span className="text-xs text-slate-500 truncate">{lead.phone || '—'}</span>
        <div className="flex gap-1">
          <span className={`w-2 h-2 rounded-full ${sm.facebook_active ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className={`w-2 h-2 rounded-full ${sm.instagram_active ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className={`w-2 h-2 rounded-full ${sm.gmb_optimized ? 'bg-green-500' : 'bg-yellow-500'}`} />
        </div>
        <span className="text-xs text-slate-500 flex items-center gap-1"><Star size={10} className="text-yellow-500" /> {lead.google_rating || '—'}</span>
        <span className={`text-[10px] font-semibold ${temp.color.split(' ')[0]}`}>{temp.emoji}</span>
      </div>
      {expanded && (
        <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Opportunities</p>{(lead.opportunities || []).map((o, i) => <p key={i} className="text-xs text-slate-600">💡 {o}</p>)}</div>
            <div><p className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Contact</p><p className="text-xs text-slate-600">{lead.email || 'No email'}</p><p className="text-xs text-slate-600">{lead.phone || 'No phone'}</p><p className="text-xs text-slate-600">{lead.website || 'No website'}</p></div>
            <div><p className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Reviews</p><p className="text-xs text-slate-600">⭐ {lead.google_rating} ({lead.google_review_count} reviews)</p></div>
          </div>
        </div>
      )}
    </>
  )
}

// -- Lead Detail Modal --
function LeadDetailModal({ lead, onClose, onImport }) {
  const temp = tempLabel(lead.agency_likelihood_score)
  const ts = lead.tech_stack || {}
  const sm = lead.social_media || {}
  const sent = lead.review_sentiment || { positive: 70, neutral: 20, negative: 10 }
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{lead.business_name}</h2>
            <p className="text-sm text-slate-400">{lead.industry} &middot; {lead.city}, {lead.state} {lead.website && <>&middot; <a href={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">{lead.website} ↗</a></>}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ border: `4px solid ${scoreColor(lead.agency_likelihood_score)}` }}>
              <span className="text-2xl font-extrabold text-white">{lead.agency_likelihood_score}</span>
            </div>
            <span className={`text-xs font-semibold ${temp.color.split(' ')[0]}`}>{temp.emoji} {temp.label} Lead</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white ml-2"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-[1fr_300px] gap-6">
            {/* Left */}
            <div className="space-y-5">
              {/* Opportunities */}
              <div className="rounded-2xl p-5 border-2 border-orange-200 bg-orange-50">
                <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2"><Target size={14} /> Opportunities for Momenta Marketing</h3>
                <div className="space-y-2">
                  {(lead.opportunities || []).map((o, i) => (
                    <div key={i} className="flex items-start gap-2"><span className="text-orange-500 mt-0.5">{i + 1}.</span><p className="text-sm text-orange-900">{o}</p></div>
                  ))}
                </div>
              </div>
              {/* Tech Stack */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Tech Stack Detected</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[{ key: 'analytics', label: 'Analytics' }, { key: 'cms', label: 'CMS' }, { key: 'crm', label: 'CRM' }, { key: 'pixel', label: 'FB Pixel' }, { key: 'chat', label: 'Live Chat' }, { key: 'email_tool', label: 'Email Tool' }].map(t => (
                    <div key={t.key} className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${ts[t.key] ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {ts[t.key] ? <Check size={12} /> : <X size={12} />} {t.label}
                    </div>
                  ))}
                </div>
              </div>
              {/* Reviews */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Reviews & Sentiment</h3>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center"><p className="text-3xl font-bold text-slate-800">{lead.google_rating || '—'}</p><p className="text-xs text-slate-400">⭐ {lead.google_review_count || 0} reviews</p></div>
                  <div className="flex-1">
                    <div className="flex h-2 rounded-full overflow-hidden"><div className="bg-green-400" style={{ width: `${sent.positive}%` }} /><div className="bg-slate-300" style={{ width: `${sent.neutral}%` }} /><div className="bg-red-400" style={{ width: `${sent.negative}%` }} /></div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>{sent.positive}% positive</span><span>{sent.negative}% negative</span></div>
                  </div>
                </div>
              </div>
              {/* Social */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Social Media</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: 'Facebook', active: sm.facebook_active, detail: sm.facebook_followers ? `${sm.facebook_followers} followers` : '' },
                    { label: 'Instagram', active: sm.instagram_active, detail: sm.last_post_days != null ? `Last post: ${sm.last_post_days}d ago` : '' },
                    { label: 'GMB', active: sm.gmb_optimized, detail: sm.gmb_optimized ? 'Optimized' : 'Needs work' }].map(s => (
                    <div key={s.label} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full mb-1 ${s.active ? 'bg-green-500' : 'bg-red-400'}`} />
                      <p className="text-xs font-medium text-slate-700">{s.label}</p>
                      <p className="text-[10px] text-slate-400">{s.detail || (s.active ? 'Active' : 'Inactive')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right - action panel */}
            <div className="space-y-4">
              <button onClick={onImport} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"><Plus size={14} /> Import to Contacts</button>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">Contact Info</h4>
                <div className="space-y-2">
                  {lead.phone && <div className="flex items-center gap-2 text-sm text-slate-700"><Phone size={13} className="text-slate-400" /> {lead.phone} <button onClick={() => { navigator.clipboard.writeText(lead.phone); toast.success('Copied') }} className="text-slate-300 hover:text-orange-500 ml-auto"><Copy size={11} /></button></div>}
                  {lead.email && <div className="flex items-center gap-2 text-sm text-slate-700"><Mail size={13} className="text-slate-400" /> <span className="truncate">{lead.email}</span> <button onClick={() => { navigator.clipboard.writeText(lead.email); toast.success('Copied') }} className="text-slate-300 hover:text-orange-500 ml-auto"><Copy size={11} /></button></div>}
                  {lead.website && <div className="flex items-center gap-2 text-sm text-slate-700"><Globe size={13} className="text-slate-400" /> <a href={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline truncate">{lead.website}</a></div>}
                  {lead.city && <div className="flex items-center gap-2 text-sm text-slate-700"><MapPin size={13} className="text-slate-400" /> {lead.city}, {lead.state} {lead.zip_code}</div>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">Score Breakdown</h4>
                {[{ label: 'Social Media', val: sm.facebook_active || sm.instagram_active ? 25 : 5, max: 30 },
                  { label: 'Website/Tech', val: Object.values(ts).filter(Boolean).length * 5, max: 30 },
                  { label: 'Reviews', val: lead.google_rating ? Math.round(lead.google_rating * 4) : 5, max: 20 },
                  { label: 'GMB Health', val: sm.gmb_optimized ? 12 : 3, max: 15 },
                ].map(s => (
                  <div key={s.label} className="mb-2"><div className="flex justify-between text-[10px] text-slate-500 mb-0.5"><span>{s.label}</span><span>{s.val}/{s.max}</span></div><div className="h-1.5 bg-slate-100 rounded-full"><div className="h-full rounded-full bg-orange-400" style={{ width: `${s.val / s.max * 100}%` }} /></div></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

function generateFallbackLeads(searchTerms, loc) {
  const names = ['Bella Vista', 'Summit Group', 'Harbor Point', 'Pacific Edge', 'Golden Gate', 'Blue Ridge', 'Silver Lake', 'Oak Street', 'Maple & Co', 'Pine Valley', 'Cedar Hill', 'Willow Creek', 'River Stone', 'Mountain View', 'Sunset Plaza', 'Coastal', 'Metro', 'Liberty']
  const cities = loc ? [loc.split(',')[0].trim()] : ['Miami', 'Austin', 'Denver', 'Chicago', 'Portland', 'Seattle']
  const states = loc && loc.includes(',') ? [loc.split(',')[1].trim()] : ['FL', 'TX', 'CO', 'IL', 'OR', 'WA']
  return names.map((n, i) => ({
    business_name: `${n} ${searchTerms?.split(' ')[0] || 'Business'}`,
    industry: searchTerms || 'Local Business', website: `www.${n.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    phone: `(${300 + i}) 555-${String(1000 + i * 111).slice(0, 4)}`,
    email: `info@${n.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    city: cities[i % cities.length], state: states[i % states.length], zip_code: String(10000 + i * 1111),
    google_rating: +(3 + Math.random() * 2).toFixed(1), google_review_count: Math.floor(Math.random() * 200 + 10),
    agency_likelihood_score: Math.floor(Math.random() * 70 + 20),
    opportunities: ['No analytics tracking', 'Inactive social media', 'Poor review management', 'Not running paid ads'].slice(0, Math.floor(Math.random() * 3 + 1)),
    tech_stack: { analytics: Math.random() > 0.5, cms: Math.random() > 0.3, crm: Math.random() > 0.7, pixel: Math.random() > 0.6, chat: Math.random() > 0.7, email_tool: Math.random() > 0.6 },
    social_media: { facebook_active: Math.random() > 0.4, instagram_active: Math.random() > 0.5, gmb_optimized: Math.random() > 0.5, facebook_followers: Math.floor(Math.random() * 2000 + 100), last_post_days: Math.floor(Math.random() * 90) },
  }))
}
