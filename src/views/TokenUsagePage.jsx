"use client"
// ─────────────────────────────────────────────────────────────
// TokenUsagePage — /token-usage
//
// Reads aggregated Claude API usage from /api/token-usage and
// renders a full-width cost + volume dashboard. Everything on
// this page comes from the koto_token_usage table populated by
// server-side logTokenUsage() calls — this page itself never
// talks to Claude, so viewing it doesn't add to the meter.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { DollarSign, Zap, TrendingUp, Clock, RefreshCw } from 'lucide-react'

const FEATURE_LABELS = {
  voice_onboarding_analysis: '🎙️ Voice Onboarding Analysis',
  proposal_generation: '📄 Proposal Generation',
  discovery_ai: '🔍 Discovery AI',
  discovery_coach: '💡 Discovery Coach',
  discovery_coach_autofill: '✨ Discovery Autofill',
  discovery_live_extraction: '🎤 Live Transcription',
  onboarding_suggest: '✨ Onboarding Suggestions',
  default: '🤖 AI Call',
}

const MODEL_LABELS = {
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-6': 'Opus 4.6',
}

function modelColor(model) {
  if (!model) return '#9ca3af'
  if (model.includes('haiku')) return '#00C2CB'
  if (model.includes('sonnet')) return '#E6007E'
  if (model.includes('opus')) return '#8b5cf6'
  return '#9ca3af'
}

function fmt(n) { return Number(n || 0).toLocaleString() }
function fmtCost(n) { return `$${Number(n || 0).toFixed(4)}` }
function fmtCostLarge(n) { return `$${Number(n || 0).toFixed(2)}` }


export default function TokenUsagePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => { load() }, [days])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summary', days }),
      })
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.warn('[TokenUsagePage load]', e)
    }
    setLoading(false)
  }

  const byFeature = data ? Object.entries(data.by_feature || {}).sort((a, b) => b[1].total_cost - a[1].total_cost) : []
  const byModel = data ? Object.entries(data.by_model || {}).sort((a, b) => b[1].total_cost - a[1].total_cost) : []
  const byDay = data ? Object.entries(data.by_day || {}).sort((a, b) => a[0].localeCompare(b[0])) : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9f9f9', fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 32, maxWidth: 1200 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: 0 }}>Token Usage</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              Claude API usage and cost breakdown — know exactly what you're spending on AI
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff' }}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last 365 days</option>
            </select>
            <button onClick={load}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>Loading usage data…</div>
        ) : !data || data.total_calls === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Zap size={48} style={{ color: '#e5e7eb', marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No usage data yet</div>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>
              Token usage will appear here as you use AI features in Koto
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Total Cost', value: fmtCostLarge(data.total_cost), Icon: DollarSign, color: '#E6007E', sub: `${days} days` },
                { label: 'Total Tokens', value: fmt(data.total_tokens), Icon: Zap, color: '#00C2CB', sub: `${fmt(data.total_input_tokens)} in / ${fmt(data.total_output_tokens)} out` },
                { label: 'API Calls', value: fmt(data.total_calls), Icon: TrendingUp, color: '#8b5cf6', sub: `avg ${Math.round(data.total_tokens / Math.max(1, data.total_calls))} tokens/call` },
                { label: 'Daily Avg Cost', value: fmtCostLarge(data.total_cost / days), Icon: Clock, color: '#f59e0b', sub: `~${fmtCostLarge((data.total_cost / days) * 30)}/month` },
              ].map(card => (
                <div key={card.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <card.Icon size={16} color={card.color} />
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#111', lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

              {/* By Feature */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 16 }}>Cost by Feature</div>
                {byFeature.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>No usage in this window.</div>}
                {byFeature.map(([feature, stats]) => {
                  const pctOfTotal = Math.round((stats.total_cost / Math.max(0.0001, data.total_cost)) * 100)
                  return (
                    <div key={feature} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                          {FEATURE_LABELS[feature] || FEATURE_LABELS.default}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{fmtCost(stats.total_cost)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pctOfTotal}%`,
                            background: '#E6007E',
                            borderRadius: 10,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 120, textAlign: 'right' }}>
                          {fmt(stats.input_tokens + stats.output_tokens)} tokens · {stats.calls} calls
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* By Model */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 16 }}>Cost by Model</div>
                {byModel.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>No usage in this window.</div>}
                {byModel.map(([model, stats]) => {
                  const pctOfTotal = Math.round((stats.total_cost / Math.max(0.0001, data.total_cost)) * 100)
                  return (
                    <div key={model} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: modelColor(model) }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            {MODEL_LABELS[model] || model}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{fmtCost(stats.total_cost)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pctOfTotal}%`,
                            background: modelColor(model),
                            borderRadius: 10,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 80, textAlign: 'right' }}>
                          {fmt(stats.input_tokens + stats.output_tokens)} tokens
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {fmt(stats.input_tokens)} in · {fmt(stats.output_tokens)} out · {stats.calls} calls
                      </div>
                    </div>
                  )
                })}

                {/* Pricing reference */}
                <div style={{ marginTop: 20, padding: '12px 14px', background: '#f9f9f9', borderRadius: 10, fontSize: 11, color: '#6b7280' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151' }}>Current Pricing (per 1M tokens)</div>
                  <div>Haiku 4.5 — $0.80 in / $4.00 out</div>
                  <div>Sonnet 4 — $3.00 in / $15.00 out</div>
                  <div>Opus 4.6 — $15.00 in / $75.00 out</div>
                </div>
              </div>
            </div>

            {/* Daily chart */}
            {byDay.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 16 }}>Daily Cost ({days} days)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                  {(() => {
                    const maxCost = Math.max(...byDay.map(([, d]) => d.total_cost), 0.001)
                    return byDay.map(([day, d]) => (
                      <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        title={`${day}: ${fmtCost(d.total_cost)} · ${fmt(d.total_tokens)} tokens · ${d.calls} calls`}>
                        <div style={{
                          width: '100%',
                          height: `${Math.max(4, Math.round((d.total_cost / maxCost) * 70))}px`,
                          background: '#E6007E',
                          borderRadius: '3px 3px 0 0',
                          opacity: 0.8,
                        }} />
                      </div>
                    ))
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                  <span>{byDay[0]?.[0]}</span>
                  <span>{byDay[byDay.length - 1]?.[0]}</span>
                </div>
              </div>
            )}

            {/* Recent calls table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Recent API Calls</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Feature', 'Model', 'Input', 'Output', 'Total Tokens', 'Cost', 'When'].map(h => (
                        <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recent || []).map((row) => (
                      <tr key={row.id} style={{ borderTop: '1px solid #f9fafb' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>
                          {FEATURE_LABELS[row.feature] || row.feature}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: `${modelColor(row.model)}20`, color: modelColor(row.model), fontWeight: 700, fontSize: 11 }}>
                            {MODEL_LABELS[row.model] || row.model}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{fmt(row.input_tokens)}</td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{fmt(row.output_tokens)}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#111' }}>{fmt(row.input_tokens + row.output_tokens)}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 800, color: '#E6007E' }}>{fmtCost(row.total_cost)}</td>
                        <td style={{ padding: '10px 16px', color: '#9ca3af' }}>
                          {new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
