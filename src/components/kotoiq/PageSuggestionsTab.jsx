"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  Loader2, Search, MapPin, TrendingUp, ChevronRight, CheckCircle,
  XCircle, Sparkles, Globe, BarChart2, Upload, Play, Eye, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FH, FB, BLK, T, R, GRN } from '../../lib/theme'

const API_GAPS = '/api/builder/gaps'
const API_GEN = '/api/builder/generate'
const API_STYLE = '/api/builder/style'

export default function PageSuggestionsTab({ clientId, agencyId }) {
  // ── State ───────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [styleProfiles, setStyleProfiles] = useState([])
  const [selectedStyle, setSelectedStyle] = useState('')
  const [filterService, setFilterService] = useState('')
  const [campaign, setCampaign] = useState(null)
  const [showPreview, setShowPreview] = useState(null)

  // Analysis inputs
  const [services, setServices] = useState('')
  const [state, setState] = useState('')
  const [counties, setCounties] = useState('')

  // Shared wildcards (business info)
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')

  // ── Load existing suggestions + style profiles on mount ──────
  useEffect(() => {
    if (clientId && agencyId) {
      loadSuggestions()
      loadStyleProfiles()
    }
  }, [clientId, agencyId])

  async function loadSuggestions() {
    if (!clientId || !agencyId) return
    try {
      const res = await fetch(`${API_GAPS}?agency_id=${agencyId}&client_id=${clientId}`)
      if (!res.ok) return
      const text = await res.text()
      if (!text.startsWith('{') && !text.startsWith('[')) return // HTML error page
      const data = JSON.parse(text)
      setSuggestions(data.suggestions || [])
    } catch {}
  }

  async function loadStyleProfiles() {
    if (!clientId || !agencyId) return
    try {
      const res = await fetch(`${API_STYLE}?agency_id=${agencyId}&client_id=${clientId}`)
      if (!res.ok) return
      const text = await res.text()
      if (!text.startsWith('{') && !text.startsWith('[')) return
      const data = JSON.parse(text)
      setStyleProfiles(data.profiles || [])
      if (data.profiles?.length) setSelectedStyle(data.profiles[0].id)
    } catch {}
  }

  // ── Run gap analysis ────────────────────────────────────────────
  async function runAnalysis() {
    if (!services.trim() || !state.trim()) {
      toast.error('Enter services and state')
      return
    }
    setLoading('analyzing')
    try {
      const res = await fetch(API_GAPS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          agency_id: agencyId,
          client_id: clientId,
          services: services.split(',').map(s => s.trim()).filter(Boolean),
          state: state.trim().toUpperCase(),
          counties: counties ? counties.split(',').map(c => c.trim()).filter(Boolean) : undefined,
          city_limit: 100,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data.suggestions || [])
      toast.success(`Found ${data.stats?.gaps_found || 0} page opportunities`)
    } catch (e) {
      toast.error(e.message || 'Analysis failed')
    }
    setLoading('')
  }

  // ── Generate selected pages ─────────────────────────────────────
  async function generateSelected() {
    if (selected.size === 0) {
      toast.error('Select pages to generate')
      return
    }
    setLoading('generating')
    try {
      const res = await fetch(API_GEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          agency_id: agencyId,
          client_id: clientId,
          suggestion_ids: [...selected],
          style_profile_id: selectedStyle || undefined,
          shared_wildcards: {
            '{business_name}': businessName,
            '{phone}': phone,
          },
          mode: 'rotation',
          variant_count: 3,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(`Generation started for ${selected.size} pages`)
      setSelected(new Set())
      // Start polling for status
      setTimeout(() => loadSuggestions(), 5000)
    } catch (e) {
      toast.error(e.message || 'Generation failed')
    }
    setLoading('')
  }

  // ── Preview a single page ───────────────────────────────────────
  async function previewPage(suggestion) {
    setLoading(`preview-${suggestion.id}`)
    try {
      const res = await fetch(API_GEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          agency_id: agencyId,
          client_id: clientId,
          service: suggestion.service,
          city: suggestion.city,
          state: suggestion.state,
          county: suggestion.county,
          wildcards: {
            '{business_name}': businessName,
            '{phone}': phone,
            '{city}': suggestion.city,
            '{state}': suggestion.state,
            '{county}': suggestion.county || '',
          },
          style_profile_id: selectedStyle || undefined,
          mode: 'static',
          variant_count: 1,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShowPreview(data)
    } catch (e) {
      toast.error(e.message || 'Preview failed')
    }
    setLoading('')
  }

  // ── Extract style from URL ──────────────────────────────────────
  async function extractStyle() {
    const url = prompt('Enter a URL from the client\'s existing website:')
    if (!url) return
    setLoading('extracting')
    try {
      const res = await fetch(API_STYLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract_url',
          agency_id: agencyId,
          client_id: clientId,
          url,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Style profile extracted')
      loadStyleProfiles()
    } catch (e) {
      toast.error(e.message || 'Style extraction failed')
    }
    setLoading('')
  }

  // ── Toggle selection ────────────────────────────────────────────
  function toggleSelect(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function selectAll() {
    const filtered = getFilteredSuggestions()
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  // ── Filter ──────────────────────────────────────────────────────
  function getFilteredSuggestions() {
    if (!filterService) return suggestions
    return suggestions.filter(s =>
      s.service.toLowerCase().includes(filterService.toLowerCase())
    )
  }

  const filtered = getFilteredSuggestions()
  const uniqueServices = [...new Set(suggestions.map(s => s.service))]

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: `${FH}, -apple-system, BlinkMacSystemFont, system-ui, sans-serif` }}>

      {/* ── Analysis Form ──────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #ececef',
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={18} />
          Gap Analysis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 10, marginBottom: 12 }}>
          <input
            placeholder="Services (comma-separated): Plumbing, HVAC, Electrical"
            value={services}
            onChange={e => setServices(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="State"
            value={state}
            onChange={e => setState(e.target.value)}
            style={inputStyle}
            maxLength={2}
          />
          <input
            placeholder="Counties (optional, comma-separated)"
            value={counties}
            onChange={e => setCounties(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
          <input
            placeholder="Business Name"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={inputStyle}
          />
          <button onClick={runAnalysis} disabled={loading === 'analyzing'} style={btnPrimary}>
            {loading === 'analyzing' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
            {loading === 'analyzing' ? 'Analyzing...' : 'Find Gaps'}
          </button>
        </div>
      </div>

      {/* ── Style Profile + Actions Bar ────────────────────────── */}
      {suggestions.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={selectedStyle}
              onChange={e => setSelectedStyle(e.target.value)}
              style={{ ...inputStyle, width: 200 }}
            >
              <option value="">No style profile</option>
              {styleProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.tone || 'default'})</option>
              ))}
            </select>
            <button onClick={extractStyle} disabled={loading === 'extracting'} style={btnSecondary}>
              <Upload size={14} />
              {loading === 'extracting' ? 'Extracting...' : 'Extract Style'}
            </button>

            {uniqueServices.length > 1 && (
              <select
                value={filterService}
                onChange={e => setFilterService(e.target.value)}
                style={{ ...inputStyle, width: 160 }}
              >
                <option value="">All services</option>
                {uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={selectAll} style={btnSecondary}>
              {selected.size === filtered.length ? 'Deselect All' : `Select All (${filtered.length})`}
            </button>
            <button
              onClick={generateSelected}
              disabled={selected.size === 0 || loading === 'generating'}
              style={{
                ...btnPrimary,
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              {loading === 'generating'
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                : <><Play size={16} /> Build {selected.size} Pages</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Suggestions Table ──────────────────────────────────── */}
      {filtered.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #ececef',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FB }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #ececef' }}>
                <th style={thStyle}></th>
                <th style={thStyle}>Service</th>
                <th style={thStyle}>City</th>
                <th style={thStyle}>State</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Search Vol</th>
                <th style={thStyle}>Competitors</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: selected.has(s.id) ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleSelect(s.id)}
                >
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.service}</td>
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} color="#6b7280" />
                      {s.city}
                    </span>
                  </td>
                  <td style={tdStyle}>{s.state}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                      fontSize: 12, fontWeight: 700, fontFamily: FH,
                      background: s.priority >= 70 ? '#dcfce7' : s.priority >= 40 ? '#fef3c7' : '#f3f4f6',
                      color: s.priority >= 70 ? '#166534' : s.priority >= 40 ? '#92400e' : '#374151',
                    }}>
                      {s.priority}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {s.search_volume ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={12} color={GRN} />
                        {s.search_volume.toLocaleString()}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {s.competitor_count > 0 ? (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>{s.competitor_count}</span>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={e => { e.stopPropagation(); previewPage(s) }}
                      disabled={loading === `preview-${s.id}`}
                      style={{ ...btnSmall, opacity: loading === `preview-${s.id}` ? 0.5 : 1 }}
                    >
                      {loading === `preview-${s.id}` ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Eye size={12} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────── */}
      {suggestions.length === 0 && !loading && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#6b6b70',
          background: '#fff', borderRadius: 16, border: '1px solid #ececef',
        }}>
          <Globe size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No page suggestions yet</div>
          <div style={{ fontSize: 13 }}>
            Enter the client's services and state above, then click "Find Gaps" to identify page opportunities.
          </div>
        </div>
      )}

      {/* ── Preview Modal ──────────────────────────────────────── */}
      {showPreview && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowPreview(null)}
        >
          <div
            style={{
              width: '90vw', maxWidth: 900, maxHeight: '90vh', background: '#fff',
              borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #ececef',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700 }}>
                {showPreview.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#6b7280' }}>
                <span>{showPreview.word_count} words</span>
                <span>{showPreview.variant_count} variants</span>
                <button onClick={() => setShowPreview(null)} style={btnSmall}>Close</button>
              </div>
            </div>
            <div
              style={{
                flex: 1, overflowY: 'auto', padding: '24px 32px',
                fontFamily: FB, fontSize: 14, lineHeight: 1.8, color: '#374151',
              }}
              dangerouslySetInnerHTML={{ __html: showPreview.body_html }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const configs = {
    suggested: { bg: '#f3f4f6', color: '#374151', label: 'Suggested' },
    accepted: { bg: '#dbeafe', color: '#1d4ed8', label: 'Accepted' },
    generating: { bg: '#fef3c7', color: '#92400e', label: 'Generating' },
    built: { bg: '#dcfce7', color: '#166534', label: 'Built' },
    published: { bg: '#d1fae5', color: '#065f46', label: 'Published' },
    dismissed: { bg: '#fecaca', color: '#991b1b', label: 'Dismissed' },
  }
  const c = configs[status] || configs.suggested
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 11,
      fontWeight: 600, fontFamily: FH, background: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const inputStyle = {
  padding: '8px 12px', borderRadius: 10, border: '1px solid #ececef',
  fontSize: 13, fontFamily: FB, outline: 'none', background: '#fff',
}

const btnPrimary = {
  padding: '8px 16px', borderRadius: 10, border: 'none',
  background: '#111', color: '#fff', fontSize: 13, fontWeight: 600,
  fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
}

const btnSecondary = {
  padding: '7px 14px', borderRadius: 10, border: '1px solid #ececef',
  background: '#fff', color: BLK, fontSize: 12, fontWeight: 600,
  fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
}

const btnSmall = {
  padding: '4px 8px', borderRadius: 8, border: '1px solid #ececef',
  background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
}

const thStyle = {
  padding: '10px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#6b7280', fontFamily: FH,
}

const tdStyle = {
  padding: '10px 12px', fontSize: 13,
}
