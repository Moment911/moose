"use client"
import { useState, useEffect, useRef } from 'react'
import { Search, Replace as ReplaceIcon, Eye, Play, Undo2, Loader2, Database, Image as ImageIcon, AlertTriangle, CheckCircle2, Trash2, RefreshCw, Pause, Globe } from 'lucide-react'
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

const EXAMPLES = [
  {
    title: 'Domain change (http → https)',
    find: 'http://yoursite.com',
    replace: 'https://yoursite.com',
    note: 'Plain text replace. Updates every link/asset URL stored under the old domain.',
  },
  {
    title: 'Old domain → new domain',
    find: 'https://oldagency.com',
    replace: 'https://newagency.com',
    note: 'Migrate every reference to a different domain in one pass.',
  },
  {
    title: 'CDN swap',
    find: 'https://cdn.example.com/uploads/',
    replace: 'https://newcdn.example.com/uploads/',
    imageMode: true,
    note: 'Image-URL replace — pre-selects all text tables since image sources live in post_content, postmeta and options.',
  },
  {
    title: 'Phone number — exact format',
    find: '833-228-3727',
    replace: '833-228-3728',
    note: 'Plain text. Only matches this exact format — see the next example to catch all formats at once.',
  },
  {
    title: 'Phone — all formats (regex)',
    find: '\\(?833\\)?[\\s-]?228[\\s-]?3727',
    replace: '833-228-3728',
    regex: true,
    note: 'Matches 833-228-3727, (833) 228-3727, (833)228-3727, 833 228 3727, etc. Escape parens with \\(  \\).',
  },
  {
    title: 'Email change',
    find: 'old@example.com',
    replace: 'new@example.com',
    note: 'Plain text. Lowercased compare by default (uncheck Case-sensitive if you mean it).',
  },
  {
    title: 'Delete a phrase entirely',
    find: 'Limited time only — ',
    replace: '',
    note: 'Leave Replace empty to remove the matched text everywhere it occurs.',
  },
  {
    title: 'Brand rename (case-sensitive)',
    find: 'OldBrand',
    replace: 'NewBrand',
    caseSensitive: true,
    note: 'When you only want to replace TitleCase versions of a word, not lowercased ones in URLs/code.',
  },
  {
    title: 'Year update',
    find: '© 2024',
    replace: '© 2026',
    note: 'Copyright year bump — works on the ©2024 too (without space) if you set up the find string with no space.',
  },
  {
    title: 'Capture and preserve (regex)',
    find: '(Mr\\.|Mrs\\.|Ms\\.)\\s+Smith',
    replace: '$1 Jones',
    regex: true,
    note: '$1 inserts whatever the first parenthesized group matched. Use $1, $2, $3 for capture-group references.',
  },
]

