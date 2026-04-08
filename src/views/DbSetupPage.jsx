"use client"
import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Copy, Check, ExternalLink, HardDrive, RefreshCw, Loader2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const RED  = '#E6007E'
const TEAL = '#00C2CB'
const BLK = '#111111'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

// All tables the app needs
const REQUIRED_TABLES = [
  { name:'clients',                  category:'Core',        desc:'Client records' },
  { name:'agencies',                 category:'Core',        desc:'Agency records' },
  { name:'projects',                 category:'Core',        desc:'Client projects' },
  { name:'proposals',                category:'Core',        desc:'Proposal builder' },
  { name:'seo_connections',          category:'SEO Hub',     desc:'Google OAuth connections' },
  { name:'seo_keyword_tracking',     category:'SEO Hub',     desc:'Keyword position tracking' },
  { name:'seo_reports',              category:'SEO Hub',     desc:'AI SEO reports' },
  { name:'wp_seo_sites',             category:'SEO Hub',     desc:'WordPress plugin connections' },
  { name:'local_rank_scans',         category:'Rank Tracker',desc:'Single scan results' },
  { name:'local_rank_grid_scans',    category:'Rank Tracker',desc:'Grid heatmap scan results' },
  { name:'desk_tickets',             category:'KotoDesk',    desc:'Support tickets' },
  { name:'desk_replies',             category:'KotoDesk',    desc:'Ticket replies' },
  { name:'desk_agents',              category:'KotoDesk',    desc:'Support agents' },
  { name:'desk_knowledge',           category:'KotoDesk',    desc:'Q&A knowledge base' },
  { name:'perf_snapshots',           category:'Performance', desc:'Ad performance data' },
  { name:'perf_campaigns',           category:'Performance', desc:'Campaign data' },
  { name:'perf_keywords',            category:'Performance', desc:'PPC keywords' },
  { name:'perf_recommendations',     category:'Performance', desc:'AI recommendations' },
  { name:'reviews',                  category:'Reviews',     desc:'Google reviews + AI responses' },
  { name:'client_portal_sessions',   category:'Client Portal', desc:'Portal access tokens' },
  { name:'subscriptions',            category:'Billing',     desc:'Stripe subscription data' },
]

