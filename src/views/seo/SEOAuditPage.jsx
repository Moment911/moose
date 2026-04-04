"use client";
import { useState } from 'react'
import { Search, Globe, Zap, AlertTriangle, CheckCircle, TrendingUp, Download, Share2, Shield, FileText, Link2, Smartphone, BarChart2, Star, ChevronDown, ChevronUp, Loader2, Target, Plus, X } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { callClaude } from '../../lib/ai'
import { callChatGPT } from '../../lib/openaiService'
import toast from 'react-hot-toast'

function scoreColor(s) { return s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#ef4444' : '#dc2626' }
function sevColor(s) { return s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#10b981' }
function sevBg(s) { return s === 'critical' ? '#fef2f2' : s === 'warning' ? '#fffbeb' : '#f0fdf4' }

export default function SEOAuditPage() {
  const [url, setUrl] = useState('')
  const [bizName, setBizName] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [competitors, setCompetitors] = useState([''])
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [expanded, setExpanded] = useState(null)

  async function runAudit() {
    if (!url.trim()) { toast.error('Enter a URL'); return }
    const cleanUrl = url.startsWith('http') ? url : 'https://' + url
    setLoading(true); setAudit(null)

    try {
      // 1. Fetch page data
      setStep('Fetching page data...')
      const pageData = await fetchPage(cleanUrl)

      // 2. PageSpeed Insights (free Google API)
      setStep('Running PageSpeed analysis...')
      const speed = await fetchPageSpeed(cleanUrl)

      // 3. Claude audit
      setStep('Running Claude AI audit...')
      const claudeResult = await runClaudeAudit(cleanUrl, bizName, industry, location, pageData, speed)

      // 4. GPT audit (optional)
      setStep('Running GPT-4o analysis...')
      const gptResult = await runGPTAudit(cleanUrl, bizName, industry, location, pageData, speed)

      // 5. Combine
      setStep('Building report...')
      const issues = [...(claudeResult?.issues || [])]
      if (gptResult?.googleAlgorithmIssues) {
        gptResult.googleAlgorithmIssues.filter(i => i.status !== 'passing').forEach(i => {
          issues.push({ category: 'technical', severity: 'warning', title: i.factor, description: i.impact, fix: i.fix, priorityScore: 60 })
        })
      }
      issues.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))

      const avgScore = Math.round(((claudeResult?.overallScore || 50) + (gptResult?.overallScore || 50)) / 2)

      setAudit({
        url: cleanUrl, businessName: bizName || cleanUrl.replace(/https?:\/\/(www\.)?/, '').split('/')[0],
        generatedAt: new Date().toISOString(),
        overallScore: avgScore, grade: avgScore >= 85 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 55 ? 'C' : avgScore >= 40 ? 'D' : 'F',
        scores: claudeResult?.scores || {},
        executiveSummary: claudeResult?.executiveSummary || '',
        pitchHeadline: claudeResult?.pitchHeadline || `This website is leaving traffic on the table`,
        revenueImpact: claudeResult?.revenueImpact || '',
        urgencyFactors: gptResult?.urgencyFactors || [],
        issues, quickWins: claudeResult?.quickWins || [], strengths: claudeResult?.strengths || [],
        pageSpeed: speed, pageData,
        localSEO: claudeResult?.localSEOAnalysis || '',
        aeoAnalysis: claudeResult?.aeoAnalysis || '',
        aiSearchReadiness: gptResult?.aiSearchReadiness || 50,
        eeAtScore: gptResult?.eeAtScore || 50,
        keywordOpps: claudeResult?.topKeywordOpportunities || [],
        contentGaps: claudeResult?.contentGaps || [],
        schemaOpps: gptResult?.schemaOpportunities || [],
        trafficOpp: claudeResult?.estimatedTrafficOpportunity || '',
      })
      setActiveTab('overview')
      toast.success('Audit complete!')
    } catch (e) { toast.error('Audit failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  async function fetchPage(u) {
    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`)
      const data = await res.json()
      const html = data.contents || ''
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || ''
      const desc = html.match(/name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || ''
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || ''
      return { url: u, title, titleLen: title.length, desc, descLen: desc.length, h1, hasSchema: html.includes('application/ld+json'), hasSSL: u.startsWith('https'), hasOG: html.includes('og:title'), hasCanonical: html.includes('rel="canonical"'), imgCount: (html.match(/<img/gi) || []).length, imgNoAlt: (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length, wordCount: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length }
    } catch { return { url: u, error: true, hasSSL: u.startsWith('https') } }
  }

  async function fetchPageSpeed(u) {
    try {
      const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(u)}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`)
      const data = await res.json()
      const cats = data.lighthouseResult?.categories || {}
      const audits = data.lighthouseResult?.audits || {}
      return { performance: Math.round((cats.performance?.score || 0) * 100), seo: Math.round((cats.seo?.score || 0) * 100), accessibility: Math.round((cats.accessibility?.score || 0) * 100), bestPractices: Math.round((cats['best-practices']?.score || 0) * 100), fcp: audits['first-contentful-paint']?.displayValue || 'N/A', lcp: audits['largest-contentful-paint']?.displayValue || 'N/A', cls: audits['cumulative-layout-shift']?.displayValue || 'N/A', tbt: audits['total-blocking-time']?.displayValue || 'N/A' }
    } catch { return { performance: null, seo: null } }
  }

  async function runClaudeAudit(u, biz, ind, loc, pd, sp) {
    const prompt = `SEO audit for ${u}. Business: ${biz || 'Unknown'}, Industry: ${ind || 'N/A'}, Location: ${loc || 'N/A'}. Title: "${pd.title}" (${pd.titleLen} chars), Desc: ${pd.descLen} chars, H1: "${pd.h1}", SSL: ${pd.hasSSL}, Schema: ${pd.hasSchema}, OG: ${pd.hasOG}, Imgs: ${pd.imgCount} (${pd.imgNoAlt} no alt). Performance: ${sp.performance}/100, SEO: ${sp.seo}/100, LCP: ${sp.lcp}, CLS: ${sp.cls}. Return JSON: {overallScore:0-100, grade:"A-F", executiveSummary:"", pitchHeadline:"", revenueImpact:"", issues:[{category:"technical|content|local|performance|mobile|aeo",severity:"critical|warning|opportunity",title:"",description:"",impact:"",fix:"",effort:"easy|medium|hard",priorityScore:0-100}], quickWins:[], strengths:[], scores:{technical:0-100,content:0-100,local:0-100,performance:0-100,mobile:0-100,backlinks:0-100,gmb:0-100,aeo:0-100}, localSEOAnalysis:"", aeoAnalysis:"", topKeywordOpportunities:[{keyword:"",intent:"",difficulty:"",opportunity:""}], contentGaps:[], estimatedTrafficOpportunity:""}`
    const r = await callClaude('Senior SEO auditor for client pitch. Return valid JSON only, no markdown.', prompt, 3000)
    try { return JSON.parse(r.replace(/```json|```/g, '').trim()) } catch { return { executiveSummary: r, overallScore: 50, issues: [] } }
  }

  async function runGPTAudit(u, biz, ind, loc, pd, sp) {
    const prompt = `SEO audit for ${u}. Business: ${biz}, Industry: ${ind}, Location: ${loc}. Performance: ${sp.performance}/100, SEO: ${sp.seo}/100, Schema: ${pd.hasSchema}, SSL: ${pd.hasSSL}. Focus on E-E-A-T, algorithm alignment, AEO readiness. Return JSON: {overallScore:0-100, grade:"A-F", executiveSummary:"", googleAlgorithmIssues:[{factor:"",status:"passing|failing",impact:"",fix:""}], eeAtScore:0-100, aiSearchReadiness:0-100, schemaOpportunities:[], urgencyFactors:[], estimatedPPCWaste:""}`
    const r = await callChatGPT(prompt, { maxTokens: 2000 })
    if (!r) return null
    try { return JSON.parse(r.replace(/```json|```/g, '').trim()) } catch { return null }
  }

  function downloadReport() {
    if (!audit) return
    const text = `Moose SEO Audit Report\n${audit.url}\nScore: ${audit.overallScore}/100 (${audit.grade})\n\n${audit.executiveSummary}\n\nPitch: ${audit.pitchHeadline}\n\nIssues (${audit.issues.length}):\n${audit.issues.map(i => `[${i.severity}] ${i.title}: ${i.fix}`).join('\n')}\n\nQuick Wins:\n${audit.quickWins.map(w => '• ' + w).join('\n')}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lucyseo-audit-${audit.businessName.replace(/\s+/g, '-')}.txt`
    a.click()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-2">
              <Zap size={22} className="text-yellow-500" /> URL Audit & Client Pitch
              <span className="text-[13px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">Moose SEO</span>
            </h1>
            <p className="text-sm text-gray-700 mt-1">Enter any URL for an instant AI-powered SEO audit. Perfect for client pitches.</p>
          </div>

          {/* Input form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Website URL *</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Globe size={18} className="text-gray-700" />
                <input className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400" placeholder="https://clientwebsite.com" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAudit()} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div><label className="text-sm text-gray-700 block mb-1">Business Name</label><input className="input text-sm" placeholder="Acme Plumbing" value={bizName} onChange={e => setBizName(e.target.value)} /></div>
              <div><label className="text-sm text-gray-700 block mb-1">Industry</label><input className="input text-sm" placeholder="Plumbing / HVAC" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
              <div><label className="text-sm text-gray-700 block mb-1">Location</label><input className="input text-sm" placeholder="Miami, FL" value={location} onChange={e => setLocation(e.target.value)} /></div>
            </div>
            {/* Competitors */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-600">Competitors <span className="text-gray-700 font-normal">(optional)</span></label>
                {competitors.length < 5 && <button onClick={() => setCompetitors([...competitors, ''])} className="text-sm text-brand-500 hover:text-brand-700 flex items-center gap-1"><Plus size={12} /> Add</button>}
              </div>
              {competitors.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <Target size={14} className="text-gray-700" />
                    <input className="flex-1 bg-transparent text-sm outline-none" placeholder={`https://competitor${i + 1}.com`} value={c} onChange={e => { const n = [...competitors]; n[i] = e.target.value; setCompetitors(n) }} />
                  </div>
                  <button onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-500 p-1"><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={runAudit} disabled={loading || !url.trim()} className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #ea2729, #ea2729)', boxShadow: loading ? 'none' : '0 4px 14px rgba(232,85,26,0.3)' }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> {step}</> : <><Search size={16} /> Run Full SEO Audit <span className="text-sm opacity-70">Claude + GPT-4o</span></>}
            </button>
          </div>

          {/* RESULTS */}
          {audit && (
            <>
              {/* Score card */}
              <div className="rounded-2xl p-5 md:p-6 mb-5 text-white" style={{ background: 'linear-gradient(135deg, #111827, #1f2937)' }}>
                <div className="flex flex-col md:flex-row gap-5 items-start">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 mb-1">{audit.businessName} &middot; {new Date(audit.generatedAt).toLocaleDateString()}</p>
                    <h2 className="text-lg md:text-xl font-extrabold text-white mb-2">{audit.pitchHeadline}</h2>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{audit.executiveSummary}</p>
                    {audit.urgencyFactors.slice(0, 2).map((u, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-red-500/15 border border-red-500/30 rounded-lg px-2.5 py-1 text-sm text-red-300 mr-2 mb-1"><AlertTriangle size={11} /> {u}</span>
                    ))}
                    <div className="mt-3">{audit.quickWins.slice(0, 3).map((w, i) => <p key={i} className="text-sm text-gray-600 flex items-center gap-2 mb-1"><CheckCircle size={12} className="text-green-400" /> {w}</p>)}</div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto relative" style={{ background: `conic-gradient(${scoreColor(audit.overallScore)} ${audit.overallScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)` }}>
                      <div className="absolute inset-1.5 rounded-full bg-gray-800 flex flex-col items-center justify-center">
                        <span className="text-2xl font-extrabold" style={{ color: scoreColor(audit.overallScore) }}>{audit.overallScore}</span>
                        <span className="text-[13px] text-gray-700">/ 100</span>
                      </div>
                    </div>
                    <p className="text-lg font-extrabold mt-2" style={{ color: scoreColor(audit.overallScore) }}>Grade {audit.grade}</p>
                    <p className="text-sm text-gray-700">{audit.issues.filter(i => i.severity === 'critical').length} critical &middot; {audit.issues.filter(i => i.severity === 'warning').length} warnings</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={downloadReport} className="flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium hover:bg-white/20"><Download size={14} /> Download</button>
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(audit, null, 2)); toast.success('Copied!') }} className="flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium hover:bg-white/20"><Share2 size={14} /> Copy JSON</button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex overflow-x-auto bg-white rounded-t-xl border border-gray-200 border-b-0" style={{ scrollbarWidth: 'none' }}>
                {['overview', 'issues', 'performance', 'aeo', 'keywords'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} className={`flex-shrink-0 px-4 py-3 text-sm font-medium capitalize ${activeTab === t ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-700'}`}>{t}</button>
                ))}
              </div>
              <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-4 md:p-5 mb-6">
                {activeTab === 'overview' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      {[{ k: 'technical', l: 'Technical', i: Shield }, { k: 'content', l: 'Content', i: FileText }, { k: 'performance', l: 'Speed', i: Zap }, { k: 'local', l: 'Local', i: Target }, { k: 'mobile', l: 'Mobile', i: Smartphone }, { k: 'aeo', l: 'AEO', i: BarChart2 }, { k: 'backlinks', l: 'Links', i: Link2 }, { k: 'gmb', l: 'GMB', i: Star }].map(c => {
                        const s = audit.scores[c.k] || 0; const I = c.i
                        return <div key={c.k} className="bg-gray-50 rounded-xl p-3 border border-gray-100"><div className="flex items-center justify-between mb-1"><I size={14} style={{ color: scoreColor(s) }} /><span className="text-lg font-extrabold" style={{ color: scoreColor(s) }}>{s}</span></div><p className="text-[13px] text-gray-600 font-medium">{c.l}</p><div className="h-1 bg-gray-200 rounded-full mt-1.5"><div className="h-full rounded-full" style={{ width: `${s}%`, background: scoreColor(s) }} /></div></div>
                      })}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[{ l: 'SSL', v: audit.pageData?.hasSSL }, { l: 'Schema', v: audit.pageData?.hasSchema }, { l: 'OG Tags', v: audit.pageData?.hasOG }, { l: 'Canonical', v: audit.pageData?.hasCanonical }].map(d => (
                        <div key={d.l} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">{d.l}</span>
                          {d.v ? <CheckCircle size={14} className="text-green-500" /> : <X size={14} className="text-red-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'issues' && (
                  <div className="space-y-2">
                    {audit.issues.map((issue, i) => (
                      <div key={i} className="rounded-lg overflow-hidden" style={{ background: sevBg(issue.severity), borderLeft: `4px solid ${sevColor(issue.severity)}` }}>
                        <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="text-sm font-semibold text-gray-800">{issue.title}</p>
                            <p className="text-sm text-gray-700">{issue.category} &middot; {issue.effort || 'medium'} effort</p>
                          </div>
                          {expanded === i ? <ChevronUp size={14} className="text-gray-700" /> : <ChevronDown size={14} className="text-gray-700" />}
                        </button>
                        {expanded === i && (
                          <div className="px-4 pb-3 space-y-2">
                            {issue.impact && <p className="text-sm text-gray-600"><strong>Impact:</strong> {issue.impact}</p>}
                            <p className="text-sm text-gray-600"><strong>Description:</strong> {issue.description}</p>
                            {issue.fix && <div className="bg-white rounded-lg p-2.5 text-sm text-gray-700"><strong>Fix:</strong> {issue.fix}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'performance' && audit.pageSpeed && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[{ l: 'Performance', v: audit.pageSpeed.performance }, { l: 'SEO', v: audit.pageSpeed.seo }, { l: 'Accessibility', v: audit.pageSpeed.accessibility }, { l: 'Best Practices', v: audit.pageSpeed.bestPractices }].map(m => (
                        <div key={m.l} className="text-center bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <p className="text-3xl font-bold" style={{ color: scoreColor(m.v || 0) }}>{m.v ?? '—'}</p>
                          <p className="text-[13px] text-gray-700 mt-1">{m.l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[{ l: 'FCP', v: audit.pageSpeed.fcp }, { l: 'LCP', v: audit.pageSpeed.lcp }, { l: 'CLS', v: audit.pageSpeed.cls }, { l: 'TBT', v: audit.pageSpeed.tbt }].map(m => (
                        <div key={m.l} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <p className="text-lg font-extrabold text-gray-800">{m.v}</p>
                          <p className="text-[13px] text-gray-700">{m.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'aeo' && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{audit.aiSearchReadiness}/100</p>
                        <p className="text-sm text-blue-700 font-medium mt-1">AI Search Readiness</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-purple-600">{audit.eeAtScore}/100</p>
                        <p className="text-sm text-purple-700 font-medium mt-1">E-E-A-T Score</p>
                      </div>
                    </div>
                    {audit.aeoAnalysis && <div className="bg-gray-50 rounded-xl p-4 mb-3"><p className="text-sm text-gray-700 leading-relaxed">{audit.aeoAnalysis}</p></div>}
                    {audit.schemaOpps.length > 0 && <div><p className="text-sm font-semibold text-gray-800 mb-2">Schema Opportunities</p>{audit.schemaOpps.map((s, i) => <p key={i} className="text-sm text-gray-600 flex items-center gap-2 mb-1"><CheckCircle size={12} className="text-purple-500" /> {s}</p>)}</div>}
                  </div>
                )}
                {activeTab === 'keywords' && (
                  <div>
                    {audit.keywordOpps.length > 0 && <div className="mb-4"><p className="text-sm font-semibold text-gray-800 mb-2">Keyword Opportunities</p>{audit.keywordOpps.map((k, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 mb-2"><div><p className="text-sm font-medium text-gray-800">{k.keyword}</p><p className="text-[13px] text-gray-700">{k.intent} &middot; {k.opportunity}</p></div><span className={`text-[13px] px-2 py-0.5 rounded-full font-semibold ${k.difficulty === 'low' ? 'bg-green-100 text-green-700' : k.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{k.difficulty}</span></div>
                    ))}</div>}
                    {audit.contentGaps.length > 0 && <div><p className="text-sm font-semibold text-gray-800 mb-2">Content Gaps</p>{audit.contentGaps.map((g, i) => <p key={i} className="text-sm text-red-700 bg-red-50 border-l-4 border-orange-400 rounded-r-lg px-3 py-2 mb-1">{g}</p>)}</div>}
                    {audit.trafficOpp && <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-center mt-4"><TrendingUp size={24} className="text-brand-500 mx-auto mb-2" /><p className="text-lg font-extrabold text-brand-600">{audit.trafficOpp}</p><p className="text-sm text-brand-400">Estimated additional traffic if issues fixed</p></div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
