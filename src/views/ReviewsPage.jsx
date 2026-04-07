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
import { useMobile } from '../hooks/useMobile'
import { MobilePage, MobileSearch, MobileRow, MobileCard, MobileEmpty, MobileButton, MobileTabs, MobilePageHeader, MobileStatStrip, MobileSectionHeader } from '../components/mobile/MobilePage'

const R   = '#ea2729'
const T   = '#5bc6d0'
const BLK = '#0a0a0a'
const GRY = '#f2f2f0'
const W   = '#ffffff'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"
const ACCENT = R
const TEAL = T

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
            {review.review_date ? formatDistanceToNow(new Date(review.review_date), { addSuffix:true }) : 'Recently'}
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
        <div style={{ padding:'14px 20px 18px', borderTop:'1px solid #f3f4f6', background:GRY }}>
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
  // Google Reviews
  const [googleSearchQuery,  setGoogleSearchQuery]  = useState('')
  const [googleSearchResults,setGoogleSearchResults] = useState([])
  const [googleSearching,    setGoogleSearching]    = useState(false)
  const [googleFetching,     setGoogleFetching]     = useState(false)
  const [googleReviews,      setGoogleReviews]      = useState([])
  const [googleStats,        setGoogleStats]        = useState(null)
  const [googleTab,          setGoogleTab]          = useState('search') // search | reviews
  const [generatingId,       setGeneratingId]       = useState(null)
  const [draftResponses,     setDraftResponses]     = useState({})
  const [editingId,          setEditingId]          = useState(null)
  const [widgetSettings, setWidgetSettings] = useState(null)
  const [clientProfile, setClientProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
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

  async function syncGoogleReviews(client) {
    if (!client) return
    setSyncing(true)
    toast.loading('Pulling reviews from Google…', { id:'sync' })
    try {
      // First search for Place ID if not stored
      let placeId = client.google_place_id
      if (!placeId) {
        const searchRes = await fetch('/api/reviews', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'search', query: client.name + ' ' + (client.city || '') }),
        })
        const searchData = await searchRes.json()
        if (searchData.results?.[0]) {
          placeId = searchData.results[0].place_id
          // Save place_id to client record
          await supabase.from('clients').update({ google_place_id: placeId }).eq('id', client.id)
        }
      }
      if (!placeId) { toast.error('Could not find this business on Google', { id:'sync' }); setSyncing(false); return }

      // Fetch reviews from Google
      const fetchRes = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch', place_id: placeId }),
      })
      const fetchData = await fetchRes.json()
      if (fetchData.error) { toast.error(fetchData.error, { id:'sync' }); setSyncing(false); return }

      // Save each review to DB (upsert by review_id)
      const reviewsToSave = (fetchData.reviews || []).map((r) => ({
        client_id:     client.id,
        agency_id:     agencyId,
        platform:      'google',
        reviewer_name: r.reviewer_name,
        reviewer_photo:r.reviewer_photo,
        rating:        r.rating,
        review_text:   r.review_text,
        review_date:   r.review_date,
        review_id:     r.review_id,
        sentiment:     r.sentiment,
        source_url:    fetchData.maps_url,
      }))

      if (reviewsToSave.length > 0) {
        await supabase.from('reviews').upsert(reviewsToSave, { onConflict: 'review_id', ignoreDuplicates: true })
      }

      toast.success(`Synced ${reviewsToSave.length} reviews from Google`, { id:'sync' })
      loadClientData(client)
    } catch(e) { toast.error('Sync failed: ' + e.message, { id:'sync' }) }
    setSyncing(false)
  }

  async function loadClientData(client) {
    setSelectedClient(client)  // update global context
    setLoading(true)
    const [{ data: revs }, { data: widget }, { data: prof }] = await Promise.all([
      supabase.from('reviews').select('*').eq('client_id', client.id).order('review_date', { ascending:false }),
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
    await supabase.from('reviews').insert(samples.map(r=>({ ...r, client_id: selectedClient.id, agency_id: agencyId })))
    toast.success('Sample reviews added!')
    if (selectedClient) loadClientData(selectedClient)
  }

  async function handleApprove(reviewId) {
    await supabase.from('reviews').update({ status:'approved' }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, status:'approved'} : rev))
    toast.success('Review approved — now showing on website')
  }

  async function handleReject(reviewId) {
    await supabase.from('reviews').update({ status:'rejected' }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, status:'rejected'} : rev))
    toast.success('Review hidden')
  }

  async function handleGenerateResponse(reviewId, text) {
    await supabase.from('reviews').update({ response_text: text }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, response_text:text} : rev))
  }

  async function handlePostResponse(reviewId, text) {
    // In production: call Google My Business API to post the response
    await supabase.from('reviews').update({ response_text:text, response_posted_at:new Date().toISOString(), status:'responded' }).eq('id', reviewId)
    setReviews(r => r.map(rev => rev.id===reviewId ? {...rev, response_text:text, response_posted_at:new Date().toISOString()} : rev))
    toast.success('Response posted! ✓')
  }

  async function handleFeature(reviewId, featured) {
    await supabase.from('reviews').update({ is_featured:featured }).eq('id', reviewId)
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


  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  // ── Google Reviews Functions ──────────────────────────────────────────────
  async function searchGoogleBusiness(q) {
    const query = q || googleSearchQuery
    if (!query.trim()) return
    setGoogleSearching(true)
    setGoogleSearchResults([])
    try {
      const res = await fetch('/api/places/search', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ query: query.trim() + ' ' + (selectedClient?.name||'') }),
      })
      const d = await res.json()
      setGoogleSearchResults(d.results || [])
      if (!d.results?.length) toast('No businesses found — try a more specific search')
    } catch(e) { toast.error('Search failed') }
    setGoogleSearching(false)
  }

  async function fetchGoogleReviews(placeId, businessName) {
    setGoogleFetching(true)
    toast.loading('Fetching Google reviews…', {id:'gfetch'})
    try {
      const res = await fetch('/api/reviews', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'fetch', place_id:placeId, client_id:selectedClient?.id, agency_id:agencyId }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setGoogleReviews(d.reviews || [])
      setGoogleStats({ name:d.name, rating:d.rating, total:d.total_reviews, saved:d.saved })
      setGoogleTab('reviews')
      toast.success(`Fetched ${d.reviews?.length||0} reviews — ★${d.rating} avg`, {id:'gfetch'})
    } catch(e) { toast.error(e.message, {id:'gfetch'}) }
    setGoogleFetching(false)
  }

  async function generateAIResponse(review) {
    setGeneratingId(review.review_id)
    try {
      const res = await fetch('/api/reviews', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_response', review_text:review.review_text, rating:review.rating, business_name:selectedClient?.name }),
      })
      const d = await res.json()
      if (d.response) {
        setDraftResponses(prev => ({...prev, [review.review_id]: d.response}))
        setEditingId(review.review_id)
      }
    } catch(e) { toast.error('AI generation failed') }
    setGeneratingId(null)
  }

  async function saveGoogleResponse(reviewId) {
    const draft = draftResponses[reviewId]
    if (!draft) return
    try {
      // Find the DB id for this review
      const { data } = await supabase.from('reviews').select('id').eq('review_id', reviewId).single()
      if (data) {
        await fetch('/api/reviews', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'save_response', review_id:data.id, response_text:draft }),
        })
        setGoogleReviews(prev => prev.map(r => r.review_id===reviewId ? {...r, is_responded:true, response_text:draft} : r))
        setEditingId(null)
        toast.success('Response saved')
      }
    } catch(e) { toast.error('Save failed') }
  }

  // Auto-search when client changes
  useEffect(() => {
    if (selectedClient?.name) {
      setGoogleSearchQuery(selectedClient.name)
      setGoogleSearchResults([])
      setGoogleReviews([])
      setGoogleStats(null)
      setGoogleTab('search')
    }
  }, [selectedClient?.id])


  if (isMobile) {
    const starArr = [5,4,3,2,1]
    const fReviews = reviews.filter(r=>{
      const q=search.toLowerCase()
      const matchQ=!q||r.reviewer_name?.toLowerCase().includes(q)||r.review_text?.toLowerCase().includes(q)
      const matchS=filterStars===0||r.star_rating===filterStars
      const matchP=filterPlatform==='all'||r.platform===filterPlatform
      return matchQ&&matchS&&matchP
    })
    const avg = reviews.length ? (reviews.reduce((s,r)=>s+(r.star_rating||0),0)/reviews.length).toFixed(1) : '—'
    const platforms = [...new Set(reviews.map(r=>r.platform).filter(Boolean))]

    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Reviews"
          subtitle={`${reviews.length} reviews · ${avg}★ avg`}/>

        {reviews.length>0 && <MobileStatStrip stats={[
          {label:'Total',   value:reviews.length},
          {label:'Avg ★',  value:avg},
          {label:'5 Star',  value:reviews.filter(r=>r.star_rating===5).length, color:'#16a34a'},
          {label:'1-2 Star',value:reviews.filter(r=>r.star_rating<=2).length,  color:'#ea2729'},
        ]}/>}

        {/* Client picker */}
        {clients.length>0 && (
          <div style={{padding:'10px 16px'}}>
            <select value={selectedClient?.id||''} onChange={e=>{const cl=clients.find(c=>c.id===e.target.value);if(cl)setSelectedClient(cl)}}
              style={{width:'100%',padding:'11px 13px',borderRadius:11,border:'1px solid #ececea',fontSize:16,color:'#0a0a0a',background:'#fff',fontFamily:"'Raleway',sans-serif"}}>
              <option value="">Select a client…</option>
              {clients.map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
          </div>
        )}

        <MobileSearch value={search} onChange={setSearch} placeholder="Search reviews…"/>

        {/* Star filter */}
        {/* ── Google Reviews Panel ──────────────────────────────────── */}
        <div style={{ margin:'16px 20px', background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🔵</div>
              <span style={{ fontFamily:"'Proxima Nova','Nunito Sans',sans-serif", fontSize:14, fontWeight:800, color:'#111' }}>Google Reviews</span>
              {googleStats && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#f0fdf4', color:'#16a34a', fontFamily:"'Proxima Nova','Nunito Sans',sans-serif" }}>★{googleStats.rating} · {googleStats.total} total</span>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setGoogleTab('search')}
                style={{ padding:'5px 12px', borderRadius:8, border:'none', background:googleTab==='search'?'#111':'#f3f4f6', color:googleTab==='search'?'#fff':'#374151', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                Search
              </button>
              {googleReviews.length>0 && (
                <button onClick={()=>setGoogleTab('reviews')}
                  style={{ padding:'5px 12px', borderRadius:8, border:'none', background:googleTab==='reviews'?'#ea2729':'#f3f4f6', color:googleTab==='reviews'?'#fff':'#374151', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  Reviews {googleReviews.length}
                </button>
              )}
            </div>
          </div>

          {googleTab==='search' && (
            <div style={{ padding:'14px 18px' }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:10 }}>
                Search Google to find {selectedClient?.name}'s listing, then click to fetch their latest reviews.
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <input value={googleSearchQuery} onChange={e=>setGoogleSearchQuery(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&searchGoogleBusiness(googleSearchQuery)}
                  placeholder={selectedClient?.name + ' ' + (selectedClient?.industry||'')}
                  style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, outline:'none', color:'#111' }}
                  onFocus={e=>e.target.style.borderColor='#5bc6d0'} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                <button onClick={()=>searchGoogleBusiness(googleSearchQuery)} disabled={googleSearching}
                  style={{ padding:'9px 18px', borderRadius:9, border:'none', background:'#5bc6d0', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                  {googleSearching ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : <Search size={13}/>}
                  {googleSearching ? 'Searching…' : 'Search Google'}
                </button>
              </div>

              {googleSearchResults.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {googleSearchResults.map((biz,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:GRY, cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#ea2729'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                      {biz.photo && <img src={biz.photo} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:'cover', flexShrink:0 }} onError={e=>e.target.style.display='none'}/>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>{biz.name}</div>
                        <div style={{ fontSize:12, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{biz.address}</div>
                        {biz.rating && <div style={{ fontSize:12, color:'#f59e0b', fontWeight:700 }}>★{biz.rating} ({biz.review_count} reviews)</div>}
                      </div>
                      <button onClick={()=>fetchGoogleReviews(biz.place_id, biz.name)} disabled={googleFetching}
                        style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#ea2729', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                        {googleFetching ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> : null}
                        {googleFetching ? 'Fetching…' : 'Fetch Reviews'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!googleSearchResults.length && !googleSearching && (
                <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'8px 0' }}>
                  Search above to find the business on Google Maps
                </div>
              )}
            </div>
          )}

          {googleTab==='reviews' && googleReviews.length > 0 && (
            <div style={{ maxHeight:480, overflowY:'auto' }}>
              {googleReviews.map((r, i) => (
                <div key={i} style={{ padding:'14px 18px', borderBottom:'1px solid #f9fafb' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:'#5bc6d030', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14, fontWeight:900, color:'#5bc6d0' }}>
                      {r.reviewer_name?.[0]?.toUpperCase()||'?'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>{r.reviewer_name||'Anonymous'}</span>
                        <span style={{ color:'#f59e0b', fontSize:13 }}>{'★'.repeat(r.rating||0)}{'☆'.repeat(5-(r.rating||0))}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:r.rating>=4?'#16a34a':r.rating<=2?'#ea2729':'#f59e0b' }}>{r.rating}★</span>
                        {r.is_responded && <span style={{ fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:20, background:'#f0fdf4', color:'#16a34a' }}>✓ Responded</span>}
                        <span style={{ fontSize:11, color:'#9ca3af', marginLeft:'auto' }}>
                          {r.review_date ? new Date(r.review_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:'#374151', lineHeight:1.6, marginTop:6 }}>{r.review_text||'(No text)'}</div>
                    </div>
                  </div>

                  {/* Response area */}
                  <div style={{ marginLeft:44, background:'#f9fafb', borderRadius:9, padding:'10px 14px' }}>
                    {editingId===r.review_id ? (
                      <div>
                        <textarea value={draftResponses[r.review_id]||''} onChange={e=>setDraftResponses(prev=>({...prev,[r.review_id]:e.target.value}))} rows={3}
                          style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #5bc6d0', fontSize:13, resize:'vertical', outline:'none', boxSizing:'border-box' }}/>
                        <div style={{ display:'flex', gap:6, marginTop:6 }}>
                          <button onClick={()=>saveGoogleResponse(r.review_id)}
                            style={{ padding:'5px 12px', borderRadius:7, border:'none', background:'#ea2729', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Save</button>
                          <button onClick={()=>{ setGeneratingId(null); generateAIResponse(r) }} disabled={generatingId===r.review_id}
                            style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #5bc6d0', background:'transparent', color:'#5bc6d0', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                            {generatingId===r.review_id?<Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={11}/>} Regenerate
                          </button>
                          <button onClick={()=>setEditingId(null)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #e5e7eb', background:'transparent', color:'#6b7280', fontSize:12, cursor:'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : draftResponses[r.review_id] || r.response_text ? (
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#5bc6d0', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Response Draft</div>
                        <div style={{ fontSize:13, color:'#374151', lineHeight:1.6, cursor:'text' }} onClick={()=>setEditingId(r.review_id)}>
                          {draftResponses[r.review_id]||r.response_text}
                        </div>
                        <button onClick={()=>setEditingId(r.review_id)} style={{ marginTop:4, fontSize:12, color:'#5bc6d0', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>Edit</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>{ generateAIResponse(r); setEditingId(r.review_id) }} disabled={generatingId===r.review_id}
                          style={{ padding:'5px 12px', borderRadius:7, border:'none', background:'#5bc6d0', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                          {generatingId===r.review_id?<Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={11}/>}
                          {generatingId===r.review_id?'Generating…':'AI Draft'}
                        </button>
                        <button onClick={()=>{ setDraftResponses(prev=>({...prev,[r.review_id]:''})); setEditingId(r.review_id) }}
                          style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #e5e7eb', background:'transparent', color:'#374151', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          Write
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:6,padding:'0 16px 10px',overflowX:'auto',scrollbarWidth:'none'}}>
          {[0,...starArr].map(s=>(
            <button key={s} onClick={()=>setFilterStars(s)}
              style={{flexShrink:0,padding:'5px 12px',borderRadius:20,border:`1px solid ${filterStars===s?'#ea2729':'#ececea'}`,background:filterStars===s?'#ea2729':'#fff',color:filterStars===s?'#fff':'#5a5a58',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>
              {s===0?'All':'★'.repeat(s)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Loading…</div>
        ) : !selectedClient ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>Select a client to view their reviews</div>
        ) : fReviews.length===0 ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>No reviews found</div>
        ) : (
          <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:10}}>
            {fReviews.map(r=>{
              const stars='★'.repeat(r.star_rating||0)+'☆'.repeat(5-(r.star_rating||0))
              const isNeg=(r.star_rating||0)<=2
              return (
                <div key={r.id} style={{background:'#fff',borderRadius:14,border:`1px solid ${isNeg?'#fecaca':'#ececea'}`,padding:'14px',borderLeft:`3px solid ${isNeg?'#ea2729':'#16a34a'}`}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                    <div>
                      <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:14,fontWeight:700,color:'#0a0a0a'}}>{r.reviewer_name||'Anonymous'}</div>
                      <div style={{fontSize:13,color:'#f59e0b',letterSpacing:1}}>{stars}</div>
                    </div>
                    <span style={{fontSize:11,color:'#9a9a96',flexShrink:0}}>{r.platform}</span>
                  </div>
                  {r.review_text && <p style={{fontSize:14,color:'#5a5a58',margin:'0 0 8px',lineHeight:1.55,fontFamily:"'Raleway',sans-serif"}}>{r.review_text}</p>}
                  {r.response_text ? (
                    <div style={{background:'#f8f8f6',borderRadius:9,padding:'10px 12px',borderLeft:'2px solid #5bc6d0'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#5bc6d0',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",marginBottom:4}}>YOUR RESPONSE</div>
                      <p style={{fontSize:13,color:'#5a5a58',margin:0,lineHeight:1.5}}>{r.response_text}</p>
                    </div>
                  ) : isNeg && (
                    <button style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid #ea2729',background:'transparent',color:'#ea2729',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>
                      Generate AI Response
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
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
                <button onClick={()=>syncGoogleReviews(selectedClient)} disabled={syncing}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:9, border:'none', background:'#4285f4', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {syncing ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={13}/>}
                  {syncing ? 'Syncing…' : 'Sync Google Reviews'}
                </button>
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
