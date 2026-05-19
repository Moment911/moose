"use client"
import { useState, useEffect, useRef } from 'react'
import { Search, Replace as ReplaceIcon, Eye, Play, Undo2, Loader2, Database, Image as ImageIcon, AlertTriangle, CheckCircle2, Trash2, RefreshCw, Pause } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const inp = (x = {}) => ({
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB,
  outline: 'none', background: '#fff', boxSizing: 'border-box', ...x,
})

const Label = ({ children }) => (
  <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 5 }}>{children}</div>
)

const Pill = ({ children, color = '#6b7280', bg = '#f3f4f6' }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: bg, fontFamily: FH }}>{children}</span>
)

const STATUS_PILL = {
  preview:   { color: '#0e7490', bg: '#cffafe', label: 'Preview' },
  running:   { color: '#1d4ed8', bg: '#dbeafe', label: 'Running' },
  paused:    { color: '#9a3412', bg: '#ffedd5', label: 'Paused' },
  complete:  { color: '#15803d', bg: '#dcfce7', label: 'Complete' },
  undoing:   { color: '#9a3412', bg: '#ffedd5', label: 'Undoing' },
  undone:    { color: '#374151', bg: '#e5e7eb', label: 'Undone' },
  failed:    { color: '#b91c1c', bg: '#fee2e2', label: 'Failed' },
}

const IMAGE_PRESET_NOTE = 'Replaces URLs across post_content, postmeta, options, and attachment GUIDs. Same engine, just guides the table picker.'

