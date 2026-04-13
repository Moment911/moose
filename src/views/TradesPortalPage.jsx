"use client"
import { useState, useEffect } from 'react'
import {
  Wrench, Search, Loader2, Zap, RefreshCw, ChevronRight, Check,
  Thermometer, Droplets, Home, Shield, Layers, Leaf, Sun,
  Bug, Sparkles, Square, ArrowDown, BarChart2, Brain, Target
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const W = '#ffffff'

const API_INDUSTRY = '/api/industry-agent'
const API_REGISTRY = '/api/industry-agent'

const SUBCATEGORY_ICONS = {
  hvac: Thermometer, plumbing: Droplets, roofing: Home, electrical: Zap,
  restoration: Shield, construction: Home, siding: Layers, windows_doors: Square,
  landscaping: Leaf, painting: Layers, concrete_masonry: Layers, pest_control: Bug,
  cleaning: Sparkles, flooring: Layers, insulation: Home, fencing: Layers,
  solar: Sun, gutters: ArrowDown, drywall: Square, deck_patio: Home, pools_water: Droplets,
}

const SUBCATEGORY_LABELS = {
  pools_water: 'Pools', construction: 'Construction', hvac: 'HVAC', plumbing: 'Plumbing',
  electrical: 'Electrical', restoration: 'Restoration', roofing: 'Roofing', siding: 'Siding',
  windows_doors: 'Windows', landscaping: 'Landscaping', painting: 'Painting',
  concrete_masonry: 'Concrete', pest_control: 'Pest Control', cleaning: 'Cleaning',
  flooring: 'Flooring', insulation: 'Insulation', fencing: 'Fencing', solar: 'Solar',
  gutters: 'Gutters', drywall: 'Drywall', deck_patio: 'Deck/Patio',
}

export default function TradesPortalPage() {
  const { agencyId } = useAuth()
  const [industries, setIndustries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subFilter, setSubFilter] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [generating, setGenerating] = useState(null)

  useEffect(() => {
    fetch(`${API_INDUSTRY}?action=list_trades`).then(r => r.json()).then(r => {
      setIndustries(Array.isArray(r.data) ? r.data : [])
      setLoading(false)
    }).catch(() => { setIndustries([]); setLoading(false) })
  }, [])

  async function loadDetail(ind) {
    setSelectedIndustry(ind)
    setLoadingDetail(true)
    const res = await fetch(`${API_INDUSTRY}?action=get_industry&sic_code=${ind.sic_code}`).then(r => r.json())
    setDetail({ ...ind, ...res.data })
    setLoadingDetail(false)
  }

  async function generateConfig(ind) {
    setGenerating(ind.industry_name)
    const res = await fetch(API_INDUSTRY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_config', sic_code: ind.sic_code, industry_name: ind.industry_name }),
    }).then(r => r.json())
    if (res.success) toast.success(`AI config generated for ${ind.industry_name}`)
    else toast.error(res.error || 'Failed')
    setGenerating(null)
    if (selectedIndustry?.sic_code === ind.sic_code) loadDetail(ind)
  }

  async function generateQA(ind) {
    setGenerating(ind.industry_name + '_qa')
    const res = await fetch(API_INDUSTRY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_qa_bank', sic_code: ind.sic_code, industry_name: ind.industry_name }),
    }).then(r => r.json())
    if (res.success) toast.success(`${res.inserted} Q&A pairs generated`)
    else toast.error(res.error || 'Failed')
    setGenerating(null)
  }

  const subcategories = [...new Set(industries.map(i => i.subcategory).filter(Boolean))]
  const filtered = industries.filter(i => {
    if (subFilter && i.subcategory !== subFilter) return false
    if (search && !i.industry_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Top banner */}
        <div style={{ background: '#f9fafb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wrench size={16} color={BLK} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Trades Industry Intelligence Portal</span>
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{industries.length} industries -- Auto-learning enabled</span>
        </div>

        {/* Header */}
        <div style={{ background: W, padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Trades & Home Services</h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '2px 0 0' }}>Industry-specific AI agents that learn from every call</p>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Subcategory filter pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setSubFilter('')} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: !subFilter ? BLK : '#f9fafb', color: !subFilter ? W : '#555' }}>All</button>
            {subcategories.sort().map(sc => (
              <button key={sc} onClick={() => setSubFilter(sc)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: subFilter === sc ? BLK : '#f9fafb', color: subFilter === sc ? W : '#555' }}>
                {SUBCATEGORY_LABELS[sc] || sc}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
            <Search size={14} color="#999" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trades..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={24} color={R} className="ds-spin" /></div>}

          {/* Grid + Detail layout */}
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Grid */}
            <div style={{ flex: selectedIndustry ? '0 0 420px' : 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: selectedIndustry ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                {filtered.map(ind => {
                  const Icon = SUBCATEGORY_ICONS[ind.subcategory] || Wrench
                  const isSelected = selectedIndustry?.industry_name === ind.industry_name
                  const hasConfig = detail?.config && isSelected
                  return (
                    <div key={ind.id || ind.industry_name} onClick={() => loadDetail(ind)} style={{
                      padding: '16px 18px', borderRadius: 8, background: W,
                      border: isSelected ? `2px solid ${R}` : '1px solid rgba(0,0,0,0.08)',
                      cursor: 'pointer', transition: 'border-color 0.15s',
                      borderLeft: `4px solid ${ind.avg_close_rate_percent >= 40 ? GRN : ind.avg_close_rate_percent >= 30 ? AMB : '#ccc'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon size={16} color={R} />
                          <span style={{ fontSize: 14, fontWeight: 500, color: BLK }}>{ind.industry_name}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>SIC {ind.sic_code}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{ind.decision_maker_title || 'Owner'} -- {ind.typical_business_size || 'small'}</div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#666' }}>
                        <span>Spend: ${ind.avg_monthly_marketing_spend_low}-${ind.avg_monthly_marketing_spend_high}/mo</span>
                        <span>Close: {ind.avg_close_rate_percent}%</span>
                      </div>
                      {Array.isArray(ind.best_call_days) && ind.best_call_days.length > 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                          Best: {ind.best_call_days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')} {Array.isArray(ind.best_call_hours) ? ind.best_call_hours.slice(0, 3).map(h => `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`).join(', ') : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detail panel */}
            {selectedIndustry && (
              <div style={{ flex: 1, minWidth: 0 }}>
                {loadingDetail ? (
                  <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={24} color={R} className="ds-spin" /></div>
                ) : detail && (
                  <div>
                    {/* Detail header */}
                    <div style={{ background: W, borderRadius: 8, padding: '20px 24px', border: '1px solid #e5e7eb', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <h2 style={{ fontSize: 18, fontWeight: 500, color: BLK, margin: 0 }}>{detail.industry_name}</h2>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>SIC {detail.sic_code} -- NAICS {detail.naics_code}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => generateConfig(detail)} disabled={generating === detail.industry_name} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: T, color: W, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {generating === detail.industry_name ? <Loader2 size={12} className="ds-spin" /> : <Zap size={12} />} AI Config
                          </button>
                          <button onClick={() => generateQA(detail)} disabled={generating === detail.industry_name + '_qa'} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {generating === detail.industry_name + '_qa' ? <Loader2 size={12} className="ds-spin" /> : <Brain size={12} />} Q&A Bank
                          </button>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        {[
                          { label: 'Close Rate', value: `${detail.avg_close_rate_percent || 0}%`, accent: GRN },
                          { label: 'Spend', value: `$${detail.avg_monthly_marketing_spend_low}-${detail.avg_monthly_marketing_spend_high}`, accent: AMB },
                          { label: 'Q&A Pairs', value: detail.qa_count || 0, accent: T },
                        ].map(s => (
                          <div key={s.label} style={{ flex: 1, padding: '10px 12px', background: '#f9fafb', borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: BLK }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Pain points */}
                      {Array.isArray(detail.typical_pain_points) && detail.typical_pain_points.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Common Pain Points</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {detail.typical_pain_points.map((p, i) => (
                              <span key={i} style={{ padding: '3px 10px', borderRadius: 99, background: '#FFF0F7', color: '#B5005B', fontSize: 12, fontWeight: 500 }}>{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Config preview */}
                    {detail.config && (
                      <div style={{ background: W, borderRadius: 8, padding: '16px 20px', border: '1px solid #e5e7eb', marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: BLK, marginBottom: 8 }}>AI Configuration</div>
                        {detail.config.tone && <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Tone: {detail.config.tone}</div>}
                        {Array.isArray(detail.config.vocabulary) && detail.config.vocabulary.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {detail.config.vocabulary.slice(0, 8).map((v, i) => (
                              <span key={i} style={{ padding: '2px 8px', borderRadius: 99, background: '#F0FAFA', color: '#00878E', fontSize: 12, fontWeight: 500 }}>{v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Best call times */}
                    <div style={{ background: W, borderRadius: 8, padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: BLK, marginBottom: 8 }}>Best Call Times</div>
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        Days: {(detail.best_call_days || []).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'Tue-Thu'}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
                        Hours: {(detail.best_call_hours || []).map(h => `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`).join(', ') || '9-11am'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}} .ds-spin{animation:ds-spin 1s linear infinite}`}</style>
      </div>
    </div>
  )
}
