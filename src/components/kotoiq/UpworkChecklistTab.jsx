"use client"
import { useState } from 'react'
import {
  Briefcase, Loader2, CheckCircle, AlertTriangle, Flag, FileText,
  DollarSign, Clock, HelpCircle, Sparkles, Copy as CopyIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function UpworkChecklistTab({ clientId, agencyId }) {
  const [jobDesc, setJobDesc] = useState('')
  const [clientName, setClientName] = useState('')
  const [budget, setBudget] = useState('')
  const [type, setType] = useState('fixed')
  const [rate, setRate] = useState('')
  const [data, setData] = useState(null)
  const [pkg, setPkg] = useState(null)
  const [running, setRunning] = useState(false)
  const [generatingPkg, setGeneratingPkg] = useState(false)

  const analyze = async () => {
    if (!jobDesc.trim()) return toast.error('Paste the job description')
    setRunning(true)
    setPkg(null)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_upwork_job', agency_id: agencyId,
          job_description: jobDesc, client_name: clientName,
          job_budget: budget, job_type: type,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Analysis complete')
    } catch (e) {
      toast.error(e.message || 'Analysis failed')
    } finally {
      setRunning(false)
    }
  }

  const generatePkg = async () => {
    setGeneratingPkg(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_proposal_package', agency_id: agencyId,
          job_description: jobDesc,
          our_hourly_rate: rate ? Number(rate) : undefined,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setPkg(j)
      toast.success('Full proposal ready')
    } catch (e) {
      toast.error(e.message || 'Package failed')
    } finally {
      setGeneratingPkg(false)
    }
  }

  const copy = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text)
    toast.success(label)
  }

  const a = data?.analysis

  return (
    <div>
      <HowItWorks tool="upwork" />
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={18} color={T} /> Upwork Pre-Flight Checklist
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Validate a freelance posting before you pitch. Generates a custom cover letter, red flags, win probability, and pricing.
        </div>
        <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste the Upwork job description..." rows={8} style={{
          width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FH,
          resize: 'vertical', marginBottom: 10, boxSizing: 'border-box',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name (optional)" style={inp} />
          <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="Budget" style={inp} />
          <select value={type} onChange={e => setType(e.target.value)} style={inp}>
            <option value="fixed">Fixed</option>
            <option value="hourly">Hourly</option>
          </select>
          <input value={rate} onChange={e => setRate(e.target.value)} placeholder="Our rate $/hr" style={inp} />
        </div>
        <button onClick={analyze} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Briefcase size={14} />}
          {running ? 'Analyzing...' : 'Analyze Job'}
        </button>
      </div>

      {data && a && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="Win Probability" value={`${a.win_probability}%`} color={a.win_probability >= 70 ? GRN : a.win_probability >= 40 ? AMB : R} />
            <Stat label="Difficulty" value={`${a.difficulty_score}/100`} color={a.difficulty_score >= 70 ? R : a.difficulty_score >= 40 ? AMB : GRN} />
            <Stat label={type === 'hourly' ? 'Est. Hours' : 'Est. Quote'}
                  value={type === 'hourly' ? `${data.project_estimate?.hours || 0}h` : `$${(data.project_estimate?.fixed_price || 0).toLocaleString()}`}
                  color={T} />
          </div>

          {a.actual_need && (
            <div style={{ ...card, borderLeft: `4px solid ${T}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 4 }}>The client's actual need</div>
              <div style={{ fontSize: 14, color: BLK, lineHeight: 1.6 }}>{a.actual_need}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FlagBlock title="Must-Haves" color={T} items={a.must_haves} />
            <FlagBlock title="Nice-to-Haves" color="#8b5cf6" items={a.nice_to_haves} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FlagBlock title="Red Flags" color={R} Icon={Flag} items={a.red_flags} objKey="flag" sub="why" />
            <FlagBlock title="Green Flags" color={GRN} Icon={CheckCircle} items={a.green_flags} objKey="flag" sub="why" />
          </div>

          {a.hidden_requirements?.length > 0 && (
            <div style={{ ...card, borderLeft: `4px solid ${AMB}` }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: AMB, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color={AMB} /> Hidden Requirements
              </div>
              {a.hidden_requirements.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: '#f9f9fb', borderRadius: 8, marginBottom: 4 }}>
                  <AlertTriangle size={12} color={AMB} style={{ marginTop: 3 }} />
                  <div style={{ fontSize: 12, color: '#1f1f22' }}>{h}</div>
                </div>
              ))}
            </div>
          )}

          {data.cover_letter && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileText size={16} color={T} />
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, flex: 1 }}>Cover Letter Draft</div>
                <button onClick={() => copy(data.cover_letter, 'Cover letter copied')} style={btnStyle}>
                  <CopyIcon size={11} /> Copy
                </button>
              </div>
              <div style={{ padding: 14, background: '#f9f9fb', borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: '#1f1f22', whiteSpace: 'pre-wrap' }}>
                {data.cover_letter}
              </div>
            </div>
          )}

          {data.clarifying_questions?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={16} color={T} /> Clarifying Questions
              </div>
              <ol style={{ margin: 0, paddingLeft: 20, color: '#1f1f22' }}>
                {data.clarifying_questions.map((q, i) => (
                  <li key={i} style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{q}</li>
                ))}
              </ol>
            </div>
          )}

          {data.pricing_strategy && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={16} color={GRN} /> Pricing Strategy
              </div>
              <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6 }}>{data.pricing_strategy}</div>
            </div>
          )}

          <div style={{ ...card, textAlign: 'center' }}>
            <button onClick={generatePkg} disabled={generatingPkg} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 28px', borderRadius: 10,
              border: 'none', background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH,
              cursor: generatingPkg ? 'wait' : 'pointer', opacity: generatingPkg ? 0.6 : 1,
            }}>
              {generatingPkg ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
              {generatingPkg ? 'Building...' : 'Generate Full Proposal Package'}
            </button>
            <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 8 }}>Scope document, FAQ, and follow-up email included.</div>
          </div>

          {pkg && (
            <>
              {pkg.scope_document && (
                <div style={card}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Scope Document — {pkg.scope_document.project_title}</div>
                  <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12, lineHeight: 1.6 }}>{pkg.scope_document.executive_summary}</div>
                  <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
                    <span style={{ fontSize: 12 }}><Clock size={12} style={{ verticalAlign: -2 }} /> <strong>{pkg.scope_document.timeline_weeks}w</strong> / <strong>{pkg.scope_document.total_hours}h</strong></span>
                    <span style={{ fontSize: 12 }}><DollarSign size={12} style={{ verticalAlign: -2 }} /> <strong>${(pkg.scope_document.investment?.amount || 0).toLocaleString()} {pkg.scope_document.investment?.type}</strong></span>
                  </div>
                  {pkg.scope_document.phases?.map((p, i) => (
                    <div key={i} style={{ padding: 12, background: '#f9f9fb', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>{p.name} <span style={{ fontSize: 11, color: '#1f1f22' }}>({p.duration})</span></div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1f1f22' }}>
                        {(p.deliverables || []).map((d, j) => <li key={j}>{d}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {pkg.faq?.length > 0 && (
                <div style={card}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>FAQ</div>
                  {pkg.faq.map((f, i) => (
                    <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>{f.q}</div>
                      <div style={{ fontSize: 12, color: '#1f2937', lineHeight: 1.5 }}>{f.a}</div>
                    </div>
                  ))}
                </div>
              )}

              {pkg.followup_email && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, flex: 1 }}>Follow-up Email (72hr)</div>
                    <button onClick={() => copy(pkg.followup_email, 'Follow-up copied')} style={btnStyle}>
                      <CopyIcon size={11} /> Copy
                    </button>
                  </div>
                  <div style={{ padding: 14, background: '#f9f9fb', borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: '#1f1f22', whiteSpace: 'pre-wrap' }}>
                    {pkg.followup_email}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const inp = { padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH, boxSizing: 'border-box' }
const btnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
  border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, color: BLK, cursor: 'pointer',
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}

function FlagBlock({ title, color, Icon, items, objKey, sub }) {
  if (!items?.length) return null
  return (
    <div style={{ ...card, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={14} color={color} />} {title}
      </div>
      {items.map((it, i) => {
        const label = typeof it === 'string' ? it : it[objKey] || it.label || JSON.stringify(it)
        const sub2 = typeof it === 'object' ? it[sub] : null
        return (
          <div key={i} style={{ padding: '8px 10px', background: color + '08', borderRadius: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{label}</div>
            {sub2 && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{sub2}</div>}
          </div>
        )
      })}
    </div>
  )
}