export default function DbSetupPage() {
  const [status,   setStatus]   = useState({})
  const [loading,  setLoading]  = useState(true)
  const [copied,   setCopied]   = useState(false)
  const [sqlText,  setSqlText]  = useState('')

  useEffect(() => { checkTables(); loadSql() }, [])

  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)

  async function checkTables() {
    setLoading(true)
    const results = {}
    await Promise.all(REQUIRED_TABLES.map(async t => {
      const { error } = await supabase.from(t.name).select('count').limit(0)
      // 42P01 = relation does not exist, PGRST116 = table not found
      results[t.name] = !error || (error.code !== '42P01' && error.code !== 'PGRST116' && !error.message?.includes('does not exist'))
    }))
    setStatus(results)
    setLoading(false)
  }

  async function runAutoMigrate() {
    setMigrating(true)
    setMigrateResult(null)
    try {
      const res = await fetch('/api/auto-migrate')
      const data = await res.json()
      setMigrateResult(data)
      if (data.status === 'migrated' || data.status === 'all_ready') {
        toast.success('Migration complete!')
        setTimeout(checkTables, 1000)
      } else if (data.status === 'needs_migration') {
        toast('Add SUPABASE_ACCESS_TOKEN to enable auto-migration')
      }
    } catch(e) { toast.error('Migration failed: ' + e.message) }
    setMigrating(false)
  }

  async function loadSql() {
    try {
      const res = await fetch('/RUN_THIS_NOW_consolidated.sql')
      if (res.ok) setSqlText(await res.text())
    } catch {}
  }

  function copySQL() {
    if (sqlText) {
      navigator.clipboard.writeText(sqlText)
      setCopied(true)
      toast.success('SQL copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const missing = REQUIRED_TABLES.filter(t => status[t.name] === false)
  const ready   = REQUIRED_TABLES.filter(t => status[t.name] === true)
  const allReady = missing.length === 0 && !loading

  // Group by category
  const categories = [...new Set(REQUIRED_TABLES.map(t => t.category))]

  // Get Supabase project ID from URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
  const sqlEditorUrl = projectId
    ? `https://supabase.com/dashboard/project/${projectId}/sql/new`
    : 'https://supabase.com/dashboard'

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:860, margin:'0 auto', padding:'32px 24px' }}>

          {/* Header */}
          <div style={{ marginBottom:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <HardDrive size={22} color={RED}/>
              <h1 style={{ fontFamily:FH, fontSize:24, fontWeight:800, color:BLK, margin:0, letterSpacing:'-.03em' }}>
                HardDrive Setup
              </h1>
            </div>
            <p style={{ fontSize:15, color:'#6b7280', fontFamily:FB, margin:0 }}>
              All Koto features require certain database tables in Supabase.
              Check status and run the setup SQL in one click.
            </p>
          </div>

          {/* Status banner */}
          {!loading && (
            <div style={{ borderRadius:14, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:14,
              background:allReady?'#f0fdf4':'#fef3c7',
              border:allReady?'1px solid #bbf7d0':'1px solid #fde68a' }}>
              {allReady
                ? <CheckCircle size={22} color="#16a34a"/>
                : <AlertCircle size={22} color="#d97706"/>}
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:allReady?'#15803d':'#92400e', marginBottom:2 }}>
                  {allReady ? 'All tables ready ✓' : `${missing.length} table${missing.length>1?'s':''} need setup`}
                </div>
                <div style={{ fontSize:13, color:allReady?'#16a34a':'#78350f', fontFamily:FB }}>
                  {allReady
                    ? `${ready.length} tables verified · If features aren't working, run the SQL anyway — it's safe to run multiple times`
                    : `${ready.length} of ${REQUIRED_TABLES.length} tables exist · Run the SQL below to fix`}
                </div>
              </div>
              <button onClick={checkTables} disabled={loading}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9,
                  border:'1px solid rgba(0,0,0,.1)', background:'rgba(255,255,255,.7)',
                  fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, color:'#374151' }}>
                <RefreshCw size={13} style={loading?{animation:'spin 1s linear infinite'}:{}}/> Recheck
              </button>
            </div>
          )}

          {loading && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'40px', textAlign:'center', marginBottom:20 }}>
              <Loader2 size={24} color={RED} style={{ animation:'spin 1s linear infinite', margin:'0 auto 12px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:14, color:'#374151' }}>Checking database tables…</div>
            </div>
          )}

          {/* Setup steps — shown when tables are missing */}
          {!loading && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', marginBottom:20, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>
                How to set up
              </div>
              <div style={{ padding:'20px' }}>
                {[
                  { step:1, label:'Copy the SQL', action:
                    <button onClick={copySQL}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9,
                        border:`1.5px solid ${RED}`, background:copied?RED:'transparent',
                        color:copied?'#fff':RED, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                      {copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied!':'Copy SQL'}
                    </button>
                  },
                  { step:2, label:'Open your Supabase SQL Editor', action:
                    <a href={sqlEditorUrl} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9,
                        border:'1.5px solid #e5e7eb', background:'#f9fafb',
                        color:'#374151', fontSize:13, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
                      <ExternalLink size={13}/> Open SQL Editor
                    </a>
                  },
                  { step:3, label:'Paste and click Run', action:
                    <span style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>Ctrl+Enter or click the Run button</span>
                  },
                  { step:4, label:'Click Recheck above', action:
                    <span style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>Status will turn green when all tables are ready</span>
                  },
                ].map(({step, label, action}) => (
                  <div key={step} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:step<4?16:0 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:RED, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:13, fontWeight:900, flexShrink:0 }}>{step}</div>
                    <div style={{ flex:1, fontFamily:FH, fontSize:14, color:'#374151' }}>{label}</div>
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table status by category */}
          {!loading && categories.map(cat => {
            const tables = REQUIRED_TABLES.filter(t => t.category === cat)
            const catMissing = tables.filter(t => status[t.name] === false).length
            return (
              <div key={cat} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', marginBottom:12, overflow:'hidden' }}>
                <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>{cat}</div>
                  {catMissing > 0
                    ? <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#fef3c7', color:'#92400e', fontFamily:FH }}>{catMissing} missing</span>
                    : <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#f0fdf4', color:'#16a34a', fontFamily:FH }}>✓ Ready</span>
                  }
                </div>
                {tables.map((t,i) => (
                  <div key={t.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:i<tables.length-1?'1px solid #f9fafb':'none' }}>
                    {status[t.name] === true
                      ? <CheckCircle size={16} color="#16a34a"/>
                      : status[t.name] === false
                      ? <AlertCircle size={16} color="#d97706"/>
                      : <div style={{ width:16, height:16, borderRadius:'50%', background:'#f3f4f6' }}/>
                    }
                    <code style={{ fontSize:13, fontFamily:'monospace', color:status[t.name]===false?'#d97706':BLK, fontWeight:status[t.name]===false?700:400 }}>
                      {t.name}
                    </code>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{t.desc}</div>
                    <div style={{ marginLeft:'auto', fontSize:12, fontWeight:700, fontFamily:FH,
                      color:status[t.name]===true?'#16a34a':status[t.name]===false?'#d97706':'#9ca3af' }}>
                      {status[t.name]===true?'Ready':status[t.name]===false?'Missing':'—'}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
