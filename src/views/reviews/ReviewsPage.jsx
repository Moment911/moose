"use client"
import { useState, useEffect } from 'react'
import { Star, MessageSquare, Sparkles, RefreshCw, Check, Loader2, Search, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

function StarRow({ rating, size=13 }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} color="#f59e0b" fill={i<=rating?'#f59e0b':'none'}/>
      ))}
    </div>
  )
}

function ReviewCard({ review, clientName, onGenerate, onSave, generating }) {
  const [expanded, setExpanded] = useState(false)
  const [draft,    setDraft]    = useState(review.ai_response || review.response_text || '')
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const isLong = (review.review_text || '').length > 220
  const rColor = review.rating >= 4 ? '#16a34a' : review.rating >= 3 ? '#f59e0b' : RED

  useEffect(() => {
    setDraft(review.ai_response || review.response_text || '')
  }, [review.ai_response, review.response_text])

  async function save() {
    setSaving(true)
    await onSave(review.id, draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:10 }}>
      <div style={{ padding:'14px 18px', display:'flex', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:TEAL+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:16, fontWeight:900, color:TEAL }}>
          {review.reviewer_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
            <span style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>{review.reviewer_name || 'Anonymous'}</span>
            <StarRow rating={review.rating}/>
            <span style={{ fontSize:12, fontWeight:900, color:rColor, fontFamily:FH }}>{review.rating}★</span>
            {review.is_responded && (
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'#f0fdf4', color:'#16a34a', fontFamily:FH, display:'flex', alignItems:'center', gap:3 }}>
                <Check size={10}/> Responded
              </span>
            )}
            <span style={{ fontSize:11, color:'#9ca3af', marginLeft:'auto' }}>
              {review.review_date ? new Date(review.review_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}
            </span>
          </div>
          <div style={{ fontSize:14, color:'#374151', lineHeight:1.65, fontFamily:FB }}>
            {isLong && !expanded ? review.review_text?.slice(0,220)+'…' : review.review_text || '(No text)'}
            {isLong && (
              <button onClick={()=>setExpanded(!expanded)}
                style={{ marginLeft:6, fontSize:12, color:TEAL, background:'none', border:'none', cursor:'pointer', fontWeight:700, fontFamily:FH }}>
                {expanded?'Less':'More'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 18px', background:'#fafafa' }}>
        {!draft && !editing ? (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{ onGenerate(review.id); setEditing(true) }} disabled={generating===review.id}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'none', background:TEAL, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              {generating===review.id ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> : <Sparkles size={12}/>}
              {generating===review.id ? 'Generating…' : 'AI Draft'}
            </button>
            <button onClick={()=>setEditing(true)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <MessageSquare size={12}/> Write
            </button>
          </div>
        ) : editing ? (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6, fontFamily:FH }}>
              Response Draft
            </div>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={4}
              style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, resize:'vertical', outline:'none', boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor=TEAL} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={save} disabled={saving||!draft.trim()}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                {saving ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> : <Check size={12}/>} Save
              </button>
              <button onClick={()=>{ onGenerate(review.id) }} disabled={generating===review.id}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:`1px solid ${TEAL}`, background:'transparent', color:TEAL, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <RefreshCw size={12}/> Regenerate
              </button>
              <button onClick={()=>{ setEditing(false); setDraft(review.ai_response||review.response_text||'') }}
                style={{ padding:'7px 12px', borderRadius:9, border:'1px solid #e5e7eb', background:'transparent', color:'#6b7280', fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div onClick={()=>setEditing(true)} style={{ cursor:'pointer' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, fontFamily:FH }}>Saved Response</div>
            <div style={{ fontSize:13, color:'#374151', lineHeight:1.65, fontFamily:FB }}>{draft}</div>
            <button style={{ marginTop:6, fontSize:12, color:TEAL, background:'none', border:'none', cursor:'pointer', fontWeight:700, fontFamily:FH }}>Edit</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReviewsPage() {
  const { agencyId } = useAuth()
  const [clients,    setClients]    = useState([])
  const [clientId,   setClientId]   = useState('')
  const [placeId,    setPlaceId]    = useState('')
  const [reviews,    setReviews]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [fetching,   setFetching]   = useState(false)
  const [generating, setGenerating] = useState(null)
  const [filter,     setFilter]     = useState('all')
  const [search,     setSearch]     = useState('')
  const [stats,      setStats]      = useState(null)

  useEffect(()=>{ loadClients() }, [agencyId])
  useEffect(()=>{ if(clientId) loadReviews() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,industry').eq('agency_id', agencyId||'').order('name')
    setClients(data||[])
  }

  async function loadReviews() {
    setLoading(true)
    const { data } = await supabase.from('reviews').select('*').eq('client_id', clientId).order('review_date',{ascending:false})
    const r = data||[]
    setReviews(r)
    if (r.length) {
      const withRating = r.filter(x=>x.rating)
      const avg = withRating.length ? withRating.reduce((s,x)=>s+x.rating,0)/withRating.length : 0
      setStats({ total:r.length, avg_rating:Math.round(avg*10)/10, responded:r.filter(x=>x.is_responded).length, positive:r.filter(x=>x.rating>=4).length, negative:r.filter(x=>x.rating<=2).length })
    } else { setStats(null) }
    setLoading(false)
  }

  async function fetchFromGoogle() {
    if (!placeId.trim()) { toast.error('Enter a Google Place ID'); return }
    setFetching(true)
    toast.loading('Fetching from Google…', {id:'fetch'})
    try {
      const res = await fetch('/api/reviews', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'fetch', client_id:clientId, agency_id:agencyId, place_id:placeId.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(`Fetched ${data.reviews?.length||0} reviews — ★${data.rating} avg`, {id:'fetch'})
      loadReviews()
    } catch(e) { toast.error('Failed: '+e.message, {id:'fetch'}) }
    setFetching(false)
  }

  async function generateResponse(reviewId) {
    setGenerating(reviewId)
    const client = clients.find(c=>c.id===clientId)
    try {
      const res = await fetch('/api/reviews', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_response', review_id:reviewId, business_name:client?.name }),
      })
      const data = await res.json()
      if (data.response) setReviews(prev=>prev.map(r=>r.id===reviewId?{...r,ai_response:data.response}:r))
    } catch(e) { toast.error('AI generation failed') }
    setGenerating(null)
  }

  async function saveResponse(reviewId, text) {
    await fetch('/api/reviews', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'save_response', review_id:reviewId, custom_response:text }),
    })
    setReviews(prev=>prev.map(r=>r.id===reviewId?{...r,response_text:text,is_responded:true}:r))
  }

  const filtered = reviews.filter(r => {
    if (filter==='unresponded' && r.is_responded) return false
    if (filter==='positive'    && r.rating < 4)   return false
    if (filter==='negative'    && r.rating > 2)   return false
    if (search && !r.review_text?.toLowerCase().includes(search.toLowerCase()) && !r.reviewer_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:BLK, padding:'20px 32px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:16 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:24, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em' }}>Reviews</h1>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:'3px 0 0', fontFamily:FB }}>Monitor, respond, and manage client reviews with AI</p>
            </div>
            <select value={clientId} onChange={e=>setClientId(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:14, fontFamily:FH, minWidth:200 }}>
              <option value="">Select client</option>
              {clients.map(c=><option key={c.id} value={c.id} style={{color:BLK,background:'#fff'}}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>
          {!clientId ? (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <Star size={44} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>Select a client to manage reviews</div>
              <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>Fetch Google reviews, generate AI responses, and track your review score</div>
            </div>
          ) : (
            <>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:10 }}>Fetch Google Reviews</div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <input value={placeId} onChange={e=>setPlaceId(e.target.value)} placeholder="Google Place ID (e.g. ChIJ...)"
                    style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, outline:'none', color:BLK }}
                    onFocus={e=>e.target.style.borderColor=TEAL} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  <a href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder" target="_blank" rel="noreferrer"
                    style={{ fontSize:12, color:TEAL, fontFamily:FH, fontWeight:700, whiteSpace:'nowrap', textDecoration:'none' }}>Find Place ID ↗</a>
                  <button onClick={fetchFromGoogle} disabled={fetching||!placeId.trim()}
                    style={{ padding:'9px 18px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                    {fetching?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<RefreshCw size={13}/>}
                    {fetching?'Fetching…':'Fetch Reviews'}
                  </button>
                </div>
              </div>

              {stats && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
                  {[
                    { label:'Total',         value:stats.total,            color:BLK },
                    { label:'Avg Rating',    value:'★'+stats.avg_rating,   color:'#f59e0b' },
                    { label:'Responded',     value:stats.responded,        color:'#16a34a' },
                    { label:'Need Response', value:stats.total-stats.responded, color:RED },
                    { label:'Negative',      value:stats.negative,         color:RED },
                  ].map((s,i)=>(
                    <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'12px 14px' }}>
                      <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center' }}>
                <div style={{ display:'flex', background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  {['all','unresponded','positive','negative'].map(f=>(
                    <button key={f} onClick={()=>setFilter(f)}
                      style={{ padding:'8px 14px', border:'none', background:filter===f?RED:'transparent', color:filter===f?'#fff':'#374151', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, textTransform:'capitalize' }}>
                      {f==='all'?'All':f==='unresponded'?'Need Response':f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:'8px 12px' }}>
                  <Search size={14} color="#9ca3af"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reviews…"
                    style={{ border:'none', outline:'none', fontSize:13, flex:1, color:BLK, background:'transparent' }}/>
                </div>
                <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FH, fontWeight:600 }}>{filtered.length} review{filtered.length!==1?'s':''}</div>
              </div>

              {loading ? (
                <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} color={RED} style={{animation:'spin 1s linear infinite'}}/></div>
              ) : filtered.length===0 ? (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                  <Star size={36} color="#e5e7eb" style={{ margin:'0 auto 14px' }}/>
                  <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK, marginBottom:6 }}>
                    {reviews.length===0?'No reviews yet':'No reviews match your filter'}
                  </div>
                  <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>
                    {reviews.length===0?'Enter a Google Place ID above to fetch reviews':'Try changing your filter'}
                  </div>
                </div>
              ) : filtered.map(r=>(
                <ReviewCard key={r.id} review={r} clientName={clients.find(c=>c.id===clientId)?.name}
                  onGenerate={generateResponse} onSave={saveResponse} generating={generating}/>
              ))}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
