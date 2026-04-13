"use client"
import { useState, useEffect } from 'react'
import {
  Brain, Search, ChevronRight, Loader2, Zap, RefreshCw, BarChart2,
  MessageSquare, Globe, Star, Target, Check, X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const W = '#ffffff'

const API = '/api/industry-agent'

export default function IndustryAgentPage() {
  const { user } = useAuth()
  const [industries, setIndustries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSic, setSelectedSic] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [generating, setGenerating] = useState(null) // 'config' | 'qa' | null

  useEffect(() => {
    fetch(`${API}?action=list_industries`).then(r => r.json()).then(r => {
      setIndustries(r.data || [])
      setLoading(false)
    })
  }, [])

  async function loadDetail(sicCode) {
    setSelectedSic(sicCode)
    setLoadingDetail(true)
    const res = await fetch(`${API}?action=get_industry&sic_code=${sicCode}`)
    const data = await res.json()
    setDetail(data.data)
    setLoadingDetail(false)
  }

  async function generateConfig() {
    if (!detail?.intelligence) return
    setGenerating('config')
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_config', sic_code: selectedSic, industry_name: detail.intelligence.industry_name }),
    })
    const data = await res.json()
    if (data.success) { toast.success('AI Config generated'); loadDetail(selectedSic) }
    else toast.error(data.error || 'Failed')
    setGenerating(null)
  }

  async function generateQA() {
    if (!detail?.intelligence) return
    setGenerating('qa')
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_qa_bank', sic_code: selectedSic, industry_name: detail.intelligence.industry_name }),
    })
    const data = await res.json()
    if (data.success) { toast.success(`Generated ${data.inserted} Q&A pairs`); loadDetail(selectedSic) }
    else toast.error(data.error || 'Failed')
    setGenerating(null)
  }

  const filtered = industries.filter(i =>
    !search || i.industry_name?.toLowerCase().includes(search.toLowerCase()) || i.industry_sic_code?.includes(search)
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: W, padding: '20px 32px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E6007E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={20} color={W} />
            </div>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Industry Agent System</h1>
              <p style={{ fontFamily: FB, fontSize: 14, color: '#6b7280', margin: 0 }}>{industries.length} industries configured</p>
            </div>
          </div>
        </div>

        {/* 2-panel layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Industry list */}
          <div style={{ width: 340, minWidth: 340, borderRight: '1px solid #e5e7eb', background: W, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 14px 10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 12, top: 11 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search industries..."
                  style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px' }}>
              {loading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={20} color={R} style={{ animation: 'spin 1s linear infinite' }} /></div>}
              {filtered.map(ind => (
                <div key={ind.industry_sic_code} onClick={() => loadDetail(ind.industry_sic_code)} style={{
                  padding: '12px 14px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                  background: selectedSic === ind.industry_sic_code ? `${R}08` : W,
                  border: selectedSic === ind.industry_sic_code ? `2px solid ${R}` : '1px solid #f3f4f6',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>{ind.industry_name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>SIC: {ind.industry_sic_code}</span>
                    {ind.total_calls > 0 && <span style={{ fontSize: 12, color: T, fontFamily: FB }}>{ind.total_calls} calls</span>}
                    {ind.confidence_score > 0 && <span style={{ fontSize: 12, color: GRN, fontFamily: FB }}>Score: {ind.confidence_score}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Detail */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            {!selectedSic && !loadingDetail && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <Globe size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
                <h3 style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>Select an Industry</h3>
                <p style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>Choose an industry to view its AI configuration, Q&A bank, and performance data.</p>
              </div>
            )}

            {loadingDetail && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <Loader2 size={28} color={R} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {detail && !loadingDetail && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: '0 0 4px' }}>
                      {detail.intelligence?.industry_name || 'Unknown'}
                    </h2>
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>SIC: {selectedSic}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={generateConfig} disabled={generating === 'config'} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                      border: 'none', background: T, color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer',
                    }}>
                      {generating === 'config' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                      Generate AI Config
                    </button>
                    <button onClick={generateQA} disabled={generating === 'qa'} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                      border: 'none', background: R, color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer',
                    }}>
                      {generating === 'qa' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={14} />}
                      Generate Q&A Bank
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Confidence', value: detail.intelligence?.confidence_score || 0, accent: T },
                    { label: 'Total Calls', value: detail.intelligence?.total_calls || 0, accent: AMB },
                    { label: 'Appt Rate', value: `${detail.intelligence?.avg_appointment_rate || 0}%`, accent: GRN },
                    { label: 'Q&A Pairs', value: detail.qa_count || 0, accent: R },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, padding: '14px 16px', background: W, borderRadius: 10, borderTop: `3px solid ${s.accent}`, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', fontFamily: FB, textTransform: 'uppercase' }}>{s.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* AI Config */}
                {detail.config && (
                  <div style={{ background: W, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb', marginBottom: 16 }}>
                    <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 12px' }}>AI Configuration</h3>
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, lineHeight: 1.6 }}>
                      <div><strong>Tone:</strong> {detail.config.tone}</div>
                      <div><strong>Pace:</strong> {detail.config.pace}</div>
                      {detail.config.vocabulary?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong>Industry Vocabulary:</strong>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {detail.config.vocabulary.map((v, i) => (
                              <span key={i} style={{ padding: '2px 8px', borderRadius: 99, background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 600 }}>{v}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {detail.config.benchmark_talking_points?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong>Benchmark Talking Points:</strong>
                          {detail.config.benchmark_talking_points.map((b, i) => (
                            <div key={i} style={{ marginTop: 4, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, borderLeft: `3px solid ${T}` }}>{b}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Top Q&A */}
                {detail.intelligence?.best_discovery_questions?.length > 0 && (
                  <div style={{ background: W, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 12px' }}>Top Discovery Questions</h3>
                    {detail.intelligence.best_discovery_questions.slice(0, 7).map((q, i) => (
                      <div key={i} style={{ fontSize: 13, fontFamily: FB, color: '#374151', padding: '6px 0', borderBottom: i < 6 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: 8 }}>
                        <span style={{ color: T, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!detail.config && !detail.intelligence?.best_discovery_questions?.length && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: W, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <Brain size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, margin: '0 0 12px' }}>No AI config yet for this industry.</p>
                    <p style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>Click "Generate AI Config" to create one using Claude, or "Generate Q&A Bank" to seed questions.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
