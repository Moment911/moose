"use client"
import { useState, useEffect } from 'react'
import {
  Sparkles, Star, Target, FileText, Globe, Brain, Mail,
  CheckCircle, BarChart2, TrendingUp, Shield, Code2,
  MessageSquare, Zap, MapPin, Loader2, ArrowRight,
  Lock, Check, ExternalLink
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const PURP  = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const ICON_MAP = {
  Star, Target, FileText, Globe, Brain, Mail, CheckCircle,
  BarChart2, TrendingUp, Shield, Code2, MessageSquare,
  Zap, MapPin, Sparkles,
}

const CATEGORY_CFG = {
  feature:     { label:'Features',     color: TEAL  },
  ai:          { label:'AI & Automation', color: PURP },
  integration: { label:'Integrations', color: AMBER  },
  reporting:   { label:'Reporting',    color: GREEN  },
}

const PLAN_ORDER = { starter:0, growth:1, agency:2 }
const PLAN_COLOR = { starter: TEAL, growth: RED, agency: '#111' }

function AddonCard({ addon, isEnabled, isPending, isPlanIncluded, userPlan, onRequest, requesting }) {
  const Icon = ICON_MAP[addon.icon] || Sparkles
  const catCfg = CATEGORY_CFG[addon.category] || CATEGORY_CFG.feature
  const planRequired = PLAN_ORDER[addon.min_plan] > PLAN_ORDER[userPlan]
  const hasPrice = addon.price_monthly > 0

  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: `1.5px solid ${isEnabled ? GREEN : '#e5e7eb'}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      opacity: planRequired ? .6 : 1, position: 'relative',
      boxShadow: isEnabled ? `0 0 0 3px ${GREEN}15` : 'none',
    }}>
      {/* Enabled badge */}
      {isEnabled && (
        <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, background:GREEN+'15', color:GREEN, fontSize:10, fontWeight:700, fontFamily:FH }}>
          <Check size={10} strokeWidth={3}/> Active
        </div>
      )}
      {isPlanIncluded && !isEnabled && (
        <div style={{ position:'absolute', top:12, right:12, padding:'3px 9px', borderRadius:20, background:TEAL+'15', color:TEAL, fontSize:10, fontWeight:700, fontFamily:FH }}>
          Included
        </div>
      )}

      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:catCfg.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={20} color={catCfg.color}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:3 }}>{addon.name}</div>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:catCfg.color+'15', color:catCfg.color, fontFamily:FH }}>
            {catCfg.label}
          </span>
        </div>
      </div>

      <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.7, flex:1 }}>
        {addon.description}
      </div>

      {/* Plan requirement */}
      {addon.min_plan !== 'starter' && (
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, color: PLAN_COLOR[addon.min_plan] || BLK, fontFamily:FH }}>
          <Lock size={10}/>
          Requires {addon.min_plan.charAt(0).toUpperCase() + addon.min_plan.slice(1)} plan
        </div>
      )}

      {/* Price / action */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
        <div style={{ fontFamily:FH, fontSize:14, fontWeight:900, color:hasPrice?RED:GREEN }}>
          {hasPrice ? `+$${addon.price_monthly}/mo` : 'Included'}
        </div>
        {planRequired ? (
          <button style={{ padding:'7px 14px', borderRadius:9, border:`1px solid ${PLAN_COLOR[addon.min_plan]}40`, background:`${PLAN_COLOR[addon.min_plan]}10`, color:PLAN_COLOR[addon.min_plan], fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
            Upgrade <ArrowRight size={11}/>
          </button>
        ) : isEnabled ? (
          <div style={{ fontSize:12, fontWeight:700, color:GREEN, fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
            <CheckCircle size={13}/> Enabled
          </div>
        ) : isPending ? (
          <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FH }}>Request pending…</div>
        ) : (
          <button onClick={() => onRequest(addon.key)}
            disabled={requesting === addon.key}
            style={{ padding:'7px 14px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
            {requesting === addon.key ? <Loader2 size={10} style={{ animation:'spin 1s linear infinite' }}/> : null}
            {requesting === addon.key ? 'Requesting…' : 'Request Access'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const { agencyId, realAgencyId } = useAuth()
  const [addons,    setAddons]    = useState([])
  const [enabled,   setEnabled]   = useState([])
  const [pending,   setPending]   = useState([])
  const [plan,      setPlan]      = useState('starter')
  const [loading,   setLoading]   = useState(true)
  const [category,  setCategory]  = useState('all')
  const [requesting,setRequesting]= useState(null)

  useEffect(() => { if (agencyId) load() }, [agencyId])

  async function load() {
    setLoading(true)
    const res  = await fetch(`/api/marketplace?agency_id=${agencyId}`)
    const data = await res.json()
    setAddons(data.addons || [])
    setEnabled(data.enabled || [])
    setPending((data.pending_requests || []).map(r => r.addon_key))
    setPlan(data.plan || 'starter')
    setLoading(false)
  }

  async function requestAddon(key) {
    setRequesting(key)
    const res  = await fetch('/api/marketplace', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', agency_id: agencyId, addon_key: key }),
    })
    const data = await res.json()
    if (data.error) {
      toast.error(data.error)
    } else {
      toast.success('Request sent to Koto team ✓')
      setPending(p => [...p, key])
    }
    setRequesting(null)
  }

  const categories = ['all', ...Object.keys(CATEGORY_CFG)]
  const filtered   = category === 'all' ? addons : addons.filter(a => a.category === category)

  const enabledCount  = enabled.length
  const totalCount    = addons.length
  const planIncludes  = addons.filter(a => PLAN_ORDER[a.min_plan] <= PLAN_ORDER[plan]).map(a => a.key)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'20px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
                <Sparkles size={18} color={AMBER}/> Koto Marketplace
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.35)', margin:'3px 0 0', fontFamily:FB }}>
                {enabledCount} of {totalCount} features active · {plan.charAt(0).toUpperCase()+plan.slice(1)} plan
              </div>
            </div>
            {/* Plan badge */}
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', fontFamily:FB, marginBottom:3 }}>Current Plan</div>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:900, color: PLAN_COLOR[plan]||'#fff', textTransform:'capitalize' }}>
                {plan}
              </div>
            </div>
          </div>

          {/* Category filter */}
          <div style={{ display:'flex', gap:6 }}>
            {categories.map(cat => {
              const cfg = CATEGORY_CFG[cat]
              const active = category === cat
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${active?(cfg?.color||'rgba(255,255,255,.3)'):'rgba(255,255,255,.12)'}`, background:active?(cfg?.color||'rgba(255,255,255,.15)')+(!cfg?'':'25'):'transparent', color:active?'#fff':'rgba(255,255,255,.45)', fontSize:11, fontWeight:active?700:500, cursor:'pointer', fontFamily:FH, textTransform:'capitalize' }}>
                  {cat === 'all' ? `All (${addons.length})` : (cfg?.label || cat)}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {/* Active features hero */}
          {enabledCount > 0 && category === 'all' && (
            <div style={{ background:`linear-gradient(135deg,${BLK},#1a1a2e)`, borderRadius:16, padding:'18px 22px', marginBottom:20 }}>
              <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                ✅ Active Features ({enabledCount})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                {enabled.map(key => {
                  const addon = addons.find(a => a.key === key)
                  if (!addon) return null
                  const Icon = ICON_MAP[addon.icon] || Sparkles
                  return (
                    <div key={key} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:20, background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.7)', fontSize:12, fontFamily:FB }}>
                      <Icon size={11}/> {addon.name}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
              <Loader2 size={28} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {filtered.map(addon => (
                <AddonCard
                  key={addon.key}
                  addon={addon}
                  isEnabled={enabled.includes(addon.key)}
                  isPending={pending.includes(addon.key)}
                  isPlanIncluded={planIncludes.includes(addon.key)}
                  userPlan={plan}
                  onRequest={requestAddon}
                  requesting={requesting}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
