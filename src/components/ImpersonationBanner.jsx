"use client"
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { X, ArrowLeft, ChevronRight } from 'lucide-react'

const FH = "'Proxima Nova','Nunito Sans',sans-serif"

export default function ImpersonationBanner() {
  const {
    isImpersonating, impersonatedAgency, impersonatedClient,
    impersonateClient, stopImpersonating,
    isPreviewingClient, clientPreview, stopClientPreview,
  } = useAuth()
  const navigate = useNavigate()

  // Level 3: Agency previewing a client
  if (isPreviewingClient) {
    return (
      <div style={{
        position:'fixed', top:0, left:0, right:0, zIndex:9999,
        background:'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
        padding:'9px 20px', display:'flex', alignItems:'center', gap:12,
        boxShadow:'0 2px 16px rgba(0,0,0,.3)',
      }}>
        <span style={{ fontSize:15 }}>👁</span>
        <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff', fontFamily:FH }}>
          Previewing client portal as <strong>{clientPreview?.name}</strong> — this is exactly what they see
        </div>
        <button onClick={()=>{ stopClientPreview(); navigate(-1) }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
          <ArrowLeft size={12}/> Exit Client View
        </button>
      </div>
    )
  }

  // Level 2: Koto viewing a specific client inside an agency
  if (isImpersonating && impersonatedClient) {
    return (
      <div style={{
        position:'fixed', top:0, left:0, right:0, zIndex:9999,
        background:'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)',
        padding:'9px 20px', display:'flex', alignItems:'center', gap:12,
        boxShadow:'0 2px 16px rgba(0,0,0,.3)',
      }}>
        <span style={{ fontSize:15 }}>⚡</span>
        <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ opacity:.8 }}>Koto</span>
          <ChevronRight size={12}/>
          <span style={{ opacity:.8 }}>{impersonatedAgency?.name}</span>
          <ChevronRight size={12}/>
          <strong>{impersonatedClient.name}</strong>
        </div>
        <button onClick={()=>impersonateClient(null)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
          <ArrowLeft size={12}/> Back to Agency
        </button>
        <button onClick={()=>{ stopImpersonating(); navigate('/koto-admin') }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
          <X size={12}/> Exit
        </button>
      </div>
    )
  }

  // Level 1: Koto viewing an agency
  if (isImpersonating) {
    return (
      <div style={{
        position:'fixed', top:0, left:0, right:0, zIndex:9999,
        background:'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
        padding:'9px 20px', display:'flex', alignItems:'center', gap:12,
        boxShadow:'0 2px 16px rgba(0,0,0,.3)',
      }}>
        <span style={{ fontSize:15 }}>⚡</span>
        <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ opacity:.8 }}>Koto</span>
          <ChevronRight size={12}/>
          <strong>{impersonatedAgency?.name}</strong>
          <span style={{ fontSize:11, opacity:.7, fontWeight:400 }}>— you see their workspace</span>
        </div>
        <button onClick={()=>{ stopImpersonating(); navigate('/koto-admin') }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
          <X size={12}/> Exit Impersonation
        </button>
      </div>
    )
  }

  return null
}
