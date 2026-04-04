"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TrendingUp, Search, BarChart2, MapPin, FileText, Sparkles, Link2, ChevronRight, Plus, Loader2, RefreshCw, Target, Zap, Globe, Star, DollarSign, Eye, MousePointer, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { loadSEOClients } from '../../lib/seoService'
import { callClaude } from '../../lib/ai'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart2 },
  { key: 'keywords', label: 'Keywords', icon: Search },
  { key: 'ppc', label: 'PPC', icon: DollarSign },
  { key: 'gmb', label: 'GMB', icon: MapPin },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'aeo', label: 'AEO', icon: Sparkles },
  { key: 'reports', label: 'Reports', icon: FileText },
]

const PROVIDERS = [
  { key: 'search_console', label: 'Search Console', icon: Search, color: '#4285F4', desc: 'Keyword rankings, clicks, impressions' },
  { key: 'analytics', label: 'Google Analytics', icon: BarChart2, color: '#F4B400', desc: 'Traffic, users, conversions' },
  { key: 'ads', label: 'Google Ads', icon: DollarSign, color: '#34A853', desc: 'Campaign spend, conversions, ROAS' },
  { key: 'gmb', label: 'Business Profile', icon: MapPin, color: '#EA4335', desc: 'Reviews, views, actions' },
]

