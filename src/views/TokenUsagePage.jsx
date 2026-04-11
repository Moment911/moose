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

import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { DollarSign, Zap, TrendingUp, Clock, RefreshCw, Upload, CreditCard, ExternalLink, Edit3 } from 'lucide-react'
import toast from 'react-hot-toast'

const FEATURE_LABELS = {
  voice_onboarding_analysis: '🎙️ Voice Onboarding Analysis',
  proposal_generation: '📄 Proposal Generation',
  discovery_ai: '🔍 Discovery AI',
  discovery_coach: '💡 Discovery Coach',
  discovery_coach_autofill: '✨ Discovery Autofill',
  discovery_live_extraction: '🎤 Live Transcription',
  onboarding_suggest: '✨ Onboarding Suggestions',
  external_audit: '🔎 External Audit Work',
  koto_app: '🛠️ Koto App',
  obsidian_copilot: '📝 Obsidian Copilot',
  external: '🌐 External',
  default: '🤖 AI Call',
}

const MODEL_LABELS = {
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-6': 'Opus 4.6',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'o1': 'o1',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'retell-voice': 'Retell Voice',
}

const PROVIDER_CFG = {
  all:       { label: 'All Providers',   color: '#6b7280', icon: '⚡' },
  anthropic: { label: 'Anthropic',       color: '#E6007E', icon: '🟠' },
  openai:    { label: 'OpenAI',          color: '#10a37f', icon: '🟢' },
  google:    { label: 'Google',          color: '#4285f4', icon: '🔵' },
  retell:    { label: 'Retell Voice',    color: '#8b5cf6', icon: '🎙️' },
  other:     { label: 'Other',           color: '#9ca3af', icon: '⚙️' },
}

function modelColor(model) {
  if (!model) return '#9ca3af'
  if (model.includes('haiku')) return '#00C2CB'
  if (model.includes('sonnet')) return '#E6007E'
  if (model.includes('opus')) return '#8b5cf6'
  if (model.includes('gpt') || model.startsWith('o1')) return '#10a37f'
  if (model.includes('gemini')) return '#4285f4'
  if (model.includes('retell')) return '#8b5cf6'
  return '#9ca3af'
}

function fmt(n) { return Number(n || 0).toLocaleString() }
function fmtCost(n) { return `$${Number(n || 0).toFixed(4)}` }
function fmtCostLarge(n) { return `$${Number(n || 0).toFixed(2)}` }

// API-key label mapping lives in localStorage so you can rename
// raw Anthropic Console labels ("momenta audit") to something
// more meaningful ("Claude.ai Audit Work") without a DB round-trip.
const API_KEY_LABEL_STORAGE = 'koto_api_key_labels'
const DEFAULT_API_KEY_LABELS = {
  'momenta audit': 'Claude.ai Audit Work',
  'momenta app':   'Koto Platform',
  'Copilot Obsidian': 'Obsidian AI',
}
function loadApiKeyLabels() {
  if (typeof window === 'undefined') return DEFAULT_API_KEY_LABELS
  try {
    const stored = JSON.parse(localStorage.getItem(API_KEY_LABEL_STORAGE) || '{}')
    return { ...DEFAULT_API_KEY_LABELS, ...stored }
  } catch { return DEFAULT_API_KEY_LABELS }
}
function saveApiKeyLabels(labels) {
  if (typeof window === 'undefined') return
  localStorage.setItem(API_KEY_LABEL_STORAGE, JSON.stringify(labels))
}


