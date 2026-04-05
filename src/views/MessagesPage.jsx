"use client";
import { useState, useEffect, useRef } from 'react'
import { PenLine, Search, Star, Paperclip, Send, X, Plus, Archive, Trash2, MessageSquare, Users, Layers } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getClients, sendEmailSummary } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'

const TYPE_COLORS = { client: '#ea2729', internal: '#3b82f6', project: '#22c55e' }

export default function MessagesPage() {
  const { agencyId } = useAuth()
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newType, setNewType] = useState('client')
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  useEffect(() => { loadConversations(); loadClients() }, [])
  useEffect(() => { if (selectedConvo) loadMessages(selectedConvo.id) }, [selectedConvo])
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [messages])

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('messages-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      if (payload.new.conversation_id === selectedConvo?.id) setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
      loadConversations()
    }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [selectedConvo])

  async function loadConversations() {
    setLoading(true)
    const { data } = await supabase.from('conversations').select('*').order('last_message_at', { ascending: false })
    setConversations(data || [])
    setLoading(false)
  }

  async function loadClients() { const { data } = await getClients(agencyId); setClients(data || []) }

  async function loadMessages(convoId) {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convoId).order('created_at')
    setMessages(data || [])
    // Mark as read
    await supabase.from('messages').update({ is_read: true }).eq('conversation_id', convoId).eq('is_read', false)
    await supabase.from('conversations').update({ unread_count: 0 }).eq('id', convoId)
  }

  async function handleSend() {
    if (!newMessage.trim() || !selectedConvo) return
    const { data } = await supabase.from('messages').insert({
      conversation_id: selectedConvo.id, body: newMessage.trim(), sender_email: user?.email,
      sender_name: user?.email?.split('@')[0] || 'Admin', sender_type: 'agency', is_internal: isInternal,
    }).select().single()
    if (data) { setMessages(prev => [...prev, data]); setNewMessage('') }
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selectedConvo.id)
    if (sendEmail) {
      const recipient = (selectedConvo.participants || []).find(p => p.email !== user?.email)
      if (recipient?.email) await sendEmailSummary({ type: 'message', to: recipient.email, subject: selectedConvo.subject || 'New message', message: newMessage.trim(), sender: user?.email?.split('@')[0] })
    }
  }

  async function handleNewConversation() {
    if (!newSubject.trim()) { toast.error('Add a subject'); return }
    const participants = [{ email: user?.email, name: user?.email?.split('@')[0] }]
    if (newTo.trim()) participants.push({ email: newTo.trim(), name: newTo.split('@')[0] })
    const { data } = await supabase.from('conversations').insert({ type: newType, subject: newSubject.trim(), participants }).select().single()
    if (data) { setConversations(prev => [data, ...prev]); setSelectedConvo(data); setShowNew(false); setNewSubject(''); setNewTo('') }
  }

  async function handleStar(convo, e) {
    e.stopPropagation()
    // Toggle star via messages - simplified: just star the convo in local state
    toast.success('Starred')
  }

  async function handleArchive() {
    if (!selectedConvo) return
    await supabase.from('conversations').update({ archived: true }).eq('id', selectedConvo.id)
    setSelectedConvo(null); loadConversations(); toast.success('Archived')
  }

  async function handleDeleteConvo() {
    if (!selectedConvo || !confirm('Delete this conversation?')) return
    await supabase.from('conversations').delete().eq('id', selectedConvo.id)
    setSelectedConvo(null); loadConversations(); toast.success('Deleted')
  }

  const filtered = conversations.filter(c => {
    if (filter === 'archived') return c.archived
    if (c.archived) return false
    if (filter === 'unread') return c.unread_count > 0
    if (search) return (c.subject || '').toLowerCase().includes(search.toLowerCase())
    return true
  })

  // Group by time
  function getGroup(date) {
    const d = new Date(date)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    if (differenceInDays(new Date(), d) <= 7) return 'This Week'
    return 'Older'
  }
  const groups = {}
  filtered.forEach(c => { const g = getGroup(c.last_message_at || c.created_at); if (!groups[g]) groups[g] = []; groups[g].push(c) })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex overflow-hidden bg-white">
        {/* LEFT — Conversations */}
        <div className="hidden md:flex w-72 border-r border-gray-200 flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Messages</h2>
              <button onClick={() => setShowNew(true)} className="w-8 h-8 bg-brand-500 text-white rounded-lg flex items-center justify-center hover:bg-brand-600"><PenLine size={14} /></button>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <Search size={13} className="text-gray-700" />
              <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex border-b border-gray-100 px-2 py-1 gap-0.5">
            {['all', 'unread', 'archived'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`flex-1 text-[13px] py-1 rounded font-medium capitalize ${filter === f ? 'bg-gray-200 text-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}>{f}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {Object.entries(groups).map(([group, convos]) => (
              <div key={group}>
                <p className="text-[13px] font-semibold text-gray-700 uppercase px-4 pt-3 pb-1">{group}</p>
                {convos.map(c => (
                  <div key={c.id} onClick={() => setSelectedConvo(c)}
                    className={`px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${selectedConvo?.id === c.id ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0" style={{ background: TYPE_COLORS[c.type] || '#9ca3af' }}>
                        {c.type === 'client' ? 'C' : c.type === 'internal' ? 'I' : 'P'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm truncate ${c.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{c.subject || 'No subject'}</span>
                          {c.unread_count > 0 && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 ml-1" />}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[13px] text-gray-700 truncate">{(c.participants || []).map(p => p.name).join(', ') || 'No participants'}</span>
                          <span className="text-[13px] text-gray-700 flex-shrink-0 ml-1">{c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true }).replace('about ', '') : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-700">{loading ? 'Loading...' : 'No conversations'}</div>}
          </div>
        </div>

        {/* MIDDLE — Thread */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedConvo ? (
            <>
              <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: TYPE_COLORS[selectedConvo.type] || '#9ca3af' }}>
                  {selectedConvo.type === 'client' ? 'C' : selectedConvo.type === 'internal' ? 'I' : 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedConvo.subject || 'No subject'}</h3>
                  <p className="text-[13px] text-gray-700">{(selectedConvo.participants || []).map(p => p.email).join(', ')}</p>
                </div>
                <button onClick={handleArchive} className="p-1.5 rounded-lg text-gray-700 hover:text-gray-700 hover:bg-gray-100" title="Archive"><Archive size={14} /></button>
                <button onClick={handleDeleteConvo} className="p-1.5 rounded-lg text-gray-700 hover:text-brand-500 hover:bg-brand-50" title="Delete"><Trash2 size={14} /></button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.map(m => {
                  const isMe = m.sender_email === user?.email
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${m.is_internal ? 'bg-amber-50 border border-amber-200' : isMe ? 'bg-brand-500 text-white' : 'bg-gray-100'} rounded-xl px-4 py-3`}>
                        {m.is_internal && <p className="text-[13px] text-amber-600 font-medium mb-1">🔒 Internal note</p>}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-medium ${isMe && !m.is_internal ? 'text-white/80' : 'text-gray-700'}`}>{m.sender_name || 'Unknown'}</span>
                          <span className={`text-[13px] ${isMe && !m.is_internal ? 'text-white/50' : 'text-gray-700'}`}>{m.created_at && format(new Date(m.created_at), 'MMM d h:mm a')}</span>
                        </div>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isMe && !m.is_internal ? 'text-white' : 'text-gray-800'}`}>{m.body}</p>
                      </div>
                    </div>
                  )
                })}
                {messages.length === 0 && <div className="text-center py-12 text-sm text-gray-700">No messages yet. Start the conversation!</div>}
              </div>

              {/* Composer */}
              <div className="px-5 py-3 border-t border-gray-200 flex-shrink-0">
                <div className="flex gap-2 mb-2">
                  <label className={`flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg cursor-pointer ${isInternal ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="w-3 h-3" /> Internal note
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="w-3 h-3" /> Also email
                  </label>
                </div>
                <div className="flex gap-2">
                  <textarea className="input text-sm flex-1 resize-none" rows={2} placeholder="Write a message... (Ctrl+Enter to send)" value={newMessage}
                    onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend() } }} />
                  <button onClick={handleSend} disabled={!newMessage.trim()} className="self-end bg-brand-500 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-brand-600 disabled:opacity-30"><Send size={15} /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><MessageSquare size={40} strokeWidth={1} className="text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-700">Select a conversation</p></div>
            </div>
          )}
        </div>

        {/* RIGHT — Context */}
        {selectedConvo && (
          <div className="w-72 border-l border-gray-200 overflow-y-auto flex-shrink-0 p-4">
            <p className="text-[13px] font-semibold text-gray-700 uppercase mb-3">Conversation Details</p>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-700 mb-1">Type</p>
                <span className="text-sm px-2 py-0.5 rounded-full font-medium" style={{ background: (TYPE_COLORS[selectedConvo.type] || '#9ca3af') + '18', color: TYPE_COLORS[selectedConvo.type] || '#9ca3af' }}>{selectedConvo.type}</span>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-1">Participants</p>
                <div className="space-y-1">
                  {(selectedConvo.participants || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[13px] font-bold flex items-center justify-center">{(p.name || p.email || '?')[0].toUpperCase()}</div>
                      <span className="text-sm text-gray-700">{p.name || p.email}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-1">Messages</p>
                <p className="text-sm font-medium text-gray-900">{messages.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-1">Created</p>
                <p className="text-sm text-gray-700">{selectedConvo.created_at && format(new Date(selectedConvo.created_at), 'MMM d yyyy h:mm a')}</p>
              </div>
              {selectedConvo.reply_token && (
                <div>
                  <p className="text-sm text-gray-700 mb-1">Client Reply Link</p>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/reply/${selectedConvo.reply_token}`); toast.success('Copied!') }}
                    className="text-sm text-brand-500 hover:text-brand-700">Copy magic link</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Conversation</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-700 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                {[{ key: 'client', label: 'Client', icon: Users }, { key: 'internal', label: 'Internal', icon: MessageSquare }, { key: 'project', label: 'Project', icon: Layers }].map(t => {
                  const I = t.icon; return (
                  <button key={t.key} onClick={() => setNewType(t.key)}
                    className={`flex-1 text-sm py-2 rounded-lg font-medium border transition-colors flex items-center justify-center gap-1 ${newType === t.key ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-700'}`}>
                    <I size={12} /> {t.label}
                  </button>
                )})}
              </div>
              <input className="input text-sm" placeholder="To (email)" value={newTo} onChange={e => setNewTo(e.target.value)} />
              <input className="input text-sm" placeholder="Subject" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="text-sm text-gray-700 px-3 py-1.5">Cancel</button>
              <button onClick={handleNewConversation} disabled={!newSubject.trim()} className="btn-primary text-sm">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
