// @ts-nocheck
"use client"
import { Phone, Globe, ExternalLink, Activity, Brain, Settings, Loader2, Zap, X } from "lucide-react"
import toast from "react-hot-toast"

const R = "#E6007E", T = "#00C2CB", BLK = "#111111", GRY = "#F9F9F9", GRN = "#16a34a", AMB = "#f59e0b"
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

export default function FrontDeskCards({ fd, fdCard, fdCardTitle, fdLabel, fdInput, DAYS, fdUpdate, fdLoading, setFdLoading, clientId, aid, fdDirectives, setFdDirectives, fdNewDirective, setFdNewDirective, fdNewCategory, setFdNewCategory, fdCalls }) {

  async function doFetch(action, extra = {}) {
    const res = await fetch('/api/front-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, client_id: clientId, agency_id: aid, ...extra }) })
    return res.json()
  }

  return (
    <div>

      {/* CARD 1: Status + Phone */}
      <div style={{ ...fdCard, background: fd.retell_phone_number ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)', border: fd.retell_phone_number ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: fd.status === 'active' ? GRN + '15' : fd.status === 'paused' ? AMB + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={22} color={fd.status === 'active' ? GRN : fd.status === 'paused' ? AMB : '#9ca3af'} />
            </div>
            <div>
              <select value={fd.status || 'draft'} onChange={e => fdUpdate('status', e.target.value)} style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, padding: '3px 8px', borderRadius: 20, border: 'none', background: fd.status === 'active' ? GRN + '15' : fd.status === 'paused' ? AMB + '15' : '#f3f4f6', color: fd.status === 'active' ? GRN : fd.status === 'paused' ? AMB : '#9ca3af', cursor: 'pointer', marginBottom: 4 }}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
              {fd.retell_phone_number
                ? <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK }}>{fd.retell_phone_number}</div>
                : <div style={{ fontSize: 14, color: '#6b7280' }}>No phone number assigned</div>
              }
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {fd.retell_phone_number ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={async () => { setFdLoading(true); try { const d = await doFetch('update_agent'); if (d.error) throw new Error(d.error); toast.success('Agent synced') } catch (e) { toast.error(e.message) } setFdLoading(false) }} disabled={fdLoading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: T, cursor: 'pointer' }}>Sync Agent</button>
                <button onClick={async () => { if (!confirm('Release this phone number?')) return; setFdLoading(true); try { const d = await doFetch('release_number'); if (d.error) throw new Error(d.error); fdUpdate('retell_phone_number', null); fdUpdate('retell_agent_id', null); toast.success('Released') } catch (e) { toast.error(e.message) } setFdLoading(false) }} disabled={fdLoading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: R, cursor: 'pointer' }}>Release</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input id="fd-area-code" defaultValue="954" style={{ width: 60, padding: '8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'center', color: BLK }} />
                <button onClick={async () => { const ac = (document.getElementById('fd-area-code') as any)?.value || '954'; setFdLoading(true); try { const d = await doFetch('provision_number', { area_code: ac }); if (d.error) throw new Error(d.error); fdUpdate('retell_phone_number', d.phone_number); fdUpdate('retell_agent_id', d.agent_id); toast.success('Number: ' + d.phone_number) } catch (e) { toast.error(e.message) } setFdLoading(false) }} disabled={fdLoading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: fdLoading ? 0.5 : 1 }}>
                  {fdLoading ? 'Provisioning...' : 'Get Number'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.06)' }}>
          {[{ label: 'Calls', val: fd.total_calls || 0, color: T }, { label: 'Appointments', val: fd.total_appointments || 0, color: GRN }, { label: 'Transfers', val: fd.total_transfers || 0, color: AMB }, { label: 'Voicemails', val: fd.total_voicemails || 0, color: '#7c3aed' }].map(s => (
            <div key={s.label}><span style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: s.color }}>{s.val}</span><span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{s.label}</span></div>
          ))}
        </div>
      </div>

      {/* CARD 2: Business Info */}
      <div style={fdCard}>
        {fdCardTitle(<Globe size={16} color={T} />, 'Business Information')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, alignItems: 'center' }}>
          <Zap size={14} color={T} />
          <input value={fd.website || ''} onChange={e => fdUpdate('website', e.target.value)} placeholder="Website URL" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
          <input value={fd.gmb_url || ''} onChange={e => fdUpdate('gmb_url', e.target.value)} placeholder="GMB URL (optional)" style={{ width: 180, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={fdLabel}>Company Name</label><input value={fd.company_name || ''} onChange={e => fdUpdate('company_name', e.target.value)} style={fdInput} /></div>
          <div><label style={fdLabel}>Industry</label><input value={fd.industry || ''} onChange={e => fdUpdate('industry', e.target.value)} style={fdInput} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={fdLabel}>Phone</label><input value={fd.phone || ''} onChange={e => fdUpdate('phone', e.target.value)} style={fdInput} /></div>
          <div><label style={fdLabel}>Address</label><input value={fd.address || ''} onChange={e => fdUpdate('address', e.target.value)} style={fdInput} /></div>
          <div><label style={fdLabel}>Timezone</label>
            <select value={fd.timezone || 'America/New_York'} onChange={e => fdUpdate('timezone', e.target.value)} style={fdInput}>
              <option value="America/New_York">New York</option>
              <option value="America/Chicago">Chicago</option>
              <option value="America/Denver">Denver</option>
              <option value="America/Los_Angeles">Los Angeles</option>
              <option value="America/Phoenix">Phoenix</option>
              <option value="Pacific/Honolulu">Honolulu</option>
            </select>
          </div>
        </div>
        <label style={fdLabel}>Business Hours</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {DAYS.map(day => {
            const h = (fd.business_hours || {})[day]
            return (
              <div key={day} style={{ background: GRY, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, color: BLK, textTransform: 'capitalize', marginBottom: 4 }}>{day.slice(0, 3)}</div>
                {h ? (
                  <div>
                    <input type="time" value={h.open || '09:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, open: e.target.value } })} style={{ width: '100%', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 4px', marginBottom: 3, color: BLK }} />
                    <input type="time" value={h.close || '17:00'} onChange={e => fdUpdate('business_hours', { ...fd.business_hours, [day]: { ...h, close: e.target.value } })} style={{ width: '100%', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 4px', color: BLK }} />
                    <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: null })} style={{ fontSize: 11, color: R, background: 'none', border: 'none', cursor: 'pointer', marginTop: 3, fontWeight: 600 }}>Closed</button>
                  </div>
                ) : (
                  <button onClick={() => fdUpdate('business_hours', { ...fd.business_hours, [day]: { open: '09:00', close: '17:00' } })} style={{ fontSize: 12, color: T, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontWeight: 700 }}>+ Add</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* CARD 3: Call Routing */}
      <div style={fdCard}>
        {fdCardTitle(<Phone size={16} color={R} />, 'Call Routing & Transfer')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><label style={fdLabel}>Scheduling Contact</label><input value={fd.scheduling_department_name || ''} onChange={e => fdUpdate('scheduling_department_name', e.target.value)} placeholder="e.g. Rachel" style={fdInput} /></div>
          <div><label style={fdLabel}>Transfer Phone</label><input value={fd.scheduling_department_phone || ''} onChange={e => fdUpdate('scheduling_department_phone', e.target.value)} style={fdInput} /></div>
          <div><label style={fdLabel}>Online Scheduling URL</label><input value={fd.scheduling_link || ''} onChange={e => fdUpdate('scheduling_link', e.target.value)} style={fdInput} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><label style={fdLabel}>Transfer Timeout (sec)</label><input type="number" value={fd.transfer_timeout_seconds || 30} onChange={e => fdUpdate('transfer_timeout_seconds', parseInt(e.target.value) || 30)} style={{ ...fdInput, width: 100 }} /></div>
          <div><label style={fdLabel}>Transfer Announcement</label><input value={fd.transfer_announce_template || 'You have an incoming call. Press 1 to connect.'} onChange={e => fdUpdate('transfer_announce_template', e.target.value)} style={fdInput} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={fdLabel}>Voicemail Greeting</label><textarea value={fd.voicemail_greeting || ''} onChange={e => fdUpdate('voicemail_greeting', e.target.value)} rows={2} placeholder="Please leave your message after the tone..." style={{ ...fdInput, resize: 'vertical' }}></textarea></div>
          <div><label style={fdLabel}>Max Voicemail (sec)</label><input type="number" value={fd.voicemail_max_seconds || 120} onChange={e => fdUpdate('voicemail_max_seconds', parseInt(e.target.value) || 120)} style={{ ...fdInput, width: 100 }} /></div>
        </div>
      </div>

      {/* CARD 4: Sendable Links */}
      <div style={fdCard}>
        {fdCardTitle(<span style={{ fontSize: 16 }}>📲</span>, 'Sendable Links')}
        <p style={{ fontSize: 13, color: '#6b7280', margin: '-8px 0 12px' }}>Links the AI can text or email to callers.</p>
        {(() => {
          const links = fd.sendable_links || []
          const TYPES = [
            { type: 'schedule', label: 'Schedule Appointment', icon: '📅' },
            { type: 'directions', label: 'Get Directions', icon: '📍' },
            { type: 'new_patient', label: 'New Patient Forms', icon: '📋' },
            { type: 'portal', label: 'Patient Portal', icon: '🔐' },
            { type: 'reviews', label: 'Leave a Review', icon: '⭐' },
            { type: 'website', label: 'Our Website', icon: '🌐' },
            { type: 'payment', label: 'Make a Payment', icon: '💳' },
          ]
          const updateLink = (i, f, v) => { const u = [...links]; u[i] = { ...u[i], [f]: v }; fdUpdate('sendable_links', u) }
          const removeLink = (i) => fdUpdate('sendable_links', links.filter((_, j) => j !== i))
          const addLink = (p) => fdUpdate('sendable_links', [...links, { type: p?.type || 'custom', label: p?.label || '', url: '', enabled: true }])
          const toggleLink = (i) => { const u = [...links]; u[i] = { ...u[i], enabled: !u[i].enabled }; fdUpdate('sendable_links', u) }
          return (
            <div>
              {links.map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '10px 12px', background: link.enabled ? '#fff' : '#f9fafb', borderRadius: 10, border: '1px solid ' + (link.enabled ? '#d1d5db' : '#e5e7eb') }}>
                  <button onClick={() => toggleLink(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: link.enabled ? 1 : 0.4, padding: 0 }}>{TYPES.find(d => d.type === link.type)?.icon || '🔗'}</button>
                  <input value={link.label || ''} onChange={e => updateLink(i, 'label', e.target.value)} placeholder="Link name" style={{ width: 160, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK, fontWeight: 600 }} />
                  <input value={link.url || ''} onChange={e => updateLink(i, 'url', e.target.value)} placeholder="https://..." style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: BLK }} />
                  <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>x</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {TYPES.filter(d => !links.some(l => l.type === d.type)).map(d => (
                  <button key={d.type} onClick={() => addLink(d)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#374151' }}>{d.icon} + {d.label}</button>
                ))}
                <button onClick={() => addLink(null)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px dashed #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#9ca3af' }}>+ Custom</button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* CARD 5: Services & Insurance */}
      <div style={fdCard}>
        {fdCardTitle(<span style={{ fontSize: 16 }}>🏥</span>, 'Services & Insurance')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={fdLabel}>Services ({(fd.services || []).length})</label>
            <textarea value={(fd.services || []).join('\n')} onChange={e => fdUpdate('services', e.target.value.split('\n').filter(s => s.trim()))} rows={8} placeholder="One service per line" style={{ ...fdInput, resize: 'vertical' }}></textarea>
          </div>
          <div>
            <label style={{ ...fdLabel, marginBottom: 8 }}>Insurance Accepted</label>
            {(() => {
              const CARRIERS = ['Aetna','Anthem / BCBS','Blue Cross Blue Shield','Cigna','UnitedHealthcare','Humana','Kaiser Permanente','Medicare','Medicaid','Tricare','Workers Compensation','PIP','Most Major Medical Plans']
              const accepted = fd.insurance_accepted || []
              const toggle = (c) => accepted.includes(c) ? fdUpdate('insurance_accepted', accepted.filter(x => x !== c)) : fdUpdate('insurance_accepted', [...accepted, c])
              return (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {CARRIERS.map(c => (
                      <button key={c} onClick={() => toggle(c)} style={{ padding: '4px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, fontFamily: FB, cursor: 'pointer', background: accepted.includes(c) ? R + '15' : '#f3f4f6', color: accepted.includes(c) ? R : '#6b7280' }}>{accepted.includes(c) ? '✓ ' : ''}{c}</button>
                    ))}
                  </div>
                  <input placeholder="Add custom carrier, press Enter" onKeyDown={e => { if (e.key === 'Enter' && (e.target as any).value.trim()) { fdUpdate('insurance_accepted', [...accepted, (e.target as any).value.trim()]); (e.target as any).value = '' } }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB }} />
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* CARD 6: AI Personality */}
      <div style={fdCard}>
        {fdCardTitle(<Settings size={16} color="#6b7280" />, 'AI Personality & Settings')}
        <div style={{ marginBottom: 14 }}>
          <label style={fdLabel}>Custom Greeting</label>
          <input value={fd.custom_greeting || ''} onChange={e => fdUpdate('custom_greeting', e.target.value)} placeholder="Hello, thanks for calling Our Office!" style={fdInput} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={fdLabel}>Additional Instructions & Directives</label>
          <textarea value={fd.custom_instructions || ''} onChange={e => fdUpdate('custom_instructions', e.target.value)} rows={12} placeholder="Add instructions for the AI receptionist..." style={{ ...fdInput, resize: 'vertical', minHeight: 220 }}></textarea>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[{ key: 'hipaa_mode', label: 'HIPAA Mode' },{ key: 'transfer_enabled', label: 'Call Transfer' },{ key: 'sms_enabled', label: 'SMS Links' },{ key: 'recording_enabled', label: 'Recording' },{ key: 'voicemail_enabled', label: 'Voicemail' },{ key: 'allow_client_editing', label: 'Allow Client to Edit' }].map(t => (
            <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK, cursor: 'pointer' }}>
              <input type="checkbox" checked={fd[t.key] ?? false} onChange={e => fdUpdate(t.key, e.target.checked)} style={{ accentColor: R, width: 16, height: 16 }} /> {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* CARD 6b: Directives */}
      <div style={fdCard}>
        {fdCardTitle(<Brain size={16} color="#7c3aed" />, 'Directives & Learnings (' + fdDirectives.filter(d => d.status === 'active').length + ' active)')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <select value={fdNewCategory} onChange={e => setFdNewCategory(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: BLK, width: 130 }}>
            <option value="general">General</option>
            <option value="greeting">Greeting</option>
            <option value="scheduling">Scheduling</option>
            <option value="medical">Medical</option>
            <option value="objection">Objection</option>
            <option value="transfer">Transfer</option>
            <option value="insurance">Insurance</option>
          </select>
          <input value={fdNewDirective} onChange={e => setFdNewDirective(e.target.value)} placeholder="Add a new directive..." style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: BLK }} onKeyDown={async e => {
            if (e.key === 'Enter' && fdNewDirective.trim()) { const d = await doFetch('add_directive', { directive: fdNewDirective.trim(), category: fdNewCategory }); if (d.directive) { setFdDirectives(prev => [d.directive, ...prev]); setFdNewDirective(''); toast.success('Added') } }
          }} />
          <button onClick={async () => { if (!fdNewDirective.trim()) return; const d = await doFetch('add_directive', { directive: fdNewDirective.trim(), category: fdNewCategory }); if (d.directive) { setFdDirectives(prev => [d.directive, ...prev]); setFdNewDirective(''); toast.success('Added') } }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>Add</button>
        </div>
        {fdDirectives.filter(d => d.status === 'pending').length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, fontFamily: FH, color: AMB, textTransform: 'uppercase', marginBottom: 6 }}>AI Suggested</div>
            {fdDirectives.filter(d => d.status === 'pending').map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 4, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: 13, color: BLK, flex: 1 }}>{d.directive}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280' }}>{d.category}</span>
                <button onClick={async () => { await doFetch('update_directive', { id: d.id, status: 'active' }); setFdDirectives(prev => prev.map(x => x.id === d.id ? { ...x, status: 'active' } : x)); toast.success('Approved') }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: GRN, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                <button onClick={async () => { await doFetch('update_directive', { id: d.id, status: 'dismissed' }); setFdDirectives(prev => prev.filter(x => x.id !== d.id)) }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Dismiss</button>
              </div>
            ))}
          </div>
        )}
        {fdDirectives.filter(d => d.status === 'active').length === 0
          ? <div style={{ background: GRY, borderRadius: 8, padding: 16, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No directives yet. Add some above.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {fdDirectives.filter(d => d.status === 'active').map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: d.source === 'call_learned' ? '#7c3aed15' : '#f3f4f6', color: d.source === 'call_learned' ? '#7c3aed' : '#6b7280' }}>{d.category}</span>
                  <span style={{ fontSize: 13, color: BLK, flex: 1 }}>{d.directive}</span>
                  <button onClick={async () => { await doFetch('delete_directive', { id: d.id }); setFdDirectives(prev => prev.filter(x => x.id !== d.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14 }}>x</button>
                </div>
              ))}
            </div>
        }
      </div>

      {/* CARD 7: GHL */}
      <div style={{ ...fdCard, background: fd.ghl_connected ? '#f0fdf4' : undefined, border: fd.ghl_connected ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: fd.ghl_connected ? GRN + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ExternalLink size={18} color={fd.ghl_connected ? GRN : '#9ca3af'} />
            </div>
            <div>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>GoHighLevel</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{fd.ghl_connected ? 'Connected' : 'Connect for call syncing'}</div>
            </div>
          </div>
          {fd.ghl_connected
            ? <button onClick={async () => { if (!confirm('Disconnect?')) return; await fetch('/api/ghl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect_client', agency_id: aid, client_id: clientId }) }); fdUpdate('ghl_connected', false); toast.success('Disconnected') }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FH, color: R, cursor: 'pointer' }}>Disconnect</button>
            : <button onClick={async () => { try { const res = await fetch('/api/ghl?action=get_client_oauth_url&agency_id=' + aid + '&client_id=' + clientId); const d = await res.json(); if (d.error) throw new Error(d.error); window.open(d.url, '_blank', 'width=600,height=700') } catch (e) { toast.error((e as any).message) } }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>Connect</button>
          }
        </div>
      </div>

      {/* CARD 8: Call Log */}
      <div style={fdCard}>
        {fdCardTitle(<Activity size={16} color={T} />, 'Recent Calls (' + fdCalls.length + ')')}
        {fdCalls.length === 0
          ? <div style={{ background: GRY, borderRadius: 10, padding: 20, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No calls yet.</div>
          : <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Caller</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Duration</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: FH, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {fdCalls.slice(0, 20).map(call => (
                    <tr key={call.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{new Date(call.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: BLK }}>{call.caller_name || call.caller_phone || 'Unknown'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13 }}>{call.duration_seconds ? Math.floor(call.duration_seconds / 60) + ':' + String(call.duration_seconds % 60).padStart(2, '0') : '0:00'}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (call.outcome === 'appointment' ? '#7c3aed' : call.outcome === 'transferred' ? T : GRN) + '15', color: call.outcome === 'appointment' ? '#7c3aed' : call.outcome === 'transferred' ? T : GRN, textTransform: 'uppercase' }}>{call.outcome}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

    </div>
  )
}
