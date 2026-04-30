"use client"
import { useState } from 'react'
import {
  GitBranch, Loader2, Copy, Download, Sparkles, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const FORMATS = [
  { key: 'wikidata', label: 'Wikidata QuickStatements' },
  { key: 'json_ld', label: 'JSON-LD' },
  { key: 'rdf_turtle', label: 'RDF Turtle' },
]

function renderMarkdown(text) {
  if (!text) return null
  const paragraphs = String(text).split('\n\n')
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n')
    const heading = para.match(/^(#{1,6})\s+(.+)$/m)
    if (heading && lines.length === 1) {
      const level = heading[1].length
      const Tag = `h${Math.min(level + 2, 6)}`
      return <Tag key={pIdx} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16 - level, fontWeight: 800, color: BLK, margin: '12px 0 6px' }}>{heading[2]}</Tag>
    }
    const isList = lines.every(l => /^\s*[-*\d]/.test(l) || !l.trim())
    if (isList && lines.some(l => l.trim())) {
      return (
        <ol key={pIdx} style={{ margin: '6px 0 10px', paddingLeft: 22, fontSize: 13, lineHeight: 1.65, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
          {lines.filter(l => l.trim()).map((l, i) => <li key={i}>{l.replace(/^\s*[-*\d]+\.?\s*/, '')}</li>)}
        </ol>
      )
    }
    return <p key={pIdx} style={{ margin: '6px 0', fontSize: 13, lineHeight: 1.65, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{para}</p>
  })
}

export default function KnowledgeGraphTab({ clientId, agencyId }) {
  const [format, setFormat] = useState('wikidata')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const generate = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_knowledge_graph',
          client_id: clientId,
          agency_id: agencyId,
          export_format: format,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setResult(j)
      toast.success('Export generated')
    } catch (e) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setRunning(false)
    }
  }

  const copyAll = () => {
    if (!result?.content) return
    navigator.clipboard.writeText(result.content)
    toast.success('Copied to clipboard')
  }

  const download = () => {
    if (!result?.content) return
    const ext = format === 'rdf_turtle' ? 'ttl' : format === 'json_ld' ? 'json' : 'txt'
    const blob = new Blob([result.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-graph-${format}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kpScore = Number(result?.estimated_knowledge_panel_trigger_likelihood || 0)
  const kpColor = kpScore >= 70 ? GRN : kpScore >= 40 ? AMB : R

  return (
    <div>
      <HowItWorks tool="knowledge_graph" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GitBranch size={30} color="#0a0a0a" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Knowledge Graph Export</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Generate entity markup for Wikidata, schema.org, or RDF — the foundation of a Google Knowledge Panel.</div>
        </div>
      </div>

      {/* Format toggle */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Export Format</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              disabled={running}
              style={{
                padding: '10px 18px', borderRadius: 8,
                border: `1.5px solid ${format === f.key ? T : '#ececef'}`,
                background: format === f.key ? '#f1f1f6' : '#fff',
                color: format === f.key ? T : '#1f1f22',
                fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer',
              }}>
              {f.label}
            </button>
          ))}
          <button
            onClick={generate}
            disabled={running}
            style={{
              marginLeft: 'auto', padding: '10px 22px', borderRadius: 8, border: 'none',
              background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            {running ? 'Generating...' : 'Generate Export'}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* KP likelihood */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                  Knowledge Panel Trigger Likelihood
                </div>
                <div style={{ fontSize: 12, color: '#1f1f22' }}>Deterministic score based on entity completeness, schema, backlinks, and reviews.</div>
              </div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 42, fontWeight: 900, color: kpColor, letterSpacing: '-.02em' }}>{kpScore}<span style={{ fontSize: 18, color: '#8e8e93' }}>/100</span></div>
            </div>
            <div style={{ marginTop: 10, height: 8, background: '#f1f1f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${kpScore}%`, height: '100%', background: kpColor, transition: 'width .3s' }} />
            </div>
          </div>

          {/* 3-column display */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Entity properties */}
            <div style={{ ...card, margin: 0 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 12 }}>Entity Properties</div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {(result.entity_properties || []).map((p, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: BLK, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.name || p.property || p.p_code || p.predicate || '—'}</div>
                    <div style={{ color: '#1f1f22', wordBreak: 'break-word', marginTop: 2 }}>{String(p.value ?? p.label ?? '').slice(0, 200)}</div>
                    {p.source && <div style={{ color: '#8e8e93', fontSize: 10, marginTop: 2 }}>{p.source}</div>}
                  </div>
                ))}
                {!(result.entity_properties || []).length && <div style={{ fontSize: 12, color: '#6b6b70' }}>No properties extracted</div>}
              </div>
            </div>

            {/* Content */}
            <div style={{ ...card, margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: BLK }}>Generated {FORMATS.find(f => f.key === format)?.label}</div>
                <button onClick={copyAll} style={{
                  padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff',
                  fontSize: 11, fontWeight: 700, color: '#1f1f22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}><Copy size={11} /> Copy</button>
              </div>
              <pre style={{
                padding: 14, background: '#0f172a', color: '#e2e8f0',
                fontSize: 11, fontFamily: 'Menlo,Monaco,monospace', borderRadius: 8,
                overflow: 'auto', maxHeight: 500, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{result.content}</pre>
            </div>

            {/* Related entities */}
            <div style={{ ...card, margin: 0 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 12 }}>Related Entities</div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {(result.related_entities || []).map((e, i) => (
                  <div key={i} style={{ padding: '8px 10px', marginBottom: 6, background: '#f9f9fb', borderRadius: 8, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: BLK }}>{e.qid_or_label || e.entity || e.label || '—'}</div>
                    {e.relationship && <div style={{ color: '#6b6b70', fontSize: 11, marginTop: 2 }}>{e.relationship}</div>}
                  </div>
                ))}
                {!(result.related_entities || []).length && <div style={{ fontSize: 12, color: '#6b6b70' }}>None extracted</div>}
              </div>
            </div>
          </div>

          {/* Submission guide */}
          {result.submission_guide_markdown && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={16} color="#0a0a0a" /> Submission Guide
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyAll} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
                    fontSize: 11, fontWeight: 700, color: '#1f1f22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}><Copy size={12} /> Copy All</button>
                  <button onClick={download} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
                    fontSize: 11, fontWeight: 700, color: '#1f1f22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}><Download size={12} /> Download</button>
                </div>
              </div>
              <div>{renderMarkdown(result.submission_guide_markdown)}</div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
