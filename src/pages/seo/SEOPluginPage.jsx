"use client";
import { useState, useEffect } from 'react'
import { Puzzle, Globe, Check, RefreshCw, ExternalLink, FileText, Zap, BarChart2, Link2, Send, Plus, Trash2, Loader2, TrendingUp, X } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const QUICK_ACTIONS = [
  { key: 'generateBatch', label: 'Generate Local Pages', icon: FileText, color: '#E8551A', desc: 'AI-write geo-targeted service pages' },
  { key: 'generateRecommendations', label: 'AI Recommendations', icon: Zap, color: '#10b981', desc: 'Claude analyzes site and generates SEO priorities' },
  { key: 'generateStrategy', label: 'Build SEO Strategy', icon: TrendingUp, color: '#3b82f6', desc: 'Full SEO roadmap for this site' },
  { key: 'runAutomation', label: 'Run Automation', icon: RefreshCw, color: '#8b5cf6', desc: 'Execute automation queue now' },
  { key: 'rebuildSitemap', label: 'Rebuild Sitemap', icon: Globe, color: '#f59e0b', desc: 'Regenerate XML sitemap' },
  { key: 'syncGSC', label: 'Sync Search Console', icon: BarChart2, color: '#06b6d4', desc: 'Pull latest ranking data' },
  { key: 'linksAudit', label: 'Link Audit', icon: Link2, color: '#ec4899', desc: 'Find broken links' },
  { key: 'pingSearchEngines', label: 'Ping Engines', icon: Send, color: '#22c55e', desc: 'Notify Google/Bing of new content' },
]

