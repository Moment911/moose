"use client"
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { X, ArrowLeft, AlertTriangle } from 'lucide-react'

export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedAgency, impersonatedClient, impersonateClient, stopImpersonating } = useAuth()
  const navigate = useNavigate()

  if (!isImpersonating) return null

  const AMBER = '#f59e0b'
  const FH = "'Proxima Nova','Nunito Sans',sans-serif"

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:9999,
      background:`linear-gradient(90deg, ${AMBER} 0%, #f97316 100%)`,
      padding:'9px 20px', display:'flex', alignItems:'center', gap:12,
      boxShadow:'0 2px 16px rgba(0,0,0,.25)',
    }}>
      <AlertTriangle size={15} color="#fff"/>
      <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff', fontFamily:FH }}>
        {impersonatedClient
          ? <span>👁 Viewing client <strong>{impersonatedClient.name}</strong> in <strong>{impersonatedAgency?.name}</strong></span>
          : <span>⚡ Impersonating <strong>{impersonatedAgency?.name}</strong> — you see their data as they do</span>
        }
      </div>
      {impersonatedClient && (
        <button onClick={()=>impersonateClient(null)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
          <ArrowLeft size={12}/> Back to Agency View
        </button>
      )}
      <button onClick={()=>{ stopImpersonating(); navigate('/koto-admin') }}
        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
        <X size={12}/> Exit Impersonation
      </button>
    </div>
  )
}
