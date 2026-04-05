"use client";
import { useState, useEffect, useRef } from 'react'
import {
  Star, Plus, Search, Filter, RefreshCw, Check, X,
  MessageSquare, Sparkles, Eye, EyeOff, Globe,
  Copy, ExternalLink, Settings, ChevronDown,
  ThumbsUp, AlertTriangle, Loader2, BarChart2, Shield,
  Sliders, Zap, ArrowRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AIThinkingBox from '../components/AIThinkingBox'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import { callClaude } from '../lib/ai'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

// ── Helpers ───────────────────────────────────────────────────────────────────
const PLATFORM_CONFIG = {
  google:   { label:'Google',   color:'#4285f4', bg:'#eff6ff', icon:'🔵' },
  yelp:     { label:'Yelp',     color:'#d32323', bg:'#fef2f2', icon:'⭐' },
  facebook: { label:'Facebook', color:'#1877f2', bg:'#eff6ff', icon:'📘' },
}

function StarRow({ rating, size=14, color='#f59e0b' }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} color={i<=rating?color:'#e5e7eb'} fill={i<=rating?color:'none'} strokeWidth={1.5}/>
      ))}
    </div>
  )
}

function PlatformBadge({ platform }) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.google
  return (
    <span style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, display:'inline-flex', alignItems:'center', gap:4 }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ review, profile, onApprove, onReject, onGenerateResponse, onPostResponse, onFeature }) {
  const [expanded, setExpanded] = useState(false)
  const [response, setResponse] = useState(review.response_text || '')
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)
  const cfg = PLATFORM_CONFIG[review.platform] || PLATFORM_CONFIG.google

  async function generateResponse() {
    setGenerating(true)
    try {
      const brandTone = profile?.brand?.tone || 'professional and friendly'
      const businessName = profile?.business_name || 'our business'
      const dos   = profile?.brand?.dos   || ''
      const donts = profile?.brand?.donts || ''

      const prompt = `You are responding to a ${review.star_rating}-star ${review.platform} review for ${businessName}.

BRAND VOICE: ${brandTone}
DO: ${dos}
DON'T: ${donts}

REVIEWER: ${review.reviewer_name}
REVIEW: "${review.review_text}"

Write a ${review.star_rating >= 4 ? 'warm, grateful' : 'empathetic, solution-focused'} response.
- Keep it under 150 words
- Sound human, not corporate
- ${review.star_rating >= 4 ? 'Thank them and highlight the specific thing they praised' : 'Acknowledge the issue, apologize sincerely, invite them to contact you directly to resolve it'}
- End with a forward-looking statement
- Do NOT use exclamation marks excessively
- Sign off with the owner/manager's first name if known, otherwise just the business name
- Response only, no preamble`

      const result = await callClaude('You write authentic, brand-voice-matched review responses for local businesses.', prompt, 400)
      setResponse(result.trim())
      onGenerateResponse(review.id, result.trim())
    } catch(e) {
      toast.error('Response generation failed')
    }
    setGenerating(false)
  }

  async function postResponse() {
    setPosting(true)
    await onPostResponse(review.id, response)
    setPosting(false)
  }

  const isNegative = review.star_rating <= 2
  const isNeutral  = review.star_rating === 3

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${isNegative?'#fecaca':isNeutral?'#fde68a':'#e5e7eb'}`, marginBottom:14, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:14 }}>
        {/* Avatar */}
        <div style={{ width:44, height:44, borderRadius:'50%', background:cfg.color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, fontWeight:700, color:cfg.color }}>
          {review.reviewer_avatar ? <img src={review.reviewer_avatar} alt="" style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover' }}/> : review.reviewer_name?.[0]?.toUpperCase() || '?'}
        </div>
        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#111' }}>{review.reviewer_name}</span>
            <PlatformBadge platform={review.platform} />
            {review.is_featured && <span style={{ fontSize:13, fontWeight:800, color:'#f59e0b', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:20, padding:'2px 8px' }}>⭐ FEATURED</span>}
            {isNegative && <span style={{ fontSize:13, fontWeight:800, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:20, padding:'2px 8px' }}>⚠ NEEDS ATTENTION</span>}
          </div>
          <StarRow rating={review.star_rating} />
          <div style={{ fontSize:14, color:'#4b5563', marginTop:4 }}>
            {review.reviewed_at ? formatDistanceToNow(new Date(review.reviewed_at), { addSuffix:true }) : 'Recently'}
            {review.review_url && <a href={review.review_url} target="_blank" rel="noreferrer" style={{ marginLeft:10, color:cfg.color, fontSize:13 }}>View on {cfg.label} ↗</a>}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display:'flex', gap:7, flexShrink:0 }}>
          {review.status==='pending' && (
            <>
              <button onClick={()=>onApprove(review.id)} style={{ padding:'6px 12px', borderRadius:8, border:'none', background:'#f0fdf4', color:'#16a34a', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}><Check size={12}/> Approve</button>
              <button onClick={()=>onReject(review.id)} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'#fef2f2', color:'#dc2626', fontSize:14, cursor:'pointer' }}><X size={12}/></button>
            </>
          )}
          {review.status==='approved' && <span style={{ fontSize:13, fontWeight:700, color:'#16a34a', background:'#f0fdf4', padding:'4px 10px', borderRadius:20 }}>✓ Live</span>}
          <button onClick={()=>onFeature(review.id, !review.is_featured)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color: review.is_featured?'#f59e0b':'#9ca3af' }}>
            <Star size={13} fill={review.is_featured?'#f59e0b':'none'}/>
          </button>
          <button onClick={()=>setExpanded(e=>!e)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151' }}>
            <MessageSquare size={13}/>
          </button>
        </div>
      </div>

      {/* Review text */}
      {review.review_text && (
        <div style={{ padding:'0 20px 14px', fontSize:15, color:'#374151', lineHeight:1.7, fontStyle:'italic' }}>
          "{review.review_text}"
        </div>
      )}

      {/* Response panel */}
      {expanded && (
        <div style={{ padding:'14px 20px 18px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#111' }}>Response</span>
            <button onClick={generateResponse} disabled={generating}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:`1.5px solid ${ACCENT}`, background:'#f0fbfc', color:ACCENT, fontSize:14, fontWeight:700, cursor:'pointer', opacity:generating?.7:1 }}>
              {generating ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/> : <Sparkles size={11}/>}
              {generating ? 'Writing…' : response ? 'Regenerate' : 'AI Write Response'}
            </button>
            {review.response_posted_at && <span style={{ fontSize:13, color:'#16a34a', fontWeight:700 }}>✓ Posted {format(new Date(review.response_posted_at), 'MMM d')}</span>}
          </div>
          <textarea value={response} onChange={e=>setResponse(e.target.value)} rows={4}
            placeholder="Write a response, or click AI Write Response to generate one in your brand voice…"
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', resize:'vertical', lineHeight:1.65, color:'#111', background:'#fff', fontFamily:'inherit', boxSizing:'border-box' }}/>
          <div style={{ display:'flex', gap:8, marginTop:8, justifyContent:'flex-end' }}>
            <span style={{ fontSize:13, color:'#4b5563', marginRight:'auto', alignSelf:'center' }}>{response.length}/150 chars recommended</span>
            <button onClick={()=>{ navigator.clipboard.writeText(response); toast.success('Copied — paste in '+cfg.label) }}
              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
              <Copy size={11}/> Copy
            </button>
            {review.platform === 'google' && (
              <button onClick={postResponse} disabled={posting || !response}
                style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#4285f4', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity:posting||!response?.7:1, display:'flex', alignItems:'center', gap:5 }}>
                {posting ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/> : null}
                {posting ? 'Posting…' : 'Post to Google'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Widget Settings Panel ──────────────────────────────────────────────────────
function WidgetSettings({ settings, onChange, clientName, appUrl }) {
  const [tab, setTab] = useState('display')
  const embedCode = `<!-- Koto Reviews Widget -->
