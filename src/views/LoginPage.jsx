"use client";
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signIn } from '../lib/supabase'
import { Zap, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const R = '#ea2729'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) { toast.error(error.message); setLoading(false); return }
    // Redirect to intended page if coming from route guard
    const from = location.state?.from || '/'
    navigate(from, { replace: true })
  }

  const INP = {
    width:'100%',padding:'12px 16px',
    background:'rgba(255,255,255,.06)',
    border:'1px solid rgba(255,255,255,.1)',
    borderRadius:10,fontSize:15,color:'#fff',
    outline:'none',fontFamily:"var(--font-body)",
    transition:'border-color .15s',
    boxSizing:'border-box',
  }

  return (
    <div style={{
      minHeight:'100vh',background:'#0a0a0a',
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:"var(--font-body)",
      padding:24,
    }}>
      {/* Background grid */}
      <div style={{position:'fixed',inset:0,opacity:.04,
        backgroundImage:'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)',
        backgroundSize:'60px 60px',pointerEvents:'none'}}/>

      <div style={{width:'100%',maxWidth:400,position:'relative',zIndex:1}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{width:52,height:52,borderRadius:14,background:R,
            display:'flex',alignItems:'center',justifyContent:'center',
            margin:'0 auto 16px',boxShadow:`0 8px 24px ${R}50`}}>
            <Zap size={24} color="#fff" strokeWidth={2.5}/>
          </div>
          <div style={{fontFamily:"var(--font-display)",fontSize:28,fontWeight:800,
            color:'#fff',letterSpacing:'-.04em',lineHeight:1,marginBottom:8}}>
            Koto
          </div>
          <div style={{fontSize:14,color:'rgba(255,255,255,.4)'}}>
            Sign in to your agency platform
          </div>
        </div>

        {/* Form card */}
        <div style={{background:'rgba(255,255,255,.04)',borderRadius:18,
          border:'1px solid rgba(255,255,255,.08)',padding:'32px 28px',
          backdropFilter:'blur(20px)'}}>
          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{display:'block',fontSize:13,fontWeight:700,
                color:'rgba(255,255,255,.5)',textTransform:'uppercase',
                letterSpacing:'.08em',marginBottom:8}}>
                Email
              </label>
              <input
                type="email" value={email} required
                onChange={e=>setEmail(e.target.value)}
                placeholder="you@agency.com"
                style={INP}
                onFocus={e=>e.target.style.borderColor='rgba(234,39,41,.6)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.1)'}
              />
            </div>
            <div>
              <label style={{display:'block',fontSize:13,fontWeight:700,
                color:'rgba(255,255,255,.5)',textTransform:'uppercase',
                letterSpacing:'.08em',marginBottom:8}}>
                Password
              </label>
              <input
                type="password" value={password} required
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                style={INP}
                onFocus={e=>e.target.style.borderColor='rgba(234,39,41,.6)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.1)'}
              />
            </div>
            <button type="submit" disabled={loading}
              style={{marginTop:8,padding:'13px',borderRadius:12,border:'none',
                background:loading?'#333':R,color:'#fff',fontSize:15,fontWeight:700,
                cursor:loading?'not-allowed':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                boxShadow:loading?'none':`0 4px 16px ${R}40`,
                transition:'all .2s',fontFamily:"var(--font-body)"}}>
              {loading
                ? <><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Signing in…</>
                : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{textAlign:'center',marginTop:20,fontSize:13,color:'rgba(255,255,255,.25)'}}>
          Need access? Contact your agency administrator
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input::placeholder { color: rgba(255,255,255,.25) !important }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #111 inset !important; -webkit-text-fill-color: #fff !important; }
      `}</style>
    </div>
  )
}