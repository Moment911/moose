"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Copy, Check, Download, Share2, Printer, Search, Lock,
  Unlock, RefreshCw, Send, ExternalLink, ChevronDown,
  ChevronUp, Loader2, FileText, FileDown, Plus, Eye,
  CheckCircle, Globe, X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "\'Proxima Nova\',\'Nunito Sans\',\'Helvetica Neue\',sans-serif"
const FB    = "\'Raleway\',\'Helvetica Neue\',sans-serif"

// Deep-get nested value by dot-path
function dg(obj, path) {
  if (!obj) return undefined
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj)
}

const SECTIONS = [
  { id:'contact', title:'1. Primary Contact', icon:'👤', fields:[
    { key:'contact.first_name',  label:'First Name'          },
    { key:'contact.last_name',   label:'Last Name'           },
    { key:'contact.title',       label:'Title / Role'        },
    { key:'contact.email',       label:'Email'               },
    { key:'contact.phone',       label:'Primary Phone'       },
    { key:'phone2',              label:'Secondary Phone'     },
    { key:'contact_consent',     label:'Contact Preferences', array:true },
  ]},
  { id:'business', title:'2. Business Information', icon:'🏢', fields:[
    { key:'business_name',        label:'Business / Trade Name' },
    { key:'legal_name',           label:'Legal Business Name'   },
    { key:'industry',             label:'Industry'              },
    { key:'business_type',        label:'Business Type'         },
    { key:'year_founded',         label:'Year Founded'          },
    { key:'num_employees',        label:'Employees'             },
    { key:'annual_revenue',       label:'Annual Revenue'        },
    { key:'website',              label:'Website', link:true    },
    { key:'address',              label:'Street Address'        },
    { key:'suite',                label:'Suite / Unit'          },
    { key:'city',                 label:'City'                  },
    { key:'state',                label:'State'                 },
    { key:'zip',                  label:'ZIP Code'              },
    { key:'business_description', label:'Business Description', multiline:true },
  ]},
  { id:'services', title:'3. Products & Services', icon:'📦', fields:[
    { key:'products_services',         label:'Services Description', multiline:true },
    { key:'top_services',              label:'Top Revenue Services', array:true     },
    { key:'service_pricing_model',     label:'Pricing Model', array:true            },
    { key:'avg_transaction',           label:'Avg Job Value', prefix:'$'            },
    { key:'avg_project_value',         label:'Avg Project Value', prefix:'$'        },
    { key:'avg_visits_per_year',       label:'Jobs / Client / Year'                 },
    { key:'client_ltv',                label:'Customer Lifetime Value', prefix:'$'  },
    { key:'seasonal_notes',            label:'Seasonal Patterns', multiline:true    },
  ]},
  { id:'customers', title:'4. Ideal Customers', icon:'👥', fields:[
    { key:'customer_types',       label:'Customer Types', array:true            },
    { key:'ideal_customer_desc',  label:'Ideal Customer', multiline:true        },
    { key:'customer_age',         label:'Age Range', array:true                 },
    { key:'customer_gender',      label:'Gender Split'                          },
    { key:'customer_income',      label:'Income Level'                          },
    { key:'customer_pain_points', label:'Pain Points', multiline:true          },
    { key:'customer_goals',       label:'Customer Goals', multiline:true        },
    { key:'customer_lifestyle',   label:'Online Lifestyle', multiline:true      },
  ]},
  { id:'competition', title:'5. Competition', icon:'🎯', competitors:true, fields:[
    { key:'why_choose_you',   label:'Why Choose You', multiline:true },
    { key:'unique_value_prop',label:'UVP'                           },
  ]},
  { id:'geography', title:'6. Target Markets', icon:'🗺️', fields:[
    { key:'growth_scope',    label:'Growth Scope'               },
    { key:'primary_city',    label:'Primary City'               },
    { key:'primary_state',   label:'Primary State'              },
    { key:'travel_distance', label:'Travel / Service Radius'    },
    { key:'target_cities',   label:'Target Cities', array:true  },
    { key:'service_area_notes',label:'Geographic Notes', multiline:true },
  ]},
  { id:'brand', title:'7. Brand & Voice', icon:'🎨', fields:[
    { key:'logo_url',            label:'Logo Files', link:true          },
    { key:'brand_assets_url',    label:'Brand Assets Folder', link:true },
    { key:'brand_primary_color', label:'Primary Color', color:true      },
    { key:'brand_accent_color',  label:'Accent Color', color:true       },
    { key:'brand_fonts',         label:'Brand Fonts'                    },
    { key:'brand_tagline',       label:'Tagline / Slogan'               },
    { key:'brand_tone',          label:'Brand Tone', array:true         },
    { key:'brand_dos',           label:"Brand DO's", multiline:true     },
    { key:'brand_donts',         label:"Brand DON'Ts", multiline:true   },
  ]},
  { id:'social', title:'8. Social Profiles', icon:'📱', fields:[
    { key:'facebook_url',   label:'Facebook',  link:true },
    { key:'instagram_url',  label:'Instagram', link:true },
    { key:'google_biz_url', label:'Google Business', link:true },
    { key:'yelp_url',       label:'Yelp', link:true     },
    { key:'linkedin_url',   label:'LinkedIn', link:true },
    { key:'tiktok_url',     label:'TikTok', link:true   },
    { key:'youtube_url',    label:'YouTube', link:true  },
    { key:'twitter_url',    label:'Twitter / X', link:true },
    { key:'pinterest_url',  label:'Pinterest', link:true },
    { key:'nextdoor_url',   label:'Nextdoor', link:true },
    { key:'houzz_url',      label:'Houzz', link:true    },
    { key:'angi_url',       label:'Angi', link:true     },
    { key:'bbb_url',        label:'BBB', link:true      },
    { key:'fb_followers',   label:'Facebook Followers'  },
    { key:'ig_followers',   label:'Instagram Followers' },
    { key:'google_rating',  label:'Google Rating'       },
    { key:'google_reviews', label:'Google Reviews'      },
  ]},
  { id:'tech', title:'9. Website & Tech', icon:'💻', fields:[
    { key:'hosting_provider',   label:'Hosting Provider'        },
    { key:'hosting_url',        label:'Hosting Dashboard', link:true },
    { key:'hosting_login',      label:'Hosting Username'        },
    { key:'domain_registrar',   label:'Domain Registrar'        },
    { key:'domain_expiry',      label:'Domain Expiry'           },
    { key:'cms',                label:'CMS Platform'            },
    { key:'cms_url',            label:'CMS Admin URL', link:true },
    { key:'cms_username',       label:'CMS Username'            },
    { key:'ga4_id',             label:'Google Analytics 4 ID'   },
    { key:'gtm_id',             label:'Google Tag Manager ID'   },
    { key:'fb_pixel',           label:'Facebook Pixel ID'       },
    { key:'google_ads_id',      label:'Google Ads Customer ID'  },
  ]},
  { id:'marketing', title:'11. Marketing History', icon:'📊', fields:[
    { key:'monthly_ad_budget',   label:'Current Monthly Ad Spend'      },
    { key:'current_ad_platforms',label:'Ad Platforms', array:true       },
    { key:'current_seo_agency',  label:'Current SEO Agency'            },
    { key:'email_platform',      label:'Email Platform'                },
    { key:'email_list_size',     label:'Email List Size'               },
    { key:'what_worked',         label:'What Has Worked', multiline:true },
    { key:'what_didnt_work',     label:'What Has NOT Worked', multiline:true },
  ]},
  { id:'goals', title:'12. Goals & Budget', icon:'🚀', fields:[
    { key:'primary_goal',          label:'Primary Goals', array:true    },
    { key:'secondary_goals',       label:'Secondary Goals', array:true  },
    { key:'target_leads_per_month',label:'Target Leads / Month'         },
    { key:'timeline',              label:'Results Timeline'             },
    { key:'budget_for_agency',     label:'Agency Fee Budget'           },
    { key:'success_metrics',       label:'Success KPIs', multiline:true },
    { key:'other_notes',           label:'Additional Notes', multiline:true },
  ]},
]

