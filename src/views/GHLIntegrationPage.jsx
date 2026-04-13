"use client"
import { useState, useEffect } from 'react'
import {
  Check, X, Loader2, RefreshCw, Zap, Shield, Settings, ChevronRight,
  Users, Phone, Calendar, BarChart2, AlertTriangle, ExternalLink
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const W = '#ffffff'

const API = '/api/ghl'

export default function GHLIntegrationPage() {
  const { agencyId } = useAuth()
  const [integration, setIntegration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncLog, setSyncLog] = useState([])
  const [step, setStep] = useState(1)
  const [apiKey, setApiKey] = useState('')
  const [locationId, setLocationId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [settings, setSettings] = useState({ sync_leads:true, sync_calls:true, sync_appointments:true, pipeline_id:'', appointment_stage_id:'', won_stage_id:'', lost_stage_id:'' })
  const [clientMappings, setClientMappings] = useState([])
  const [allClients, setAllClients] = useState([])
  const [ghlLocations, setGhlLocations] = useState([])
  const [assignClient, setAssignClient] = useState('')
  const [assignLocation, setAssignLocation] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [disconnecting, setDisconnecting] = useState(null)

  useEffect(() => { loadIntegration() }, [])

  async function loadIntegration() {
    setLoading(true)
    const res = await fetch(`${API}?action=get_integration&agency_id=${agencyId}`)
    const data = await res.json()
    if (data.data) {
      setIntegration(data.data)
      setSettings(s => ({ ...s, sync_leads: data.data.sync_leads !== false, sync_calls: data.data.sync_calls !== false, sync_appointments: data.data.sync_appointments !== false, pipeline_id: data.data.pipeline_id || '', appointment_stage_id: data.data.appointment_stage_id || '' }))
    }
    const logRes = await fetch(`${API}?action=get_sync_log&agency_id=${agencyId}`)
    const logData = await logRes.json()
    setSyncLog(logData.data || [])
    setLoading(false)
  }

  async function connect() {
    if (!apiKey || !locationId) { toast.error('API key and Location ID required'); return }
    setConnecting(true)
    const res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'connect', agency_id:agencyId, api_key:apiKey, location_id:locationId }) })
    const data = await res.json()
    if (data.success) { setTestResult(data); toast.success(`Connected to ${data.location_name}`); setStep(4); loadIntegration() }
    else { toast.error(data.error || 'Connection failed'); setTestResult({ success:false, error:data.error }) }
    setConnecting(false)
  }

  async function disconnect() {
    if (!confirm('Disconnect GoHighLevel? Sync will stop.')) return
    await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'disconnect', agency_id:agencyId }) })
    setIntegration(null); toast.success('Disconnected')
  }

  async function loadClientMappings() {
    try {
      const [mapRes, clientRes, locRes] = await Promise.all([
        fetch(`${API}?action=get_client_mappings&agency_id=${agencyId}`).then(r => r.json()),
        import('@supabase/supabase-js').then(({ createClient: c }) => c(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').from('clients').select('id, name, phone, industry').eq('agency_id', agencyId).order('name')),
        fetch(`${API}?action=get_locations&agency_id=${agencyId}`).then(r => r.json()),
      ])
      setClientMappings(mapRes.mappings || [])
      setAllClients(clientRes.data || [])
      setGhlLocations(locRes.locations || [])
    } catch {}
  }

  async function assignClientToLocation() {
    if (!assignClient || !assignLocation) { toast.error('Select a client and location'); return }
    setAssigning(true)
    const locName = ghlLocations.find(l => l.id === assignLocation)?.name || ''
    const res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'assign_client', agency_id:agencyId, client_id:assignClient, ghl_location_id:assignLocation, ghl_location_name:locName }) })
    const data = await res.json()
    if (data.success) { toast.success('Client assigned to GHL location'); setAssignClient(''); setAssignLocation(''); loadClientMappings() }
    else toast.error(data.error || 'Failed')
    setAssigning(false)
  }

  async function disconnectClient(clientId) {
    if (!confirm('Disconnect this client from GHL?')) return
    setDisconnecting(clientId)
    await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'disconnect_client', agency_id:agencyId, client_id:clientId }) })
    toast.success('Client disconnected'); loadClientMappings()
    setDisconnecting(null)
  }

  async function disconnectAgency() {
    if (!confirm('Disconnect your entire agency from GHL? This will remove ALL client mappings and stop all syncing.')) return
    await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'disconnect_agency', agency_id:agencyId }) })
    setIntegration(null); setClientMappings([]); toast.success('Agency disconnected from GHL')
  }

  async function saveSettings() {
    await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'update_settings', agency_id:agencyId, ...settings }) })
    toast.success('Settings saved'); loadIntegration()
  }

  const connected = integration?.status === 'active'
  useEffect(() => { if (connected) loadClientMappings() }, [connected])

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Loader2 size={32} color={R} style={{ animation:'spin 1s linear infinite' }} /></div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, overflow:'auto' }}>
        {/* Header */}
        <div style={{ background: W, padding: '28px 36px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'#ff6a00', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Zap size={22} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily:FH, fontSize:20, fontWeight: 700, color: '#111', margin:0 }}>GoHighLevel Integration</h1>
                <p style={{ fontFamily:FB, fontSize:14, color: '#6b7280', margin:0 }}>Sync Koto with your GoHighLevel CRM automatically</p>
              </div>
            </div>
            <span style={{ padding:'4px 14px', borderRadius:99, fontSize:12, fontWeight:700, fontFamily:FB, background:connected?GRN+'20':R+'20', color:connected?GRN:R }}>
              {connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        <div style={{ maxWidth:800, margin:'0 auto', padding:'32px' }}>
          {/* ── NOT CONNECTED: Setup Wizard ── */}
          {!connected && (
            <div>
              {/* Step indicators */}
              <div style={{ display:'flex', gap:8, marginBottom:28 }}>
                {['Introduction','API Key','Location ID','Configure'].map((s,i) => (
                  <div key={i} onClick={() => { if (i+1 <= step) setStep(i+1) }} style={{
                    flex:1, textAlign:'center', padding:'10px 0', borderRadius:8, cursor:i+1<=step?'pointer':'default',
                    background:step===i+1?`${R}10`:step>i+1?`${GRN}10`:'#f3f4f6',
                    border:`2px solid ${step===i+1?R:step>i+1?GRN:'#e5e7eb'}`,
                  }}>
                    <div style={{ fontSize:12, fontWeight:700, color:step===i+1?R:step>i+1?GRN:'#aaa', fontFamily:FH }}>STEP {i+1}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:step===i+1?BLK:'#888', fontFamily:FH }}>{s}</div>
                  </div>
                ))}
              </div>

              {/* Step 1: Intro */}
              {step === 1 && (
                <div style={{ background:W, borderRadius:14, padding:'28px 32px', border:'1px solid #e5e7eb' }}>
                  <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>What this integration does</h2>
                  {[
                    'Every lead Koto calls is automatically created as a GHL contact',
                    'Every call outcome is logged as a GHL activity note',
                    'Every appointment creates a GHL opportunity + calendar event',
                    'Call events trigger GHL workflows automatically',
                    'Import GHL contacts into Koto campaigns',
                    'Lead scores synced to GHL custom fields',
                  ].map((item, i) => (
                    <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:13, fontFamily:FB, color:'#374151' }}>
                      <Check size={16} color={GRN} style={{ flexShrink:0, marginTop:1 }} /> {item}
                    </div>
                  ))}
                  <div style={{ marginTop:20, padding:'14px 18px', background:'#f9fafb', borderRadius:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:BLK, marginBottom:6 }}>What you will need:</div>
                    <div style={{ fontSize:12, fontFamily:FB, color:'#6b7280', lineHeight:1.8 }}>
                      - Your GoHighLevel account (any plan)<br/>
                      - API key from GHL settings<br/>
                      - Your Location ID (sub-account ID)
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
                    <button onClick={() => setStep(2)} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                      Get Started <ChevronRight size={14} style={{ verticalAlign:'middle' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: API Key */}
              {step === 2 && (
                <div style={{ background:W, borderRadius:14, padding:'28px 32px', border:'1px solid #e5e7eb' }}>
                  <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Getting Your GHL API Key</h2>
                  {[
                    { n:1, t:'Log in to GoHighLevel', d:'Go to app.gohighlevel.com and sign in.' },
                    { n:2, t:'Go to Settings', d:'Click your profile icon (top right) and select "Settings".' },
                    { n:3, t:'Find API Keys', d:'In the left menu find "API Keys" or "Integrations" and click it.' },
                    { n:4, t:'Create a new API key', d:'Click "Add Key". Name it "Koto Integration". Select permissions: Contacts, Opportunities, Calendars, Workflows (Read/Write). Click "Create".' },
                    { n:5, t:'Copy your API key', d:'Copy the key that appears. Save it -- you won\'t see it again!' },
                  ].map(s => (
                    <div key={s.n} style={{ display:'flex', gap:12, marginBottom:14 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:`${R}10`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, fontFamily:FH, color:R }}>{s.n}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:BLK }}>{s.t}</div>
                        <div style={{ fontSize:12, fontFamily:FB, color:'#6b7280' }}>{s.d}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:16 }}>
                    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>API Key</label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs..." style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
                    <button onClick={() => setStep(1)} style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #e5e7eb', background:W, fontSize:13, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280' }}>Back</button>
                    <button onClick={() => { if (!apiKey) { toast.error('Enter API key'); return }; setStep(3) }} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                      Next <ChevronRight size={14} style={{ verticalAlign:'middle' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Location ID */}
              {step === 3 && (
                <div style={{ background:W, borderRadius:14, padding:'28px 32px', border:'1px solid #e5e7eb' }}>
                  <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Finding Your Location ID</h2>
                  {[
                    { n:1, t:'Go to Settings in GHL', d:'Open your GoHighLevel dashboard and click Settings.' },
                    { n:2, t:'Find Location ID', d:'Click "Business Profile" or "Company". Look for "Location ID" or check the URL: app.gohighlevel.com/location/{LOCATION_ID}/...' },
                    { n:3, t:'Copy the Location ID', d:'It looks like a long alphanumeric string. Copy it.' },
                  ].map(s => (
                    <div key={s.n} style={{ display:'flex', gap:12, marginBottom:14 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:`${R}10`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, fontFamily:FH, color:R }}>{s.n}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:BLK }}>{s.t}</div>
                        <div style={{ fontSize:12, fontFamily:FB, color:'#6b7280' }}>{s.d}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:16 }}>
                    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>Location ID</label>
                    <input value={locationId} onChange={e => setLocationId(e.target.value)} placeholder="abc123xyz..." style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
                  </div>
                  {testResult && !testResult.success && (
                    <div style={{ marginTop:12, padding:'10px 14px', background:'#fef2f2', borderRadius:8, fontSize:12, color:R, fontFamily:FB }}>
                      <AlertTriangle size={12} style={{ verticalAlign:'middle', marginRight:4 }} /> {testResult.error}
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
                    <button onClick={() => setStep(2)} style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #e5e7eb', background:W, fontSize:13, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280' }}>Back</button>
                    <button onClick={connect} disabled={connecting} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:GRN, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                      {connecting ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }} /> : <Check size={14} />}
                      Test & Connect
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Configure */}
              {step === 4 && (
                <div style={{ background:W, borderRadius:14, padding:'28px 32px', border:`1px solid ${GRN}40` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center' }}><Check size={20} color={GRN} /></div>
                    <div>
                      <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>Connected!</h2>
                      {testResult?.locationName && <div style={{ fontSize:12, color:GRN, fontFamily:FB }}>{testResult.locationName} -- {testResult.contactCount || 0} contacts</div>}
                    </div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:BLK, marginBottom:10 }}>Sync Settings</div>
                  {[
                    { key:'sync_leads', label:'Auto-sync leads to GHL contacts' },
                    { key:'sync_calls', label:'Log call outcomes as GHL notes' },
                    { key:'sync_appointments', label:'Create opportunities for appointments' },
                  ].map(tog => (
                    <label key={tog.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, fontSize:13, fontFamily:FB, color:'#374151', cursor:'pointer' }}>
                      <input type="checkbox" checked={settings[tog.key]} onChange={e => setSettings(s => ({...s, [tog.key]:e.target.checked}))} style={{ accentColor:R }} />
                      {tog.label}
                    </label>
                  ))}
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
                    <button onClick={saveSettings} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>Save & Activate</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CONNECTED: Dashboard ── */}
          {connected && (
            <div>
              {/* Stats */}
              <div style={{ display:'flex', gap:12, marginBottom:20 }}>
                {[
                  { label:'Contacts Synced', value:integration.contacts_synced || 0, icon:Users, accent:T },
                  { label:'Calls Logged', value:integration.calls_synced || 0, icon:Phone, accent:AMB },
                  { label:'Appointments', value:integration.appointments_synced || 0, icon:Calendar, accent:GRN },
                ].map(s => (
                  <div key={s.label} style={{ flex:1, padding:'16px 20px', background:W, borderRadius:12, borderTop:`3px solid ${s.accent}`, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <s.icon size={14} color={s.accent} />
                      <span style={{ fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase' }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize:24, fontWeight:800, fontFamily:FH, color:BLK }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Client → Location Assignment */}
              <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb', marginBottom:16 }}>
                <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 4px' }}>Client Location Mapping</h3>
                <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 14px', fontFamily:FB }}>Assign each client to a GHL sub-account. Clients without a mapping use the agency default.</p>

                {/* Assign form */}
                <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                  <select value={assignClient} onChange={e => setAssignClient(e.target.value)} style={{ flex:1, minWidth:160, padding:'8px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, fontFamily:FB }}>
                    <option value="">Select client...</option>
                    {allClients.filter(c => !clientMappings.some(m => m.client_id === c.id && m.status === 'active')).map(c => (
                      <option key={c.id} value={c.id}>{c.name || 'Unnamed'}{c.industry ? ` (${c.industry})` : ''}</option>
                    ))}
                  </select>
                  <select value={assignLocation} onChange={e => setAssignLocation(e.target.value)} style={{ flex:1, minWidth:160, padding:'8px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, fontFamily:FB }}>
                    <option value="">Select GHL location...</option>
                    {ghlLocations.map(l => (
                      <option key={l.id} value={l.id}>{l.name || l.id}</option>
                    ))}
                  </select>
                  <button onClick={assignClientToLocation} disabled={assigning} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:R, color:W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer', opacity:assigning?0.5:1 }}>
                    {assigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>

                {/* Current mappings */}
                {clientMappings.filter(m => m.status === 'active').length === 0 ? (
                  <div style={{ fontSize:13, color:'#6b7280', textAlign:'center', padding:12, fontFamily:FB }}>No clients assigned yet</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {clientMappings.filter(m => m.status === 'active').map(m => (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:8, border:'1px solid #ececea', background:'#fafafa' }}>
                        <div>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{m.clients?.name || 'Unknown client'}</div>
                          <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>→ {m.ghl_location_name || m.ghl_location_id}</div>
                        </div>
                        <button onClick={() => disconnectClient(m.client_id)} disabled={disconnecting === m.client_id} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:W, fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer', color:R }}>
                          {disconnecting === m.client_id ? '...' : 'Disconnect'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings */}
              <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:0 }}>Sync Settings</h3>
                  <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>Last sync: {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}</span>
                </div>
                {[
                  { key:'sync_leads', label:'Auto-sync leads' },
                  { key:'sync_calls', label:'Log call outcomes' },
                  { key:'sync_appointments', label:'Create appointments' },
                ].map(tog => (
                  <label key={tog.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:13, fontFamily:FB, color:'#374151', cursor:'pointer' }}>
                    <input type="checkbox" checked={settings[tog.key]} onChange={e => setSettings(s => ({...s, [tog.key]:e.target.checked}))} style={{ accentColor:R }} />
                    {tog.label}
                  </label>
                ))}
                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button onClick={saveSettings} style={{ padding:'8px 16px', borderRadius:6, border:'none', background:R, color:W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>Save Settings</button>
                  <button onClick={disconnectAgency} style={{ padding:'8px 16px', borderRadius:6, border:'1px solid #e5e7eb', background:W, fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer', color:R }}>Disconnect Agency</button>
                </div>
              </div>

              {/* Sync Log */}
              <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb' }}>
                <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 12px' }}>Recent Sync Activity</h3>
                {syncLog.length === 0 ? (
                  <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, textAlign:'center', padding:20 }}>No sync activity yet</div>
                ) : (
                  <div style={{ maxHeight:300, overflow:'auto' }}>
                    {syncLog.map((log, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<syncLog.length-1?'1px solid #f3f4f6':'none' }}>
                        {log.status === 'success' ? <Check size={14} color={GRN} /> : <X size={14} color={R} />}
                        <span style={{ fontSize:12, fontFamily:FB, color:BLK, flex:1 }}>{log.sync_type}</span>
                        <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{log.direction}</span>
                        <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