export default function TokenUsagePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [providerFilter, setProviderFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [labelEditor, setLabelEditor] = useState(null) // { key, value }
  const [apiKeyLabels, setApiKeyLabels] = useState(() => loadApiKeyLabels())
  const fileInputRef = useRef(null)

  useEffect(() => { load() }, [days, providerFilter])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summary', days, provider: providerFilter }),
      })
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.warn('[TokenUsagePage load]', e)
    }
    setLoading(false)
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_csv', csv_content: text }),
      })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.error || 'Import failed')
      } else {
        toast.success(`Imported ${d.imported} rows · ${fmtCostLarge(d.total_cost)}${d.skipped ? ` · ${d.skipped} skipped` : ''}`)
        await load()
      }
    } catch (err) {
      toast.error(err.message || 'Import failed')
    }
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function renameApiKey(rawKey) {
    const current = apiKeyLabels[rawKey] || rawKey
    setLabelEditor({ key: rawKey, value: current })
  }

  function saveApiKeyLabel() {
    if (!labelEditor) return
    const next = { ...apiKeyLabels, [labelEditor.key]: labelEditor.value.trim() || labelEditor.key }
    setApiKeyLabels(next)
    saveApiKeyLabels(next)
    setLabelEditor(null)
  }

  function displayApiKey(rawKey) {
    return apiKeyLabels[rawKey] || rawKey
  }

  const byFeature = data ? Object.entries(data.by_feature || {}).sort((a, b) => b[1].total_cost - a[1].total_cost) : []
  const byModel = data ? Object.entries(data.by_model || {}).sort((a, b) => b[1].total_cost - a[1].total_cost) : []
  const byDay = data ? Object.entries(data.by_day || {}).sort((a, b) => a[0].localeCompare(b[0])) : []
  const byProvider = data ? Object.entries(data.by_provider || {}).sort((a, b) => b[1].total_cost - a[1].total_cost) : []
  const byApiKey = data ? Object.entries(data.by_api_key || {}).sort((a, b) => b[1].total_cost - a[1].total_cost) : []
  const platformCosts = data?.platform_costs || null
  const grandTotal = data?.grand_total ?? 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9f9f9', fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 32, maxWidth: 1200 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: 0 }}>Token Usage</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              Multi-provider AI cost breakdown — Anthropic, OpenAI, Google, Retell
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E6007E40', background: '#fff', color: '#E6007E', cursor: importing ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={13} /> {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <a href="https://console.anthropic.com/settings/usage" target="_blank" rel="noreferrer"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Anthropic Console <ExternalLink size={11} />
            </a>
            <a href="https://claude.ai/settings/usage" target="_blank" rel="noreferrer"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Claude.ai Usage <ExternalLink size={11} />
            </a>
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

        {/* Provider filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {['all', 'anthropic', 'openai', 'google', 'retell'].map(p => {
            const cfg = PROVIDER_CFG[p]
            const active = providerFilter === p
            return (
              <button key={p} onClick={() => setProviderFilter(p)}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: active ? `1.5px solid ${cfg.color}` : '1px solid #e5e7eb',
                  background: active ? `${cfg.color}15` : '#fff',
                  color: active ? cfg.color : '#6b7280',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            )
          })}
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
            {/* Grand total banner — API + subscription combined */}
            {platformCosts && platformCosts.total > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
                <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', border: '1px solid #e5e7eb', borderLeft: '4px solid #E6007E' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>API Token Costs</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#111' }}>{fmtCostLarge(data.total_cost)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>metered per-call, from koto_token_usage</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', border: '1px solid #e5e7eb', borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CreditCard size={11} /> Claude.ai Subscription
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#111' }}>{fmtCostLarge(platformCosts.total)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{platformCosts.entries} entries · Max plan + extras</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #E6007E08 0%, #8b5cf608 100%)', borderRadius: 14, padding: '18px 22px', border: '1.5px solid #E6007E40' }}>
                  <div style={{ fontSize: 11, color: '#E6007E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Grand Total Anthropic Spend</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#E6007E' }}>{fmtCostLarge(grandTotal)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>API + subscription combined</div>
                </div>
              </div>
            )}

            {/* Provider breakdown */}
            {byProvider.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 14 }}>By Provider</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${byProvider.length}, 1fr)`, gap: 12 }}>
                  {byProvider.map(([prov, stats]) => {
                    const cfg = PROVIDER_CFG[prov] || PROVIDER_CFG.other
                    return (
                      <div key={prov} style={{ background: `${cfg.color}10`, borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${cfg.color}` }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color, marginBottom: 4 }}>{cfg.icon} {cfg.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#111' }}>{fmtCostLarge(stats.total_cost)}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{fmt(stats.input_tokens + stats.output_tokens)} tokens · {stats.calls} calls</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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
                  <div>GPT-4o — $2.50 in / $10.00 out</div>
                  <div>GPT-4o mini — $0.15 in / $0.60 out</div>
                  <div>Gemini 2.5 Flash — $0.15 in / $0.60 out</div>
                  <div>Retell voice — $0.05/min</div>
                </div>
              </div>
            </div>

            {/* By API Key / Workspace — lets you rename raw labels */}
            {byApiKey.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>By API Key / Workspace</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Click a row to rename the label</div>
                </div>
                {byApiKey.map(([rawKey, stats]) => {
                  const pctOfTotal = Math.round((stats.total_cost / Math.max(0.0001, data.total_cost)) * 100)
                  return (
                    <div key={rawKey} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => renameApiKey(rawKey)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {displayApiKey(rawKey)}
                          <Edit3 size={11} color="#d1d5db" />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{fmtCost(stats.total_cost)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pctOfTotal}%`, background: '#00C2CB', borderRadius: 10 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 110, textAlign: 'right' }}>
                          {fmt(stats.input_tokens + stats.output_tokens)} tokens · {stats.calls} calls
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Platform costs (Claude.ai subscription, refunds, etc.) */}
            {platformCosts && platformCosts.entries > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <CreditCard size={16} color="#8b5cf6" />
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Platform Costs (flat subscription + top-ups)</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Date', 'Type', 'Description', 'Amount'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Amount' ? 'right' : 'left', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(platformCosts.recent || []).map((row) => (
                        <tr key={row.id} style={{ borderTop: '1px solid #f9fafb' }}>
                          <td style={{ padding: '8px 14px', color: '#6b7280' }}>{row.date}</td>
                          <td style={{ padding: '8px 14px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: '#8b5cf620', color: '#8b5cf6', fontWeight: 700, fontSize: 10, textTransform: 'capitalize' }}>
                              {row.metadata?.type || 'subscription'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 14px', color: '#374151' }}>{row.description}</td>
                          <td style={{ padding: '8px 14px', fontWeight: 800, textAlign: 'right', color: Number(row.amount) < 0 ? '#16a34a' : '#111' }}>
                            {Number(row.amount) < 0 ? '−' : ''}{fmtCostLarge(Math.abs(Number(row.amount)))}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 800 }}>
                        <td colSpan={3} style={{ padding: '10px 14px', textAlign: 'right', color: '#111' }}>Total</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#8b5cf6', fontSize: 14 }}>{fmtCostLarge(platformCosts.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

      {/* API key label editor */}
      {labelEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 6 }}>Rename API Key Label</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
              Raw value: <code style={{ background: '#f9f9f9', padding: '2px 6px', borderRadius: 4 }}>{labelEditor.key}</code>
            </div>
            <input
              autoFocus
              type="text"
              value={labelEditor.value}
              onChange={(e) => setLabelEditor({ ...labelEditor, value: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKeyLabel()}
              placeholder="Display label"
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #e5e7eb', borderRadius: 8, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLabelEditor(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveApiKeyLabel} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#E6007E', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