function CopyBtn({ text, id, small }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={doCopy}
      style={{ display:'inline-flex', alignItems:'center', gap:3, padding: small ? '2px 7px' : '4px 10px',
        borderRadius:7, border:'1px solid #e5e7eb', background:'#fff',
        color:copied ? GREEN : '#9ca3af', cursor:'pointer', fontSize:11, fontWeight:600, flexShrink:0 }}>
      {copied ? <Check size={11}/> : <Copy size={11}/>}
      {!small && (copied ? 'Copied' : 'Copy')}
    </button>
  )
}

function FieldRow({ label, value, link, color, array, multiline, prefix }) {
  const isEmpty = !value || (Array.isArray(value) ? value.length === 0 : value.toString().trim() === '')
  const copyText = Array.isArray(value) ? value.join(', ') : (value || '').toString()

  return (
    <div style={{ display:'grid', gridTemplateColumns:'190px 1fr auto', gap:12, padding:'9px 0', borderBottom:'1px solid #f9fafb', alignItems:'start' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', paddingTop:2, fontFamily:FH }}>
        {label}
      </div>
      <div style={{ fontSize:13.5, color: isEmpty ? '#d1d5db' : '#111', fontStyle: isEmpty ? 'italic' : 'normal', lineHeight:1.65, fontFamily:FB }}>
        {isEmpty ? 'Not provided' :
          array ? (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {(Array.isArray(value) ? value : value.toString().split(',')).map((v,i) => (
                <span key={i} style={{ padding:'3px 10px', borderRadius:20, background:TEAL+'15', color:'#0e7490', fontSize:12, fontWeight:600 }}>{v.toString().trim()}</span>
              ))}
            </div>
          ) : color ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:20, height:20, borderRadius:5, background:value, border:'1px solid #e5e7eb' }}/>
              <span style={{ fontFamily:'monospace', fontSize:13 }}>{value}</span>
            </div>
          ) : link ? (
            <a href={value} target="_blank" rel="noreferrer" style={{ color:RED, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, fontSize:13 }}>
              {value} <ExternalLink size={10}/>
            </a>
          ) : multiline ? (
            <div style={{ whiteSpace:'pre-wrap' }}>{prefix}{value}</div>
          ) : (
            `${prefix || ''}${value}`
          )
        }
      </div>
      {!isEmpty && <CopyBtn text={copyText} small/>}
    </div>
  )
}

