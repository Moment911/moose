"use client"
import { useMemo, useState } from 'react'
import { Phone, X, Search, Loader2, CheckCircle2, AlertTriangle, Eye, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * PhoneVariantsModal
 *
 * Scans the site for every common formatting of a phone number, lets the user
 * pick which exact variants to replace, then runs a job per selected variant
 * mapping the source format → matching target format.
 *
 * Strategy: 16 preview scans against the existing engine (sr_create_job +
 * sr_run_chunk loop, is_dry_run=true). Each variant's preview job gets deleted
 * after we capture its match count so we don't pollute job history with
 * zero-result preview rows. Live replace runs are kept in history.
 */

const VARIANTS = [
  { id: 'parens-sp-dash',     label: '(555) 123-4567',     fn: d => `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` },
  { id: 'parens-dash',        label: '(555)123-4567',      fn: d => `(${d.slice(0,3)})${d.slice(3,6)}-${d.slice(6)}` },
  { id: 'parens-sp-sp',       label: '(555) 123 4567',     fn: d => `(${d.slice(0,3)}) ${d.slice(3,6)} ${d.slice(6)}` },
  { id: 'dash',               label: '555-123-4567',       fn: d => `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` },
  { id: 'dot',                label: '555.123.4567',       fn: d => `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}` },
  { id: 'space',              label: '555 123 4567',       fn: d => `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}` },
  { id: 'plain',              label: '5551234567',         fn: d => d },
  { id: 'cc-plain',           label: '+15551234567',       fn: d => `+1${d}` },
  { id: 'cc-dash',            label: '+1-555-123-4567',    fn: d => `+1-${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` },
  { id: 'cc-dot',             label: '+1.555.123.4567',    fn: d => `+1.${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}` },
  { id: 'cc-sp-parens-dash',  label: '+1 (555) 123-4567',  fn: d => `+1 (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` },
  { id: 'cc-sp-dash',         label: '+1 555-123-4567',    fn: d => `+1 ${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` },
  { id: 'cc-sp-space',        label: '+1 555 123 4567',    fn: d => `+1 ${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}` },
  { id: '1-dash',             label: '1-555-123-4567',     fn: d => `1-${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` },
  { id: '1-dot',              label: '1.555.123.4567',     fn: d => `1.${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}` },
  { id: '1-plain',            label: '15551234567',        fn: d => `1${d}` },
]

const digitsOnly = s => (s || '').replace(/\D/g, '').slice(-10)

const fmtPhone = d => d && d.length === 10
  ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  : (d || '')

export default function PhoneVariantsModal({ site, tables, defaultTables, onClose, onAllReplaced }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [results, setResults] = useState([]) // [{id, label, find, replace, count}]
  const [selected, setSelected] = useState({}) // {id: true}
  const [replacing, setReplacing] = useState(false)

  const sourceDigits = digitsOnly(source)
  const targetDigits = digitsOnly(target)
  const variants = useMemo(() => {
    if (sourceDigits.length !== 10) return []
    return VARIANTS.map(v => ({
      id: v.id,
      label: v.label,
      find: v.fn(sourceDigits),
      // If target is empty, replace is null — populated lazily before Replace runs
      replace: targetDigits.length === 10 ? v.fn(targetDigits) : null,
    }))
  }, [sourceDigits, targetDigits])

  function buildScope() {
    // Prefer the user's existing selection if any; otherwise fall back to core
    // text tables which is where phone numbers virtually always live.
    const chosen = tables.filter(t => defaultTables[t.name] || t.is_core)
    return { tables: chosen.map(t => ({ name: t.name, primary_key: t.primary_key, columns: t.columns })) }
  }

  async function runJobToCompletion({ find, replaceWith, dryRun }) {
    const scope = buildScope()
    if (!scope.tables.length) throw new Error('No tables selected to scan')
    const createRes = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sr_create_job',
        site_id: site.id,
        search: find,
        replace_with: replaceWith,
        options: { case_sensitive: false, regex: false, image_mode: false },
        scope,
        is_dry_run: !!dryRun,
      }),
    })
    const created = await createRes.json()
    if (created.error || !created.job) throw new Error(created.error || 'Could not create job')
    const job = created.job

    let total = { matches: 0, rows_changed: 0, scanned: 0 }
    let done = false
    while (!done) {
      const r = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sr_run_chunk', site_id: site.id, job_id: job.id, chunk_size: 200, sample_cap: 0 }),
      })
      const chunk = await r.json()
      if (chunk.error) throw new Error(chunk.error)
      total.matches += Number(chunk.matches || 0)
      total.rows_changed += Number(chunk.rows_changed || 0)
      total.scanned += Number(chunk.scanned || 0)
      done = !!chunk.done
    }
    return { job_id: job.id, ...total }
  }

  async function deleteJobSilently(jobId) {
    try {
      await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sr_delete_job', site_id: site.id, job_id: jobId }),
      })
    } catch {}
  }

  async function scan() {
    if (sourceDigits.length !== 10) { toast.error('Enter a 10-digit source phone number'); return }
    setScanning(true)
    setResults([])
    setSelected({})

    const out = []
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      // Show the actual variant string being scanned (e.g. "833.228.3727"),
      // not the template label ("555.123.4567" placeholder).
      setProgress({ current: i + 1, total: variants.length, label: v.find })
      try {
        // Use the variant's own find string as a placeholder replace during scan;
        // never written (dry_run = true). The real replace string is built when
        // the user fills in Target and clicks Replace.
        const r = await runJobToCompletion({ find: v.find, replaceWith: v.replace || v.find, dryRun: true })
        await deleteJobSilently(r.job_id)
        out.push({ ...v, count: r.matches })
      } catch (e) {
        out.push({ ...v, count: 0, error: e.message })
      }
    }
    // Sort by count desc, then auto-select everything with >0 matches
    out.sort((a, b) => (b.count || 0) - (a.count || 0))
    setResults(out)
    const autoSel = {}
    out.forEach(r => { if (r.count > 0) autoSel[r.id] = true })
    setSelected(autoSel)
    setScanning(false)
    setProgress({ current: variants.length, total: variants.length, label: '' })
  }

  async function replaceSelected() {
    if (targetDigits.length !== 10) { toast.error('Enter a 10-digit target phone number first'); return }
    // Re-build current replace strings from the latest target — modal lets user
    // fill in target after scanning.
    const variantById = new Map(variants.map(v => [v.id, v]))
    const toRun = results
      .filter(r => selected[r.id] && r.count > 0)
      .map(r => {
        const v = variantById.get(r.id)
        return { ...r, replace: v?.replace || r.replace }
      })
    if (!toRun.length) { toast.error('Select at least one variant with matches'); return }
    if (!confirm(`Apply ${toRun.length} replacement(s) on ${site.site_name || site.site_url}?\n\n${toRun.map(r => `  ${r.find} → ${r.replace}  (${r.count} matches)`).join('\n')}`)) return

    setReplacing(true)
    let total = 0
    for (let i = 0; i < toRun.length; i++) {
      const v = toRun[i]
      setProgress({ current: i + 1, total: toRun.length, label: `${v.find} → ${v.replace}` })
      try {
        const r = await runJobToCompletion({ find: v.find, replaceWith: v.replace, dryRun: false })
        total += r.rows_changed
      } catch (e) {
        toast.error(`${v.find}: ${e.message}`)
      }
    }
    toast.success(`Replaced ${total} row(s) across ${toRun.length} format(s)`)
    setReplacing(false)
    setProgress({ current: 0, total: 0, label: '' })
    onAllReplaced?.()
  }

  const totalMatches = results.reduce((s, r) => s + (r.count || 0), 0)
  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 50, paddingBottom: 50, zIndex: 1000, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 720, width: '100%', padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Phone size={18} color={R}/>
          <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: BLK }}>Phone variant finder</div>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginBottom: 16, lineHeight: 1.5 }}>
          Enter any format of the source phone (we extract the 10 digits) and the target phone. Scans all 16 common formats, shows how many of each exist, and lets you pick which to replace. Target keeps the same format as the source variant being replaced.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Lbl>Find phone (any format)</Lbl>
            <input value={source} onChange={e => setSource(e.target.value)} placeholder="833-228-3727 or (833) 228-3727…" style={inp()} />
            {source && <Hint ok={sourceDigits.length === 10}>{sourceDigits.length === 10 ? `Detected: ${fmtPhone(sourceDigits)}` : `${sourceDigits.length}/10 digits`}</Hint>}
          </div>
          <div>
            <Lbl>Replace with (any format)</Lbl>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="800-555-1234 or (800) 555-1234…" style={inp()} />
            {target && <Hint ok={targetDigits.length === 10}>{targetDigits.length === 10 ? `Detected: ${fmtPhone(targetDigits)}` : `${targetDigits.length}/10 digits`}</Hint>}
          </div>
        </div>

        <button onClick={scan} disabled={scanning || replacing || sourceDigits.length !== 10} style={{ ...primaryBtn({ bg: '#fff', color: BLK, border: '1.5px solid #e5e7eb' }), width: '100%', marginBottom: 14 }}>
          {scanning ? <Loader2 size={13} className="spin"/> : <Search size={13}/>}
          {scanning ? `Scanning ${progress.current}/${progress.total}… ${progress.label}` : 'Scan all 16 formats'}
        </button>
        <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB, marginTop: -10, marginBottom: 14, lineHeight: 1.4 }}>
          Target phone is only required when you're ready to replace. Scan can run with just the source.
        </div>

        {results.length > 0 && (
          <div style={{ background: '#fafafa', borderRadius: 9, border: '1px solid #f1f5f9', padding: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK }}>
                {totalMatches.toLocaleString()} total match{totalMatches === 1 ? '' : 'es'} across {results.filter(r => r.count > 0).length} format(s)
              </div>
              <div style={{ flex: 1 }}/>
              <button onClick={() => { const all = {}; results.forEach(r => { if (r.count > 0) all[r.id] = true }); setSelected(all) }} style={mini()}>Select all w/ matches</button>
              <button onClick={() => setSelected({})} style={mini()}>Clear</button>
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {results.map(r => {
                const has = r.count > 0
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: '#fff', borderRadius: 7, border: `1px solid ${selected[r.id] && has ? AMB : '#f1f5f9'}`, marginBottom: 5, cursor: has ? 'pointer' : 'default', opacity: has ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      disabled={!has}
                      onChange={() => setSelected(s => ({ ...s, [r.id]: !s[r.id] }))}
                      style={{ margin: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, color: BLK, wordBreak: 'break-all' }}>
                        <span style={{ color: has ? '#991b1b' : '#9ca3af' }}>−</span> {r.find}
                        {targetDigits.length === 10 ? (
                          <>  <span style={{ color: '#9ca3af' }}>→</span>  <span style={{ color: has ? '#166534' : '#9ca3af' }}>+</span> {(variants.find(v => v.id === r.id)?.replace) || r.replace}</>
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic', marginLeft: 6 }}>(enter target to see replacement)</span>
                        )}
                      </div>
                      {r.error && <div style={{ fontSize: 10, color: AMB, fontFamily: FB, marginTop: 2 }}>scan error: {r.error}</div>}
                    </div>
                    <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: has ? R : '#9ca3af', minWidth: 36, textAlign: 'right' }}>
                      {(r.count || 0).toLocaleString()}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={scanning || replacing} style={primaryBtn({ bg: '#fff', color: BLK, border: '1.5px solid #e5e7eb' })}>Close</button>
          {results.length > 0 && (
            <button
              onClick={replaceSelected}
              disabled={!selectedCount || replacing || scanning || targetDigits.length !== 10}
              title={targetDigits.length !== 10 ? 'Enter a 10-digit target phone first' : ''}
              style={primaryBtn({ bg: R, color: '#fff' })}>
              {replacing ? <Loader2 size={13} className="spin"/> : <Play size={13}/>}
              {replacing ? `Replacing ${progress.current}/${progress.total}…` : `Replace ${selectedCount} selected format(s)`}
            </button>
          )}
        </div>

        <style jsx>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; display: inline-block; }
        `}</style>
      </div>
    </div>
  )
}

const Lbl = ({ children }) => <div style={{ fontFamily: FH, fontSize: 11, fontWeight: 700, color: BLK, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</div>
const Hint = ({ children, ok }) => <div style={{ marginTop: 5, fontSize: 11, color: ok ? GRN : AMB, fontFamily: FB }}>{children}</div>
const inp = (x = {}) => ({ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', background: '#fff', boxSizing: 'border-box', ...x })
const mini = (x = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: `1px solid ${x.borderColor || '#e5e7eb'}`, background: x.bg || '#fff', color: x.color || '#6b7280', fontSize: 11, fontFamily: FH, fontWeight: 600, cursor: 'pointer' })
const primaryBtn = (x = {}) => ({ padding: '10px 18px', borderRadius: 9, border: x.border || 'none', background: x.bg || R, color: x.color || '#fff', fontFamily: FH, fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: x.disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 })
