"use client"
import { useState, useEffect } from 'react'
import { PhoneIncoming, Save, Loader2, Clock, X, Check, Lock } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"
const fieldLabel = { fontSize: 12, fontWeight: 700, fontFamily: FH, color: '#6b7280', marginBottom: 4, display: 'block' }
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function ClientFrontDeskPage() {
  const { user, agencyId, clientId, isClient, clientInfo } = useAuth()
  const [config, setConfig] = useState(null)
  const [editable, setEditable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const cid = clientId || clientInfo?.id

  useEffect(() => { if (cid) loadConfig() }, [cid])

  async function loadConfig() {
    setLoading(true)
    try {
      const res = await fetch(`/api/front-desk?action=client_get&client_id=${cid}&agency_id=${agencyId}`)
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
        setEditable(data.editable ?? false)
      }
    } catch {}
    setLoading(false)
  }

  async function save() {
    if (!editable) return
    setSaving(true)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'client_save', client_id: cid, agency_id: agencyId, ...config }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Front desk settings saved')
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  function update(field, value) {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const fd = config || {}

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,.08)', padding: '20px 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhoneIncoming size={20} color={R} /> Virtual Front Desk
              </h1>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0', fontFamily: FB }}>
                Manage how your AI receptionist answers calls
              </p>
            </div>
            {editable && (
              <button onClick={save} disabled={saving} style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', background: R, color: '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.5 : 1,
              }}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Save Changes
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9a9a96' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : !config ? (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: '48px 32px', textAlign: 'center' }}>
              <PhoneIncoming size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
              <p style={{ fontFamily: FH, fontSize: 16, fontWeight: 600, color: BLK }}>No front desk configured yet</p>
              <p style={{ fontSize: 13, color: '#9ca3af', maxWidth: 400, margin: '0 auto' }}>Your agency hasn't set up a virtual front desk for your account yet. Contact them to get started.</p>
            </div>
          ) : (
            <div style={{ maxWidth: 800 }}>
              {/* Status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH,
                  background: config.status === 'active' ? GRN + '15' : config.status === 'paused' ? AMB + '15' : '#f3f4f6',
                  color: config.status === 'active' ? GRN : config.status === 'paused' ? AMB : '#9ca3af',
                }}>
                  {config.status === 'active' ? '● Active' : config.status === 'paused' ? '● Paused' : '● Draft'}
                </span>
                {!editable && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                    <Lock size={12} /> View only — contact your agency to make changes
                  </span>
                )}
                {editable && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: GRN, fontFamily: FB }}>
                    <Check size={12} /> You can edit these settings
                  </span>
                )}
              </div>

              {/* Business Info */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Business Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={fieldLabel}>Company Name</label>
                    <input value={fd.company_name || ''} onChange={e => update('company_name', e.target.value)} disabled={!editable}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Phone</label>
                    <input value={fd.phone || ''} onChange={e => update('phone', e.target.value)} disabled={!editable}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Address</label>
                    <input value={fd.address || ''} onChange={e => update('address', e.target.value)} disabled={!editable}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Website</label>
                    <input value={fd.website || ''} onChange={e => update('website', e.target.value)} disabled={!editable}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                </div>
              </div>

              {/* Business Hours */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={15} color={T} /> Business Hours
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {DAYS.map(day => {
                    const h = (fd.business_hours || {})[day]
                    return (
                      <div key={day} style={{ background: GRY, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, fontFamily: FH, color: '#6b7280', textTransform: 'capitalize', marginBottom: 4 }}>{day.slice(0, 3)}</div>
                        {h ? (
                          <>
                            <input type="time" value={h.open || '09:00'} disabled={!editable}
                              onChange={e => update('business_hours', { ...fd.business_hours, [day]: { ...h, open: e.target.value } })}
                              style={{ width: '100%', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 4, padding: 2, marginBottom: 2 }} />
                            <input type="time" value={h.close || '17:00'} disabled={!editable}
                              onChange={e => update('business_hours', { ...fd.business_hours, [day]: { ...h, close: e.target.value } })}
                              style={{ width: '100%', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 4, padding: 2 }} />
                            {editable && <button onClick={() => update('business_hours', { ...fd.business_hours, [day]: null })} style={{ fontSize: 9, color: R, background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>Closed</button>}
                          </>
                        ) : (
                          editable
                            ? <button onClick={() => update('business_hours', { ...fd.business_hours, [day]: { open: '09:00', close: '17:00' } })} style={{ fontSize: 10, color: T, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}>+ Add</button>
                            : <div style={{ fontSize: 10, color: '#9ca3af', padding: '8px 0' }}>Closed</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Scheduling */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Scheduling</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={fieldLabel}>Scheduling Contact</label>
                    <input value={fd.scheduling_department_name || ''} onChange={e => update('scheduling_department_name', e.target.value)} disabled={!editable} placeholder="e.g. Rachel"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Scheduling Phone</label>
                    <input value={fd.scheduling_department_phone || ''} onChange={e => update('scheduling_department_phone', e.target.value)} disabled={!editable}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Online Scheduling URL</label>
                    <input value={fd.scheduling_link || ''} onChange={e => update('scheduling_link', e.target.value)} disabled={!editable} placeholder="https://..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                  </div>
                </div>
              </div>

              {/* Services */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Services ({(fd.services || []).length})</h3>
                <textarea value={(fd.services || []).join('\n')} onChange={e => update('services', e.target.value.split('\n').filter(s => s.trim()))}
                  disabled={!editable} rows={5} placeholder="One service per line"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB, resize: 'vertical', background: editable ? '#fff' : '#f9fafb' }} />
              </div>

              {/* Insurance */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Insurance Accepted ({(fd.insurance_accepted || []).length})</h3>
                {(() => {
                  const CARRIERS = [
                    'Aetna', 'Anthem / Blue Cross Blue Shield', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare',
                    'Humana', 'Kaiser Permanente', 'Molina Healthcare', 'Centene / Ambetter', 'Medicare',
                    'Medicaid', 'Tricare', 'Workers Compensation', 'Personal Injury Protection (PIP)',
                    'Oscar Health', 'Bright Health', 'Devoted Health', 'Clover Health',
                    'Most Major Medical Plans',
                  ]
                  const accepted = fd.insurance_accepted || []
                  const toggleCarrier = (c) => {
                    if (!editable) return
                    if (accepted.includes(c)) update('insurance_accepted', accepted.filter(x => x !== c))
                    else update('insurance_accepted', [...accepted, c])
                  }
                  const customOnes = accepted.filter(x => !CARRIERS.includes(x))
                  return (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: customOnes.length > 0 || editable ? 8 : 0 }}>
                        {CARRIERS.map(c => {
                          const on = accepted.includes(c)
                          return (
                            <button key={c} onClick={() => toggleCarrier(c)} disabled={!editable} style={{
                              padding: '4px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, fontFamily: FB, cursor: editable ? 'pointer' : 'default',
                              background: on ? R + '15' : '#f3f4f6', color: on ? R : '#6b7280', opacity: !editable && !on ? 0.4 : 1,
                            }}>{on ? '✓ ' : ''}{c}</button>
                          )
                        })}
                      </div>
                      {editable && (
                        <input placeholder="Add custom carrier and press Enter..." onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value.trim()) { update('insurance_accepted', [...accepted, e.target.value.trim()]); e.target.value = '' }
                        }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB, marginBottom: customOnes.length > 0 ? 6 : 0 }} />
                      )}
                      {customOnes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {customOnes.map(c => (
                            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: T + '15', color: T, fontSize: 11, fontWeight: 600 }}>
                              {c}
                              {editable && <button onClick={() => update('insurance_accepted', accepted.filter(x => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Custom Greeting */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Greeting</h3>
                <input value={fd.custom_greeting || ''} onChange={e => update('custom_greeting', e.target.value)} disabled={!editable}
                  placeholder="{greeting}, it's a great day at {company}!"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: editable ? '#fff' : '#f9fafb' }} />
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Use {'{greeting}'} for Good morning/afternoon/evening and {'{company}'} for your business name</div>
              </div>

              {/* Call Stats */}
              {(fd.total_calls > 0 || fd.total_appointments > 0) && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20 }}>
                  <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Call Statistics</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Total Calls', val: fd.total_calls || 0, color: T },
                      { label: 'Appointments', val: fd.total_appointments || 0, color: GRN },
                      { label: 'Transfers', val: fd.total_transfers || 0, color: AMB },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '14px 8px', background: GRY, borderRadius: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, fontFamily: FH, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
