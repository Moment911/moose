"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Zap, Loader2, CheckCircle, XCircle, AlertCircle, Clock, Play,
  Download, Copy, Eye, ChevronDown, ChevronUp, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const PIPELINE_STEPS = [
  { key: 'query_gap_analysis', label: 'Query Gap Analysis' },
  { key: 'frame_analysis', label: 'Frame Analysis' },
  { key: 'named_entity_suggestion', label: 'Named Entity Suggestion' },
  { key: 'brief_generation', label: 'Brief Generation' },
  { key: 'content_generation', label: 'Content Generation' },
  { key: 'humanization', label: 'Humanization' },
  { key: 'quality_checks', label: 'Quality Checks' },
  { key: 'schema_generation', label: 'Schema Generation' },
]

function StatusBadge({ status }) {
  const cfg = {
    completed: { color: GRN, icon: CheckCircle, label: 'Done' },
    running: { color: T, icon: Loader2, label: 'Running' },
    failed: { color: R, icon: XCircle, label: 'Failed' },
    flagged: { color: AMB, icon: AlertCircle, label: 'Flagged' },
    skipped: { color: '#8e8e93', icon: Clock, label: 'Skipped' },
    pending: { color: '#8e8e93', icon: Clock, label: 'Pending' },
  }[status] || { color: '#8e8e93', icon: Clock, label: status || 'Pending' }
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
      background: cfg.color + '14', color: cfg.color,
    }}>
      <Icon size={11} style={status === 'running' ? { animation: 'spin 1s linear infinite' } : {}} />
      {cfg.label}
    </span>
  )
}