function Section({ sec, form, search, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen !== false)
  const [copiedAll, setCopiedAll] = useState(false)

  const fields  = sec.fields.map(f => ({ ...f, value: dg(form, f.key) ?? form?.[f.key] }))
  const comps   = sec.competitors ? (form?.competitors || []).filter(c => c.name) : []

  const visible = search
    ? fields.filter(f => {
        const v = Array.isArray(f.value) ? f.value.join(' ') : (f.value || '')
        return f.label.toLowerCase().includes(search.toLowerCase()) || v.toLowerCase().includes(search.toLowerCase())
      })
    : fields

  const filledCount = fields.filter(f => {
    const v = f.value
    return v && (Array.isArray(v) ? v.length > 0 : v.toString().trim() !== '')
  }).length

  if (search && visible.length === 0 && comps.length === 0) return null

  const sectionText = fields
    .filter(f => f.value && (Array.isArray(f.value) ? f.value.length > 0 : f.value.toString().trim()))
    .map(f => `${f.label}: ${Array.isArray(f.value) ? f.value.join(', ') : f.value}`)
    .join('\n')

  function copyAll() {
    navigator.clipboard.writeText(sectionText)
    setCopiedAll(true)
    toast.success('Section copied!')
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', marginBottom:10, overflow:'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px', cursor:'pointer', background: open ? '#fafafa' : '#fff' }}>
        <span style={{ fontSize:18 }}>{sec.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>{sec.title}</div>
          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{filledCount}/{fields.length} fields completed</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }} onClick={e => e.stopPropagation()}>
          {sectionText && (
            <button onClick={copyAll}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color: copiedAll ? GREEN : '#6b7280', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              {copiedAll ? <Check size={11}/> : <Copy size={11}/>} Copy Section
            </button>
          )}
          <button onClick={() => setOpen(o => !o)}
            style={{ padding:'4px 8px', borderRadius:7, border:'1px solid #e5e7eb', background:'#fff', color:'#9ca3af', cursor:'pointer' }}>
            {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ padding:'4px 20px 16px' }}>
          {visible.map(f => <FieldRow key={f.key} {...f}/>)}
          {comps.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10, fontFamily:FH }}>
                Competitors ({comps.length})
              </div>
              {comps.map((comp, i) => (
                <div key={i} style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>{comp.name}</div>
                      {comp.url && <a href={comp.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#9ca3af' }}>{comp.url}</a>}
                    </div>
                    <CopyBtn text={`${comp.name}\nStrengths: ${comp.strengths||''}\nWeaknesses: ${comp.weaknesses||''}`} small/>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:GREEN, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>✅ What They Do Well</div>
                      <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{comp.strengths || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:RED, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>❌ Where They Fall Short</div>
                      <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{comp.weaknesses || '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientProfilePage() {
  const { agencyId }  = useAuth()
  const { clientId }  = useParams()
  const navigate      = useNavigate()
  const [profile, setProfile]   = useState(null)
  const [client,  setClient]    = useState(null)
  const [tokens,  setTokens]    = useState([])
  const [loading, setLoading]   = useState(true)
  const [search,  setSearch]    = useState('')
  const [showTokens, setShowTokens] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const id = clientId

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    setLoading(true)
    const { supabase } = await import('../lib/supabase')
    const [{ data: cl }, { data: prof }, { data: toks }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_profiles').select('*').eq('client_id', id).single(),
      supabase.from('onboarding_tokens').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ])
    setClient(cl)
    // Merge profile + onboarding_form for flat access
    const merged = { ...(prof || {}), ...(prof?.onboarding_form || {}) }
    setProfile(merged)
    setTokens(toks || [])
    setLoading(false)
  }

  async function download(fmt) {
    setDownloading(fmt)
    try {
      const res = await fetch(`/api/onboarding/export?client_id=${id}&format=${fmt}`)
      if (!res.ok) { toast.error('Export failed'); setDownloading(null); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${client?.name || 'Client'}_Onboarding_Profile.${fmt}`
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)
      toast.success(`${fmt.toUpperCase()} downloaded ✓`)
    } catch { toast.error('Download failed') }
    setDownloading(null)
  }

  function copyAllData() {
    const text = SECTIONS.map(sec => {
      const lines = sec.fields
        .map(f => {
          const v = dg(profile, f.key) ?? profile?.[f.key]
          if (!v || (Array.isArray(v) ? v.length === 0 : !v.toString().trim())) return null
          return `${f.label}: ${Array.isArray(v) ? v.join(', ') : v}`
        }).filter(Boolean)
      return lines.length ? `=== ${sec.title} ===\n${lines.join('\n')}` : null
    }).filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success('All profile data copied!')
    setTimeout(() => setCopiedAll(false), 2000)
  }

  async function sendNewLink() {
    if (!client?.email) { toast.error('No email on file for this client'); return }
    const res  = await fetch('/api/onboarding', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'send_link', client_id:id, agency_id:agencyId }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); return }
    const url = data.onboarding_url
    navigator.clipboard.writeText(url)
    toast.success('New link sent + copied!')
    load()
  }

  function share() {
    const url = `${window.location.origin}/client-profile/${id}`
    if (navigator.share) {
      navigator.share({ title: `${client?.name} — Onboarding Profile`, url })
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Profile link copied!')
    }
  }

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#f2f2f0' }}>
      <Loader2 size={28} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
    </div>
  )

  const primaryToken = tokens.find(t => t.is_primary) || tokens[0]
  const onboardingUrl = primaryToken ? `${window.location.origin}/onboarding/${primaryToken.token}` : null

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'16px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:'#fff' }}>{client?.name || 'Client Profile'}</div>
              <div style={{ fontSize:12, color: '#999999', fontFamily:FB, marginTop:2 }}>
                {profile?.industry || 'No industry'} · {client?.city || ''}{client?.state ? `, ${client.state}` : ''}
              </div>
            </div>
            {/* Action bar */}
            <div style={{ display:'flex', gap:7 }}>
              {[
                { label:'.docx',  icon:FileText,  action:() => download('docx'), loading:downloading==='docx' },
                { label:'PDF',    icon:FileDown,  action:() => download('pdf'),  loading:downloading==='pdf'  },
                { label:'Share',  icon:Share2,    action:share                                                },
                { label:'Print',  icon:Printer,   action:() => window.print()                                },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={btn.loading}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 13px', borderRadius:9, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  {btn.loading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> : <btn.icon size={12}/>}
                  {btn.label}
                </button>
              ))}
              <button onClick={copyAllData}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 13px', borderRadius:9, border:'1px solid rgba(255,255,255,.15)', background: copiedAll ? GREEN+'30' : 'rgba(255,255,255,.08)', color: copiedAll ? '#6ee7b7' : '#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                {copiedAll ? <Check size={12}/> : <Copy size={12}/>} Copy All
              </button>
            </div>
          </div>

          {/* Onboarding link strip */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color: '#999999', fontFamily:FB }}>Form link:</span>
            {onboardingUrl ? (
              <span style={{ fontSize:11, fontFamily:'monospace', color:TEAL, background:'rgba(91,198,208,.1)', padding:'3px 9px', borderRadius:6 }}>
                {onboardingUrl.replace(/^https?:\/\//, '')}
              </span>
            ) : (
              <span style={{ fontSize:11, color:'rgba(255,255,255,.25)', fontFamily:FB, fontStyle:'italic' }}>No link yet</span>
            )}
            {onboardingUrl && (
              <button onClick={() => { navigator.clipboard.writeText(onboardingUrl); toast.success('Link copied!') }}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:6, border:'1px solid rgba(91,198,208,.3)', background:'rgba(91,198,208,.1)', color:TEAL, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <Copy size={9}/> Copy
              </button>
            )}
            <button onClick={sendNewLink}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,.15)', background:'transparent', color:'rgba(255,255,255,.6)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <Send size={9}/> Send New Link
            </button>
            {tokens.length > 0 && (
              <button onClick={() => setShowTokens(s => !s)}
                style={{ fontSize:11, color:'rgba(255,255,255,.3)', background:'none', border:'none', cursor:'pointer', fontFamily:FB }}>
                {tokens.length} link{tokens.length !== 1 ? 's' : ''} {showTokens ? '▲' : '▼'}
              </button>
            )}
          </div>

          {/* Token list */}
          {showTokens && tokens.length > 0 && (
            <div style={{ marginTop:10, background:'rgba(255,255,255,.05)', borderRadius:10, border:'1px solid rgba(255,255,255,.08)', padding:'12px 14px' }}>
              {tokens.map(tok => {
                const url = `${window.location.origin}/onboarding/${tok.token}`
                return (
                  <div key={tok.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: tok.is_locked ? '#6b7280' : 'rgba(255,255,255,.7)', fontFamily:FH, minWidth:80 }}>
                      {tok.label || 'Primary'}
                    </span>
                    <span style={{ fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.3)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {url.replace(/^https?:\/\//,'')}
                    </span>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background: tok.is_locked ? '#7f1d1d30' : GREEN+'20', color: tok.is_locked ? RED : GREEN }}>
                      {tok.is_locked ? '🔒 Locked' : '🟢 Active'}
                    </span>
                    <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Copied!') }}
                      style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.1)', background:'transparent', color:'rgba(255,255,255,.5)', cursor:'pointer', fontSize:10 }}>
                      <Copy size={10}/>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ padding:'14px 28px 0', background:'#f2f2f0' }}>
          <div style={{ position:'relative', maxWidth:480 }}>
            <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search any field or value…"
              style={{ width:'100%', padding:'9px 14px 9px 34px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', background:'#fff', boxSizing:'border-box' }}/>
            {search && (
              <button onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>
            )}
          </div>
        </div>

        {/* Sections */}
        <div style={{ flex:1, overflowY:'auto', padding:'14px 28px 28px' }}>
          {!profile || Object.keys(profile).length === 0 ? (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
              No onboarding data yet. Send the client their onboarding link to collect their information.
              {client?.email && (
                <div style={{ marginTop:16 }}>
                  <button onClick={sendNewLink}
                    style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 22px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                    <Send size={14}/> Send Onboarding Link Now
                  </button>
                </div>
              )}
            </div>
          ) : (
            SECTIONS.map((sec, i) => (
              <Section key={sec.id} sec={sec} form={profile} search={search} defaultOpen={i < 2}/>
            ))
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media print { nav, aside { display: none !important; } }
      `}</style>
    </div>
  )
}
