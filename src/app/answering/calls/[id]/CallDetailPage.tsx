'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Play, Pause, Download, Check, Clock, Sparkles, Phone, ArrowLeft,
} from 'lucide-react'

const R = '#ea2729'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const PURP = '#7c3aed'
const BLK = '#111827'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }
const btn = (bg = R, c = '#fff'): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, background: bg, color: c, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' })

export default function CallDetailPage({ call: initial, intakes, agent }: { call: any; intakes: any[]; agent: any }) {
  const [call, setCall] = useState<any>(initial)
  const [playing, setPlaying] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [followUpAt, setFollowUpAt] = useState<string>(call.follow_up_at ? new Date(call.follow_up_at).toISOString().slice(0, 16) : '')
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const details = call.caller_details || call.intake_data || {}

  function togglePlay() {
    if (!call.recording_url) return
    if (playing) { audioRef.current?.pause(); setPlaying(false) }
    else { if (audioRef.current) { audioRef.current.src = call.recording_url; audioRef.current.play() }; setPlaying(true) }
  }

  async function mutate(action: string, extra: any = {}) {
    setSaving(true)
    try {
      const res = await fetch('/api/inbound', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, call_id: call.id, ...extra }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.success) { setCall({ ...call, ...(d.call || extra) }); toast.success('Saved') }
      else toast.error(d.error || 'Save failed')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  async function regenerateVoice() {
    setSaving(true)
    try {
      const res = await fetch('/api/inbound', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_summary_audio', call_id: call.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.summary_audio_url) { setCall({ ...call, summary_audio_url: d.summary_audio_url }); toast.success('Voice summary regenerated') }
      else toast.error(d.error || 'TTS failed')
    } catch { toast.error('TTS failed') }
    setSaving(false)
  }

  const downloadUrl = (kind: string) => `/api/inbound/download?call_id=${call.id}&kind=${kind}`
  const row = (label: string, value: any) => value ? <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '4px 0' }}><span style={{ color: '#6b7280', width: 110, flexShrink: 0 }}>{label}</span><span>{value}</span></div> : null

  const urgencyColor = call.urgency === 'emergency' ? '#dc2626' : call.urgency === 'high' ? '#ea580c' : call.urgency === 'medium' ? '#ca8a04' : '#16a34a'

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      <audio ref={audioRef} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/answering" style={{ ...btn('#e5e7eb', BLK), textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Koto
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ background: urgencyColor, color: '#fff', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{call.urgency || 'normal'}</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: BLK }}>
          {details.caller_name || call.caller_name || call.caller_number || 'Unknown caller'}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
          {agent?.business_name || agent?.name || 'Answering Service'} · {call.date ? new Date(call.date).toLocaleString() : ''}
        </p>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {call.recording_url && <button onClick={togglePlay} style={btn('#374151')}>{playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Play'}</button>}
        {call.recording_url && <a href={downloadUrl('recording')} style={btn('#e5e7eb', BLK)}><Download size={14} /> Recording</a>}
        {call.summary_audio_url
          ? <a href={downloadUrl('summary')} style={btn(PURP)}><Download size={14} /> Voice summary</a>
          : <button onClick={regenerateVoice} disabled={saving} style={btn(PURP)}><Sparkles size={14} /> Generate voice summary</button>
        }
        {call.transcript && <a href={downloadUrl('transcript')} style={btn('#e5e7eb', BLK)}><Download size={14} /> Transcript</a>}
        <div style={{ flex: 1 }} />
        {!call.resolved_at && <button onClick={() => mutate('mark_resolved')} disabled={saving} style={btn(GRN)}><Check size={14} /> Mark resolved</button>}
        <button onClick={() => setFollowUpOpen(o => !o)} style={btn('#374151')}><Clock size={14} /> {call.follow_up_at ? 'Edit follow-up' : 'Set follow-up'}</button>
      </div>

      {followUpOpen && (
        <div style={{ ...card, padding: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="datetime-local" style={input} value={followUpAt} onChange={e => setFollowUpAt(e.target.value)} />
            <button onClick={() => mutate('set_follow_up', { follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null, required: !!followUpAt })} disabled={saving} style={btn()}>Save</button>
            {call.follow_up_at && <button onClick={() => { setFollowUpAt(''); mutate('set_follow_up', { follow_up_at: null, required: false }) }} disabled={saving} style={btn('#e5e7eb', BLK)}>Clear</button>}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Caller</div>
          {row('Name', details.caller_name || call.caller_name)}
          {row('Phone', details.callback_number || call.caller_number)}
          {row('Email', details.callback_email)}
          {row('Company', details.company_name)}
          {row('Address', details.address)}
          {row('Reason', details.reason_for_calling)}
          {row('Best time', details.best_time_to_reach)}
          {row('Notes', details.additional_notes)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>AI Summary</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{call.ai_summary || call.summary || 'Summary unavailable.'}</div>
            {call.quality_score != null && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: '#f9fafb', borderRadius: 6, fontSize: 11, color: '#6b7280' }}>
                <strong style={{ color: call.quality_score >= 80 ? GRN : call.quality_score >= 60 ? AMB : R }}>Quality {call.quality_score}/100</strong>
                {call.quality_notes && <span> · {call.quality_notes}</span>}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Metadata</div>
            {row('Duration', call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : '—')}
            {row('Intent', call.intent)}
            {row('Outcome', call.outcome)}
            {row('Sentiment', call.sentiment)}
            {row('Resolved', call.resolved_at ? new Date(call.resolved_at).toLocaleString() : null)}
            {row('Follow-up', call.follow_up_at ? new Date(call.follow_up_at).toLocaleString() : null)}
          </div>
        </div>
      </div>

      {call.transcript && (
        <details style={{ ...card, marginBottom: 18 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>Full transcript</summary>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, color: '#374151', fontFamily: 'ui-monospace, Menlo, monospace' }}>{call.transcript}</pre>
        </details>
      )}

      {intakes.length > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Intake Answers</div>
          {intakes.map((i: any) => (
            <div key={i.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{i.question}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{i.answer || <span style={{ color: '#9ca3af' }}>— not answered</span>}</div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Notes</div>
        {call.follow_up_notes && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#374151', margin: '0 0 12px', fontFamily: 'inherit' }}>{call.follow_up_notes}</pre>}
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder="Add a note…" value={noteInput} onChange={e => setNoteInput(e.target.value)} />
          <button onClick={() => { if (!noteInput.trim()) return; mutate('add_call_note', { note: noteInput.trim() }); setNoteInput('') }} disabled={saving || !noteInput.trim()} style={btn()}>Add</button>
        </div>
      </div>

      {details.callback_number && (
        <div style={{ position: 'sticky', bottom: 12, marginTop: 18, display: 'flex', justifyContent: 'center' }}>
          <a href={`tel:${details.callback_number}`} style={{ ...btn(GRN), padding: '12px 22px', fontSize: 14, boxShadow: '0 4px 12px rgba(22,163,74,.3)' }}>
            <Phone size={16} /> Call {details.callback_number}
          </a>
        </div>
      )}
    </div>
  )
}
