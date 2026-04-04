"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Mail, Upload, Download, X, Check, Tag, Users, ChevronLeft } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ImportWizard from '../components/contacts/ImportWizard'
import TagManager from '../components/contacts/TagManager'
import { TagAutocomplete } from '../components/contacts/TagManager'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ContactsPage() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [lists, setLists] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTags, setFilterTags] = useState([])
  const [page, setPage] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [tab, setTab] = useState('contacts')
  const [selected, setSelected] = useState(new Set())
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [form, setForm] = useState({
    prefix: '', first_name: '', middle_name: '', last_name: '', suffix: '', nickname: '',
    email: '', phone_mobile: '', phone_work: '', phone_home: '',
    company: '', job_title: '', department: '', industry: '', company_size: '', website: '',
    address_line1: '', address_line2: '', city: '', state: '', zip_code: '', country: '',
    linkedin_url: '', twitter_handle: '', instagram_handle: '', facebook_url: '',
    date_of_birth: '', gender: '', lead_source: '', lead_status: 'new', lifecycle_stage: 'lead',
    notes: '', tags: ''
  })
  const PAGE = 25

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('contact_lists').select('*'),
    ])
    setContacts(c || []); setLists(l || [])
  }

  async function handleAdd(e) {
    e?.preventDefault()
    if (!form.email.trim()) { toast.error('Email required'); return }
    const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    // Build contact object, only include non-empty fields
    const contact = { status: 'subscribed', tags }
    const fields = ['prefix','first_name','middle_name','last_name','suffix','nickname','email',
      'phone_mobile','phone_work','phone_home','company','job_title','department','industry',
      'company_size','website','address_line1','address_line2','city','state','zip_code','country',
      'linkedin_url','twitter_handle','instagram_handle','facebook_url','date_of_birth','gender',
      'lead_source','lead_status','lifecycle_stage','notes']
    fields.forEach(f => { if (form[f]?.trim()) contact[f] = form[f].trim() })
    contact.email = form.email.trim().toLowerCase()
    // Map phone_mobile to phone for backwards compat
    if (contact.phone_mobile && !contact.phone) contact.phone = contact.phone_mobile

    const { error } = await supabase.from('contacts').insert(contact)
    if (error) { toast.error(error.message?.includes('duplicate') ? 'Email already exists' : error.message || 'Failed'); return }
    toast.success('Contact added'); setShowAdd(false); setShowMoreFields(false)
    setForm({ prefix:'',first_name:'',middle_name:'',last_name:'',suffix:'',nickname:'',email:'',phone_mobile:'',phone_work:'',phone_home:'',company:'',job_title:'',department:'',industry:'',company_size:'',website:'',address_line1:'',address_line2:'',city:'',state:'',zip_code:'',country:'',linkedin_url:'',twitter_handle:'',instagram_handle:'',facebook_url:'',date_of_birth:'',gender:'',lead_source:'',lead_status:'new',lifecycle_stage:'lead',notes:'',tags:'' })
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', id); loadAll()
  }

  async function handleToggleStatus(c) {
    const newStatus = c.status === 'subscribed' ? 'unsubscribed' : 'subscribed'
    await supabase.from('contacts').update({ status: newStatus }).eq('id', c.id); loadAll()
  }

  async function handleBulkTag(tags) {
    for (const id of selected) {
      const c = contacts.find(x => x.id === id)
      if (!c) continue
      const merged = [...new Set([...(c.tags || []), ...tags])]
      await supabase.from('contacts').update({ tags: merged }).eq('id', id)
    }
    toast.success(`Tagged ${selected.size} contacts`); setSelected(new Set()); setBulkTagOpen(false); loadAll()
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} contacts?`)) return
    for (const id of selected) { await supabase.from('contacts').delete().eq('id', id) }
    toast.success(`Deleted ${selected.size} contacts`); setSelected(new Set()); loadAll()
  }

  function exportCSV() {
    const headers = 'First Name,Last Name,Email,Phone,Company,Job Title,Status,Tags,Created\n'
    const rows = filtered.map(c => `"${c.first_name || ''}","${c.last_name || ''}","${c.email}","${c.phone || ''}","${c.company || ''}","${c.job_title || ''}","${c.status}","${(c.tags || []).join('; ')}","${c.created_at?.split('T')[0] || ''}"`).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contacts.csv'; a.click()
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll() {
    if (selected.size === paged.length) setSelected(new Set())
    else setSelected(new Set(paged.map(c => c.id)))
  }

  const filtered = contacts.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterTags.length > 0 && !filterTags.every(t => (c.tags || []).includes(t))) return false
    if (search && !c.email.toLowerCase().includes(search.toLowerCase()) && !(c.first_name || '').toLowerCase().includes(search.toLowerCase()) && !(c.last_name || '').toLowerCase().includes(search.toLowerCase()) && !(c.company || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE)
  const pages = Math.ceil(filtered.length / PAGE)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/marketing')} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-black text-gray-900">Contacts</h1>
              <p className="text-sm text-gray-700 mt-0.5">{contacts.length} total &middot; {contacts.filter(c => c.status === 'subscribed').length} subscribed</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowImport(true)} className="btn-secondary text-sm hidden md:flex"><Upload size={13} strokeWidth={1.5} /> Import</button>
              <button onClick={exportCSV} className="btn-secondary text-sm hidden md:flex"><Download size={13} strokeWidth={1.5} /> Export</button>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus size={13} /> <span className="hidden sm:inline">Add Contact</span><span className="sm:hidden">Add</span></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {[{ key: 'contacts', label: 'Contacts', icon: Users }, { key: 'tags', label: 'Tags', icon: Tag }].map(t => {
              const I = t.icon
              return <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-700 hover:text-gray-700'}`}><I size={14} /> {t.label}</button>
            })}
          </div>

          {/* Tags tab */}
          {tab === 'tags' && <TagManager open={true} contacts={contacts} />}

          {/* Contacts tab */}
          {tab === 'contacts' && (
            <>
              {/* Bulk actions bar */}
              {selected.size > 0 && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3">
                  <span className="text-sm font-medium text-brand-700">{selected.size} selected</span>
                  <button onClick={() => setBulkTagOpen(true)} className="text-sm text-brand-600 hover:text-brand-800 flex items-center gap-1"><Tag size={11} /> Add Tag</button>
                  <button onClick={handleBulkDelete} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={11} /> Delete</button>
                  <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-gray-700">Clear</button>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <Search size={14} strokeWidth={1.5} className="text-gray-700" />
                  <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search contacts..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
                </div>
                <div className="flex bg-white rounded-xl border border-gray-200 p-0.5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  {['all', 'subscribed', 'unsubscribed'].map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setPage(0) }} className={`text-sm px-3 py-1.5 rounded-lg capitalize font-medium ${filterStatus === s ? 'bg-gray-900 text-white' : 'text-gray-700 hover:text-gray-700'}`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Tag filter */}
              {contacts.some(c => c.tags?.length) && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] text-gray-700 uppercase font-semibold">Filter by tag:</span>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(contacts.flatMap(c => c.tags || []))].slice(0, 15).map(t => (
                      <button key={t} onClick={() => { setFilterTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]); setPage(0) }}
                        className={`text-[13px] px-2 py-0.5 rounded-full transition-colors ${filterTags.includes(t) ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t}</button>
                    ))}
                    {filterTags.length > 0 && <button onClick={() => setFilterTags([])} className="text-[13px] text-gray-700 hover:text-gray-600 ml-1">Clear</button>}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div className="grid grid-cols-[32px_1fr_160px_100px_100px_80px_40px] gap-3 px-5 py-3 bg-gray-50/50 text-[13px] font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-100">
                  <div><input type="checkbox" checked={selected.size === paged.length && paged.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" /></div>
                  <div>Name</div><div>Email</div><div>Company</div><div>Tags</div><div>Status</div><div></div>
                </div>
                {paged.length === 0 && <div className="py-16 text-center text-sm text-gray-700">No contacts found</div>}
                {paged.map(c => (
                  <div key={c.id} className="grid grid-cols-[32px_1fr_160px_100px_100px_80px_40px] gap-3 px-5 py-3 items-center border-b border-gray-50 hover:bg-gray-50/50 group">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-gray-300" />
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate(`/marketing/contacts/${c.id}`)}>
                      <div className="w-8 h-8 rounded-full bg-brand-500 text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{((c.first_name || c.email)[0] || '?').toUpperCase()}</div>
                      <span className="text-sm font-medium text-gray-900 hover:text-brand-600">{c.first_name ? `${c.first_name} ${c.last_name || ''}` : c.email.split('@')[0]}</span>
                    </div>
                    <span className="text-sm text-gray-700 truncate">{c.email}</span>
                    <span className="text-sm text-gray-700 truncate">{c.company || '\u2014'}</span>
                    <div className="flex gap-0.5 flex-wrap">{(c.tags || []).slice(0, 2).map((t, i) => <span key={i} className="text-[12px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{t}</span>)}{(c.tags || []).length > 2 && <span className="text-[12px] text-gray-700">+{c.tags.length - 2}</span>}</div>
                    <button onClick={() => handleToggleStatus(c)} className={`text-[13px] px-2 py-0.5 rounded-full font-medium cursor-pointer ${c.status === 'subscribed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{c.status}</button>
                    <button onClick={() => handleDelete(c.id)} className="text-gray-600 hover:text-brand-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} strokeWidth={1.5} /></button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-700">Showing {page * PAGE + 1}-{Math.min((page + 1) * PAGE, filtered.length)} of {filtered.length}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="text-sm text-gray-700 hover:text-gray-700 disabled:opacity-30 px-2">Prev</button>
                    {Array.from({ length: Math.min(pages, 5) }).map((_, i) => (
                      <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-sm ${page === i ? 'bg-brand-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{i + 1}</button>
                    ))}
                    <button onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} className="text-sm text-gray-700 hover:text-gray-700 disabled:opacity-30 px-2">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add contact modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="font-semibold text-gray-900">Add Contact</h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-700 hover:text-gray-600"><X size={18} /></button>
              </div>
              <form onSubmit={handleAdd} className="flex-1 overflow-auto px-5 py-4 space-y-3">
                {/* Core fields - always visible */}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm text-gray-700 block mb-1">First Name</label><input className="input text-sm" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} autoFocus /></div>
                  <div><label className="text-sm text-gray-700 block mb-1">Last Name</label><input className="input text-sm" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm text-gray-700 block mb-1">Email *</label><input className="input text-sm" type="email" placeholder="name@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm text-gray-700 block mb-1">Phone</label><input className="input text-sm" placeholder="+1 (555) 123-4567" value={form.phone_mobile} onChange={e => setForm(f => ({ ...f, phone_mobile: e.target.value }))} /></div>
                  <div><label className="text-sm text-gray-700 block mb-1">Company</label><input className="input text-sm" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm text-gray-700 block mb-1">Job Title</label><input className="input text-sm" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} /></div>
                  <div><label className="text-sm text-gray-700 block mb-1">Tags</label><input className="input text-sm" placeholder="client, vip" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
                </div>

                {/* More fields toggle */}
                <button type="button" onClick={() => setShowMoreFields(!showMoreFields)}
                  className="w-full text-sm text-gray-700 hover:text-gray-600 py-1.5 flex items-center justify-center gap-1 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <Plus size={11} className={`transition-transform ${showMoreFields ? 'rotate-45' : ''}`} />
                  {showMoreFields ? 'Hide extra fields' : 'More fields (address, social, notes...)'}
                </button>

                {showMoreFields && (
                  <div className="space-y-3 pt-1">
                    <p className="text-[12px] text-gray-700 uppercase font-semibold tracking-wider">Details</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-sm text-gray-700 block mb-1">Prefix</label><input className="input text-sm" placeholder="Mr." value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))} /></div>
                      <div><label className="text-sm text-gray-700 block mb-1">Department</label><input className="input text-sm" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
                      <div><label className="text-sm text-gray-700 block mb-1">Industry</label><input className="input text-sm" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} /></div>
                    </div>
                    <div><label className="text-sm text-gray-700 block mb-1">Website</label><input className="input text-sm" placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>

                    <p className="text-[12px] text-gray-700 uppercase font-semibold tracking-wider pt-1">Address</p>
                    <div><input className="input text-sm" placeholder="Street address" value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><input className="input text-sm" placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                      <div><input className="input text-sm" placeholder="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
                      <div><input className="input text-sm" placeholder="Zip" value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} /></div>
                    </div>

                    <p className="text-[12px] text-gray-700 uppercase font-semibold tracking-wider pt-1">Social</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><input className="input text-sm" placeholder="LinkedIn URL" value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} /></div>
                      <div><input className="input text-sm" placeholder="Twitter @handle" value={form.twitter_handle} onChange={e => setForm(f => ({ ...f, twitter_handle: e.target.value }))} /></div>
                    </div>

                    <p className="text-[12px] text-gray-700 uppercase font-semibold tracking-wider pt-1">Lead Info</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><select className="input text-sm" value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}>
                        <option value="">Source</option><option>Website</option><option>Referral</option><option>Social Media</option><option>Cold Outreach</option><option>Event</option><option>Other</option>
                      </select></div>
                      <div><select className="input text-sm" value={form.lead_status} onChange={e => setForm(f => ({ ...f, lead_status: e.target.value }))}>
                        <option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="won">Won</option><option value="lost">Lost</option>
                      </select></div>
                      <div><select className="input text-sm" value={form.lifecycle_stage} onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value }))}>
                        <option value="lead">Lead</option><option value="subscriber">Subscriber</option><option value="opportunity">Opportunity</option><option value="customer">Customer</option>
                      </select></div>
                    </div>
                    <div><label className="text-sm text-gray-700 block mb-1">Notes</label><textarea className="input text-sm resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                  </div>
                )}
              </form>
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
                <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-gray-700 px-3 py-1.5">Cancel</button>
                <button onClick={handleAdd} className="btn-primary text-sm">Add Contact</button>
              </div>
            </div>
          </div>
        )}

        {/* Import wizard */}
        <ImportWizard open={showImport} onClose={() => setShowImport(false)} onComplete={loadAll} existingLists={lists} />

        {/* Bulk tag modal */}
        {bulkTagOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBulkTagOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-gray-900 mb-3">Add Tags to {selected.size} Contacts</h3>
              <BulkTagInput contacts={contacts} onApply={handleBulkTag} onCancel={() => setBulkTagOpen(false)} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function BulkTagInput({ contacts, onApply, onCancel }) {
  const [tags, setTags] = useState([])
  return (
    <div>
      <TagAutocomplete value={tags} onChange={setTags} contacts={contacts} placeholder="Type tags..." />
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onCancel} className="text-sm text-gray-700 px-3 py-1.5">Cancel</button>
        <button onClick={() => onApply(tags)} disabled={tags.length === 0} className="btn-primary text-sm disabled:opacity-40">Apply Tags</button>
      </div>
    </div>
  )
}