export default function SEOPluginPage() {
  const [sites, setSites] = useState([])
  const [selected, setSelected] = useState(null)
  const [clients, setClients] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ url: '', apiKey: '', clientId: '' })
  const [testing, setTesting] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [actionResult, setActionResult] = useState(null)
  const [tab, setTab] = useState('actions')

  useEffect(() => { loadSites(); loadClients() }, [])

  async function loadSites() {
    try {
      const { data } = await supabase.from('lucy_wp_sites').select('*, clients(name)').order('created_at', { ascending: false })
      setSites(data || [])
      if (data?.length && !selected) setSelected(data[0])
    } catch { setSites([]) }
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id, name').order('name')
    setClients(data || [])
  }

  async function connectSite() {
    if (!form.url || !form.apiKey) { toast.error('URL and API key required'); return }
    setTesting(true)
    try {
      const cleanUrl = form.url.replace(/\/$/, '')
      // Try to connect to the plugin API
      let siteName = cleanUrl
      try {
        const res = await fetch(`${cleanUrl}/wp-json/hlseo/v1/site/info`, { headers: { 'Authorization': `Bearer ${form.apiKey}`, 'X-HLSEO-Key': form.apiKey } })
        if (res.ok) { const info = await res.json(); siteName = info.site_name || cleanUrl }
      } catch {}

      await supabase.from('lucy_wp_sites').upsert({ url: cleanUrl, api_key: form.apiKey, client_id: form.clientId || null, site_name: siteName, connected: true, last_synced: new Date().toISOString() }, { onConflict: 'url' })
      toast.success('Site connected!'); setAdding(false); setForm({ url: '', apiKey: '', clientId: '' }); loadSites()
    } catch (e) { toast.error(e.message) }
    setTesting(false)
  }

  async function triggerAction(action) {
    if (!selected) return
    setActiveAction(action); setActionResult(null)
    try {
      const res = await fetch(`${selected.url}/wp-json/hlseo/v1/${action === 'rebuildSitemap' ? 'sitemap/rebuild' : action === 'syncGSC' ? 'gsc/sync' : action === 'linksAudit' ? 'links/audit' : action === 'pingSearchEngines' ? 'ping/search-engines' : action === 'runAutomation' ? 'automation/run-now' : action === 'generateRecommendations' ? 'recommendations/generate' : action === 'generateStrategy' ? 'strategy/generate' : 'generate/batch'}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${selected.api_key}`, 'X-HLSEO-Key': selected.api_key, 'Content-Type': 'application/json' }, body: '{}'
      })
      const data = await res.json()
      setActionResult({ success: res.ok, data })
      toast[res.ok ? 'success' : 'error'](res.ok ? 'Action completed!' : data.message || 'Failed')
    } catch (e) { toast.error('Connection failed: ' + e.message) }
    setActiveAction(null)
  }

  async function deleteSite(id) {
    if (!confirm('Remove this site?')) return
    await supabase.from('lucy_wp_sites').delete().eq('id', id)
    setSites(s => s.filter(x => x.id !== id))
    if (selected?.id === id) setSelected(null)
    toast.success('Removed')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2"><Puzzle size={22} className="text-purple-500" /> WordPress Plugin</h1>
              <p className="text-sm text-gray-500 mt-0.5">Connect WordPress sites with HyperLocal SEO Pro</p>
            </div>
            <button onClick={() => setAdding(true)} className="btn-primary text-sm"><Plus size={14} /> Connect Site</button>
          </div>

          {/* Add site form */}
          {adding && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Connect WordPress Site</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div><label className="text-xs text-gray-500 block mb-1">Site URL *</label><input className="input text-sm" placeholder="https://clientsite.com" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Plugin API Key *</label><input className="input text-sm" type="password" placeholder="From WP → HyperLocal SEO → Agency" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Client</label><select className="input text-sm" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}><option value="">— None —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <div className="flex gap-2">
                <button onClick={connectSite} disabled={testing} className="btn-primary text-sm">{testing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} {testing ? 'Connecting...' : 'Test & Connect'}</button>
                <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* No sites */}
          {sites.length === 0 && !adding && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <Puzzle size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Sites Connected</h3>
              <p className="text-sm text-gray-400 mb-6">Connect WordPress sites with the HyperLocal SEO Pro plugin to manage everything from Lucy.</p>
              <div className="bg-gray-50 rounded-xl p-4 max-w-md mx-auto text-left mb-6">
                <p className="text-xs font-semibold text-gray-600 mb-2">Setup Steps:</p>
                {['Install HyperLocal SEO Pro on WordPress', 'Go to WordPress → HyperLocal SEO → Agency Connect', 'Generate API key and copy it', 'Click "Connect Site" and paste the key'].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5"><span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span><span className="text-xs text-gray-600">{s}</span></div>
                ))}
              </div>
              <button onClick={() => setAdding(true)} className="btn-primary text-sm">Connect Your First Site</button>
            </div>
          )}

          {/* Sites + selected */}
          {sites.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
              {/* Sites list */}
              <div className="space-y-2">
                {sites.map(site => (
                  <div key={site.id} onClick={() => setSelected(site)}
                    className={`rounded-xl p-3 cursor-pointer transition-colors border ${selected?.id === site.id ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{site.site_name || site.url}</p>
                        <p className="text-[10px] text-gray-400">{site.clients?.name || 'No client'}</p>
                        <div className="flex items-center gap-1 mt-1"><div className={`w-1.5 h-1.5 rounded-full ${site.connected ? 'bg-green-500' : 'bg-red-400'}`} /><span className="text-[10px] text-gray-400">{site.connected ? 'Connected' : 'Offline'}</span></div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteSite(site.id) }} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected site */}
              {selected && (
                <div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div>
                      <p className="text-base font-semibold text-gray-800">{selected.site_name}</p>
                      <a href={selected.url} target="_blank" rel="noreferrer" className="text-xs text-brand-500 flex items-center gap-1">{selected.url} <ExternalLink size={10} /></a>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${selected.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selected.connected ? 'Connected' : 'Offline'}</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex overflow-x-auto bg-white rounded-t-xl border border-gray-200 border-b-0" style={{ scrollbarWidth: 'none' }}>
                    {['actions', 'generate', 'data'].map(t => (
                      <button key={t} onClick={() => setTab(t)} className={`flex-shrink-0 px-4 py-3 text-xs font-medium capitalize ${tab === t ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-500 border-b-2 border-transparent'}`}>{t}</button>
                    ))}
                  </div>
                  <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-4">
                    {tab === 'actions' && (
                      <div>
                        <p className="text-xs text-gray-500 mb-3">Trigger plugin actions on <strong>{selected.site_name}</strong></p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {QUICK_ACTIONS.map(a => {
                            const I = a.icon
                            return (
                              <button key={a.key} onClick={() => triggerAction(a.key)} disabled={!!activeAction}
                                className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl text-left hover:bg-gray-100 transition-colors disabled:opacity-40">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.color + '20' }}>
                                  {activeAction === a.key ? <Loader2 size={16} className="animate-spin" style={{ color: a.color }} /> : <I size={16} style={{ color: a.color }} />}
                                </div>
                                <div><p className="text-sm font-medium text-gray-800">{a.label}</p><p className="text-[10px] text-gray-400">{a.desc}</p></div>
                              </button>
                            )
                          })}
                        </div>
                        {actionResult && (
                          <div className={`mt-4 rounded-xl p-3 ${actionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <p className="text-xs font-semibold mb-1">{actionResult.success ? '✅ Success' : '❌ Failed'}</p>
                            <pre className="text-[10px] text-gray-600 overflow-auto max-h-32">{JSON.stringify(actionResult.data, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                    {tab === 'generate' && (
                      <div className="text-center py-8">
                        <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-4">Generate AI-powered pages directly on the WordPress site.</p>
                        <button onClick={() => triggerAction('generateBatch')} disabled={!!activeAction} className="btn-primary text-sm"><Zap size={14} /> Generate Pages</button>
                      </div>
                    )}
                    {tab === 'data' && (
                      <div className="text-center py-8">
                        <BarChart2 size={32} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-4">Sync rankings and analytics from the plugin.</p>
                        <button onClick={() => triggerAction('syncGSC')} disabled={!!activeAction} className="btn-primary text-sm"><RefreshCw size={14} /> Sync Data</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
