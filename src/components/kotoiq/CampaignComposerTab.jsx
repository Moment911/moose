"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, ChevronRight, ChevronLeft, Upload, FileText, Table2,
  Play, CheckCircle, AlertCircle, Clock, Layers, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FH, BLK } from '../../lib/theme'

/**
 * Campaign Composer (UI-03)
 *
 * Five-step wizard:
 * 1. Pick template
 * 2. Upload/paste seed dataset (CSV or JSON)
 * 3. Preview rows (slot fills)
 * 4. Set cadence
 * 5. Create campaign
 */

const API = '/api/wp'

async function wpAction(action, payload = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

// ── CSV parser — simple split, auto-detect headers ─────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  // Detect delimiter: if first line has more tabs than commas, use tab
  const firstLine = lines[0]
  const delim = (firstLine.split('\t').length > firstLine.split(',').length) ? '\t' : ','

  const parsed = lines.map(line => {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === delim && !inQuotes) { result.push(current.trim()); current = ''; continue }
      current += ch
    }
    result.push(current.trim())
    return result
  })

  // First row is headers if it looks non-numeric
  const headers = parsed[0]
  const rows = parsed.slice(1).map(cols => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  })
  return { headers, rows }
}

function parseJSON(text) {
  try {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data : [data]
    if (arr.length === 0) return { headers: [], rows: [] }
    const headers = Object.keys(arr[0])
    return { headers, rows: arr }
  } catch {
    return null
  }
}

// ── Cadence options ────────────────────────────────────────────────────────
const CADENCE_OPTIONS = [
  { key: 'burst', label: 'Burst', desc: 'Publish all pages as fast as possible' },
  { key: 'drip', label: 'Drip', desc: 'Publish a fixed number per day' },
  { key: 'weekly', label: 'Weekly', desc: 'Publish a batch once per week' },
]