function applyExample(ex, setSearch, setReplaceWith, setCaseSensitive, setRegex, setImageMode) {
  setSearch(ex.find || '')
  setReplaceWith(ex.replace || '')
  setCaseSensitive(!!ex.caseSensitive)
  setRegex(!!ex.regex)
  setImageMode(!!ex.imageMode)
}

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
  const [showExamples, setShowExamples] = useState(false)
  const [job, setJob] = useState(null)
  const [jobRunning, setJobRunning] = useState(false)
  const [samples, setSamples] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedJobIds, setSelectedJobIds] = useState({}) // {jobId: true} — for multi-select undo
  const [agencyWide, setAgencyWide] = useState(false)
  const [progress, setProgress] = useState(null) // {scanned, matches, table}
  const cancelRef = useRef(false)

  // Re-run when wpsc_api_key changes (e.g. after the user just paired this site)
  useEffect(() => { if (site?.id) { loadTables(); loadJobs() } }, [site?.id, site?.wpsc_api_key])
  // Reload jobs when agency-wide toggle flips
  useEffect(() => { if (site?.id) loadJobs() }, [agencyWide])

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
      console.log('[wpsc:sr_list_tables] response:', data)

      if (!site.wpsc_api_key) {
        setTablesError('This site has no WPSimpleCode API key paired. Pair it from the page above first.')
        setTables([]); setSelectedTables({})
        return
      }
      // Proxy reported a non-2xx from the plugin
      if (data?.ok === false) {
        const msg = data?.data?.message || data?.data?.error || data?.error || `HTTP ${data?.status || '?'}`
        setTablesError(`${msg}\n\nRaw: ${JSON.stringify(data?.data).slice(0, 400)}`)
        setTables([]); setSelectedTables({})
        return
      }

      const list = data?.data?.tables || data?.tables || []
      if (!Array.isArray(list) || list.length === 0) {
        // Surface what actually came back so the cause is debuggable.
        setTablesError(`Plugin responded 200 but returned no tables.\n\nResponse keys: ${Object.keys(data?.data || {}).join(', ') || '(empty)'}\nRaw: ${JSON.stringify(data?.data).slice(0, 400)}`)
        setTables([]); setSelectedTables({})
        return
      }

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
    const payload = agencyWide
      ? { action: 'sr_list_all_jobs', agency_id: site.agency_id }
      : { action: 'sr_list_jobs', site_id: site.id }
    const res = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  async function undoSelected() {
    const ids = Object.keys(selectedJobIds).filter(id => selectedJobIds[id])
    if (!ids.length) return
    // Filter to undoable jobs only + sort newest first so undos compose correctly
    const undoable = jobs
      .filter(j => ids.includes(j.id) && !j.is_dry_run && j.status === 'complete')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (!undoable.length) { toast.error('No undoable runs in selection (preview or already-undone jobs are skipped)'); return }
    const totalRows = undoable.reduce((sum, j) => sum + (j.total_rows_changed || 0), 0)
    if (!confirm(`Undo ${undoable.length} job(s)? Restores ${totalRows.toLocaleString()} row(s) total.\n\nApplied newest-first so revert order is correct.`)) return

    let restored = 0
    for (const j of undoable) {
      const tid = toast.loading(`Undoing "${trim(j.search, 30)}"…`)
      try {
        const res = await fetch('/api/wp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sr_undo_job', site_id: site.id, job_id: j.id }),
        })
        const data = await res.json()
        toast.dismiss(tid)
        if (data.error) { toast.error(`${j.search}: ${data.error}`); break }
        restored += Number(data.restored || 0)
      } catch (e) {
        toast.dismiss(tid)
        toast.error(e.message); break
      }
    }
    toast.success(`Restored ${restored.toLocaleString()} row(s) across ${undoable.length} job(s)`)
    setSelectedJobIds({})
    await loadJobs()
  }

  function toggleJobSelected(id) {
    setSelectedJobIds(s => ({ ...s, [id]: !s[id] }))
  }
  function selectAllUndoable() {
    const next = {}
    jobs.forEach(j => { if (!j.is_dry_run && j.status === 'complete') next[j.id] = true })
    setSelectedJobIds(next)
  }
  function clearJobSelection() { setSelectedJobIds({}) }

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
          Find anything — URL, word, phrase, phone number, email — and replace it. Serialized-PHP-safe. Every applied change is journaled, undo any job from history.
        </div>

        {/* Examples — preset patterns that fill the inputs + toggle options */}
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setShowExamples(s => !s)} style={{ background: 'none', border: 'none', padding: 0, fontFamily: FH, fontSize: 11, fontWeight: 700, color: T, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {showExamples ? '▾' : '▸'} {showExamples ? 'Hide examples' : 'Need ideas? See examples'}
          </button>
          {showExamples && (
            <div style={{ marginTop: 8, padding: 10, background: '#fafafa', borderRadius: 9, border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => applyExample(ex, setSearch, setReplaceWith, setCaseSensitive, setRegex, setImageMode)}
                  title={ex.note}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FH, fontSize: 11, fontWeight: 700, color: BLK }}>{ex.title}</div>
                    <div style={{ fontSize: 10, fontFamily: 'ui-monospace,Menlo,monospace', color: '#6b7280', marginTop: 3, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#991b1b' }}>−</span> {ex.find}  <span style={{ color: '#166534' }}>+</span> {ex.replace || <em style={{ color: '#9ca3af' }}>(delete)</em>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {ex.regex && <Pill color={R} bg={`${R}15`}>regex</Pill>}
                    {ex.caseSensitive && <Pill color="#374151" bg="#e5e7eb">Aa</Pill>}
                  </div>
                </button>
              ))}
              <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB, marginTop: 4, lineHeight: 1.4 }}>
                Click any example to prefill the fields. Regex examples use <code>$1</code>/<code>$2</code> as capture-group references.
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <Label>Find anything</Label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="text, URL, phone number, word, phrase…" style={inp()} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Label>Replace it with</Label>
          <input value={replaceWith} onChange={e => setReplaceWith(e.target.value)} placeholder="what to replace it with (leave blank to delete)" style={inp()} />
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

        {/* Undo last applied job — surfaces the per-job Undo from History to the top */}
        {(() => {
          const lastApplied = jobs.find(j => !j.is_dry_run && j.status === 'complete')
          if (!lastApplied || jobRunning) return null
          return (
            <button
              onClick={() => undoJob(lastApplied)}
              style={{ ...btn({ bg: '#fff', color: AMB, border: `1.5px solid ${AMB}` }), marginTop: 12, width: '100%' }}
              title={`Restore ${lastApplied.total_rows_changed || 0} row(s) from "${trim(lastApplied.search, 30)}" → "${trim(lastApplied.replace_with || '', 30)}"`}
            >
              <Undo2 size={13} /> Undo last run · {(lastApplied.total_rows_changed || 0).toLocaleString()} rows
            </button>
          )
        })()}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>History</div>
              <button
                onClick={() => setAgencyWide(v => !v)}
                title={agencyWide ? 'Showing every run in this agency — click for this site only' : 'Showing only this site — click for agency-wide history'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px', borderRadius: 6,
                  border: `1px solid ${agencyWide ? R : '#e5e7eb'}`,
                  background: agencyWide ? `${R}10` : '#fff',
                  color: agencyWide ? R : '#6b7280',
                  fontFamily: FH, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                <Globe size={10}/> {agencyWide ? 'All sites' : 'This site'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={selectAllUndoable} style={mini()} title="Select all undoable runs">Select all</button>
              <button onClick={clearJobSelection} style={mini()}>Clear</button>
              <button onClick={loadJobs} style={mini()}><RefreshCw size={10} /></button>
            </div>
          </div>

          {(() => {
            const selectedCount = Object.values(selectedJobIds).filter(Boolean).length
            if (!selectedCount) return null
            const totalRows = jobs
              .filter(j => selectedJobIds[j.id] && !j.is_dry_run && j.status === 'complete')
              .reduce((s, j) => s + (j.total_rows_changed || 0), 0)
            return (
              <button onClick={undoSelected} style={{ ...btn({ bg: AMB, color: '#fff' }), marginBottom: 10 }}>
                <Undo2 size={13} /> Undo {selectedCount} selected · {totalRows.toLocaleString()} rows
              </button>
            )
          })()}

          {jobs.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No jobs yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(j => {
                const pill = STATUS_PILL[j.status] || STATUS_PILL.preview
                const isUndoable = !j.is_dry_run && j.status === 'complete'
                const isSelected = !!selectedJobIds[j.id]
                return (
                  <div key={j.id} style={{ padding: 12, background: isSelected ? `${AMB}10` : '#fafafa', borderRadius: 9, border: `1px solid ${isSelected ? AMB : '#f1f5f9'}` }}>
                    {/* Top row: checkbox + status pills + timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isUndoable}
                        onChange={() => isUndoable && toggleJobSelected(j.id)}
                        title={isUndoable ? 'Select to bulk-undo' : 'Only completed live runs can be undone'}
                        style={{ margin: 0, opacity: isUndoable ? 1 : 0.3, cursor: isUndoable ? 'pointer' : 'not-allowed' }}
                      />
                      <Pill color={pill.color} bg={pill.bg}>{pill.label}</Pill>
                      {j.is_dry_run && <Pill>preview</Pill>}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>{new Date(j.created_at).toLocaleString()}</span>
                    </div>

                    {/* Site/client context — only shown in agency-wide view */}
                    {agencyWide && (j.client_name || j.site_url) && (
                      <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FB, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Globe size={10} color="#9ca3af"/>
                        {j.client_name && <strong style={{ color: BLK }}>{j.client_name}</strong>}
                        {j.client_name && j.site_url && <span style={{ color: '#d1d5db' }}>·</span>}
                        {j.site_url && <span>{j.site_url.replace(/^https?:\/\//,'')}</span>}
                      </div>
                    )}

                    {/* Find/Replace — no truncation, monospace, wraps on long values */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 7, padding: '8px 10px', marginBottom: 8, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 11, lineHeight: 1.55, wordBreak: 'break-all' }}>
                      <div style={{ color: '#991b1b' }}><span style={{ display: 'inline-block', width: 12, fontWeight: 700 }}>−</span>{j.search || <em style={{ color: '#9ca3af' }}>(empty)</em>}</div>
                      <div style={{ color: '#166534' }}><span style={{ display: 'inline-block', width: 12, fontWeight: 700 }}>+</span>{j.replace_with || <em style={{ color: '#9ca3af' }}>(deleted)</em>}</div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, fontFamily: FB, color: '#6b7280', marginBottom: 8 }}>
                      <span>{(j.total_rows_scanned || 0).toLocaleString()} scanned</span>
                      <span>· {(j.total_matches || 0).toLocaleString()} matches</span>
                      <span>· {(j.total_rows_changed || 0).toLocaleString()} rows changed</span>
                      <span>· {j.tables_completed || 0}/{j.total_tables || 0} tables</span>
                      {j.options?.regex && <Pill color={R} bg={`${R}15`}>regex</Pill>}
                      {j.options?.case_sensitive && <Pill color="#374151" bg="#e5e7eb">Aa</Pill>}
                    </div>

                    {/* Action row */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => loadSamplesFor(j.id)} style={mini()}><Eye size={10} /> Samples</button>
                      {isUndoable && (
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
