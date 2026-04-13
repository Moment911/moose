// @ts-nocheck
"use client"
import { useState } from "react"
import { Phone, Globe, ExternalLink, Activity, Brain, Settings, Loader2, Zap, Save, X } from "lucide-react"
import toast from "react-hot-toast"

const R = "#E6007E", T = "#00C2CB", BLK = "#111111", GRY = "#F9F9F9", GRN = "#16a34a", AMB = "#f59e0b"
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

export default function FrontDeskCards({ fd, fdCard, fdCardTitle, fdLabel, fdInput, DAYS, fdUpdate, fdLoading, setFdLoading, clientId, aid, fdDirectives, setFdDirectives, fdNewDirective, setFdNewDirective, fdNewCategory, setFdNewCategory, fdCalls }) {
    return (
      <div>

            {/* ═══ CARD 1: Status + Phone Hero ═══ */}
            <div style={{ ...fdCard, background: fd.retell_phone_number ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)', border: fd.retell_phone_number ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: fd.status === 'active' ? GRN + '15' : fd.status === 'paused' ? AMB + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={22} color={fd.status === 'active' ? GRN : fd.status === 'paused' ? AMB : '#9ca3af'} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <select value={fd.status || 'draft'} onChange={e => fdUpdate('status', e.target.value)} style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, padding: '3px 8px', borderRadius: 20, border: 'none', background: fd.status === 'active' ? GRN + '15' : fd.status === 'paused' ? AMB + '15' : '#f3f4f6', color: fd.status === 'active' ? GRN : fd.status === 'paused' ? AMB : '#9ca3af', cursor: 'pointer' }}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                    {fd.retell_phone_number ? (
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK, letterSpacing: '-.02em' }}>{fd.retell_phone_number}</div>
                    ) : (
                      <div style={{ fontSize: 14, color: '#6b7280' }}>No phone number assigned</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {fd.retell_phone_number ? (<span>
                    <button onClick={async () => {
                      setFdLoading(true)
                      try { const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_agent', client_id: clientId, agency_id: aid }) }); const data = await res.json(); if (data.error) throw new Error(data.error); toast.success('Agent synced') } catch (e) { toast.error(e.message) }
                      setFdLoading(false)
                    }} disabled={fdLoading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: T, cursor: 'pointer' }}>Sync Agent</button>
                    <button onClick={async () => {
                      if (!confirm('Release this phone number?')) return; setFdLoading(true)
                      try { const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release_number', client_id: clientId, agency_id: aid }) }); const data = await res.json(); if (data.error) throw new Error(data.error); fdUpdate('retell_phone_number', null); fdUpdate('retell_agent_id', null); toast.success('Number released') } catch (e) { toast.error(e.message) }
                      setFdLoading(false)
                    }} disabled={fdLoading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: R, cursor: 'pointer' }}>Release</button>
                  </span>) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input id="fd-area-code" defaultValue="954" style={{ width: 60, padding: '8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'center', color: BLK }} />
                      <button onClick={async () => {
                        const ac = document.getElementById('fd-area-code')?.value || '954'; setFdLoading(true)
                        try { const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'provision_number', client_id: clientId, agency_id: aid, area_code: ac }) }); const data = await res.json(); if (data.error) throw new Error(data.error); fdUpdate('retell_phone_number', data.phone_number); fdUpdate('retell_agent_id', data.agent_id); toast.success(`Number: ${data.phone_number}`) } catch (e) { toast.error(e.message) }
                        setFdLoading(false)
                      }} disabled={fdLoading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: fdLoading ? 0.5 : 1 }}>
                        {fdLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={13} />} Get Number
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Metrics strip */}
              <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                {[
                  { label: 'Calls', val: fd.total_calls || 0, color: T },
                  { label: 'Appointments', val: fd.total_appointments || 0, color: GRN },
                  { label: 'Transfers', val: fd.total_transfers || 0, color: AMB },
                  { label: 'Voicemails', val: fd.total_voicemails || 0, color: '#7c3aed' },
                ].map(s => (
                  <div key={s.label}>
                    <span style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: s.color }}>{s.val}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ CARD 2: Business Info ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Globe size={16} color={T} />, 'Business Information')}
              {/* AI Scan bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, alignItems: 'center' }}>
                <Zap size={14} color={T} />
                <input value={fd.website || ''} onChange={e => fdUpdate('website', e.target.value)} placeholder="Website URL" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                <input value={fd.gmb_url || ''} onChange={e => fdUpdate('gmb_url', e.target.value)} placeholder="GMB URL (optional)" style={{ width: 180, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                <button onClick={fdAiScan} disabled={fdLoading} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', whiteSpace: 'nowrap', opacity: fdLoading ? 0.5 : 1 }}>
                  {fdLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />} Scan
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={fdLabel}>Company Name</label><input value={fd.company_name || ''} onChange={e => fdUpdate('company_name', e.target.value)} style={fdInput} /></div>
                <div><label style={fdLabel}>Industry</label><input value={fd.industry || ''} onChange={e => fdUpdate('industry', e.target.value)} style={fdInput} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={fdLabel}>Phone</label><input value={fd.phone || ''} onChange={e => fdUpdate('phone', e.target.value)} style={fdInput} /></div>
                <div><label style={fdLabel}>Address</label><input value={fd.address || ''} onChange={e => fdUpdate('address', e.target.value)} style={fdInput} /></div>
                <div><label style={fdLabel}>Timezone</label>
                  <select value={fd.timezone || 'America/New_York'} onChange={e => fdUpdate('timezone', e.target.value)} style={{ ...fdInput }}>
                    {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu'].map(tz => <option key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', '').replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              {/* Hours */}
              <label style={fdLabel}>Business Hours</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {DAYS.map(day => {
                  const h = (fd.business_hours || {})[day]
                  return (
                    <div key={day} style={{ background: GRY, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, color: BLK, textTransform: 'capitalize', marginBottom: 4 }}>{day.slice(0, 3)}</div>
                      {h ? (<span>
                        <input type="time" value={h.open || '09:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, open: e.target.value } })} style={{ width: '100%', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 4px', marginBottom: 3, color: BLK }} />
                        <input type="time" value={h.close || '17:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, close: e.target.value } })} style={{ width: '100%', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 4px', color: BLK }} />
                        <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: null })} style={{ fontSize: 11, color: R, background: 'none', border: 'none', cursor: 'pointer', marginTop: 3, fontWeight: 600 }}>Closed</button>
                      </span>) : (
                        <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: { open: '09:00', close: '17:00' } })} style={{ fontSize: 12, color: T, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontWeight: 700 }}>+ Add</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ═══ CARD 3: Call Routing ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Phone size={16} color={R} />, 'Call Routing & Transfer')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label style={fdLabel}>Scheduling Contact</label><input value={fd.scheduling_department_name || ''} onChange={e => fdUpdate('scheduling_department_name', e.target.value)} placeholder="e.g. Rachel" style={fdInput} /></div>
                <div><label style={fdLabel}>Transfer Phone</label><input value={fd.scheduling_department_phone || ''} onChange={e => fdUpdate('scheduling_department_phone', e.target.value)} placeholder="(555) 123-4567" style={fdInput} /></div>
                <div><label style={fdLabel}>Online Scheduling URL</label><input value={fd.scheduling_link || ''} onChange={e => fdUpdate('scheduling_link', e.target.value)} placeholder="https://..." style={fdInput} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label style={fdLabel}>Transfer Timeout (sec)</label><input type="number" value={fd.transfer_timeout_seconds || 30} onChange={e => fdUpdate('transfer_timeout_seconds', parseInt(e.target.value) || 30)} style={{ ...fdInput, width: 100 }} /></div>
                <div><label style={fdLabel}>Transfer Announcement</label><input value={fd.transfer_announce_template || 'You have an incoming call. Press 1 to connect.'} onChange={e => fdUpdate('transfer_announce_template', e.target.value)} placeholder="Use {'{'}caller{'}'} for caller name" style={fdInput} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={fdLabel}>Voicemail Greeting</label><textarea value={fd.voicemail_greeting || ''} onChange={e => fdUpdate('voicemail_greeting', e.target.value)} rows={2} placeholder="Please leave your message after the tone..." style={{ ...fdInput, resize: 'vertical' }}></textarea></div>
                <div><label style={fdLabel}>Max Voicemail (sec)</label><input type="number" value={fd.voicemail_max_seconds || 120} onChange={e => fdUpdate('voicemail_max_seconds', parseInt(e.target.value) || 120)} style={{ ...fdInput, width: 100 }} /></div>
              </div>
            </div>

            {/* ═══ CARD 4: Sendable Links ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<span style={{ fontSize: 16 }}>📲</span>, 'Sendable Links (SMS / Email)')}
              <p style={{ fontSize: 13, color: '#6b7280', margin: '-8px 0 12px' }}>Links the AI can text or email to callers.</p>
              {(() => {
                const links = fd.sendable_links || []
                const DEFAULT_TYPES = [
                  { type: 'schedule', label: 'Schedule Appointment', icon: '📅', placeholder: 'https://calendly.com/...' },
                  { type: 'directions', label: 'Get Directions', icon: '📍', placeholder: 'https://maps.google.com/...' },
                  { type: 'new_patient', label: 'New Patient Forms', icon: '📋', placeholder: 'https://...' },
                  { type: 'portal', label: 'Patient / Client Portal', icon: '🔐', placeholder: 'https://...' },
                  { type: 'reviews', label: 'Leave a Review', icon: '⭐', placeholder: 'https://g.page/...' },
                  { type: 'website', label: 'Our Website', icon: '🌐', placeholder: 'https://...' },
                  { type: 'payment', label: 'Make a Payment', icon: '💳', placeholder: 'https://...' },
                ]
                const updateLink = (idx, field, val) => {
                  const updated = [...links]
                  updated[idx] = { ...updated[idx], [field]: val }
                  fdUpdate('sendable_links', updated)
                }
                const removeLink = (idx) => fdUpdate('sendable_links', links.filter((_, i) => i !== idx))
                const addLink = (preset) => fdUpdate('sendable_links', [...links, { type: preset?.type || 'custom', label: preset?.label || '', url: '', enabled: true }])
                const toggleLink = (idx) => { const updated = [...links]; updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }; fdUpdate('sendable_links', updated) }

                // Pre-populate scheduling link if not already in sendable_links
                const hasSchedule = links.some(l => l.type === 'schedule')
                const hasDirections = links.some(l => l.type === 'directions')

                return (
                  <span>
                    {links.length === 0 && (
                      <div style={{ background: GRY, borderRadius: 10, padding: '16px', textAlign: 'center', marginBottom: 10 }}>
                        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 10px' }}>No links configured yet. Add links the AI can send to callers.</p>
                      </div>
                    )}
                    {links.map((link, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '10px 12px', background: link.enabled ? '#fff' : '#f9fafb', borderRadius: 10, border: `1px solid ${link.enabled ? '#d1d5db' : '#e5e7eb'}` }}>
                        <button onClick={() => toggleLink(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: link.enabled ? 1 : 0.4, padding: 0, lineHeight: 1 }}>
                          {DEFAULT_TYPES.find(d => d.type === link.type)?.icon || '🔗'}
                        </button>
                        <input value={link.label || ''} onChange={e => updateLink(idx, 'label', e.target.value)} placeholder="Link name" style={{ width: 160, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK, fontWeight: 600 }} />
                        <input value={link.url || ''} onChange={e => updateLink(idx, 'url', e.target.value)} placeholder="https://..." style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" checked={link.enabled !== false} onChange={() => toggleLink(idx)} style={{ accentColor: R }} /> Active
                        </label>
                        <button onClick={() => removeLink(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {DEFAULT_TYPES.filter(d => !links.some(l => l.type === d.type)).map(d => (
                        <button key={d.type} onClick={() => addLink(d)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {d.icon} + {d.label}
                        </button>
                      ))}
                      <button onClick={() => addLink()} style={{ padding: '5px 12px', borderRadius: 20, border: '1px dashed #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#9ca3af' }}>
                        + Custom Link
                      </button>
                    </div>
                  </span>
                )
              })()}
            </div>

            {/* ═══ CARD 5: Services & Insurance ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<span style={{ fontSize: 16 }}>🏥</span>, 'Services & Insurance')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={fdLabel}>Services ({(fd.services || []).length})</label>
                  <textarea value={(fd.services || []).join('\n')} onChange={e => fdUpdate('services', e.target.value.split('\n').filter(s => s.trim()))} rows={8} placeholder="One service per line" style={{ ...fdInput, resize: 'vertical' }}></textarea>
                </div>
                <div>
                  <label style={{ ...fdLabel, marginBottom: 8 }}>Insurance Accepted</label>

            {/* Insurance */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...fdLabel, marginBottom: 8 }}>Insurance Accepted</label>
              {(() => {
                const CARRIERS = [
                  'Aetna', 'Anthem / Blue Cross Blue Shield', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare',
                  'Humana', 'Kaiser Permanente', 'Molina Healthcare', 'Centene / Ambetter', 'Medicare',
                  'Medicaid', 'Tricare', 'Workers Compensation', 'Personal Injury Protection (PIP)',
                  'Oscar Health', 'Bright Health', 'Devoted Health', 'Clover Health',
                  'Meritain Health', 'AvMed', 'Florida Blue', 'Health First',
                  'Oxford Health Plans', 'Empire BCBS', 'Horizon BCBS',
                  'Harvard Pilgrim', 'Tufts Health Plan', 'Priority Health',
                  'Geisinger Health Plan', 'UPMC Health Plan', 'Highmark',
                  'Carefirst BCBS', 'Independence Blue Cross', 'Premera Blue Cross',
                  'Regence', 'SelectHealth', 'Deseret Mutual', 'CHIP',
                  'Most Major Medical Plans',
                ]
                const accepted = fd.insurance_accepted || []
                const toggleCarrier = (c) => {
                  if (accepted.includes(c)) fdUpdate('insurance_accepted', accepted.filter(x => x !== c))
                  else fdUpdate('insurance_accepted', [...accepted, c])
                }
                const selectAll = () => fdUpdate('insurance_accepted', [...new Set([...accepted, ...CARRIERS])])
                const clearAll = () => fdUpdate('insurance_accepted', accepted.filter(x => !CARRIERS.includes(x)))
                const customOnes = accepted.filter(x => !CARRIERS.includes(x))
                return (
                  <span>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <button onClick={selectAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, fontFamily: FH, cursor: 'pointer', color: T }}>Select All</button>
                      <button onClick={clearAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, fontFamily: FH, cursor: 'pointer', color: '#9ca3af' }}>Clear All</button>
                      <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>{accepted.length} selected</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {CARRIERS.map(c => {
                        const on = accepted.includes(c)
                        return (
                          <button key={c} onClick={() => toggleCarrier(c)} style={{
                            padding: '4px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, fontFamily: FB, cursor: 'pointer',
                            background: on ? R + '15' : '#f3f4f6', color: on ? R : '#6b7280',
                          }}>{on ? '✓ ' : ''}{c}</button>
                        )
                      })}
                    </div>
                    <input
                      placeholder="Add custom carrier and press Enter..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          fdUpdate('insurance_accepted', [...accepted, e.target.value.trim()])
                          e.target.value = ''
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB, marginBottom: customOnes.length > 0 ? 6 : 0 }}
                    />
                    {customOnes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {customOnes.map(c => (
                          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: T + '15', color: T, fontSize: 11, fontWeight: 600 }}>
                            {c}
                            <button onClick={() => fdUpdate('insurance_accepted', accepted.filter(x => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </span>
                )
              })()}
            </div>

              </div>
            </div>

            {/* ═══ CARD 6: AI Personality ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Settings size={16} color="#6b7280" />, 'AI Personality & Settings')}
              <div style={{ marginBottom: 14 }}>
                <label style={fdLabel}>Custom Greeting</label>
                <input value={fd.custom_greeting || ''} onChange={e => fdUpdate('custom_greeting', e.target.value)} placeholder="Hello, it's a great day at Our Office!" style={fdInput} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Use {'{greeting}'} and {'{company}'} as placeholders</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={fdLabel}>Additional Instructions & Directives</label>
                <textarea value={fd.custom_instructions || ''} onChange={e => fdUpdate('custom_instructions', e.target.value)} rows={12} placeholder={'Add custom instructions, directions, and notes for the AI receptionist.\nThese are injected directly into the LLM prompt.\n\nExamples:\n• Always ask if they are a new or existing patient\n• If they mention a car accident, offer a same-day appointment\n• We are closed for lunch from 1-2pm on Wednesdays\n• Dr. Cohen does not take new patients on Fridays\n• Ask for their date of birth to verify identity\n• If caller is rude, stay calm and offer to have a manager call back'} style={{ ...fdInput, resize: 'vertical', minHeight: 220 }}></textarea>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[{ key: 'hipaa_mode', label: 'HIPAA Mode' },{ key: 'transfer_enabled', label: 'Call Transfer' },{ key: 'sms_enabled', label: 'SMS Links' },{ key: 'recording_enabled', label: 'Recording' },{ key: 'voicemail_enabled', label: 'Voicemail' },{ key: 'allow_client_editing', label: 'Allow Client to Edit' }].map(t => (
                  <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK, cursor: 'pointer' }}>
                    <input type="checkbox" checked={fd[t.key] ?? false} onChange={e => fdUpdate(t.key, e.target.checked)} style={{ accentColor: R, width: 16, height: 16 }} /> {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* ═══ CARD 6b: Learned Directives ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Brain size={16} color="#7c3aed" />, `Directives & Learnings (${fdDirectives.filter(d => d.status === 'active').length} active)`)}
              <p style={{ fontSize: 13, color: '#6b7280', margin: '-8px 0 12px' }}>Rules the AI follows on every call. Add your own or approve AI-suggested learnings from past calls.</p>

              {/* Add new directive */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <select value={fdNewCategory} onChange={e => setFdNewCategory(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: BLK, width: 130 }}>
                  {['general','greeting','scheduling','medical','objection','transfer','insurance'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <input value={fdNewDirective} onChange={e => setFdNewDirective(e.target.value)} placeholder="Add a new directive..." onKeyDown={async e => {
                  if (e.key === 'Enter' && fdNewDirective.trim()) {
                    const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_directive', client_id: clientId, agency_id: aid, directive: fdNewDirective.trim(), category: fdNewCategory }) })
                    const data = await res.json()
                    if (data.directive) { setFdDirectives(prev => [data.directive, ...prev]); setFdNewDirective(''); toast.success('Directive added') }
                  }
                }} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: BLK }} />
                <button onClick={async () => {
                  if (!fdNewDirective.trim()) return
                  const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_directive', client_id: clientId, agency_id: aid, directive: fdNewDirective.trim(), category: fdNewCategory }) })
                  const data = await res.json()
                  if (data.directive) { setFdDirectives(prev => [data.directive, ...prev]); setFdNewDirective(''); toast.success('Directive added') }
                }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>

              {/* Pending (AI suggested) */}
              {fdDirectives.filter(d => d.status === 'pending').length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, color: AMB, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>AI Suggested — Review</div>
                  {fdDirectives.filter(d => d.status === 'pending').map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 4, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <span style={{ fontSize: 13, color: BLK, flex: 1 }}>{d.directive}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280' }}>{d.category}</span>
                      <button onClick={async () => {
                        await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_directive', id: d.id, status: 'active', agency_id: aid }) })
                        setFdDirectives(prev => prev.map(x => x.id === d.id ? { ...x, status: 'active' } : x))
                        toast.success('Approved')
                      }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: GRN, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                      <button onClick={async () => {
                        await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_directive', id: d.id, status: 'dismissed', agency_id: aid }) })
                        setFdDirectives(prev => prev.filter(x => x.id !== d.id))
                      }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#9ca3af' }}>Dismiss</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Active directives */}
              {fdDirectives.filter(d => d.status === 'active').length === 0 ? (
                <div style={{ background: GRY, borderRadius: 8, padding: '16px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                  No directives yet. Add some above or they will be auto-suggested after calls.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fdDirectives.filter(d => d.status === 'active').map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: d.source === 'call_learned' ? '#7c3aed15' : '#f3f4f6', color: d.source === 'call_learned' ? '#7c3aed' : '#6b7280' }}>{d.category}</span>
                      <span style={{ fontSize: 13, color: BLK, flex: 1 }}>{d.directive}</span>
                      {d.source === 'call_learned' && <span style={{ fontSize: 10, color: '#7c3aed' }}>AI learned</span>}
                      <button onClick={async () => {
                        await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_directive', id: d.id, agency_id: aid }) })
                        setFdDirectives(prev => prev.filter(x => x.id !== d.id))
                      }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: '0 4px' }}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══ CARD 7: Integrations (GHL) ═══ */}
            <div style={{ ...fdCard, background: fd.ghl_connected ? '#f0fdf4' : undefined, border: fd.ghl_connected ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: fd.ghl_connected ? GRN + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ExternalLink size={18} color={fd.ghl_connected ? GRN : '#9ca3af'} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>GoHighLevel</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{fd.ghl_connected ? `Connected — ${fd.ghl_location_id || ''}` : 'Connect for call syncing & contact push'}</div>
                  </div>
                </div>
                {fd.ghl_connected ? (
                  <button onClick={async () => { if (!confirm('Disconnect?')) return; await fetch('/api/ghl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect_client', agency_id: aid, client_id: clientId }) }); fdUpdate('ghl_connected', false); toast.success('Disconnected') }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: R, cursor: 'pointer' }}>Disconnect</button>
                ) : (
                  <button onClick={async () => { try { const res = await fetch(`/api/ghl?action=get_client_oauth_url&agency_id=${aid}&client_id=${clientId}`); const data = await res.json(); if (data.error) throw new Error(data.error); window.open(data.url, '_blank', 'width=600,height=700') } catch (e) { toast.error(e.message) } }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><ExternalLink size={13} /> Connect</button>
                )}
              </div>
            </div>

            {/* ═══ CARD 8: Call Log ═══ */}
            <div style={fdCard}>
              {fdCardTitle(<Activity size={16} color={T} />, `Recent Calls (${fdCalls.length})`)}
              {fdCalls.length === 0 ? (
                <div style={{ background: GRY, borderRadius: 10, padding: '20px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                  No calls yet. Once the phone number is active, calls will appear here.
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Time', 'Caller', 'Duration', 'Outcome', 'Sentiment', ''].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fdCalls.slice(0, 20).map(call => {
                        const outcomeColor = { answered: GRN, appointment: '#7c3aed', transferred: T, voicemail: AMB, missed: '#9ca3af' }[call.outcome] || '#6b7280'
                        return (
                          <tr key={call.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{new Date(call.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{call.caller_name || call.caller_phone || 'Unknown'}</div>
                              {call.caller_name && call.caller_phone && <div style={{ fontSize: 11, color: '#9ca3af' }}>{call.caller_phone}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: BLK }}>{call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : '0:00'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: outcomeColor + '15', color: outcomeColor, textTransform: 'uppercase' }}>
                                {call.voicemail ? '📩 VM' : call.outcome}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 16 }}>{call.sentiment === 'positive' ? '😊' : call.sentiment === 'negative' ? '😞' : '😐'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {call.recording_url && <a href={call.recording_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T, fontWeight: 700, textDecoration: 'none' }}>▶ Play</a>}
                              {call.voicemail_url && <a href={call.voicemail_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textDecoration: 'none', marginLeft: 8 }}>📩 VM</a>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
    )
}
