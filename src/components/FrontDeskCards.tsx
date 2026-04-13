// @ts-nocheck
"use client"
import { useState, useEffect, useRef } from "react"
import { Phone, Globe, ExternalLink, Activity, Brain, Settings, Loader2, Zap, X, Sparkles, Check, Play, Square } from "lucide-react"
import toast from "react-hot-toast"

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from "../lib/theme"

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
        <div style={{ marginBottom: 14, padding: '14px 16px', background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', borderRadius: 10, border: '1px solid #fbcfe8' }}>
          <label style={{ ...fdLabel, color: R }}>Main Transfer Number</label>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '-2px 0 8px' }}>When a caller says "speak to a person" or "talk to someone", Jenny will transfer here.</p>
          <input value={fd.transfer_number || ''} onChange={e => fdUpdate('transfer_number', e.target.value)} placeholder="+1 (555) 123-4567" style={{ ...fdInput, fontSize: 16, fontWeight: 700, letterSpacing: '.02em' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><label style={fdLabel}>Scheduling Contact</label><input value={fd.scheduling_department_name || ''} onChange={e => fdUpdate('scheduling_department_name', e.target.value)} placeholder="e.g. Rachel" style={fdInput} /></div>
          <div><label style={fdLabel}>Scheduling Phone</label><input value={fd.scheduling_department_phone || ''} onChange={e => fdUpdate('scheduling_department_phone', e.target.value)} placeholder="If different from main" style={fdInput} /></div>
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
        <VoicePicker fd={fd} fdUpdate={fdUpdate} fdLabel={fdLabel} doFetch={doFetch} />
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
      <DirectivesCard fd={fd} fdCard={fdCard} fdCardTitle={fdCardTitle} fdLabel={fdLabel} doFetch={doFetch} fdDirectives={fdDirectives} setFdDirectives={setFdDirectives} fdNewDirective={fdNewDirective} setFdNewDirective={setFdNewDirective} fdNewCategory={fdNewCategory} setFdNewCategory={setFdNewCategory} clientId={clientId} aid={aid} fdUpdate={fdUpdate} />

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

// Curated voice names to show — actual IDs loaded from Retell API
const CURATED_NAMES = ['Marissa','Myra','Paola','Karina','Adrian','Nathan','Ryan','Josh']

function VoicePicker({ fd, fdUpdate, fdLabel, doFetch }) {
  const [voices, setVoices] = useState([])
  const [playing, setPlaying] = useState(null)
  const [loadingVoices, setLoadingVoices] = useState(true)
  const audioRef = useRef(null)

  // Fetch voices from Retell API — get real IDs and preview URLs
  useEffect(() => {
    fetch('/api/front-desk?action=list_voices').then(r => r.json()).then(d => {
      if (d.voices) {
        // Filter to curated names, or show first 8 female + male if none match
        const curated = d.voices.filter(v => CURATED_NAMES.some(n => (v.voice_name || '').toLowerCase() === n.toLowerCase()))
        if (curated.length > 0) {
          setVoices(curated)
        } else {
          // Fallback: pick 4 female + 4 male with previews
          const withPreview = d.voices.filter(v => v.preview_audio_url)
          const females = withPreview.filter(v => v.gender === 'female').slice(0, 4)
          const males = withPreview.filter(v => v.gender === 'male').slice(0, 4)
          setVoices([...females, ...males])
        }
      }
      setLoadingVoices(false)
    }).catch(() => setLoadingVoices(false))
  }, [])

  function togglePreview(voiceId) {
    if (playing === voiceId) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    const voice = voices.find(v => v.voice_id === voiceId)
    const url = voice?.preview_audio_url
    if (!url) { toast.error('No preview available'); return }
    if (audioRef.current) { audioRef.current.pause() }
    const audio = new Audio(url)
    audio.onended = () => setPlaying(null)
    audio.play().catch(() => toast.error('Could not play audio'))
    audioRef.current = audio
    setPlaying(voiceId)
  }

  if (loadingVoices) return <div style={{ marginBottom: 14 }}><label style={fdLabel}>Voice</label><div style={{ fontSize: 13, color: '#9ca3af', padding: 8 }}>Loading voices...</div></div>

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={fdLabel}>Voice</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {voices.map(v => {
          const selected = fd.voice_id === v.voice_id
          const hasPreview = !!v.preview_audio_url
          return (
            <div key={v.voice_id} style={{
              padding: '8px 14px', borderRadius: 10,
              border: selected ? '2px solid ' + R : '1px solid #e5e7eb',
              background: selected ? R + '08' : '#fff',
              textAlign: 'left', minWidth: 130, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <button onClick={() => togglePreview(v.voice_id)} disabled={!hasPreview} style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: playing === v.voice_id ? R + '15' : '#f3f4f6',
                cursor: hasPreview ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: hasPreview ? 1 : 0.3,
              }}>
                {playing === v.voice_id ? <Square size={10} color={R} fill={R} /> : <Play size={11} color="#374151" fill="#374151" />}
              </button>
              <button onClick={() => fdUpdate('voice_id', v.voice_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: BLK }}>{v.voice_name || v.voice_id}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{v.accent || v.provider || ''}{v.gender ? ' · ' + (v.gender === 'female' ? 'Female' : 'Male') : ''}</div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CATEGORIES = ['general','greeting','scheduling','medical','objection','transfer','insurance']
const CAT_COLORS = { greeting: '#7c3aed', scheduling: T, medical: R, objection: AMB, transfer: '#6366f1', insurance: '#0891b2', general: '#6b7280' }

function DirectivesCard({ fd, fdCard, fdCardTitle, fdLabel, doFetch, fdDirectives, setFdDirectives, fdNewDirective, setFdNewDirective, fdNewCategory, setFdNewCategory, clientId, aid, fdUpdate }) {
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [selected, setSelected] = useState({})
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [bulkSelected, setBulkSelected] = useState({})
  const [rewriting, setRewriting] = useState(false)

  async function generateAI() {
    setGenerating(true)
    try {
      const d = await doFetch('generate_directives', { industry: fd.industry, services: fd.services, company_name: fd.company_name })
      if (d.suggestions?.length) {
        // Append new suggestions to existing ones (de-dup by directive text)
        setAiSuggestions(prev => {
          const existingTexts = new Set(prev.map(s => s.directive))
          const novel = d.suggestions.filter(s => !existingTexts.has(s.directive))
          const merged = [...prev, ...novel]
          // Update selected: auto-select new high-priority ones
          setSelected(prevSel => {
            const sel = { ...prevSel }
            const offset = prev.length
            novel.forEach((s, i) => { sel[offset + i] = s.priority >= 2 })
            return sel
          })
          return merged
        })
      } else {
        toast.error('No suggestions generated')
      }
    } catch (e) { toast.error((e as any).message) }
    setGenerating(false)
  }

  async function applySelected() {
    const toApply = aiSuggestions.filter((_, i) => selected[i])
    if (toApply.length === 0) { toast.error('Select at least one directive'); return }
    setApplying(true)
    try {
      const d = await doFetch('apply_directives', { directives: toApply })
      if (d.inserted) {
        setFdDirectives(prev => [...d.inserted, ...prev])
        setAiSuggestions([])
        setSelected({})
        toast.success(d.count + ' directives applied' + (d.prompt_updated ? ' — LLM prompt updated' : ''))
      }
    } catch (e) { toast.error((e as any).message) }
    setApplying(false)
  }

  async function organizeAll() {
    setOrganizing(true)
    try {
      const d = await doFetch('organize_directives')
      if (d.directives) {
        setFdDirectives(d.directives)
        if (d.custom_instructions !== undefined && fdUpdate) {
          fdUpdate('custom_instructions', d.custom_instructions)
        }
        toast.success('Directives reorganized' + (d.prompt_updated ? ' — LLM prompt updated' : ''))
      } else {
        toast.error('Organize failed')
      }
    } catch (e) { toast.error((e as any).message) }
    setOrganizing(false)
  }

  async function saveEdit(id) {
    if (!editText.trim()) return
    await doFetch('update_directive', { id, directive: editText.trim() })
    setFdDirectives(prev => prev.map(d => d.id === id ? { ...d, directive: editText.trim() } : d))
    setEditingId(null)
    setEditText('')
    toast.success('Saved')
  }

  async function bulkDelete() {
    const ids = Object.keys(bulkSelected).filter(id => bulkSelected[id])
    if (ids.length === 0) return
    if (!confirm('Delete ' + ids.length + ' directive(s)?')) return
    for (const id of ids) { await doFetch('delete_directive', { id }) }
    setFdDirectives(prev => prev.filter(d => !ids.includes(d.id)))
    setBulkSelected({})
    toast.success(ids.length + ' deleted')
  }

  async function rewriteFlow() {
    setRewriting(true)
    try {
      const d = await doFetch('organize_directives')
      if (d.directives) {
        setFdDirectives(d.directives)
        if (d.custom_instructions !== undefined && fdUpdate) {
          fdUpdate('custom_instructions', d.custom_instructions)
        }
        setBulkSelected({})
        toast.success('Directives & instructions rewritten' + (d.prompt_updated ? ' — LLM updated' : ''))
      } else {
        toast.error('Rewrite failed')
      }
    } catch (e) { toast.error((e as any).message) }
    setRewriting(false)
  }

  const toggleAll = (on) => { const s = {}; aiSuggestions.forEach((_, i) => { s[i] = on }); setSelected(s) }
  const selectedCount = Object.values(selected).filter(Boolean).length
  const activeDirectives = fdDirectives.filter(d => d.status === 'active')
  const bulkCount = Object.values(bulkSelected).filter(Boolean).length
  const toggleBulkAll = (on) => { const s = {}; activeDirectives.forEach(d => { s[d.id] = on }); setBulkSelected(s) }

  return (
    <div style={fdCard}>
      {fdCardTitle(<Brain size={16} color="#7c3aed" />, 'Directives & Learnings (' + activeDirectives.length + ' active)')}

      {/* AI Generate + Organize buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '14px 16px', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', borderRadius: 10, border: '1px solid #ddd6fe', alignItems: 'center' }}>
        <Sparkles size={18} color="#7c3aed" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK }}>AI Directive Generator</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{aiSuggestions.length > 0 ? 'Click again for more suggestions' : 'Generate smart directives based on ' + (fd.industry || 'this') + ' industry'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {activeDirectives.length > 0 && (
            <button onClick={organizeAll} disabled={organizing} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#fff', color: '#7c3aed', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: organizing ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {organizing ? <span><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Organizing...</span> : <span><Zap size={13} /> Organize</span>}
            </button>
          )}
          <button onClick={generateAI} disabled={generating} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: generating ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {generating ? <span><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</span> : <span><Sparkles size={13} /> {aiSuggestions.length > 0 ? 'Generate More' : 'Generate Directives'}</span>}
          </button>
        </div>
      </div>

      {/* AI Suggestions (when generated) */}
      {aiSuggestions.length > 0 && (
        <div style={{ marginBottom: 14, padding: '14px 16px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: FH, color: AMB }}>AI Recommendations ({aiSuggestions.length})</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggleAll(true)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Select All</button>
              <button onClick={() => toggleAll(false)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#9ca3af' }}>Clear</button>
            </div>
          </div>
          {CATEGORIES.map(cat => {
            const items = aiSuggestions.map((s, i) => ({ ...s, idx: i })).filter(s => s.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, fontFamily: FH, color: CAT_COLORS[cat] || '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{cat}</div>
                {items.map(s => (
                  <label key={s.idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid #fef3c7' }}>
                    <input type="checkbox" checked={!!selected[s.idx]} onChange={() => setSelected(prev => ({ ...prev, [s.idx]: !prev[s.idx] }))} style={{ accentColor: '#7c3aed', marginTop: 2, width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: BLK, flex: 1 }}>{s.directive}</span>
                    {s.priority >= 3 && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: R + '15', color: R }}>Critical</span>}
                    {s.priority === 2 && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: AMB + '15', color: AMB }}>Important</span>}
                  </label>
                ))}
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={applySelected} disabled={applying || selectedCount === 0} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: applying ? 0.5 : 1 }}>
              {applying ? <span><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Applying...</span> : <span><Check size={14} /> Apply {selectedCount} Directives & Rebuild LLM</span>}
            </button>
            <button onClick={() => { setAiSuggestions([]); setSelected({}) }} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#9ca3af' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Manual add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <select value={fdNewCategory} onChange={e => setFdNewCategory(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: BLK, width: 130 }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <input value={fdNewDirective} onChange={e => setFdNewDirective(e.target.value)} placeholder="Add a custom directive..." style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: BLK }} onKeyDown={async e => {
          if (e.key === 'Enter' && fdNewDirective.trim()) { const d = await doFetch('add_directive', { directive: fdNewDirective.trim(), category: fdNewCategory }); if (d.directive) { setFdDirectives(prev => [d.directive, ...prev]); setFdNewDirective(''); toast.success('Added') } }
        }} />
        <button onClick={async () => { if (!fdNewDirective.trim()) return; const d = await doFetch('add_directive', { directive: fdNewDirective.trim(), category: fdNewCategory }); if (d.directive) { setFdDirectives(prev => [d.directive, ...prev]); setFdNewDirective(''); toast.success('Added') } }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>Add</button>
      </div>

      {/* Active directives with bulk select */}
      {activeDirectives.length === 0
        ? <div style={{ background: GRY, borderRadius: 8, padding: 16, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No directives yet. Generate with AI or add manually above.</div>
        : <div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, padding: '6px 0' }}>
              <button onClick={() => toggleBulkAll(bulkCount < activeDirectives.length)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>{bulkCount === activeDirectives.length ? 'Deselect All' : 'Select All'}</button>
              {bulkCount > 0 && (
                <span>
                  <button onClick={bulkDelete} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: R }}>Delete {bulkCount}</button>
                </span>
              )}
              <div style={{ flex: 1 }}></div>
              <button onClick={rewriteFlow} disabled={rewriting} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#fff', color: '#7c3aed', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: rewriting ? 0.5 : 1 }}>
                {rewriting ? <span><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Rewriting...</span> : <span><Sparkles size={12} /> Rewrite & Flow</span>}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeDirectives.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid ' + (editingId === d.id ? '#7c3aed' : bulkSelected[d.id] ? R : '#e5e7eb'), background: editingId === d.id ? '#faf5ff' : bulkSelected[d.id] ? R + '05' : '#fff' }}>
                  <input type="checkbox" checked={!!bulkSelected[d.id]} onChange={() => setBulkSelected(prev => ({ ...prev, [d.id]: !prev[d.id] }))} style={{ accentColor: R, width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: (CAT_COLORS[d.category] || '#6b7280') + '15', color: CAT_COLORS[d.category] || '#6b7280' }}>{d.category}</span>
                  {editingId === d.id ? (
                    <input value={editText} onChange={e => setEditText(e.target.value)} onBlur={() => saveEdit(d.id)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(d.id); if (e.key === 'Escape') { setEditingId(null); setEditText('') } }} autoFocus style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #7c3aed', fontSize: 13, color: BLK, outline: 'none' }} />
                  ) : (
                    <span onClick={() => { setEditingId(d.id); setEditText(d.directive) }} style={{ fontSize: 13, color: BLK, flex: 1, cursor: 'pointer', borderBottom: '1px dashed transparent' }} onMouseEnter={e => (e.currentTarget.style.borderBottomColor = '#d1d5db')} onMouseLeave={e => (e.currentTarget.style.borderBottomColor = 'transparent')}>{d.directive}</span>
                  )}
                  {d.source === 'ai_suggested' && <span style={{ fontSize: 9, color: '#7c3aed' }}>AI</span>}
                  <button onClick={async () => { await doFetch('delete_directive', { id: d.id }); setFdDirectives(prev => prev.filter(x => x.id !== d.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14 }}>x</button>
                </div>
              ))}
            </div>
          </div>
      }
    </div>
  )
}
