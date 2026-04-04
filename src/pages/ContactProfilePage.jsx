import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Mail, Phone, MapPin, Building2, Globe, Link2, Share2, Camera, Globe, Edit2, Trash2, Tag, Plus, X, Send, Eye, MousePointer, Ban, FileText, Clock, Check, ExternalLink } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { TagAutocomplete } from '../components/contacts/TagManager'
import { supabase } from '../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export default function ContactProfilePage() {
  const { contactId } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [contacts, setContacts] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [events, setEvents] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [lists, setLists] = useState([])
  const [contactLists, setContactLists] = useState([])
  const [notes, setNotes] = useState('')

  useEffect(() => { if (contactId) loadContact() }, [contactId])

  async function loadContact() {
    try {
      const { data: c } = await supabase.from('contacts').select('*').eq('id', contactId).single()
      if (c) { setContact(c); setForm(c); setNotes(c.notes || '') }
    } catch { navigate('/marketing/contacts'); return }

    const [{ data: allC }, { data: camps }, { data: ls }] = await Promise.all([
      supabase.from('contacts').select('id,first_name,last_name,email,tags'),
      supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('contact_lists').select('*'),
    ])
    setContacts(allC || [])
    setCampaigns(camps || [])
    setLists(ls || [])

    // These tables might not exist yet - wrap safely
    try {
      const { data: evts } = await supabase.from('email_tracking_events').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(50)
      setEvents(evts || [])
    } catch { setEvents([]) }

    try {
      const { data: members } = await supabase.from('contact_list_members').select('list_id').eq('contact_id', contactId)
      setContactLists((members || []).map(m => m.list_id))
    } catch { setContactLists([]) }
  }

  async function handleSave() {
    const { error } = await supabase.from('contacts').update(form).eq('id', contactId)
    if (error) { toast.error('Save failed'); return }
    toast.success('Contact updated'); setEditing(false); setContact(form)
  }

  async function handleTagsChange(newTags) {
    await supabase.from('contacts').update({ tags: newTags }).eq('id', contactId)
    setContact(c => ({ ...c, tags: newTags })); setForm(f => ({ ...f, tags: newTags }))
  }

  async function handleNotesBlur() {
    if (notes !== (contact?.notes || '')) {
      await supabase.from('contacts').update({ notes }).eq('id', contactId)
      toast.success('Notes saved')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this contact permanently?')) return
    await supabase.from('contacts').delete().eq('id', contactId)
    toast.success('Contact deleted'); navigate('/marketing/contacts')
  }

  async function toggleList(listId) {
    if (contactLists.includes(listId)) {
      await supabase.from('contact_list_members').delete().eq('list_id', listId).eq('contact_id', contactId)
      setContactLists(prev => prev.filter(id => id !== listId))
    } else {
      await supabase.from('contact_list_members').insert({ list_id: listId, contact_id: contactId }).catch(() => {})
      setContactLists(prev => [...prev, listId])
    }
  }

  if (!contact) return <div className="flex h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></main></div>

  const engagement = Math.min(100, Math.max(0, contact.engagement_score || 50))
  const engColor = engagement >= 70 ? '#22c55e' : engagement >= 40 ? '#eab308' : '#ef4444'
  const initials = ((contact.first_name?.[0] || '') + (contact.last_name?.[0] || contact.email?.[0] || '')).toUpperCase()

  const EVENT_ICONS = {
    sent: { icon: Send, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Email sent' },
    open: { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Opened' },
    click: { icon: MousePointer, color: 'text-green-500', bg: 'bg-green-50', label: 'Clicked' },
    unsub: { icon: Ban, color: 'text-red-500', bg: 'bg-red-50', label: 'Unsubscribed' },
    imported: { icon: FileText, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Imported' },
    tag_added: { icon: Tag, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Tag added' },
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-8 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/marketing/contacts')} className="text-gray-400 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="w-16 h-16 rounded-2xl bg-brand-500 text-white text-xl font-bold flex items-center justify-center flex-shrink-0">{initials}</div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{contact.first_name ? `${contact.prefix || ''} ${contact.first_name} ${contact.last_name || ''}`.trim() : contact.email}</h1>
              <p className="text-sm text-gray-500">{[contact.job_title, contact.company].filter(Boolean).join(' at ') || contact.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${contact.status === 'subscribed' ? 'bg-green-50 text-green-700' : contact.status === 'unsubscribed' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{contact.status || 'subscribed'}</span>
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full"><div className="h-full rounded-full" style={{ width: `${engagement}%`, background: engColor }} /></div>
                  <span className="text-[10px] font-medium" style={{ color: engColor }}>{engagement}%</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(!editing)} className="btn-secondary text-xs"><Edit2 size={12} /> {editing ? 'Cancel' : 'Edit'}</button>
              <button onClick={handleDelete} className="text-xs text-gray-400 hover:text-red-500 p-2"><Trash2 size={14} /></button>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <TagAutocomplete value={contact.tags || []} onChange={handleTagsChange} contacts={contacts} placeholder="Add tag..." />
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-[1fr_360px] gap-6">
            {/* LEFT - Timeline & Email History */}
            <div className="space-y-6">
              {/* Activity Timeline */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity Timeline</h3>
                {events.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No activity recorded yet</p>}
                <div className="space-y-3">
                  {events.slice(0, 20).map((evt, i) => {
                    const cfg = EVENT_ICONS[evt.event_type] || EVENT_ICONS.sent
                    const I = cfg.icon
                    const camp = campaigns.find(c => c.id === evt.campaign_id)
                    return (
                      <div key={evt.id || i} className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}><I size={12} className={cfg.color} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700">
                            {cfg.label} {camp && <span className="font-medium">"{camp.name}"</span>}
                            {evt.metadata?.url && <span className="text-xs text-gray-400"> - {evt.metadata.url}</span>}
                          </p>
                          <p className="text-[10px] text-gray-400">{evt.created_at ? formatDistanceToNow(new Date(evt.created_at), { addSuffix: true }) : ''}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Email History */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Email History</h3>
                <p className="text-xs text-gray-400 mb-3">{contact.email_count || 0} emails sent &middot; {contact.total_emails_opened || 0} opened &middot; {contact.total_emails_clicked || 0} clicked</p>
                {campaigns.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No campaigns yet</p>}
                <div className="space-y-1.5">
                  {campaigns.slice(0, 10).map(c => {
                    const sentEvt = events.find(e => e.campaign_id === c.id && e.event_type === 'sent')
                    const openEvt = events.find(e => e.campaign_id === c.id && e.event_type === 'open')
                    const clickEvt = events.find(e => e.campaign_id === c.id && e.event_type === 'click')
                    if (!sentEvt) return null
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-400">{sentEvt?.created_at ? format(new Date(sentEvt.created_at), 'MMM d, yyyy') : ''}</p>
                        </div>
                        <div className="flex gap-2">
                          {openEvt ? <Eye size={12} className="text-blue-500" /> : <Eye size={12} className="text-gray-300" />}
                          {clickEvt ? <MousePointer size={12} className="text-green-500" /> : <MousePointer size={12} className="text-gray-300" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT - Details */}
            <div className="space-y-4">
              {/* Contact Info */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Details</h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'Email', key: 'email', icon: Mail },
                    { label: 'Phone', key: 'phone_mobile', icon: Phone, fallback: 'phone' },
                    { label: 'Company', key: 'company', icon: Building2 },
                    { label: 'Title', key: 'job_title' },
                    { label: 'Website', key: 'website', icon: Globe },
                    { label: 'City', key: 'city', icon: MapPin },
                    { label: 'State', key: 'state' },
                    { label: 'Country', key: 'country' },
                    { label: 'LinkedIn', key: 'linkedin_url', icon: Link2 },
                    { label: 'Share2', key: 'twitter_handle', icon: Share2 },
                    { label: 'Lead Source', key: 'lead_source' },
                    { label: 'Lead Status', key: 'lead_status' },
                    { label: 'Lifecycle', key: 'lifecycle_stage' },
                  ].map(f => {
                    const val = form[f.key] || (f.fallback && form[f.fallback]) || ''
                    const I = f.icon
                    return (
                      <div key={f.key} className="flex items-center gap-2">
                        {I && <I size={12} className="text-gray-400 flex-shrink-0" />}
                        {!I && <div className="w-3" />}
                        {editing ? (
                          <div className="flex-1"><label className="text-[9px] text-gray-400 uppercase">{f.label}</label><input className="input text-xs py-1 w-full" value={val} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} /></div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-gray-400 uppercase">{f.label}</p>
                            <p className="text-sm text-gray-800 truncate">{val || <span className="text-gray-300">—</span>}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {editing && <button onClick={handleSave} className="btn-primary text-xs w-full justify-center mt-2"><Check size={12} /> Save Changes</button>}
                </div>
              </div>

              {/* Lists */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Lists</h3>
                <div className="space-y-1.5">
                  {lists.map(l => (
                    <label key={l.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5">
                      <input type="checkbox" checked={contactLists.includes(l.id)} onChange={() => toggleList(l.id)} className="rounded border-gray-300" />
                      {l.name}
                    </label>
                  ))}
                  {lists.length === 0 && <p className="text-xs text-gray-400">No lists created</p>}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes</h3>
                <textarea className="input text-sm w-full resize-none" rows={4} placeholder="Add notes about this contact..."
                  value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
