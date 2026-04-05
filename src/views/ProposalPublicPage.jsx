"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Check, CheckCircle, Loader2, FileText, Clock, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'
const PRICE_LABELS = { monthly:'/ mo', one_time:'one-time', hourly:'/ hr', custom:'' }

export default function ProposalPublicPage() {
  const { token } = useParams()
  const canvasRef = useRef(null)
  const [proposal, setProposal] = useState(null)
  const [sections, setSections] = useState([])
  const [existingSig, setExistingSig] = useState(null)
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [token])

  async function load() {
    const { data: prop } = await supabase.from('proposals').select('*, clients(name, industry)').eq('public_token', token).single()
    if (!prop) { setLoading(false); return }
    setProposal(prop)

    const [{ data: secs }, { data: sig }] = await Promise.all([
      supabase.from('proposal_sections').select('*').eq('proposal_id', prop.id).order('sort_order'),
      supabase.from('proposal_signatures').select('*').eq('proposal_id', prop.id).eq('party','client').single(),
    ])
    setSections(secs || [])
    if (sig) setExistingSig(sig)

    // Mark as viewed
    if (prop.status === 'sent') {
      await supabase.from('proposals').update({ status:'viewed', viewed_at: new Date().toISOString() }).eq('id', prop.id)
    }
    setLoading(false)

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.strokeStyle='#111'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round'
    }
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const t = e.touches?.[0]||e
    return { x: t.clientX-rect.left, y: t.clientY-rect.top }
  }
  function start(e) { e.preventDefault(); setDrawing(true); const ctx=canvasRef.current.getContext('2d'); const {x,y}=getPos(e); ctx.beginPath(); ctx.moveTo(x,y) }
  function move(e)  { e.preventDefault(); if(!drawing)return; const ctx=canvasRef.current.getContext('2d'); const {x,y}=getPos(e); ctx.lineTo(x,y); ctx.stroke() }
  function clear()  { canvasRef.current.getContext('2d').clearRect(0,0,canvasRef.current.width,canvasRef.current.height) }

  async function sign() {
    if (!signerName.trim()||!agreed) { toast.error('Enter your name and agree to the terms'); return }
    setSubmitting(true)
    const sigData = canvasRef.current.toDataURL('image/png')
    await supabase.from('proposal_signatures').insert({
      proposal_id: proposal.id, signer_name: signerName,
      signer_email: signerEmail, signer_title: signerTitle,
      signature_data: sigData, party: 'client',
    })
    await supabase.from('proposals').update({ status:'accepted', accepted_at: new Date().toISOString() }).eq('id', proposal.id)
    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><Loader2 size={28} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/></div>
  if (!proposal) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:16, color:'#4b5563' }}>Proposal not found.</div>

  const totalMonthly = sections.filter(s=>s.price_type==='monthly').reduce((sum,s)=>sum+(s.price||0),0)
  const totalOneTime = sections.filter(s=>s.price_type==='one_time').reduce((sum,s)=>sum+(s.price||0),0)

  return (
    <div style={{ minHeight:'100vh', background:'#f4f4f5' }}>
      <Toaster position="top-right"/>
      {/* Header */}
      <div style={{ background:'#18181b', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Koto</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,.4)' }}>Secure proposal · Powered by Koto</div>
      </div>

      <div style={{ maxWidth:780, margin:'0 auto', padding:'32px 20px 80px' }}>
        {/* Proposal header */}
        <div style={{ background:'#18181b', borderRadius:16, padding:'36px 40px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.35)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>
            {proposal.type==='agreement'?'Service Agreement':proposal.type==='sow'?'Statement of Work':'Proposal'}
          </div>
          <h1 style={{ fontSize:30, fontWeight:900, color:'#fff', marginBottom:8, letterSpacing:-0.5 }}>{proposal.title}</h1>
          {proposal.clients?.name && <div style={{ fontSize:15, color:'rgba(255,255,255,.45)' }}>Prepared for {proposal.clients.name}</div>}
          {proposal.valid_until && <div style={{ fontSize:15, color:'rgba(255,255,255,.3)', marginTop:4 }}>Valid until {new Date(proposal.valid_until).toLocaleDateString()}</div>}
        </div>

        {/* Body */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'36px 40px', marginBottom:20 }}>
          {proposal.intro && (
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Introduction</div>
              <div style={{ fontSize:15, color:'#374151', lineHeight:1.85, whiteSpace:'pre-wrap' }}>{proposal.intro}</div>
            </div>
          )}
          {proposal.executive_summary && (
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Overview</div>
              <div style={{ fontSize:15, color:'#374151', lineHeight:1.85, whiteSpace:'pre-wrap' }}>{proposal.executive_summary}</div>
            </div>
          )}

          {sections.length > 0 && (
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:16 }}>Services Included</div>
              {sections.map((sec, i) => {
                const delivs = typeof sec.deliverables==='string' ? JSON.parse(sec.deliverables||'[]') : (sec.deliverables||[])
                return (
                  <div key={i} style={{ borderLeft:`3px solid ${ACCENT}`, paddingLeft:20, marginBottom:28 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                      <h3 style={{ fontSize:16, fontWeight:800, color:'#111' }}>{sec.title}</h3>
                      <div>
                        {sec.price>0&&<span style={{ fontSize:16, fontWeight:800, color:ACCENT }}>${Number(sec.price).toLocaleString()} {PRICE_LABELS[sec.price_type]}</span>}
                        {sec.is_optional&&<div style={{ fontSize:13, color:'#4b5563' }}>Optional</div>}
                      </div>
                    </div>
                    {sec.content&&<div style={{ fontSize:15, color:'#374151', lineHeight:1.75, marginBottom:10 }}>{sec.content}</div>}
                    {delivs.filter(d=>d).map((d,j)=>(
                      <div key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, color:'#374151', marginBottom:5 }}>
                        <Check size={12} color={ACCENT} style={{ flexShrink:0 }}/>{d}
                      </div>
                    ))}
                    {sec.timeline&&<div style={{ fontSize:14, color:'#4b5563', marginTop:8, display:'flex', alignItems:'center', gap:5 }}><Clock size={11}/>{sec.timeline}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {(totalMonthly>0||totalOneTime>0) && (
            <div style={{ background:'#f9fafb', borderRadius:12, padding:'18px 22px', marginBottom:28 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Your Investment</div>
              {totalMonthly>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#111', marginBottom:6 }}><span>Monthly retainer</span><span style={{ fontWeight:800 }}>${totalMonthly.toLocaleString()}/mo</span></div>}
              {totalOneTime>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#111' }}><span>One-time setup</span><span style={{ fontWeight:800 }}>${totalOneTime.toLocaleString()}</span></div>}
            </div>
          )}

          {proposal.terms&&(
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Terms & Conditions</div>
              <div style={{ fontSize:14, color:'#4b5563', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{proposal.terms}</div>
            </div>
          )}
        </div>

        {/* Signature block */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'28px 32px' }}>
          {submitted || existingSig ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <CheckCircle size={32} color="#16a34a"/>
              </div>
              <h2 style={{ fontSize:22, fontWeight:900, color:'#111', marginBottom:6 }}>Proposal Accepted</h2>
              <p style={{ fontSize:15, color:'#374151' }}>
                {existingSig ? `Signed by ${existingSig.signer_name}` : 'Your signature has been saved.'}
                {existingSig?.signed_at ? ` on ${new Date(existingSig.signed_at).toLocaleDateString()}` : ''}
              </p>
            </div>
          ) : (
            <>
              <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                <Shield size={16} color={ACCENT}/> Sign & Accept
              </div>
              <div style={{ fontSize:15, color:'#4b5563', marginBottom:20 }}>By signing, you accept this proposal and its terms.</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[['Full name *', signerName, setSignerName,'Your legal name'],['Title', signerTitle, setSignerTitle,'Your title'],['Email', signerEmail, setSignerEmail,'your@email.com']].slice(0,2).map(([label,val,set,ph])=>(
                  <div key={label}>
                    <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>{label}</label>
                    <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>Email</label>
                <input value={signerEmail} onChange={e=>setSignerEmail(e.target.value)} placeholder="your@email.com"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Signature</label>
                <div style={{ border:'2px dashed #e5e7eb', borderRadius:12, position:'relative', background:'#fafafa' }}>
                  <canvas ref={canvasRef} width={700} height={140} style={{ width:'100%', cursor:'crosshair', display:'block' }}
                    onMouseDown={start} onMouseMove={move} onMouseUp={()=>setDrawing(false)} onMouseLeave={()=>setDrawing(false)}
                    onTouchStart={start} onTouchMove={move} onTouchEnd={()=>setDrawing(false)}/>
                  <button onClick={clear} style={{ position:'absolute', top:8, right:10, fontSize:13, color:'#4b5563', border:'none', background:'none', cursor:'pointer' }}>Clear</button>
                </div>
                <div style={{ fontSize:13, color:'#4b5563', marginTop:4 }}>Draw your signature above</div>
              </div>
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:16, cursor:'pointer', fontSize:15, color:'#374151', lineHeight:1.6 }}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ marginTop:3, flexShrink:0 }}/>
                I have reviewed this {proposal.type||'proposal'} and agree to its terms. I understand this constitutes a legally binding electronic signature.
              </label>
              <button onClick={sign} disabled={submitting||!signerName.trim()||!agreed}
                style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', opacity:!signerName.trim()||!agreed?.5:1, boxShadow:`0 4px 16px ${ACCENT}40` }}>
                {submitting?<><Loader2 size={14} style={{animation:'spin 1s linear infinite', display:'inline', marginRight:6}}/>Saving…</>:'Accept & Sign Proposal'}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
