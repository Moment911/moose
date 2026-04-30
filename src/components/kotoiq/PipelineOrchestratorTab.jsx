'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { FH, FB, BLK, GRY, R, T, W, GRN, AMB, cardStyle, labelStyle, inputStyle, buttonPrimary, buttonSecondary, badgeStyle } from '../../lib/theme'
import {
  Play, Square, CheckCircle2, XCircle, Loader2, Wifi, WifiOff,
  Plus, Trash2, ChevronDown, ChevronRight, ExternalLink,
  Database, BarChart3, FileText, Sparkles, Rocket, TrendingUp,
  ToggleLeft, ToggleRight
} from 'lucide-react'

const STAGES = [
  { num: 1, name: 'Ingest', icon: Database, desc: 'Audit data sources' },
  { num: 2, name: 'Graph', icon: BarChart3, desc: 'Build knowledge graph' },
  { num: 3, name: 'Plan', icon: FileText, desc: 'Strategic planning' },
  { num: 4, name: 'Generate', icon: Sparkles, desc: 'Create content' },
  { num: 5, name: 'Ship', icon: Rocket, desc: 'Publish & link' },
  { num: 6, name: 'Measure', icon: TrendingUp, desc: 'Track results' },
]

const STATUS_COLORS = {
  waiting: '#8e8e93',
  running: '#3b82f6',
  done: GRN,
  error: '#ef4444',
  skipped: '#d1d5db',
}