export default function SEOHubPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(clientId || null)
  const [tab, setTab] = useState('overview')
  const [connections, setConnections] = useState([])
  const [keywords, setKeywords] = useState([])
  const [reports, setReports] = useState([])
  const [generating, setGenerating] = useState(false)
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selected) loadClientData(selected) }, [selected])

  async function loadData() {
    const cls = await loadSEOClients()
    setClients(cls)
    if (clientId) setSelected(clientId)
    else if (cls.length && !selected) setSelected(cls[0].id)
  }

  async function loadClientData(cId) {
    try {
      const [{ data: conns }, { data: kws }, { data: rpts }] = await Promise.all([
        supabase.from('seo_connections').select('*').eq('client_id', cId),
        supabase.from('seo_keyword_tracking').select('*').eq('client_id', cId).order('tracked_at', { ascending: false }).limit(100),
        supabase.from('seo_reports').select('*').eq('client_id', cId).order('generated_at', { ascending: false }).limit(5),
      ])
      setConnections(conns || [])
      setKeywords(kws || [])
      setReports(rpts || [])
    } catch {}
  }

  async function generateAIAnalysis() {
    if (!selected) return
    setGenerating(true)
    try {
      const client = clients.find(c => c.id === selected)
      const result = await callClaude(
        'You are a senior SEO strategist. Provide a comprehensive SEO analysis.',
        `Analyze the SEO opportunity for "${client?.name || 'this business'}". They have ${keywords.length} tracked keywords and ${connections.length} connected data sources. Provide: 1) Executive summary (2 sentences), 2) Overall score 0-100, 3) Top 5 opportunities with impact/effort ratings, 4) Quick wins list, 5) Monthly action plan. Return as JSON with keys: executiveSummary, overallScore, opportunities (array), quickWins (array), actionPlan (object with week1-week4 arrays).`,
        2000
      )
      let parsed
      try { parsed = JSON.parse(result.replace(/```json|```/g, '').trim()) } catch { parsed = { executiveSummary: result, overallScore: 65 } }
      setAnalysis(parsed)
      toast.success('Analysis generated')
    } catch (e) { toast.error('Analysis failed: ' + e.message) }
    setGenerating(false)
  }

  const selectedClient = clients.find(c => c.id === selected)
  const connMap = {}
  connections.forEach(c => { connMap[c.provider] = c })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        {/* Header */}
        <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200 bg-white">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-2"><TrendingUp size={22} className="text-green-500" /> SEO & AEO Hub</h1>
              <p className="text-sm text-gray-700 mt-0.5">Intelligence across all channels</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate('/seo/connect')} className="btn-secondary text-sm"><Link2 size={13} /> Connect Data</button>
              <button onClick={generateAIAnalysis} disabled={generating} className="btn-primary text-sm">
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {generating ? 'Analyzing...' : 'AI Analysis'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Client selector */}
          <div className="md:w-56 bg-white md:border-r border-b md:border-b-0 border-gray-200 flex-shrink-0">
            <div className="p-3">
              <p className="text-[12px] font-semibold text-gray-700 uppercase tracking-wider mb-2 px-1">Clients</p>
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                {clients.map(c => {
                  const conns = c.connections || {}
                  const connCount = Object.values(conns).filter(Boolean).length
                  return (
                    <button key={c.id} onClick={() => setSelected(c.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors whitespace-nowrap md:whitespace-normal w-full flex-shrink-0 ${selected === c.id ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connCount >= 3 ? 'bg-green-500' : connCount > 0 ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                      <span className="text-sm truncate">{c.name}</span>
                    </button>
                  )
                })}
              </div>
              {clients.length === 0 && <p className="text-sm text-gray-700 text-center py-4">No clients yet</p>}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {!selected ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <TrendingUp size={48} className="text-gray-600 mb-4" />
                <h2 className="text-lg font-bold text-gray-700 mb-2">Select a Client</h2>
                <p className="text-sm text-gray-700">Choose a client to view their SEO intelligence</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex overflow-x-auto border-b border-gray-200 bg-white" style={{ scrollbarWidth: 'none' }}>
                  {TABS.map(t => {
                    const I = t.icon
                    return <button key={t.key} onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${tab === t.key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-700 hover:text-gray-700'}`}>
                      <I size={14} /> {t.label}
                    </button>
                  })}
                </div>

                <div className="p-4 md:p-6">
                  {/* OVERVIEW TAB */}
                  {tab === 'overview' && (
                    <div className="space-y-6">
                      {/* Connection status */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Data Sources</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          {PROVIDERS.map(p => {
                            const conn = connMap[p.key]
                            const I = p.icon
                            return (
                              <div key={p.key} className="bg-white rounded-xl border border-gray-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <I size={16} style={{ color: p.color }} />
                                  <span className="text-sm font-medium text-gray-800">{p.label}</span>
                                </div>
                                <p className="text-[13px] text-gray-700 mb-2">{p.desc}</p>
                                {conn?.connected ? (
                                  <span className="text-[13px] font-semibold text-green-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected</span>
                                ) : (
                                  <button onClick={() => navigate('/seo/connect')} className="text-[13px] font-semibold text-orange-500 hover:text-orange-700">Connect →</button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* AI Analysis */}
                      {analysis && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">AI Analysis</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-black" style={{ color: (analysis.overallScore || 0) >= 70 ? '#22c55e' : (analysis.overallScore || 0) >= 50 ? '#f59e0b' : '#ef4444' }}>{analysis.overallScore || '—'}</span>
                              <span className="text-sm text-gray-700">/ 100</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">{analysis.executiveSummary}</p>
                          {analysis.opportunities && (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-gray-700 uppercase">Top Opportunities</p>
                              {(analysis.opportunities || []).slice(0, 5).map((opp, i) => (
                                <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                                  <span className="text-sm font-bold text-green-600 mt-0.5">{i + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800">{opp.title || opp}</p>
                                    {opp.description && <p className="text-sm text-gray-700 mt-0.5">{opp.description}</p>}
                                  </div>
                                  {opp.impact && <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${opp.impact === 'high' ? 'bg-red-100 text-red-700' : opp.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{opp.impact}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Keyword snapshot */}
                      {keywords.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Tracked Keywords</h3>
                            <button onClick={() => setTab('keywords')} className="text-sm text-green-600 hover:text-green-700">View all →</button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <StatMini label="Total Keywords" value={keywords.length} />
                            <StatMini label="Avg Position" value={Math.round((keywords.reduce((a, k) => a + (k.current_position || 0), 0) / keywords.length) * 10) / 10 || '—'} />
                            <StatMini label="In Top 10" value={keywords.filter(k => k.current_position && k.current_position <= 10).length} />
                            <StatMini label="Total Clicks" value={keywords.reduce((a, k) => a + (k.clicks || 0), 0)} />
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table className="w-full text-sm" style={{ minWidth: 500 }}>
                              <thead><tr className="border-b border-gray-100 text-gray-700"><th className="text-left py-2 font-medium">Keyword</th><th className="text-right py-2 font-medium">Pos</th><th className="text-right py-2 font-medium">Vol</th><th className="text-right py-2 font-medium">Clicks</th><th className="text-right py-2 font-medium">CTR</th></tr></thead>
                              <tbody>
                                {keywords.slice(0, 10).map((k, i) => (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="py-2 text-gray-800 font-medium">{k.keyword}</td>
                                    <td className="py-2 text-right"><PositionBadge pos={k.current_position} prev={k.previous_position} /></td>
                                    <td className="py-2 text-right text-gray-700">{k.search_volume || '—'}</td>
                                    <td className="py-2 text-right text-gray-700">{k.clicks || 0}</td>
                                    <td className="py-2 text-right text-gray-700">{k.ctr ? `${(k.ctr * 100).toFixed(1)}%` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Recent reports */}
                      {reports.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Reports</h3>
                          {reports.map(r => (
                            <div key={r.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                              <FileText size={14} className="text-gray-700" />
                              <div className="flex-1 min-w-0"><p className="text-sm text-gray-700 truncate">{r.title || r.report_type}</p><p className="text-[13px] text-gray-700">{r.generated_at ? new Date(r.generated_at).toLocaleDateString() : ''}</p></div>
                              <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${r.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!analysis && keywords.length === 0 && (
                        <div className="text-center py-16">
                          <Sparkles size={40} className="text-gray-600 mx-auto mb-4" />
                          <h3 className="text-base font-semibold text-gray-700 mb-2">Ready to Analyze</h3>
                          <p className="text-sm text-gray-700 mb-4 max-w-md mx-auto">Connect data sources or run an AI analysis to see SEO intelligence for {selectedClient?.name}</p>
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => navigate('/seo/connect')} className="btn-secondary text-sm"><Link2 size={14} /> Connect Data</button>
                            <button onClick={generateAIAnalysis} disabled={generating} className="btn-primary text-sm"><Sparkles size={14} /> Run AI Analysis</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KEYWORDS TAB */}
                  {tab === 'keywords' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Keyword Tracking</h3>
                        <button className="btn-secondary text-sm"><Plus size={12} /> Add Keywords</button>
                      </div>
                      {keywords.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                          <Search size={32} className="text-gray-600 mx-auto mb-3" />
                          <p className="text-sm text-gray-700">No keywords tracked yet. Connect Search Console or add keywords manually.</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ overflowX: 'auto' }}>
                          <table className="w-full text-sm" style={{ minWidth: 600 }}>
                            <thead><tr className="bg-gray-50 border-b text-gray-700"><th className="text-left px-4 py-2.5 font-semibold">Keyword</th><th className="text-right px-3 py-2.5 font-semibold">Position</th><th className="text-right px-3 py-2.5 font-semibold">Volume</th><th className="text-right px-3 py-2.5 font-semibold">Impressions</th><th className="text-right px-3 py-2.5 font-semibold">Clicks</th><th className="text-right px-3 py-2.5 font-semibold">CTR</th></tr></thead>
                            <tbody>
                              {keywords.map((k, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5 font-medium text-gray-800">{k.keyword}</td>
                                  <td className="px-3 py-2.5 text-right"><PositionBadge pos={k.current_position} prev={k.previous_position} /></td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{k.search_volume || '—'}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{k.impressions || 0}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{k.clicks || 0}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{k.ctr ? `${(k.ctr * 100).toFixed(1)}%` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PPC TAB */}
                  {tab === 'ppc' && (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                      <DollarSign size={32} className="text-gray-600 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-700 mb-2">PPC Intelligence</h3>
                      <p className="text-sm text-gray-700 mb-4">Connect Google Ads to analyze campaign performance, find wasted spend, and optimize budgets.</p>
                      <button onClick={() => navigate('/seo/connect')} className="btn-primary text-sm"><Link2 size={14} /> Connect Google Ads</button>
                    </div>
                  )}

                  {/* GMB TAB */}
                  {tab === 'gmb' && (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                      <MapPin size={32} className="text-gray-600 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-700 mb-2">Google Business Profile</h3>
                      <p className="text-sm text-gray-700 mb-4">Connect GBP to monitor reviews, optimize your listing, and track local performance.</p>
                      <button onClick={() => navigate('/seo/connect')} className="btn-primary text-sm"><Link2 size={14} /> Connect GBP</button>
                    </div>
                  )}

                  {/* CONTENT TAB */}
                  {tab === 'content' && (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                      <FileText size={32} className="text-gray-600 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-700 mb-2">SEO Content Studio</h3>
                      <p className="text-sm text-gray-700 mb-4">Generate AI-powered blog posts, location pages, GMB posts, and FAQ content optimized for search.</p>
                      <button onClick={generateAIAnalysis} disabled={generating} className="btn-primary text-sm"><Sparkles size={14} /> Generate Content</button>
                    </div>
                  )}

                  {/* AEO TAB */}
                  {tab === 'aeo' && (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                      <Sparkles size={32} className="text-gray-600 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-700 mb-2">Answer Engine Optimization</h3>
                      <p className="text-sm text-gray-700 mb-4 max-w-md mx-auto">Optimize for AI answer engines (Google AI Overviews, ChatGPT, Perplexity), voice search, and featured snippets.</p>
                      <button onClick={generateAIAnalysis} disabled={generating} className="btn-primary text-sm"><Sparkles size={14} /> Analyze AEO Readiness</button>
                    </div>
                  )}

                  {/* REPORTS TAB */}
                  {tab === 'reports' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Reports</h3>
                        <button onClick={generateAIAnalysis} disabled={generating} className="btn-primary text-sm"><Sparkles size={12} /> Generate Report</button>
                      </div>
                      {reports.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                          <FileText size={32} className="text-gray-600 mx-auto mb-3" />
                          <p className="text-sm text-gray-700">No reports yet. Generate your first SEO report.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {reports.map(r => (
                            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                              <FileText size={18} className="text-green-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800">{r.title || r.report_type}</p>
                                <p className="text-sm text-gray-700">{r.generated_at ? new Date(r.generated_at).toLocaleDateString() : ''}</p>
                              </div>
                              <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${r.shared_with_client ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.shared_with_client ? 'Shared' : r.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StatMini({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-lg font-extrabold text-gray-800">{value}</p>
      <p className="text-[13px] text-gray-700 font-medium">{label}</p>
    </div>
  )
}

function PositionBadge({ pos, prev }) {
  if (!pos) return <span className="text-gray-700">—</span>
  const diff = prev ? prev - pos : 0
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`font-bold ${pos <= 3 ? 'text-green-600' : pos <= 10 ? 'text-blue-600' : pos <= 20 ? 'text-yellow-600' : 'text-gray-700'}`}>{Math.round(pos * 10) / 10}</span>
      {diff > 0 && <ArrowUp size={10} className="text-green-500" />}
      {diff < 0 && <ArrowDown size={10} className="text-red-500" />}
      {diff === 0 && prev && <Minus size={10} className="text-gray-700" />}
    </span>
  )
}