// ── Step indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Template' },
  { num: 2, label: 'Seed Data' },
  { num: 3, label: 'Preview' },
  { num: 4, label: 'Cadence' },
  { num: 5, label: 'Create' },
]

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((s, i) => {
        const done = current > s.num
        const active = current === s.num
        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                background: done ? BLK : active ? BLK : '#f1f1f6',
                color: done || active ? '#fff' : '#8e8e93',
                transition: 'all .2s',
              }}>
                {done ? <CheckCircle size={16} /> : s.num}
              </div>
              <span style={{
                fontSize: 13, fontWeight: active ? 700 : 500,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                color: active ? BLK : done ? '#1f1f22' : '#8e8e93',
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 40, height: 2, margin: '0 8px',
                background: done ? BLK : '#ececef',
                borderRadius: 1,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CampaignComposerTab({ agencyId }) {
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Step 2 — seed data
  const [rawInput, setRawInput] = useState('')
  const [seedHeaders, setSeedHeaders] = useState([])
  const [seedRows, setSeedRows] = useState([])
  const [inputMode, setInputMode] = useState('paste') // 'paste' | 'file'

  // Step 3 — preview
  const [previewRows, setPreviewRows] = useState([])
  const [generatingPreview, setGeneratingPreview] = useState(false)

  // Step 4 — cadence
  const [cadence, setCadence] = useState('drip')
  const [perDayCap, setPerDayCap] = useState(5)
  const [startAt, setStartAt] = useState('')

  // Step 5 — creating
  const [creating, setCreating] = useState(false)
  const [campaignResult, setCampaignResult] = useState(null)

  // Load templates
  useEffect(() => {
    loadTemplates()
  }, [agencyId])

  async function loadTemplates() {
    setLoadingTemplates(true)
    try {
      const res = await wpAction('list_templates', { agency_id: agencyId })
      setTemplates(res.templates || [])
    } catch { /* ignore */ }
    setLoadingTemplates(false)
  }

  // Parse seed data
  function parseSeedData() {
    const text = rawInput.trim()
    if (!text) { toast.error('Paste or upload seed data first'); return false }

    // Try JSON first
    const jsonResult = parseJSON(text)
    if (jsonResult && jsonResult.headers.length > 0) {
      setSeedHeaders(jsonResult.headers)
      setSeedRows(jsonResult.rows)
      return true
    }

    // Try CSV
    const csvResult = parseCSV(text)
    if (csvResult.headers.length > 0 && csvResult.rows.length > 0) {
      setSeedHeaders(csvResult.headers)
      setSeedRows(csvResult.rows)
      return true
    }

    toast.error('Could not parse data. Use CSV with headers or JSON array.')
    return false
  }

  // File upload handler
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRawInput(ev.target.result)
    }
    reader.readAsText(file)
  }

  // Generate preview for first 3 rows
  async function generatePreview() {
    if (seedRows.length === 0) { toast.error('No seed data'); return }
    setGeneratingPreview(true)
    try {
      const previewSlice = seedRows.slice(0, 3)
      const res = await wpAction('generate_variants', {
        agency_id: agencyId,
        template_id: selectedTemplate.id,
        seed_rows: previewSlice,
      })
      setPreviewRows(res.variants || previewSlice.map(r => ({ ...r, _preview: true })))
    } catch {
      // Fallback — show raw rows as preview
      setPreviewRows(seedRows.slice(0, 3).map(r => ({ ...r, _preview: true })))
    }
    setGeneratingPreview(false)
  }

  // Create campaign
  async function createCampaign() {
    setCreating(true)
    try {
      const res = await wpAction('create_campaign', {
        agency_id: agencyId,
        template_id: selectedTemplate.id,
        seed_rows: seedRows,
        cadence,
        per_day_cap: cadence === 'drip' ? perDayCap : undefined,
        start_at: startAt || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        setCampaignResult(res)
        toast.success(`Campaign created with ${seedRows.length} variants`)
      }
    } catch (err) {
      toast.error('Failed to create campaign')
    }
    setCreating(false)
  }

  // Navigation
  function nextStep() {
    if (step === 2) {
      if (!parseSeedData()) return
    }
    setStep(s => Math.min(s + 1, 5))
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px' }

  return (
    <div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Campaign Composer</div>
      <div style={{ fontSize: 14, color: '#6b6b70', marginBottom: 24 }}>Create a multi-page campaign from a template and seed dataset.</div>

      <StepIndicator current={step} />

      {/* ── Step 1: Pick Template ────────────────────────────────── */}
      {step === 1 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16 }}>
            Pick a Template
          </div>

          {loadingTemplates ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b70', fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div style={{ fontSize: 14, color: '#8e8e93', padding: '32px 0', textAlign: 'center' }}>
              No templates found. Ingest a template from the Templates tab first.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {templates.map(tpl => {
                const active = selectedTemplate?.id === tpl.id
                return (
                  <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', borderRadius: 10,
                    border: active ? `2px solid ${BLK}` : '1px solid #e5e7eb',
                    background: active ? '#f9f9fb' : '#fff',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all .15s',
                  }}>
                    <Layers size={18} color={active ? BLK : '#8e8e93'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: BLK }}>{tpl.name || tpl.title || 'Untitled'}</div>
                      {tpl.slot_count != null && (
                        <div style={{ fontSize: 12, color: '#6b6b70', marginTop: 2 }}>{tpl.slot_count} slots</div>
                      )}
                    </div>
                    {active && <CheckCircle size={18} color={BLK} />}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={nextStep} disabled={!selectedTemplate} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: selectedTemplate ? BLK : '#ececef',
              color: selectedTemplate ? '#fff' : '#8e8e93',
              fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: selectedTemplate ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload Seed Data ─────────────────────────────── */}
      {step === 2 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16 }}>
            Upload Seed Dataset
          </div>
          <div style={{ fontSize: 13, color: '#6b6b70', marginBottom: 16 }}>
            Paste CSV or JSON rows. Each row = one page variant. Columns should match template slots (e.g. city, service, phone).
          </div>

          {/* Toggle paste / file */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setInputMode('paste')} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: inputMode === 'paste' ? `1px solid ${BLK}` : '1px solid #e5e7eb',
              background: inputMode === 'paste' ? '#f9f9fb' : '#fff',
              color: BLK, cursor: 'pointer',
            }}>
              Paste
            </button>
            <button onClick={() => setInputMode('file')} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: inputMode === 'file' ? `1px solid ${BLK}` : '1px solid #e5e7eb',
              background: inputMode === 'file' ? '#f9f9fb' : '#fff',
              color: BLK, cursor: 'pointer',
            }}>
              <Upload size={12} style={{ marginRight: 4 }} /> Upload File
            </button>
          </div>

          {inputMode === 'file' && (
            <div style={{ marginBottom: 12 }}>
              <input type="file" accept=".csv,.json,.tsv,.txt" onChange={handleFileUpload}
                style={{ fontSize: 13 }} />
            </div>
          )}

          <textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={`city,service,phone\nMiami,Plumbing,305-555-0100\nTampa,HVAC,813-555-0200\nOrlando,Roofing,407-555-0300`}
            style={{
              width: '100%', minHeight: 180, padding: '14px 16px',
              borderRadius: 10, border: '1px solid #e5e7eb',
              fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6,
              resize: 'vertical', outline: 'none',
            }}
          />

          {seedRows.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={12} /> {seedRows.length} rows parsed, {seedHeaders.length} columns: {seedHeaders.join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => setStep(1)} style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: BLK, fontSize: 14, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={nextStep} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ──────────────────────────────────────── */}
      {step === 3 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK }}>Preview</div>
              <div style={{ fontSize: 13, color: '#6b6b70', marginTop: 4 }}>
                Showing first {Math.min(3, seedRows.length)} of {seedRows.length} rows. Generate preview to see slot fills.
              </div>
            </div>
            <button onClick={generatePreview} disabled={generatingPreview} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: BLK, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: generatingPreview ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: generatingPreview ? 0.6 : 1,
            }}>
              {generatingPreview ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
              Generate Preview
            </button>
          </div>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9f9fb' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, color: BLK, fontSize: 12, borderBottom: '1px solid #e5e7eb' }}>#</th>
                  {seedHeaders.map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, color: BLK, fontSize: 12, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(previewRows.length > 0 ? previewRows : seedRows.slice(0, 3)).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', color: '#8e8e93', fontWeight: 600 }}>{i + 1}</td>
                    {seedHeaders.map(h => (
                      <td key={h} style={{ padding: '10px 14px', color: '#1f1f22' }}>{row[h] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => setStep(2)} style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: BLK, fontSize: 14, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={nextStep} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Cadence ──────────────────────────────────────── */}
      {step === 4 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16 }}>
            Set Publish Cadence
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
            {CADENCE_OPTIONS.map(opt => {
              const active = cadence === opt.key
              return (
                <button key={opt.key} onClick={() => setCadence(opt.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', borderRadius: 10,
                  border: active ? `2px solid ${BLK}` : '1px solid #e5e7eb',
                  background: active ? '#f9f9fb' : '#fff',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all .15s',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: active ? `6px solid ${BLK}` : '2px solid #d1d5db',
                    transition: 'all .15s',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: BLK }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#6b6b70', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Per-day cap for drip */}
          {cadence === 'drip' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, marginBottom: 6 }}>
                Pages per day
              </label>
              <input type="number" min={1} max={100} value={perDayCap}
                onChange={e => setPerDayCap(Number(e.target.value) || 1)}
                style={{
                  padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                  fontSize: 14, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 600, width: 120, outline: 'none',
                }}
              />
            </div>
          )}

          {/* Start date */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, marginBottom: 6 }}>
              Start date (optional)
            </label>
            <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", width: 240, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => setStep(3)} style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: BLK, fontSize: 14, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={nextStep} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Create Campaign ──────────────────────────────── */}
      {step === 5 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16 }}>
            Review &amp; Create
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Template</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: BLK }}>{selectedTemplate?.name || selectedTemplate?.title || 'N/A'}</div>
            </div>
            <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Variants</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: BLK }}>{seedRows.length} pages</div>
            </div>
            <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Cadence</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: BLK }}>
                {CADENCE_OPTIONS.find(o => o.key === cadence)?.label}
                {cadence === 'drip' && ` (${perDayCap}/day)`}
              </div>
            </div>
            <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Start</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: BLK }}>
                {startAt ? new Date(startAt).toLocaleString() : 'Immediately'}
              </div>
            </div>
          </div>

          {/* Campaign result */}
          {campaignResult && (
            <div style={{
              background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0',
              padding: '16px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <CheckCircle size={20} color="#16a34a" />
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: '#166534' }}>Campaign Created</div>
                <div style={{ fontSize: 13, color: '#15803d', marginTop: 2 }}>
                  ID: {campaignResult.campaign_id || campaignResult.id || 'N/A'} — {seedRows.length} variants queued
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => setStep(4)} disabled={creating} style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: BLK, fontSize: 14, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ChevronLeft size={16} /> Back
            </button>
            {!campaignResult && (
              <button onClick={createCampaign} disabled={creating} style={{
                padding: '12px 28px', borderRadius: 8, border: 'none',
                background: creating ? '#6b6b70' : BLK,
                color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                cursor: creating ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {creating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={16} />}
                Create Campaign
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
