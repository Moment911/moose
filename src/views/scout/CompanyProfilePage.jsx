"use client";
"use client";
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Target, ChevronLeft, Star, Globe, Phone, Mail, MapPin, Copy, ExternalLink, Check, X, Plus, Loader2, Building2, Users, BarChart3, MessageSquare, FileText, Settings, Eye, MousePointer, Ban } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { supabase } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import toast from 'react-hot-toast'

function scoreColor(s) { return s >= 75 ? '#22c55e' : s >= 50 ? '#5bc6d0' : s >= 30 ? '#eab308' : '#3b82f6' }
function tempLabel(s) { return s >= 75 ? { emoji: '🔥', label: 'Hot', cls: 'text-red-500 bg-red-50' } : s >= 50 ? { emoji: '🟠', label: 'Warm', cls: 'text-brand-500 bg-red-50' } : s >= 30 ? { emoji: '🟡', label: 'Lukewarm', cls: 'text-yellow-600 bg-yellow-50' } : { emoji: '🔵', label: 'Cold', cls: 'text-blue-500 bg-blue-50' } }

export default function CompanyProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [tab, setTab] = useState('overview')
  const [notes, setNotes] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)
  const [pipelineStage, setPipelineStage] = useState('lead')

  useEffect(() => {
    if (!id) return
    // Try scout_leads first, then check if it's a stored lead in sessionStorage
    async function load() {
      try {
        const { data } = await supabase.from('scout_leads').select('*').eq('id', id).single()
        if (data) { setLead(data); setNotes(data.notes || ''); setPipelineStage(data.pipeline_stage || 'lead'); return }
      } catch {}
      // Fallback: check sessionStorage for temp lead
      const stored = sessionStorage.getItem('scout_lead_' + id)
      if (stored) {
        const parsed = JSON.parse(stored)
        setLead(parsed); setNotes(parsed.notes || ''); setPipelineStage(parsed.pipeline_stage || 'lead')
      }
    }
    load()
  }, [id])

  async function generateAISummary() {
    if (!lead) return
    setLoadingAI(true)
    try {
      const result = await callClaude(
        'You are a business analyst at a marketing agency. Write a concise company profile summary.',
        `Write a 3-sentence professional summary of "${lead.business_name}", a ${lead.industry} business in ${lead.city}, ${lead.state}. Google rating: ${lead.google_rating}/5 with ${lead.google_review_count} reviews. Their marketing gaps include: ${(lead.opportunities || []).join(', ')}. Focus on business presence and marketing opportunity.`,
        300
      )
      setAiSummary(result)
    } catch { setAiSummary('AI summary unavailable. Check your API key.') }
    setLoadingAI(false)
  }

  async function handleImport() {
    if (!lead) return
    try {
      await supabase.from('contacts').upsert({
        email: lead.email, company: lead.business_name, phone: lead.phone,
        website: lead.website, city: lead.city, state: lead.state, zip_code: lead.zip_code,
        lead_source: 'SCOUT', lead_status: 'new', lifecycle_stage: 'lead',
        tags: ['SCOUT Import', lead.temperature === 'hot' ? 'Hot Lead' : 'SCOUT Lead'],
        status: 'subscribed',
      }, { onConflict: 'email' })
      toast.success('Imported to contacts!')
    } catch { toast.error('Import failed') }
  }

  async function saveNotes() {
    if (!lead?.id) return
    await supabase.from('scout_leads').update({ notes }).eq('id', lead.id).catch(() => {})
    toast.success('Notes saved')
  }

  function copy(text) { navigator.clipboard.writeText(text); toast.success('Copied') }

  if (!lead) return (
    <ScoutLayout>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center"><Loader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" /><p className="text-sm text-slate-400">Loading profile...</p></div>
      </div>
    </ScoutLayout>
  )

  const temp = tempLabel(lead.agency_likelihood_score || 50)
  const ts = lead.tech_stack || {}
  const sm = lead.social_media || {}
  const sent = lead.review_sentiment || { positive: 70, neutral: 20, negative: 10 }
  const domain = lead.website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null

  const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'tech', label: 'Technology', icon: Settings },
    { key: 'social', label: 'Social & Reviews', icon: Star },
    { key: 'marketing', label: 'Marketing Analysis', icon: Target },
    { key: 'contact', label: 'Contact Info', icon: Phone },
    { key: 'notes', label: 'Notes', icon: FileText },
  ]

  return (
    <ScoutLayout>
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white"><ChevronLeft size={18} /></button>
        {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 rounded-xl bg-white p-1 object-contain flex-shrink-0" onError={e => e.target.style.display = 'none'} />}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-white truncate">{lead.business_name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-slate-400">{lead.industry}</span>
            <span className="text-sm text-slate-500">&middot;</span>
            <span className="text-sm text-slate-400">{lead.city}, {lead.state}</span>
            {lead.website && <a href={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"><Globe size={10} /> {domain}</a>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center" style={{ border: `4px solid ${scoreColor(lead.agency_likelihood_score || 50)}` }}>
              <span className="text-lg sm:text-2xl font-extrabold text-white">{lead.agency_likelihood_score || '—'}</span>
            </div>
            <span className={`text-[13px] font-semibold ${temp.cls.split(' ')[0]}`}>{temp.emoji} {temp.label}</span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 sm:px-6 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2">
        <button onClick={handleImport} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={12} /> Import to Contacts</button>
        {lead.email && <button onClick={() => copy(lead.email)} className="btn-secondary text-sm"><Mail size={11} /> Email</button>}
        {lead.phone && <button onClick={() => copy(lead.phone)} className="btn-secondary text-sm"><Phone size={11} /> Phone</button>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white overflow-x-auto px-4 sm:px-6">
        {TABS.map(t => {
          const I = t.icon
          return <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <I size={13} /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-5">
              {/* AI Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">Business Summary</h3>
                  {!aiSummary && <button onClick={generateAISummary} disabled={loadingAI} className="text-[13px] text-brand-500 hover:text-red-700 flex items-center gap-1">
                    {loadingAI ? <Loader2 size={10} className="animate-spin" /> : <Target size={10} />} Generate with AI
                  </button>}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{aiSummary || `${lead.business_name} is a ${lead.industry} business located in ${lead.city}, ${lead.state}. Rated ${lead.google_rating || 'N/A'}/5 on Google with ${lead.google_review_count || 0} reviews.`}</p>
              </div>

              {/* Score Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">SCOUT Score Breakdown</h3>
                {[
                  { label: 'Social Media', val: (sm.facebook_active ? 10 : 0) + (sm.instagram_active ? 10 : 0) + (sm.gmb_optimized ? 10 : 0), max: 30, desc: sm.facebook_active || sm.instagram_active ? 'Some presence' : 'Weak/Missing' },
                  { label: 'Website & Tech', val: Object.values(ts).filter(Boolean).length * 7, max: 35, desc: `${Object.values(ts).filter(Boolean).length} of ${Object.keys(ts).length} tools detected` },
                  { label: 'Reviews', val: lead.google_rating ? Math.round(lead.google_rating * 4) : 5, max: 20, desc: `${lead.google_rating || '?'}/5 with ${lead.google_review_count || 0} reviews` },
                  { label: 'GMB Health', val: sm.gmb_optimized ? 10 : 3, max: 15, desc: sm.gmb_optimized ? 'Optimized' : 'Needs work' },
                ].map(s => (
                  <div key={s.label} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600">{s.label}</span>
                      <span className="text-sm font-medium text-slate-800">{s.val}/{s.max}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full"><div className="h-full rounded-full transition-all" style={{ width: `${s.val / s.max * 100}%`, background: s.val / s.max > 0.6 ? '#22c55e' : s.val / s.max > 0.3 ? '#5bc6d0' : '#ef4444' }} /></div>
                    <p className="text-[13px] text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* Opportunities */}
              <div className="rounded-2xl p-5 border-2 border-orange-200 bg-red-50">
                <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2"><Target size={14} /> Marketing Opportunities</h3>
                <div className="space-y-2">
                  {(lead.opportunities || ['No specific gaps identified']).map((o, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-brand-500 text-sm font-bold mt-0.5">{i + 1}.</span>
                      <p className="text-sm text-orange-900">{o}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h4 className="text-sm font-semibold text-slate-600 uppercase mb-3">Quick Contact</h4>
                <div className="space-y-2.5">
                  {lead.phone && <ContactRow icon={Phone} value={lead.phone} onCopy={() => copy(lead.phone)} />}
                  {lead.email && <ContactRow icon={Mail} value={lead.email} onCopy={() => copy(lead.email)} />}
                  {lead.website && <ContactRow icon={Globe} value={domain} link={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} />}
                  {lead.city && <ContactRow icon={MapPin} value={`${lead.city}, ${lead.state} ${lead.zip_code || ''}`} />}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h4 className="text-sm font-semibold text-slate-600 uppercase mb-3">Pipeline</h4>
                <select className="input text-sm w-full" value={pipelineStage} onChange={e => { setPipelineStage(e.target.value); supabase.from('scout_leads').update({ pipeline_stage: e.target.value }).eq('id', lead.id).catch(() => {}) }}>
                  <option value="lead">Lead</option><option value="contacted">Contacted</option><option value="interested">Interested</option><option value="proposal">Proposal Sent</option><option value="won">Won</option><option value="lost">Lost</option>
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h4 className="text-sm font-semibold text-slate-600 uppercase mb-2">Google Reviews</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-black text-slate-800">{lead.google_rating || '—'}</span>
                  <div><div className="flex">{[1,2,3,4,5].map(i => <Star key={i} size={12} className={i <= Math.round(lead.google_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-slate-200'} />)}</div><p className="text-[13px] text-slate-400">{lead.google_review_count || 0} reviews</p></div>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden"><div className="bg-green-400" style={{ width: `${sent.positive}%` }} /><div className="bg-slate-300" style={{ width: `${sent.neutral}%` }} /><div className="bg-red-400" style={{ width: `${sent.negative}%` }} /></div>
                <p className="text-[13px] text-slate-400 mt-1">{sent.positive}% positive &middot; {sent.negative}% negative</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'tech' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Technology Stack</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[{ key: 'analytics', label: 'Analytics (GA)', icon: '📊' }, { key: 'cms', label: 'CMS', icon: '🌐' }, { key: 'crm', label: 'CRM', icon: '👥' }, { key: 'pixel', label: 'FB Pixel', icon: '📱' }, { key: 'chat', label: 'Live Chat', icon: '💬' }, { key: 'email_tool', label: 'Email Marketing', icon: '📧' }].map(t => (
                <div key={t.key} className={`p-4 rounded-xl border-2 text-center ${ts[t.key] ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <span className="text-2xl">{t.icon}</span>
                  <p className={`text-sm font-medium mt-1 ${ts[t.key] ? 'text-green-700' : 'text-red-600'}`}>{t.label}</p>
                  <p className={`text-sm mt-0.5 ${ts[t.key] ? 'text-green-600' : 'text-red-500'}`}>{ts[t.key] ? '✅ Detected' : '❌ Not Found'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500">{Object.values(ts).filter(Boolean).length} of {Object.keys(ts).length} marketing tools detected. {Object.values(ts).filter(v => !v).length > 3 ? 'Significant opportunity for a full marketing tech stack implementation.' : 'Moderate tech adoption. Focus on the missing tools.'}</p>
            </div>
          </div>
        )}

        {tab === 'social' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[{ label: 'Facebook', active: sm.facebook_active, detail: sm.facebook_followers ? `${sm.facebook_followers} followers` : 'Unknown', lastPost: sm.last_post_days != null ? `Last post: ${sm.last_post_days}d ago` : '' },
                { label: 'Instagram', active: sm.instagram_active, detail: '', lastPost: '' },
                { label: 'Google My Business', active: sm.gmb_optimized, detail: sm.gmb_optimized ? 'Profile optimized' : 'Needs optimization', lastPost: '' },
              ].map(p => (
                <div key={p.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${p.active ? 'bg-green-100' : 'bg-red-100'}`}>
                    <span className={`w-3 h-3 rounded-full ${p.active ? 'bg-green-500' : 'bg-red-400'}`} />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{p.label}</p>
                  <p className={`text-sm mt-1 ${p.active ? 'text-green-600' : 'text-red-500'}`}>{p.active ? 'Active' : 'Inactive / Not Found'}</p>
                  {p.detail && <p className="text-[13px] text-slate-400 mt-0.5">{p.detail}</p>}
                  {p.lastPost && <p className="text-[13px] text-slate-400">{p.lastPost}</p>}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Review Sentiment</h3>
              <div className="flex items-center gap-6">
                <div className="text-center"><span className="text-3xl font-bold text-slate-800">{lead.google_rating || '—'}</span><p className="text-sm text-slate-400">Rating</p></div>
                <div className="flex-1">
                  {[5,4,3,2,1].map(s => (
                    <div key={s} className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-slate-500 w-4">{s}★</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full"><div className="h-full bg-yellow-400 rounded-full" style={{ width: `${s === 5 ? sent.positive : s === 4 ? 20 : s === 3 ? 10 : 5}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'marketing' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Agency Likelihood Score</h3>
              <div className="text-center py-4">
                <span className="text-5xl font-extrabold" style={{ color: scoreColor(lead.agency_likelihood_score || 50) }}>{lead.agency_likelihood_score || '—'}</span>
                <span className="text-lg text-slate-400">/100</span>
                <p className={`text-sm font-semibold mt-1 ${temp.cls.split(' ')[0]}`}>{temp.emoji} {temp.label} Lead</p>
                <p className="text-sm text-slate-400 mt-1">{(lead.opportunities || []).length} marketing gaps identified</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Why They Need an Agency</h3>
              <div className="space-y-3">
                {(lead.opportunities || []).map((opp, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-sm font-medium text-slate-800">{i + 1}. {opp}</p>
                    <p className="text-sm text-slate-500 mt-1">This represents a service opportunity for Moose.</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Estimated Deal Value</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-lg font-extrabold text-slate-800">$1,500</p><p className="text-[13px] text-slate-400">Min/month</p></div>
                <div><p className="text-lg font-extrabold text-brand-500">$4,500</p><p className="text-[13px] text-slate-400">Typical/month</p></div>
                <div><p className="text-lg font-extrabold text-green-600">$54,000</p><p className="text-[13px] text-slate-400">Annual value</p></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'contact' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-lg" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">All Contact Information</h3>
            <div className="space-y-3">
              {lead.phone && <ContactRow icon={Phone} label="Phone" value={lead.phone} onCopy={() => copy(lead.phone)} />}
              {lead.email && <ContactRow icon={Mail} label="Email" value={lead.email} onCopy={() => copy(lead.email)} />}
              {lead.website && <ContactRow icon={Globe} label="Website" value={lead.website} link={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} />}
              {lead.city && <ContactRow icon={MapPin} label="Address" value={`${lead.city}, ${lead.state} ${lead.zip_code || ''}`} />}
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Internal Notes</h3>
              <textarea className="input text-sm w-full resize-none" rows={6} placeholder="Add notes about this prospect..."
                value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} />
              <p className="text-[13px] text-slate-400 mt-1">Auto-saves when you click away</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Pipeline Status</h3>
              <div className="flex flex-wrap gap-2">
                {['lead', 'contacted', 'interested', 'proposal', 'won', 'lost'].map(stage => (
                  <button key={stage} onClick={() => { setPipelineStage(stage); supabase.from('scout_leads').update({ pipeline_stage: stage }).eq('id', lead.id).catch(() => {}) }}
                    className={`text-sm px-3 py-2 rounded-xl capitalize font-medium border transition-all ${pipelineStage === stage ? 'bg-brand-500 text-white border-brand-500' : 'border-slate-200 text-slate-600 hover:border-orange-300'}`}>{stage}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ScoutLayout>
  )
}

function ContactRow({ icon: Icon, label, value, onCopy, link }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {label && <p className="text-[12px] text-slate-400 uppercase">{label}</p>}
        {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-500 hover:underline truncate block">{value}</a>
          : <p className="text-sm text-slate-700 truncate">{value}</p>}
      </div>
      {onCopy && <button onClick={onCopy} className="text-slate-300 hover:text-brand-500 flex-shrink-0"><Copy size={12} /></button>}
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-brand-500 flex-shrink-0"><ExternalLink size={12} /></a>}
    </div>
  )
}
