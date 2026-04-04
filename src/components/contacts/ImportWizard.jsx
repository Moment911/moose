"use client";
import { useState, useRef, useCallback } from 'react'
import { Upload, X, Check, AlertTriangle, FileText, ArrowRight, ArrowLeft, Loader2, Download, Tag, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const CONTACT_FIELDS = [
  { group: 'Personal', fields: [
    { key: 'first_name', label: 'First Name' }, { key: 'middle_name', label: 'Middle Name' }, { key: 'last_name', label: 'Last Name' },
    { key: 'prefix', label: 'Prefix' }, { key: 'suffix', label: 'Suffix' }, { key: 'nickname', label: 'Nickname' },
    { key: 'date_of_birth', label: 'Date of Birth' }, { key: 'gender', label: 'Gender' },
  ]},
  { group: 'Contact', fields: [
    { key: 'email', label: 'Email *' }, { key: 'phone', label: 'Phone' },
    { key: 'phone_mobile', label: 'Phone (Mobile)' }, { key: 'phone_work', label: 'Phone (Work)' }, { key: 'phone_home', label: 'Phone (Home)' },
  ]},
  { group: 'Company', fields: [
    { key: 'company', label: 'Company' }, { key: 'job_title', label: 'Job Title' }, { key: 'department', label: 'Department' },
    { key: 'industry', label: 'Industry' }, { key: 'company_size', label: 'Company Size' }, { key: 'website', label: 'Website' },
  ]},
  { group: 'Address', fields: [
    { key: 'address_line1', label: 'Address Line 1' }, { key: 'address_line2', label: 'Address Line 2' },
    { key: 'city', label: 'City' }, { key: 'state', label: 'State/Province' }, { key: 'zip_code', label: 'Zip/Postal Code' }, { key: 'country', label: 'Country' },
  ]},
  { group: 'Social', fields: [
    { key: 'linkedin_url', label: 'LinkedIn URL' }, { key: 'twitter_handle', label: 'Twitter Handle' },
    { key: 'instagram_handle', label: 'Instagram' }, { key: 'facebook_url', label: 'Facebook URL' },
  ]},
  { group: 'Other', fields: [
    { key: 'lead_source', label: 'Lead Source' }, { key: 'lead_status', label: 'Lead Status' },
    { key: 'lifecycle_stage', label: 'Lifecycle Stage' }, { key: 'notes', label: 'Notes' },
    { key: 'tags', label: 'Tags (comma-separated)' }, { key: '_skip', label: 'Skip this column' },
  ]},
]

const FUZZY_MAP = {
  first_name: ['first name', 'first_name', 'firstname', 'fname', 'given name', 'given_name', 'first'],
  last_name: ['last name', 'last_name', 'lastname', 'lname', 'surname', 'family name', 'family_name', 'last'],
  email: ['email', 'email_address', 'e-mail', 'email address', 'e_mail', 'emailaddress', 'mail'],
  phone: ['phone', 'phone_number', 'telephone', 'tel', 'phone number'],
  phone_mobile: ['mobile', 'cell', 'cellphone', 'cell phone', 'mobile phone', 'mobile_phone'],
  phone_work: ['work phone', 'work_phone', 'business phone', 'office phone'],
  company: ['company', 'company_name', 'organization', 'org', 'employer', 'business', 'company name'],
  job_title: ['title', 'job_title', 'job title', 'position', 'role', 'designation'],
  department: ['department', 'dept', 'division'],
  industry: ['industry', 'sector', 'vertical'],
  website: ['website', 'url', 'web', 'site', 'homepage', 'web site'],
  city: ['city', 'town', 'locality'],
  state: ['state', 'province', 'region', 'state/province'],
  zip_code: ['zip', 'zip_code', 'postal', 'postal_code', 'zipcode', 'zip code', 'postal code', 'postcode'],
  country: ['country', 'nation', 'country_code'],
  address_line1: ['address', 'address_line1', 'street', 'address 1', 'street address', 'address1'],
  address_line2: ['address_line2', 'address 2', 'apt', 'suite', 'unit', 'address2'],
  linkedin_url: ['linkedin', 'linkedin_url', 'linkedin url'],
  twitter_handle: ['twitter', 'twitter_handle', 'twitter handle'],
  instagram_handle: ['instagram', 'instagram_handle', 'ig'],
  facebook_url: ['facebook', 'facebook_url', 'fb'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
  tags: ['tags', 'tag', 'label', 'labels', 'category', 'categories', 'group', 'groups'],
  date_of_birth: ['dob', 'date_of_birth', 'birthday', 'birth date', 'birthdate'],
  gender: ['gender', 'sex'],
  lead_source: ['source', 'lead_source', 'lead source', 'referral', 'how did you hear'],
  lead_status: ['lead_status', 'lead status', 'status'],
  middle_name: ['middle name', 'middle_name', 'middlename', 'middle'],
  prefix: ['prefix', 'salutation', 'mr/mrs', 'title prefix'],
  suffix: ['suffix', 'name suffix'],
  nickname: ['nickname', 'nick', 'alias', 'preferred name'],
  company_size: ['company_size', 'company size', 'employees', 'size'],
  lifecycle_stage: ['lifecycle', 'lifecycle_stage', 'stage', 'lifecycle stage'],
}

function autoMap(header) {
  const h = header.toLowerCase().trim()
  let bestMatch = '_skip'
  let bestConf = 0
  for (const [field, aliases] of Object.entries(FUZZY_MAP)) {
    for (const alias of aliases) {
      if (h === alias) return { field, confidence: 1 }
      if (h.includes(alias) || alias.includes(h)) {
        const conf = Math.min(h.length, alias.length) / Math.max(h.length, alias.length)
        if (conf > bestConf) { bestConf = conf; bestMatch = field }
      }
    }
  }
  return { field: bestMatch, confidence: bestConf }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  // Handle quoted fields
  function parseLine(line) {
    const result = []; let current = ''; let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += ch }
    }
    result.push(current.trim())
    return result
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line); const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  }).filter(row => Object.values(row).some(v => v))
  return { headers, rows }
}

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