export default function SearchReplacePanel({ site }) {
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tablesError, setTablesError] = useState(null)
  const [selectedTables, setSelectedTables] = useState({}) // {tableName: true}
  const [search, setSearch] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [job, setJob] = useState(null)
  const [jobRunning, setJobRunning] = useState(false)
  const [samples, setSamples] = useState([])
  const [jobs, setJobs] = useState([])
  const [progress, setProgress] = useState(null) // {scanned, matches, table}
  const cancelRef = useRef(false)

  // Re-run when wpsc_api_key changes (e.g. after the user just paired this site)
  useEffect(() => { if (site?.id) { loadTables(); loadJobs() } }, [site?.id, site?.wpsc_api_key])

  async function loadTables() {
    if (!site?.id) return
    setTablesLoading(true); setTablesError(null)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sr_list_tables', site_id: site.id }),
      })
      const data = await res.json()

      // Surface auth/plugin errors instead of silently rendering an empty list.
      // proxyToWPSC returns { ok, data, status }. On failure, data.data contains the WP error payload.
      if (data?.ok === false) {
        const msg = data?.data?.message || data?.data?.error || data?.error || `HTTP ${data?.status || '?'}`
        setTablesError(msg)
        setTables([])
        setSelectedTables({})
        return
      }
      if (!site.wpsc_api_key) {
        setTablesError('This site has no WPSimpleCode API key paired. Pair it from the page above first.')
        setTables([])
        setSelectedTables({})
        return
      }

      const list = data?.data?.tables || data?.tables || []
      setTables(list)
      const defaults = {}
      list.forEach(t => { if (t.is_core) defaults[t.name] = true })
      setSelectedTables(defaults)
    } catch (e) {
      setTablesError(e.message)
      toast.error('Could not load tables: ' + e.message)
    }
    setTablesLoading(false)
  }

  async function loadJobs() {
    if (!site?.id) return
    const res = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sr_list_jobs', site_id: site.id }),
    })
    const data = await res.json()
    setJobs(data.jobs || [])
  }

  async function loadSamplesFor(job_id) {
    const res = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sr_get_samples', site_id: site.id, job_id, limit: 50 }),
    })
    const data = await res.json()
    setSamples(data.samples || [])
  }

  function buildScope() {
    const chosen = Object.keys(selectedTables).filter(t => selectedTables[t])
    const matched = tables.filter(t => chosen.includes(t.name))
    return {
      tables: matched.map(t => ({
        name: t.name,
        primary_key: t.primary_key,
        columns: t.columns,
      })),
    }
  }

  async function runJob({ dry }) {
    if (!search) { toast.error('Search text required'); return }
    const scope = buildScope()
    if (!scope.tables.length) { toast.error('Pick at least one table'); return }
    if (!dry && !confirm(`Apply replacement to ${scope.tables.length} table(s) on ${site.site_name || site.site_url}?\n\nAn undo journal will be saved.`)) return

    setJobRunning(true)
    cancelRef.current = false
    setSamples([])
    setProgress({ scanned: 0, matches: 0, replacements: 0, rows_changed: 0, table: '' })

    try {
      const createRes = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sr_create_job',
          site_id: site.id,
          search,
          replace_with: replaceWith,
          options: { case_sensitive: caseSensitive, regex, image_mode: imageMode },
          scope,
          is_dry_run: dry,
        }),
      })
      const created = await createRes.json()
      if (created.error) { toast.error(created.error); setJobRunning(false); return }
      const j = created.job
      setJob(j)

      // Drive chunks until done
      let done = false
      let aggregated = []
      while (!done && !cancelRef.current) {
        const r = await fetch('/api/wp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sr_run_chunk', site_id: site.id, job_id: j.id, chunk_size: 200, sample_cap: 10 }),
        })
        const chunk = await r.json()
        if (chunk.error) {
          toast.error(`Failed on ${chunk.table || 'plugin'}: ${chunk.error}`)
          break
        }
        setProgress(p => ({
          scanned: (p?.scanned || 0) + (chunk.scanned || 0),
          matches: (p?.matches || 0) + (chunk.matches || 0),
          replacements: (p?.replacements || 0) + (chunk.replacements || 0),
          rows_changed: (p?.rows_changed || 0) + (chunk.rows_changed || 0),
          table: chunk.table,
        }))
        if (chunk.samples?.length) {
          aggregated = aggregated.concat(chunk.samples.map(s => ({ ...s, table_name: chunk.table })))
          setSamples(aggregated.slice(0, 100))
        }
        done = !!chunk.done
      }

      if (cancelRef.current) {
        await fetch('/api/wp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sr_pause_job', site_id: site.id, job_id: j.id }),
        })
        toast('Paused', { icon: '⏸' })
      } else if (done) {
        toast.success(dry ? 'Preview complete' : 'Replacement complete')
      }
      await loadJobs()
    } catch (e) {
      toast.error(e.message)
    }
    setJobRunning(false)
  }

  async function undoJob(j) {
    if (!confirm(`Undo job? Will restore ${j.total_rows_changed || 0} row(s) on ${j.current_table || 'site'}.`)) return
    const tid = toast.loading('Restoring…')
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sr_undo_job', site_id: site.id, job_id: j.id }),
      })
      const data = await res.json()
      toast.dismiss(tid)
      if (data.error) toast.error(data.error)
      else toast.success(`Restored ${data.restored}`)
      await loadJobs()
    } catch (e) {
      toast.dismiss(tid)
      toast.error(e.message)
    }
  }

  async function deleteJob(j) {
    if (!confirm('Delete job + journal? This removes the undo history but does not revert changes.')) return
    await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sr_delete_job', site_id: site.id, job_id: j.id }),
    })
    await loadJobs()
  }

  function toggleTable(name) {
    setSelectedTables(s => ({ ...s, [name]: !s[name] }))
  }
  function selectAllText() {
    const all = {}
    tables.forEach(t => { all[t.name] = true })
    setSelectedTables(all)
  }
  function selectCore() {
    const core = {}
    tables.forEach(t => { if (t.is_core) core[t.name] = true })
    setSelectedTables(core)
  }
  function selectNone() { setSelectedTables({}) }

  const totalSelected = Object.values(selectedTables).filter(Boolean).length
  const totalRowsInScope = tables.filter(t => selectedTables[t.name]).reduce((a, t) => a + (t.rows || 0), 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 20, alignItems: 'start' }}>

      {/* LEFT — controls */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, position: 'sticky', top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Search size={16} color={R} />
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Search &amp; Replace</div>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FB, marginBottom: 16 }}>
          Serialized-PHP-safe. Every applied change is journaled — undo any job from history.
        </div>

        <div style={{ marginBottom: 12 }}>
          <Label>Find</Label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="https://old-domain.com" style={inp()} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Label>Replace with</Label>
          <input value={replaceWith} onChange={e => setReplaceWith(e.target.value)} placeholder="https://new-domain.com" style={inp()} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <CheckRow checked={caseSensitive} onChange={setCaseSensitive} label="Case-sensitive" />
          <CheckRow checked={regex} onChange={setRegex} label="Regex" />
          <CheckRow checked={imageMode} onChange={v => { setImageMode(v); if (v) selectAllText() }} label="Image URLs" icon={<ImageIcon size={11} />} />
        </div>
        {imageMode && (
          <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FB, padding: '8px 10px', background: `${T}10`, borderRadius: 8, marginBottom: 16, lineHeight: 1.4 }}>
            {IMAGE_PRESET_NOTE}
          </div>
        )}

        {/* Table picker */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Tables ({totalSelected}/{tables.length})</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={selectCore} style={mini()}>Core</button>
            <button onClick={selectAllText} style={mini()}>All</button>
            <button onClick={selectNone} style={mini()}>None</button>
            <button onClick={loadTables} style={mini()} title="Refresh"><RefreshCw size={10} /></button>
          </div>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1.5px solid #e5e7eb', borderRadius: 9, padding: 6, marginBottom: 12 }}>
          {tablesLoading ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}><Loader2 size={14} className="spin" /> Loading tables…</div>
          ) : tablesError ? (
            <div style={{ padding: 14, fontSize: 12, color: BLK, fontFamily: FB, lineHeight: 1.5 }}>
              <div style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom:6 }}>
                <AlertTriangle size={13} color={AMB} style={{ flexShrink:0, marginTop:1 }}/>
                <strong>Couldn't load tables</strong>
              </div>
              <div style={{ color:'#6b7280', fontSize:11, marginBottom:8 }}>{tablesError}</div>
              <div style={{ color:'#9ca3af', fontSize:11 }}>
                Verify the site is paired, the WPSimpleCode plugin is active, and Remote Control is enabled in WP admin → WPSimpleCode → Settings.
              </div>
            </div>
          ) : tables.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
              No tables loaded. Make sure WPSimpleCode is paired for this site.
            </div>
          ) : tables.map(t => (
            <label key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', background: selectedTables[t.name] ? `${T}10` : 'transparent' }}>
              <input type="checkbox" checked={!!selectedTables[t.name]} onChange={() => toggleTable(t.name)} />
              <Database size={11} color={t.is_core ? R : '#9ca3af'} />
              <span style={{ flex: 1, fontFamily: FH, fontSize: 12, fontWeight: t.is_core ? 700 : 500, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>{(t.rows || 0).toLocaleString()}</span>
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FB, marginBottom: 16 }}>
          ~{totalRowsInScope.toLocaleString()} rows in scope. Scanned in 200-row chunks; large tables stream progress live.
        </div>

        {/* Run buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => runJob({ dry: true })}
            disabled={jobRunning || !search || !totalSelected}
            style={btn({ bg: '#fff', color: BLK, border: '1.5px solid #e5e7eb' })}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            onClick={() => runJob({ dry: false })}
            disabled={jobRunning || !search || !totalSelected}
            style={btn({ bg: R, color: '#fff' })}
          >
            <Play size={13} /> Run
          </button>
        </div>
        {jobRunning && (
          <button onClick={() => { cancelRef.current = true }} style={{ ...btn({ bg: '#fff', color: AMB, border: `1.5px solid ${AMB}` }), marginTop: 8, width: '100%' }}>
            <Pause size={13} /> Pause
          </button>
        )}
      </div>

      {/* RIGHT — progress + samples + history */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {progress && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>
                {jobRunning ? <><Loader2 size={12} className="spin" /> Scanning {progress.table || '…'}</> : <><CheckCircle2 size={12} color={GRN} /> Done</>}
              </div>
              {job?.is_dry_run ? <Pill color="#0e7490" bg="#cffafe">PREVIEW</Pill> : <Pill color="#b91c1c" bg="#fee2e2">LIVE</Pill>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Stat label="Scanned" value={progress.scanned} />
              <Stat label="Matches" value={progress.matches} color={T} />
              <Stat label="Replacements" value={progress.replacements} color={R} />
              <Stat label="Rows changed" value={progress.rows_changed} color={GRN} />
            </div>
          </div>
        )}

        {samples.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>Sample diffs ({samples.length})</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>First 100 changes</div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {samples.map((s, i) => (
                <div key={i} style={{ padding: 10, background: '#fafafa', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <Pill color="#374151" bg="#e5e7eb">{s.table_name || s.table}</Pill>
                    <Pill color="#0e7490" bg="#cffafe">{s.column}</Pill>
                    <Pill color="#6b7280" bg="#f3f4f6">#{s.primary_key_value || s.pk}</Pill>
                  </div>
                  <DiffRow before={s.before_value || s.before} after={s.after_value || s.after} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>History</div>
            <button onClick={loadJobs} style={mini()}><RefreshCw size={10} /></button>
          </div>
          {jobs.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No jobs yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(j => {
                const pill = STATUS_PILL[j.status] || STATUS_PILL.preview
                return (
                  <div key={j.id} style={{ padding: 10, background: '#fafafa', borderRadius: 9, border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Pill color={pill.color} bg={pill.bg}>{pill.label}</Pill>
                      {j.is_dry_run && <Pill>preview</Pill>}
                      <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        "{trim(j.search, 30)}" → "{trim(j.replace_with || '', 30)}"
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>{new Date(j.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: FB, color: '#6b7280', marginBottom: 8 }}>
                      <span>{(j.total_rows_scanned || 0).toLocaleString()} scanned</span>
                      <span>{(j.total_matches || 0).toLocaleString()} matches</span>
                      <span>{(j.total_rows_changed || 0).toLocaleString()} rows changed</span>
                      <span>{j.tables_completed || 0}/{j.total_tables || 0} tables</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => loadSamplesFor(j.id)} style={mini()}><Eye size={10} /> Samples</button>
                      {!j.is_dry_run && j.status === 'complete' && (
                        <button onClick={() => undoJob(j)} style={mini({ color: AMB, borderColor: AMB })}><Undo2 size={10} /> Undo</button>
                      )}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => deleteJob(j)} style={mini({ color: '#9ca3af' })}><Trash2 size={10} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!progress && jobs.length === 0 && (
          <div style={{ background: `${AMB}10`, border: `1px solid ${AMB}40`, borderRadius: 12, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color={AMB} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: BLK, fontFamily: FB, lineHeight: 1.5 }}>
              <strong>Tip:</strong> If the table picker is empty, make sure the WPSimpleCode plugin is installed on this site, Remote Control is enabled in <em>WPSimpleCode → Settings</em>, and the site has been paired in KotoIQ.
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

function CheckRow({ checked, onChange, label, icon }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: checked ? `${T}15` : '#f9fafb', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${checked ? T : '#e5e7eb'}` }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ margin: 0 }} />
      {icon}
      <span style={{ fontFamily: FH, fontSize: 11, fontWeight: 700, color: BLK }}>{label}</span>
    </label>
  )
}

function Stat({ label, value, color = BLK }) {
  return (
    <div style={{ padding: 10, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color }}>{(value || 0).toLocaleString()}</div>
      <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function DiffRow({ before, after }) {
  const before_s = typeof before === 'string' ? before : JSON.stringify(before)
  const after_s = typeof after === 'string' ? after : JSON.stringify(after)
  return (
    <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, lineHeight: 1.45 }}>
      <div style={{ padding: '4px 8px', background: '#fef2f2', color: '#991b1b', borderRadius: 4, marginBottom: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>− {before_s}</div>
      <div style={{ padding: '4px 8px', background: '#f0fdf4', color: '#166534', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>+ {after_s}</div>
    </div>
  )
}

function trim(s, n) {
  s = String(s || '')
  return s.length > n ? s.slice(0, n) + '…' : s
}

function mini(x = {}) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', borderRadius: 6,
    border: `1px solid ${x.borderColor || '#e5e7eb'}`,
    background: x.bg || '#fff',
    color: x.color || '#6b7280',
    fontSize: 11, fontFamily: FH, fontWeight: 600,
    cursor: 'pointer',
  }
}

function btn(x = {}) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 14px', borderRadius: 9,
    border: x.border || 'none',
    background: x.bg || R,
    color: x.color || '#fff',
    fontSize: 13, fontFamily: FH, fontWeight: 800,
    cursor: 'pointer', width: '100%',
    opacity: x.disabled ? 0.5 : 1,
  }
}