<script>
window._mooseReviews = {
  key: "${settings.embed_key}",
  mode: "${settings.display_mode}",
  position: "${settings.badge_position}"
};
</script>
<script src="${appUrl}/reviews-widget.js" async></script>`

  const shortcode = `[moose_reviews key="${settings.embed_key}" mode="${settings.display_mode}" min_stars="${settings.min_stars}"]`

  function copy(text, label) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }

  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
      {/* Header with master toggle */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:12, background: settings.widget_enabled?'#f0fdf4':'#fef2f2' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>Review Widget — {clientName}</div>
          <div style={{ fontSize:14, color: settings.widget_enabled?'#16a34a':'#dc2626', fontWeight:700, marginTop:2 }}>
            {settings.widget_enabled ? '● Active — showing on website' : '○ Disabled — hidden from website'}
          </div>
        </div>
        {/* Master ON/OFF toggle — payment gate */}
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5, textAlign:'center' }}>Widget {settings.widget_enabled?'ON':'OFF'}</div>
          <div onClick={() => onChange('widget_enabled', !settings.widget_enabled)}
            style={{ width:56, height:28, borderRadius:14, background:settings.widget_enabled?'#16a34a':'#d1d5db', cursor:'pointer', position:'relative', transition:'background .2s' }}>
            <div style={{ position:'absolute', top:4, left:settings.widget_enabled?30:4, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.2)' }}/>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #f3f4f6' }}>
        {[['display','Display'],['filter','Filtering'],['embed','Embed Code']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{ flex:1, padding:'10px 0', fontSize:15, fontWeight:tab===id?700:500, color:tab===id?ACCENT:'#6b7280', border:'none', background:'none', cursor:'pointer', borderBottom:`2px solid ${tab===id?ACCENT:'transparent'}` }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding:'18px 20px' }}>
        {/* Display tab */}
        {tab==='display' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:8, color:'#374151' }}>Display Mode</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['carousel','🎠 Carousel'],['grid','⊞ Grid'],['list','≡ List'],['badge','🏅 Badge']].map(([v,l])=>(
                  <button key={v} onClick={()=>onChange('display_mode',v)}
                    style={{ flex:1, padding:'9px 6px', borderRadius:10, border:`2px solid ${settings.display_mode===v?ACCENT:'#e5e7eb'}`, background:settings.display_mode===v?'#f0fbfc':'#fff', color:settings.display_mode===v?ACCENT:'#374151', fontSize:14, fontWeight:settings.display_mode===v?700:500, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {settings.display_mode==='badge' && (
              <div>
                <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:8, color:'#374151' }}>Badge Position</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['bottom-left','↙ Bottom Left'],['bottom-right','↘ Bottom Right']].map(([v,l])=>(
                    <button key={v} onClick={()=>onChange('badge_position',v)}
                      style={{ flex:1, padding:'9px', borderRadius:10, border:`2px solid ${settings.badge_position===v?ACCENT:'#e5e7eb'}`, background:settings.badge_position===v?'#f0fbfc':'#fff', color:settings.badge_position===v?ACCENT:'#374151', fontSize:15, fontWeight:settings.badge_position===v?700:500, cursor:'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:8, color:'#374151' }}>Theme</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['light','☀️ Light'],['dark','🌙 Dark'],['auto','⚙️ Auto']].map(([v,l])=>(
                  <button key={v} onClick={()=>onChange('theme',v)}
                    style={{ flex:1, padding:'9px', borderRadius:10, border:`2px solid ${settings.theme===v?ACCENT:'#e5e7eb'}`, background:settings.theme===v?'#f0fbfc':'#fff', color:settings.theme===v?ACCENT:'#374151', fontSize:15, fontWeight:settings.theme===v?700:500, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:6, color:'#374151' }}>Accent Color</label>
              <div style={{ display:'flex', gap:10 }}>
                <input type="color" value={settings.primary_color||ACCENT} onChange={e=>onChange('primary_color',e.target.value)}
                  style={{ width:44, height:40, borderRadius:9, border:'1.5px solid #e5e7eb', padding:2, cursor:'pointer' }}/>
                <input value={settings.primary_color||ACCENT} onChange={e=>onChange('primary_color',e.target.value)}
                  style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', fontFamily:'monospace', color:'#111' }}/>
              </div>
            </div>
            {/* Toggles */}
            {[
              ['show_platform_icons','Show platform icons (Google, Yelp, Facebook)'],
              ['show_reviewer_photo','Show reviewer photo/avatar'],
              ['show_date','Show review date'],
              ['show_response','Show agency response'],
            ].map(([k,label])=>(
              <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#f9fafb', borderRadius:10 }}>
                <span style={{ fontSize:15, color:'#374151', fontWeight:600 }}>{label}</span>
                <div onClick={()=>onChange(k,!settings[k])} style={{ width:38, height:21, borderRadius:11, background:settings[k]?ACCENT:'#d1d5db', cursor:'pointer', position:'relative', transition:'background .2s' }}>
                  <div style={{ position:'absolute', top:3, left:settings[k]?19:3, width:15, height:15, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tab */}
        {tab==='filter' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:8, color:'#374151' }}>Minimum Star Rating to Display</label>
              <div style={{ display:'flex', gap:8 }}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>onChange('min_stars',n)}
                    style={{ flex:1, padding:'10px 6px', borderRadius:10, border:`2px solid ${settings.min_stars===n?'#f59e0b':'#e5e7eb'}`, background:settings.min_stars===n?'#fffbeb':'#fff', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:4 }}>
                      <StarRow rating={n} size={14}/>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:settings.min_stars===n?'#d97706':'#9ca3af' }}>{n}+ stars</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize:13, color:'#4b5563', marginTop:8 }}>
                Only reviews with {settings.min_stars}+ stars will appear on the website. Recommended: 4+
              </div>
            </div>
            <div>
              <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:6, color:'#374151' }}>Max Reviews to Show</label>
              <select value={settings.max_reviews||20} onChange={e=>onChange('max_reviews',parseInt(e.target.value))}
                style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', cursor:'pointer', color:'#111' }}>
                {[5,10,15,20,30,50].map(n=><option key={n} value={n}>{n} reviews</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:14, fontWeight:700, display:'block', marginBottom:8, color:'#374151' }}>Platforms to Show</label>
              <div style={{ display:'flex', gap:8 }}>
                {Object.entries(PLATFORM_CONFIG).map(([id,cfg])=>{
                  const active = settings.platforms?.includes(id)
                  return (
                    <button key={id} onClick={()=>{
                      const cur = settings.platforms || ['google','yelp','facebook']
                      onChange('platforms', active ? cur.filter(p=>p!==id) : [...cur,id])
                    }}
                      style={{ flex:1, padding:'10px', borderRadius:10, border:`2px solid ${active?cfg.color:'#e5e7eb'}`, background:active?cfg.bg:'#fff', cursor:'pointer' }}>
                      <div style={{ fontSize:20, marginBottom:4 }}>{cfg.icon}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:active?cfg.color:'#4b5563' }}>{cfg.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Embed tab */}
        {tab==='embed' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px', fontSize:15, color:'#166534' }}>
              ✅ The Koto WordPress plugin automatically injects this widget. You don't need to paste code manually if the plugin is installed.
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:8 }}>WordPress Shortcode</div>
              <div style={{ background:'#f9fafb', borderRadius:10, border:'1px solid #e5e7eb', padding:'12px 14px', fontFamily:'monospace', fontSize:14, color:'#374151', position:'relative' }}>
                {shortcode}
                <button onClick={()=>copy(shortcode,'Shortcode')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'#fff', border:'1px solid #e5e7eb', borderRadius:7, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, color:'#374151' }}>
                  <Copy size={11}/> Copy
                </button>
              </div>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:8 }}>HTML Embed Code</div>
              <div style={{ background:'#f9fafb', borderRadius:10, border:'1px solid #e5e7eb', padding:'12px 14px', fontFamily:'monospace', fontSize:13, color:'#374151', position:'relative', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
                {embedCode}
                <button onClick={()=>copy(embedCode,'Embed code')} style={{ position:'absolute', right:10, top:10, background:'#fff', border:'1px solid #e5e7eb', borderRadius:7, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, color:'#374151' }}>
                  <Copy size={11}/> Copy
                </button>
              </div>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:6 }}>API Endpoint (for developers)</div>
              <div style={{ background:'#f9fafb', borderRadius:10, border:'1px solid #e5e7eb', padding:'10px 14px', fontFamily:'monospace', fontSize:13, color:'#374151', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>{window.location.origin}/api/reviews/embed?key={settings.embed_key}</span>
                <button onClick={()=>copy(`${window.location.origin}/api/reviews/embed?key=${settings.embed_key}`,'API URL')} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:7, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, color:'#374151' }}>
                  <Copy size={11}/>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const { user, agencyId } = useAuth()
  const { clients, selectedClient, selectClient: setSelectedClient } = useClient()
  const [reviews, setReviews] = useState([])
  const [widgetSettings, setWidgetSettings] = useState(null)
  const [clientProfile, setClientProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStars, setFilterStars] = useState(0)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [showWidget, setShowWidget] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Auto-load data when global selected client changes (from sidebar click or context)
  useEffect(() => {
    if (selectedClient) loadClientData(selectedClient)
  }, [selectedClient?.id])

  async function loadClientData(client) {
    setSelectedClient(client)  // update global context
    setLoading(true)
    const [{ data: revs }, { data: widget }, { data: prof }] = await Promise.all([
      supabase.from('moose_review_queue').select('*').eq('client_id', client.id).order('reviewed_at', { ascending:false }),
      supabase.from('review_widget_settings').select('*').eq('client_id', client.id).maybeSingle(),
      supabase.from('client_profiles').select('*').eq('client_id', client.id).maybeSingle(),
    ])
    setReviews(revs || [])
    setClientProfile(prof)
    // Auto-create widget settings if not exists
    if (!widget) {
      const { data: newWidget } = await supabase.from('review_widget_settings').insert({
        client_id: client.id, agency_id: agencyId,
        min_stars: 4, max_reviews: 20, display_mode: 'carousel',
        platforms: ['google','yelp','facebook'], theme:'light', primary_color:ACCENT,
      }).select().single()
      setWidgetSettings(newWidget)
    } else {
      setWidgetSettings(widget)
    }
    setLoading(false)
  }

  async function addSampleReviews() {
    if (!selectedClient) return
    const samples = [
      { platform:'google',   reviewer_name:'Michael T.', star_rating:5, review_text:'Absolutely incredible service! They showed up within an hour and fixed everything perfectly. The technician was professional, clean, and explained everything. 100% recommend to anyone in Miami!', status:'approved', reviewed_at: new Date(Date.now()-86400000*2).toISOString() },
      { platform:'google',   reviewer_name:'Sarah K.',   star_rating:5, review_text:'Best experience I have had with any contractor. Fair pricing, no surprises, and the work was flawless. Will definitely use them again.', status:'approved', reviewed_at: new Date(Date.now()-86400000*5).toISOString() },
      { platform:'yelp',     reviewer_name:'James R.',   star_rating:4, review_text:'Good service overall. Came on time and did good work. Pricing was fair. Only knocked off a star because communication could be a little better.', status:'pending', reviewed_at: new Date(Date.now()-86400000*1).toISOString() },
      { platform:'facebook', reviewer_name:'Maria L.',   star_rating:5, review_text:'Amazing! Called at 11pm with an emergency and they were here by midnight. Saved us from a major disaster. These guys are lifesavers.', status:'approved', reviewed_at: new Date(Date.now()-86400000*10).toISOString() },
      { platform:'google',   reviewer_name:'David H.',   star_rating:2, review_text:'Came out, gave a quote, then never showed up for the job. Had to call three times to get a response. Very disappointed.', status:'pending', reviewed_at: new Date(Date.now()-3600000*6).toISOString() },
      { platform:'yelp',     reviewer_name:'Lisa M.',    star_rating:5, review_text:'Third time using them and they never disappoint. Consistent, reliable, and always professional. My go-to recommendation for everyone.', status:'approved', reviewed_at: new Date(Date.now()-86400000*14).toISOString() },
    ]
    await supabase.from('moose_review_queue').insert(samples.map(r=>({ ...r, client_id: selectedClient.id, agency_id: agencyId })))
    toast.success('Sample reviews added!')
    if (selectedClient) loadClientData(selectedClient)
  }

  async function handleApprove(reviewId) {
    await supabase.from('moose_review_queue').update({ status:'approved' }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, status:'approved'} : rev))
    toast.success('Review approved — now showing on website')
  }

  async function handleReject(reviewId) {
    await supabase.from('moose_review_queue').update({ status:'rejected' }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, status:'rejected'} : rev))
    toast.success('Review hidden')
  }

  async function handleGenerateResponse(reviewId, text) {
    await supabase.from('moose_review_queue').update({ response_text: text }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, response_text:text} : rev))
  }

  async function handlePostResponse(reviewId, text) {
    // In production: call Google My Business API to post the response
    await supabase.from('moose_review_queue').update({ response_text:text, response_posted_at:new Date().toISOString(), status:'responded' }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, response_text:text, response_posted_at:new Date().toISOString()} : rev))
    toast.success('Response posted! ✓')
  }

  async function handleFeature(reviewId, featured) {
    await supabase.from('moose_review_queue').update({ is_featured:featured }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, is_featured:featured} : rev))
  }

  async function updateWidgetSetting(key, val) {
    const updated = { ...widgetSettings, [key]:val }
    setWidgetSettings(updated)
    setSavingSettings(true)
    await supabase.from('review_widget_settings').update({ [key]:val, updated_at:new Date().toISOString() }).eq('id', widgetSettings.id)
    setSavingSettings(false)
    if (key === 'widget_enabled') {
      toast.success(val ? '✅ Widget enabled — reviews showing on website' : '⛔ Widget disabled — reviews hidden from website')
    }
  }

  // Stats
  const approved = reviews.filter(r=>r.status==='approved').length
  const pending  = reviews.filter(r=>r.status==='pending').length
  const negative = reviews.filter(r=>r.star_rating<=2).length
  const avgRating = reviews.length ? (reviews.reduce((s,r)=>s+r.star_rating,0)/reviews.length).toFixed(1) : '—'

  // Filtered reviews
  const filtered = reviews.filter(r => {
    const mp = filterPlatform==='all' || r.platform===filterPlatform
    const ms = filterStars===0 || r.star_rating>=filterStars
    const mt = filterStatus==='all' || r.status===filterStatus
    const mq = !search || r.reviewer_name?.toLowerCase().includes(search.toLowerCase()) || r.review_text?.toLowerCase().includes(search.toLowerCase())
    return mp && ms && mt && mq
  })

  return (
    <div className="page-shell" style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>

      {/* Client list */}
      <div  className="reviews-client-col"style={{ width:240, flexShrink:0, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0 }}>
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:10 }}>Reviews</div>
          <div style={{ fontSize:13, color:'#4b5563' }}>{clients.length} clients</div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {clients.map(c=>(
            <div key={c.id} onClick={()=>loadClientData(c)}
              style={{ padding:'11px 16px', cursor:'pointer', borderBottom:'1px solid #f9fafb', background:selectedClient?.id===c.id?'#f0fbfc':'#fff', borderLeft:`3px solid ${selectedClient?.id===c.id?ACCENT:'transparent'}` }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>{c.name}</div>
              <div style={{ fontSize:13, color:'#4b5563' }}>{c.industry}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {!selectedClient ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#4b5563' }}>
            <Star size={48} strokeWidth={1}/>
            <div style={{ fontSize:16, fontWeight:800 }}>Select a client to manage their reviews</div>
          </div>
        ) : loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
            <Loader2 size={28} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'14px 24px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:17, fontWeight:800, color:'#111' }}>{selectedClient.name}</div>
                <div style={{ fontSize:14, color:'#4b5563' }}>{reviews.length} total reviews · {avgRating}★ average</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {reviews.length===0 && <button onClick={addSampleReviews} style={{ padding:'7px 14px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>+ Add Sample Reviews</button>}
                <button onClick={()=>setShowWidget(s=>!s)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:9, border:`1.5px solid ${showWidget?ACCENT:'#e5e7eb'}`, background:showWidget?'#f0fbfc':'#fff', fontSize:14, fontWeight:700, cursor:'pointer', color:showWidget?ACCENT:'#374151' }}>
                  <Sliders size={13}/> Widget Settings
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns: showWidget?'1fr 380px':'1fr', gap:0 }}>
              {/* Reviews column */}
              <div style={{ padding:'20px 24px', overflowY:'auto' }}>
                {/* Stats row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                  {[
                    { label:'Total Reviews', value:reviews.length, color:'#111' },
                    { label:'Published', value:approved, color:'#16a34a' },
                    { label:'Pending Review', value:pending, color:'#d97706' },
                    { label:'Avg Rating', value:`${avgRating}★`, color:'#f59e0b' },
                  ].map(s=>(
                    <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                      <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:13, color:'#4b5563', marginTop:3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Alert for negative reviews */}
                {negative > 0 && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
                    <AlertTriangle size={15} color="#dc2626"/>
                    <div style={{ flex:1, fontSize:15, color:'#991b1b', fontWeight:700 }}>{negative} negative review{negative>1?'s':''} need a response — don't let them sit!</div>
                    <button onClick={()=>setFilterStars(0)} style={{ fontSize:14, color:'#dc2626', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Show all</button>
                  </div>
                )}

                {/* Filters */}
                <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                  <div style={{ position:'relative' }}>
                    <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#4b5563' }}/>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reviews…" style={{ padding:'7px 10px 7px 26px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', width:180 }}/>
                  </div>
                  <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} style={{ padding:'7px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, cursor:'pointer', outline:'none' }}>
                    <option value="all">All Platforms</option>
                    <option value="google">Google</option>
                    <option value="yelp">Yelp</option>
                    <option value="facebook">Facebook</option>
                  </select>
                  <select value={filterStars} onChange={e=>setFilterStars(parseInt(e.target.value))} style={{ padding:'7px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, cursor:'pointer', outline:'none' }}>
                    <option value={0}>All Stars</option>
                    {[5,4,3,2,1].map(n=><option key={n} value={n}>{n}★+</option>)}
                  </select>
                  <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ padding:'7px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, cursor:'pointer', outline:'none' }}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Hidden</option>
                  </select>
                </div>

                {/* Review list */}
                {filtered.length===0 ? (
                  <div style={{ textAlign:'center', padding:'48px 20px', color:'#4b5563' }}>
                    <Star size={40} strokeWidth={1} style={{ margin:'0 auto 12px' }}/>
                    <div style={{ fontSize:15, fontWeight:700 }}>No reviews match your filters</div>
                    <div style={{ fontSize:15, marginTop:6 }}>Reviews from Google, Yelp, and Facebook will appear here automatically once connected</div>
                  </div>
                ) : filtered.map(review=>(
                  <ReviewCard key={review.id} review={review} profile={clientProfile}
                    onApprove={handleApprove} onReject={handleReject}
                    onGenerateResponse={handleGenerateResponse} onPostResponse={handlePostResponse}
                    onFeature={handleFeature}/>
                ))}
              </div>

              {/* Widget settings panel */}
              {showWidget && widgetSettings && (
                <div style={{ borderLeft:'1px solid #e5e7eb', background:'#f9fafb', overflowY:'auto', padding:'20px 20px' }}>
                  <WidgetSettings settings={widgetSettings} onChange={updateWidgetSetting} clientName={selectedClient.name} appUrl={appUrl}/>
                  {savingSettings && <div style={{ fontSize:13, color:'#4b5563', textAlign:'center', marginTop:10 }}>↻ Auto-saving…</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