function ScoreBadge({ score, label }) {
  const s = Number(score || 0)
  const color = s >= 85 ? GRN : s >= 60 ? AMB : s > 0 ? '#e9695c' : '#d1d5db'
  return (
    <div style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 96 }}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 900, color }}>{s || '—'}</div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, color: '#1f1f22', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function AutonomousPipelineTab({ clientId, agencyId }) {
  const [keyword, setKeyword] = useState('')
  const [autoPublish, setAutoPublish] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!clientId) return
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_pipeline_runs', client_id: clientId }),
      })
      const j = await res.json()
      setHistory(j.runs || [])
    } catch {
      // silent
    } finally {
      setHistoryLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadHistory() }, [loadHistory])

  const startPipeline = async () => {
    if (!keyword.trim()) { toast.error('Enter a target keyword'); return }
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_autonomous_pipeline',
          client_id: clientId,
          agency_id: agencyId,
          keyword: keyword.trim(),
          auto_publish: autoPublish,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setResult(j)
      if (j.status === 'completed') toast.success(`Pipeline complete — Human Score ${j.human_score || 0}`)
      else if (j.status === 'flagged') toast(`Flagged — review before publishing`, { icon: '⚠️' })
      else toast.error('Pipeline failed')
      loadHistory()
    } catch (e) {
      toast.error(e.message || 'Pipeline failed')
    } finally {
      setRunning(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  const downloadHTML = () => {
    if (!result?.content_html) return
    const blob = new Blob([result.content_html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${keyword.replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const mergedSteps = PIPELINE_STEPS.map(s => {
    const match = (result?.steps || []).find(x => x.step === s.key)
    return { ...s, ...(match || { status: running ? 'pending' : null }) }
  })

  return (
    <div>
      <HowItWorks tool="autopilot" />

      {/* Hero */}
      <div style={{ ...card, background: `linear-gradient(135deg, #f9f9fb 0%, #f9f9fb 100%)`, borderColor: T + '40' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={28} color="#0a0a0a" />
          </div>
          <div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 900, color: BLK }}>Auto-Pilot Content Generation</div>
            <div style={{ fontSize: 13, color: '#1f1f22' }}>Give it a keyword, it runs an 8-step pipeline and ships publish-ready content.</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="text"
            placeholder="Target keyword (e.g. emergency plumber boca raton)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            disabled={running}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 10, border: '1px solid #d1d5db',
              fontSize: 15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, outline: 'none',
            }}
          />
          <button
            onClick={startPipeline}
            disabled={running || !keyword.trim()}
            style={{
              padding: '14px 26px', borderRadius: 10, border: 'none', background: "#0a0a0a", color: '#fff',
              fontSize: 14, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: running ? 'wait' : 'pointer', opacity: running || !keyword.trim() ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {running ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={16} />}
            {running ? 'Running...' : 'Start Pipeline'}
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13, color: '#1f1f22' }}>
          <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)} disabled={running} />
          Auto-publish when Human Score &ge; 85
        </label>
      </div>

      {/* Progress panel */}
      {(running || result) && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14 }}>Pipeline Progress</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mergedSteps.map((s, i) => (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 8, background: s.status === 'running' ? '#f9f9fb' : '#f9f9fb',
                border: `1px solid ${s.status === 'completed' ? GRN + '30' : s.status === 'failed' ? R + '30' : '#ececef'}`,
              }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '1px solid #ececef', color: BLK, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: BLK }}>{s.label}</div>
                {s.duration_ms ? <span style={{ fontSize: 11, color: '#6b6b70' }}>{s.duration_ms}ms</span> : null}
                <StatusBadge status={s.status || 'pending'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result panel */}
      {result && (
        <>
          <div style={card}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14 }}>Scores</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ScoreBadge score={result.human_score} label="Human" />
              <ScoreBadge score={result.topicality_score} label="Topicality" />
              <ScoreBadge score={result.plagiarism_score} label="Originality" />
              <ScoreBadge score={result.on_page_score} label="On-Page" />
            </div>
            {result.flagged_reasons?.length > 0 && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: AMB + '10', border: `1px solid ${AMB}40`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: AMB, marginBottom: 4 }}>Flagged reasons</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#1f1f22' }}>
                  {result.flagged_reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Content preview */}
          {result.content_html && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={16} color="#0a0a0a" /> Content Preview
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {result.auto_published && result.published_url && (
                    <a href={result.published_url} target="_blank" rel="noopener noreferrer" style={{
                      padding: '6px 14px', borderRadius: 8, border: `1px solid ${GRN}`, background: GRN + '14', color: GRN,
                      fontSize: 12, fontWeight: 700, textDecoration: 'none',
                    }}>Published ↗</a>
                  )}
                  <button onClick={downloadHTML} style={{
                    padding: '6px 14px', borderRadius: 8, border: '1px solid #ececef', background: '#fff',
                    fontSize: 12, fontWeight: 700, color: '#1f1f22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}><Download size={12} /> Download HTML</button>
                </div>
              </div>
              <iframe
                title="content preview"
                srcDoc={result.content_html}
                sandbox="allow-same-origin"
                style={{ width: '100%', height: 500, border: '1px solid #ececef', borderRadius: 8, background: '#fff' }}
              />
            </div>
          )}

          {/* Schema */}
          {result.schema_json_ld?.length > 0 && (
            <div style={card}>
              <button onClick={() => setSchemaOpen(!schemaOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK,
              }}>
                {schemaOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Schema JSON-LD ({result.schema_json_ld.length})
                <button onClick={e => { e.stopPropagation(); copyToClipboard(JSON.stringify(result.schema_json_ld, null, 2), 'Schema') }} style={{
                  marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid #ececef', background: '#fff',
                  fontSize: 11, fontWeight: 700, color: '#1f1f22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}><Copy size={11} /> Copy Schema</button>
              </button>
              {schemaOpen && (
                <pre style={{
                  marginTop: 12, padding: 14, background: '#0f172a', color: '#e2e8f0',
                  fontSize: 11, fontFamily: 'Menlo,Monaco,monospace', borderRadius: 8,
                  overflow: 'auto', maxHeight: 400,
                }}>{JSON.stringify(result.schema_json_ld, null, 2)}</pre>
              )}
            </div>
          )}
        </>
      )}

      {/* History */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#0a0a0a" /> Pipeline History
          </div>
          <button onClick={loadHistory} disabled={historyLoading} style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #ececef', background: '#fff',
            fontSize: 11, fontWeight: 700, color: '#1f1f22', cursor: 'pointer',
          }}>{historyLoading ? 'Loading...' : 'Refresh'}</button>
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#1f1f22', fontSize: 13 }}>
            <FileText size={32} color="#d1d5db" style={{ marginBottom: 8 }} /><br />
            No pipeline runs yet. Kick one off above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ececef' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Keyword</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Human</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Topicality</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((r, i) => (
                  <tr key={r.id || i} style={{ borderBottom: '1px solid #f1f1f6' }}>
                    <td style={{ padding: '10px 8px', color: BLK, fontWeight: 600 }}>{r.keyword}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}><StatusBadge status={r.status} /></td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{r.human_score ?? '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{r.topicality_score ?? '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#6b6b70' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