export default function ImportWizard({ open, onClose, onComplete, existingLists }) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [dupMode, setDupMode] = useState('update')
  const [importTags, setImportTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [addDateTag, setAddDateTag] = useState(true)
  const [addFileTag, setAddFileTag] = useState(false)
  const [listId, setListId] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, imported: 0, updated: 0, skipped: 0, errors: 0, errorLog: [] })
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const { headers, rows } = parseCSV(text)
      if (headers.length === 0) { toast.error('Could not parse file'); return }
      setParsed({ headers, rows, filename: f.name })
      // Auto-map
      const autoMapping = {}
      headers.forEach(h => {
        const { field, confidence } = autoMap(h)
        autoMapping[h] = { field, confidence }
      })
      setMapping(autoMapping)
      setStep(2)
    }
    reader.readAsText(f)
  }, [])

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.tsv') || f.name.endsWith('.txt'))) handleFile(f)
    else toast.error('Please upload a CSV file')
  }

  function updateMapping(header, field) {
    setMapping(prev => ({ ...prev, [header]: { ...prev[header], field, confidence: 1 } }))
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !importTags.includes(t)) setImportTags(prev => [...prev, t])
    setTagInput('')
  }

  async function runImport() {
    if (!parsed) return
    setImporting(true); setStep(4)
    const total = parsed.rows.length
    const prog = { current: 0, total, imported: 0, updated: 0, skipped: 0, errors: 0, errorLog: [] }
    setProgress({ ...prog })

    // Build tags
    const allTags = [...importTags]
    if (addDateTag) { const d = new Date(); allTags.push(`Imported ${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`) }
    if (addFileTag && parsed.filename) allTags.push(`File: ${parsed.filename.replace(/\.[^.]+$/, '')}`)

    // Find email mapping
    const emailCol = Object.entries(mapping).find(([, v]) => v.field === 'email')?.[0]
    if (!emailCol) { toast.error('No email column mapped'); setImporting(false); setStep(3); return }

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      prog.current = i + 1

      // Build contact object from mapping
      const contact = {}
      let rowTags = [...allTags]
      for (const [header, { field }] of Object.entries(mapping)) {
        if (field === '_skip' || !row[header]) continue
        if (field === 'tags') {
          rowTags.push(...row[header].split(',').map(t => t.trim()).filter(Boolean))
        } else {
          contact[field] = row[header].trim()
        }
      }

      if (!contact.email || !isValidEmail(contact.email)) {
        prog.errors++
        prog.errorLog.push({ row: i + 2, reason: `Invalid email: "${contact.email || ''}"` })
        setProgress({ ...prog })
        continue
      }

      contact.email = contact.email.toLowerCase()
      if (rowTags.length > 0) contact.tags = rowTags

      try {
        if (dupMode === 'update') {
          const { data: existing } = await supabase.from('contacts').select('id,tags').eq('email', contact.email).maybeSingle()
          if (existing) {
            // Merge tags
            const mergedTags = [...new Set([...(existing.tags || []), ...(contact.tags || [])])]
            await supabase.from('contacts').update({ ...contact, tags: mergedTags }).eq('id', existing.id)
            prog.updated++
          } else {
            if (!contact.status) contact.status = 'subscribed'
            await supabase.from('contacts').insert(contact)
            prog.imported++
          }
        } else if (dupMode === 'skip') {
          const { data: existing } = await supabase.from('contacts').select('id').eq('email', contact.email).maybeSingle()
          if (existing) { prog.skipped++ }
          else {
            if (!contact.status) contact.status = 'subscribed'
            await supabase.from('contacts').insert(contact)
            prog.imported++
          }
        } else {
          if (!contact.status) contact.status = 'subscribed'
          await supabase.from('contacts').insert(contact)
          prog.imported++
        }
      } catch (e) {
        prog.errors++
        prog.errorLog.push({ row: i + 2, reason: e.message?.slice(0, 100) || 'Unknown error' })
      }
      setProgress({ ...prog })
    }

    // Add to list
    if (listId) {
      try {
        const { data: allContacts } = await supabase.from('contacts').select('id').in('email', parsed.rows.map(r => (r[emailCol] || '').toLowerCase().trim()).filter(Boolean))
        if (allContacts?.length) {
          const members = allContacts.map(c => ({ list_id: listId, contact_id: c.id }))
          await supabase.from('contact_list_members').upsert(members, { onConflict: 'list_id,contact_id' }).catch(() => {})
        }
      } catch {}
    }

    setImporting(false); setStep(5)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Import Contacts</h2>
            <div className="flex gap-1 mt-2">
              {[1,2,3,4,5].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {/* STEP 1: File Upload */}
          {step === 1 && (
            <div>
              <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
                <Upload size={40} className={`mx-auto mb-4 transition-transform ${dragOver ? 'text-brand-500 scale-110' : 'text-gray-400'}`} />
                <p className="text-base font-medium text-gray-700">Drag your CSV file here</p>
                <p className="text-sm text-gray-400 mt-1">or <span className="text-brand-500 underline">click to browse</span></p>
                <p className="text-xs text-gray-300 mt-3">Supports CSV, TSV &middot; Max 50MB</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {/* STEP 2: Field Mapping */}
          {step === 2 && parsed && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Map Fields</h3>
                  <p className="text-xs text-gray-500">Found {parsed.rows.length} contacts in {parsed.filename}</p>
                </div>
                <div className="text-xs text-gray-400">{parsed.headers.length} columns detected</div>
              </div>
              <div className="space-y-2 mb-4">
                {parsed.headers.map(header => {
                  const m = mapping[header] || { field: '_skip', confidence: 0 }
                  const samples = parsed.rows.slice(0, 3).map(r => r[header]).filter(Boolean)
                  return (
                    <div key={header} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{header}</p>
                        <p className="text-[10px] text-gray-400 truncate">{samples.join(' · ') || 'no data'}</p>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.confidence >= 0.8 ? 'bg-green-500' : m.confidence > 0.3 ? 'bg-yellow-500' : m.field === '_skip' ? 'bg-gray-300' : 'bg-blue-400'}`} />
                        <select value={m.field} onChange={e => updateMapping(header, e.target.value)}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[180px] focus:outline-none focus:ring-2 focus:ring-brand-400">
                          {CONTACT_FIELDS.map(g => (
                            <optgroup key={g.group} label={g.group}>
                              {g.fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Preview */}
              {(() => {
                const emailCol = Object.entries(mapping).find(([, v]) => v.field === 'email')?.[0]
                if (!emailCol) return <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 mb-3"><AlertTriangle size={14} className="inline mr-1" /> Map at least one column to Email</div>
                return null
              })()}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 bg-gray-50 border-b border-gray-100">Preview (first 3 rows)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-gray-100">
                      {Object.entries(mapping).filter(([,v]) => v.field !== '_skip').map(([h, v]) => (
                        <th key={h} className="px-3 py-1.5 text-left font-medium text-gray-600">{CONTACT_FIELDS.flatMap(g=>g.fields).find(f=>f.key===v.field)?.label || v.field}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {parsed.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {Object.entries(mapping).filter(([,v]) => v.field !== '_skip').map(([h, v]) => {
                            const val = row[h] || ''
                            const isEmail = v.field === 'email'
                            const invalid = isEmail && val && !isValidEmail(val)
                            return <td key={h} className={`px-3 py-1.5 ${invalid ? 'text-red-500 bg-red-50' : 'text-gray-700'}`}>{val || <span className="text-gray-300">—</span>}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Import Options */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Duplicate Handling</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'update', label: 'Update existing', desc: 'Match by email, update fields' },
                    { key: 'skip', label: 'Skip duplicates', desc: 'Ignore existing emails' },
                    { key: 'create', label: 'Import all', desc: 'Create even if duplicate' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setDupMode(opt.key)}
                      className={`text-left p-3 rounded-xl border transition-all ${dupMode === opt.key ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full border-2 ${dupMode === opt.key ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`} /><span className="text-sm font-medium text-gray-800">{opt.label}</span></div>
                      <p className="text-[10px] text-gray-400 ml-5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Tags to Apply</h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {importTags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs px-2.5 py-1 rounded-full">
                      <Tag size={10} />{t}
                      <button onClick={() => setImportTags(prev => prev.filter(x => x !== t))} className="text-brand-400 hover:text-brand-700"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input text-sm flex-1" placeholder="Add a tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
                  <button onClick={addTag} className="btn-secondary text-xs">Add</button>
                </div>
                <div className="flex gap-4 mt-3">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={addDateTag} onChange={e => setAddDateTag(e.target.checked)} className="rounded border-gray-300" /> Tag with import date
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={addFileTag} onChange={e => setAddFileTag(e.target.checked)} className="rounded border-gray-300" /> Tag with filename
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add to List</h3>
                <select className="input text-sm" value={listId} onChange={e => setListId(e.target.value)}>
                  <option value="">Don't add to a list</option>
                  {(existingLists || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: Progress */}
          {step === 4 && (
            <div className="py-8">
              <div className="text-center mb-6">
                {importing ? <Loader2 size={40} className="animate-spin text-brand-500 mx-auto mb-3" /> : <Check size={40} className="text-green-500 mx-auto mb-3" />}
                <p className="text-sm font-medium text-gray-700">{importing ? `Importing contact ${progress.current} of ${progress.total}...` : 'Processing complete'}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${progress.total ? (progress.current / progress.total * 100) : 0}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-green-700">{progress.imported}</p><p className="text-[10px] text-green-600">Imported</p></div>
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-blue-700">{progress.updated}</p><p className="text-[10px] text-blue-600">Updated</p></div>
                <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-600">{progress.skipped}</p><p className="text-[10px] text-gray-500">Skipped</p></div>
                <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-red-600">{progress.errors}</p><p className="text-[10px] text-red-500">Errors</p></div>
              </div>
              {progress.errorLog.length > 0 && (
                <div className="mt-4 bg-red-50 rounded-xl p-3 max-h-32 overflow-auto">
                  <p className="text-[10px] font-semibold text-red-600 uppercase mb-1">Error Log</p>
                  {progress.errorLog.map((e, i) => <p key={i} className="text-xs text-red-500">Row {e.row}: {e.reason}</p>)}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Summary */}
          {step === 5 && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-green-600" /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Import Complete!</h3>
              <p className="text-sm text-gray-500 mb-6">{progress.total} rows processed</p>
              <div className="grid grid-cols-4 gap-3 max-w-md mx-auto mb-6">
                <div className="text-center"><p className="text-2xl font-bold text-green-600">{progress.imported}</p><p className="text-[10px] text-gray-500">New</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-blue-600">{progress.updated}</p><p className="text-[10px] text-gray-500">Updated</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-gray-500">{progress.skipped}</p><p className="text-[10px] text-gray-500">Skipped</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-red-500">{progress.errors}</p><p className="text-[10px] text-gray-500">Errors</p></div>
              </div>
              {importTags.length > 0 && <p className="text-xs text-gray-400 mb-4">Tags applied: {importTags.join(', ')}</p>}
              <div className="flex gap-2 justify-center">
                <button onClick={() => { onComplete?.(); onClose() }} className="btn-primary text-sm">View Contacts</button>
                <button onClick={() => { setStep(1); setFile(null); setParsed(null); setMapping({}); setProgress({ current:0, total:0, imported:0, updated:0, skipped:0, errors:0, errorLog:[] }) }} className="btn-secondary text-sm">Import Another</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        {(step === 2 || step === 3) && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between flex-shrink-0">
            <button onClick={() => setStep(step - 1)} className="btn-secondary text-sm"><ArrowLeft size={12} /> Back</button>
            {step === 2 && (
              <button onClick={() => {
                const hasEmail = Object.values(mapping).some(v => v.field === 'email')
                if (!hasEmail) { toast.error('Map at least one column to Email'); return }
                setStep(3)
              }} className="btn-primary text-sm">Next: Options <ArrowRight size={12} /></button>
            )}
            {step === 3 && (
              <button onClick={runImport} className="btn-primary text-sm">Start Import <ArrowRight size={12} /></button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