export default function PipelineOrchestratorTab({ clientId, agencyId, siteId, connections }) {
  const { session } = useAuth()
  const [keywords, setKeywords] = useState([])
  const [keywordInput, setKeywordInput] = useState('')
  const [autoPublish, setAutoPublish] = useState(false)
  const [stagesToRun, setStagesToRun] = useState([1, 2, 3, 4, 5, 6])
  const [runId, setRunId] = useState(null)
  const [run, setRun] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [expandedStages, setExpandedStages] = useState({})
  const [pastRuns, setPastRuns] = useState([])
  const pollRef = useRef(null)

  // Load existing keywords
  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_keywords', client_id: clientId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.keywords) setKeywords(d.keywords.map(k => k.keyword))
      })
      .catch(() => {})
  }, [clientId])

  // Load past runs
  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', client_id: clientId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.runs) setPastRuns(d.runs)
      })
      .catch(() => {})
  }, [clientId])

  // Poll for status
  const pollStatus = useCallback(() => {
    if (!runId) return
    fetch('/api/kotoiq/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', run_id: runId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.run) {
          setRun(d.run)
          if (d.run.status !== 'running') {
            setIsRunning(false)
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        }
      })
      .catch(() => {})
  }, [runId])

  useEffect(() => {
    if (runId && isRunning) {
      pollRef.current = setInterval(pollStatus, 3000)
      pollStatus() // immediate first check
      return () => { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [runId, isRunning, pollStatus])

  // Add keywords from input
  const addKeywords = () => {
    const newKws = keywordInput
      .split(/[,\n]/)
      .map(k => k.trim())
      .filter(k => k && !keywords.includes(k))
    if (newKws.length) setKeywords(prev => [...prev, ...newKws])
    setKeywordInput('')
  }

  const removeKeyword = (kw) => {
    setKeywords(prev => prev.filter(k => k !== kw))
  }

  const toggleStage = (num) => {
    setStagesToRun(prev =>
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort()
    )
  }

  const startPipeline = async () => {
    if (!keywords.length) return
    setIsRunning(true)
    setRun(null)
    try {
      const res = await fetch('/api/kotoiq/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          client_id: clientId,
          agency_id: agencyId,
          site_id: siteId || null,
          target_keywords: keywords,
          auto_publish: autoPublish,
          stages_to_run: stagesToRun,
        }),
      })
      const d = await res.json()
      if (d.run_id) {
        setRunId(d.run_id)
      } else {
        setIsRunning(false)
      }
    } catch {
      setIsRunning(false)
    }
  }

  const stopPipeline = async () => {
    if (!runId) return
    await fetch('/api/kotoiq/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', run_id: runId }),
    })
  }

  const toggleExpand = (stageNum) => {
    setExpandedStages(prev => ({ ...prev, [stageNum]: !prev[stageNum] }))
  }

  // Compute overall progress
  const overallProgress = run
    ? (() => {
        const activeStages = run.stages.filter(s => s.status !== 'skipped')
        const totalSteps = activeStages.reduce((a, s) => a + s.steps_total, 0)
        const doneSteps = activeStages.reduce((a, s) => a + s.steps_complete, 0)
        return totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0
      })()
    : 0

  const conns = connections || {}

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Section 1: Client & Connections */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, marginBottom: 14 }}>
          Data Sources
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'gsc', label: 'Google Search Console' },
            { key: 'ga4', label: 'Google Analytics 4' },
            { key: 'gmb', label: 'Google Business Profile' },
          ].map(src => {
            const connected = !!conns[src.key]
            return (
              <div
                key={src.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${connected ? GRN + '40' : '#ececef'}`,
                  background: connected ? GRN + '08' : W,
                  fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 600, color: BLK,
                }}
              >
                {connected
                  ? <Wifi size={14} color={GRN} />
                  : <WifiOff size={14} color="#9ca3af" />
                }
                {src.label}
                {!connected && (
                  <span
                    style={{
                      fontSize: 11, fontWeight: 700, color: R, cursor: 'pointer',
                      marginLeft: 4,
                    }}
                  >
                    Connect
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 2: Target Keywords */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
            Target Keywords
          </div>
          <span style={{ ...badgeStyle(T), fontSize: 11 }}>
            {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <textarea
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            placeholder="Enter keywords (one per line or comma-separated)"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addKeywords() } }}
            style={{
              ...inputStyle,
              minHeight: 60,
              resize: 'vertical',
              fontSize: 13,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
            }}
          />
          <button
            onClick={addKeywords}
            style={{
              ...buttonPrimary,
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 6,
              flexShrink: 0, alignSelf: 'flex-start',
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {keywords.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {keywords.map(kw => (
              <div
                key={kw}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 6,
                  background: '#f1f1f6', fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK,
                }}
              >
                {kw}
                <Trash2
                  size={12}
                  color="#9ca3af"
                  style={{ cursor: 'pointer' }}
                  onClick={() => removeKeyword(kw)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Pipeline Control */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, marginBottom: 14 }}>
          Pipeline Control
        </div>

        {/* Stage toggles */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {STAGES.map(s => {
            const active = stagesToRun.includes(s.num)
            return (
              <button
                key={s.num}
                onClick={() => toggleStage(s.num)}
                disabled={isRunning}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${active ? T + '60' : '#ececef'}`,
                  background: active ? T + '10' : W,
                  fontSize: 12, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                  color: active ? BLK : '#8e8e93',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                <s.icon size={13} />
                {s.num}. {s.name}
              </button>
            )
          })}
        </div>

        {/* Auto-publish toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div
            onClick={() => !isRunning && setAutoPublish(!autoPublish)}
            style={{ cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {autoPublish
              ? <ToggleRight size={28} color={GRN} />
              : <ToggleLeft size={28} color="#9ca3af" />
            }
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
            Auto-publish pages
          </span>
          <span style={{ fontSize: 11, color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            {autoPublish ? 'Pages will be published automatically' : 'Pages saved as drafts'}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isRunning ? (
            <button
              onClick={startPipeline}
              disabled={!keywords.length}
              style={{
                ...buttonPrimary,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: keywords.length ? 1 : 0.5,
                cursor: keywords.length ? 'pointer' : 'not-allowed',
              }}
            >
              <Play size={16} /> Run Full Pipeline
            </button>
          ) : (
            <button
              onClick={stopPipeline}
              style={{
                ...buttonSecondary,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 8,
                borderColor: '#ef4444',
                color: '#ef4444',
              }}
            >
              <Square size={16} /> Stop Pipeline
            </button>
          )}
        </div>
      </div>

      {/* Section 4: Pipeline Progress */}
      {run && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
              Pipeline Progress
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: STATUS_COLORS[run.status] || BLK }}>
              {run.status === 'running' && `${overallProgress}%`}
              {run.status === 'done' && 'Complete'}
              {run.status === 'error' && 'Error'}
              {run.status === 'cancelled' && 'Cancelled'}
            </span>
          </div>

          {/* Overall progress bar */}
          <div style={{
            width: '100%', height: 6, borderRadius: 3,
            background: '#f1f1f6', marginBottom: 20, overflow: 'hidden',
          }}>
            <div style={{
              width: `${overallProgress}%`, height: '100%', borderRadius: 3,
              background: run.status === 'error' ? '#ef4444' : run.status === 'done' ? GRN : '#3b82f6',
              transition: 'width 0.5s ease',
            }} />
          </div>

          {/* 6-stage visual pipeline — horizontal circles + lines */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '0 10px' }}>
            {run.stages.map((stage, i) => {
              const color = STATUS_COLORS[stage.status]
              const isLast = i === run.stages.length - 1
              return (
                <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: `2px solid ${color}`,
                      background: stage.status === 'done' ? color : stage.status === 'running' ? color + '15' : W,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s ease',
                    }}>
                      {stage.status === 'running' && <Loader2 size={16} color={color} style={{ animation: 'spin 1s linear infinite' }} />}
                      {stage.status === 'done' && <CheckCircle2 size={16} color={W} />}
                      {stage.status === 'error' && <XCircle size={16} color={color} />}
                      {(stage.status === 'waiting' || stage.status === 'skipped') && (
                        <span style={{ fontSize: 12, fontWeight: 700, color }}>{stage.stage}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {stage.stage_name}
                    </span>
                  </div>
                  {!isLast && (
                    <div style={{
                      flex: 1, height: 2, marginLeft: 6, marginRight: 6, marginBottom: 18,
                      background: stage.status === 'done' ? GRN : '#ececef',
                      transition: 'background 0.3s ease',
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Expandable stage details */}
          {run.stages.map(stage => {
            if (stage.status === 'skipped') return null
            const expanded = expandedStages[stage.stage]
            const color = STATUS_COLORS[stage.status]

            return (
              <div
                key={stage.stage}
                style={{
                  border: `1px solid ${stage.status === 'running' ? '#3b82f6' + '30' : '#ececef'}`,
                  borderRadius: 10, marginBottom: 8,
                  background: stage.status === 'running' ? '#3b82f6' + '04' : W,
                }}
              >
                <div
                  onClick={() => toggleExpand(stage.stage)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {expanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
                      Stage {stage.stage}: {stage.stage_name}
                    </span>
                    {stage.status === 'running' && (
                      <Loader2 size={13} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#6b6b70' }}>
                      {stage.steps_complete}/{stage.steps_total} steps
                    </span>
                    {stage.duration_ms != null && (
                      <span style={{ fontSize: 11, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#8e8e93' }}>
                        {(stage.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: color,
                    }} />
                  </div>
                </div>

                {expanded && stage.steps.length > 0 && (
                  <div style={{ padding: '0 14px 12px 38px' }}>
                    {stage.steps.map((step, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          padding: '4px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {step.status === 'success' && <CheckCircle2 size={12} color={GRN} />}
                          {step.status === 'error' && <XCircle size={12} color="#ef4444" />}
                          <span style={{ fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>{step.step}</span>
                        </div>
                        {step.error && (
                          <span style={{ fontSize: 11, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#ef4444', maxWidth: 300, textAlign: 'right' }}>
                            {step.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Section 5: Results */}
      {run && run.status === 'done' && run.results && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, marginBottom: 14 }}>
            Results
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Pages Generated', value: run.results.pages_generated, color: T },
              { label: 'Pages Published', value: run.results.pages_published, color: GRN },
              { label: 'Keywords Targeted', value: run.results.keywords_targeted, color: R },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  padding: '14px 20px', borderRadius: 10,
                  border: '1px solid #e5e7eb', flex: '1 1 140px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: stat.color }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {run.results.published_urls.length > 0 && (
            <div>
              <span style={labelStyle}>Published Pages</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {run.results.published_urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#3b82f6',
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={12} />
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {run.results.errors.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <span style={labelStyle}>Errors ({run.results.errors.length})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {run.results.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#ef4444' }}>
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
