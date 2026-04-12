"use client";
import { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronUp, Reply, Send, CheckCircle, Check, Paperclip, ListTodo, Image as ImageIcon } from 'lucide-react'
import { format } from 'date-fns'

const AVATAR_COLORS = ['#E6007E', '#59c6d0', '#185FA5', '#7C3ABF', '#3B6D11', '#f59e0b', '#0E7490', '#ec4899']

function getInitials(name) { return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() }
function getAvatarColor(name) { let hash = 0; for (const c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash); return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] }

export default function CommentSidebar({ annotations, selectedId, onSelect, replies = {}, onAddReply, authorName, onCreateTask, onUploadScreenshot, typingUser, onEditAnnotation, onDeleteAnnotation }) {
  const [collapsed, setCollapsed] = useState({})
  const [filter, setFilter] = useState('all')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  // Number ALL annotations sequentially (not just pins)
  const annIndex = (ann) => annotations.findIndex(a => a.id === ann.id) + 1
  const TYPE_LABELS = {
    pin: { label: 'Comment', icon: '📌' },
    arrow: { label: 'Arrow', icon: '↗' },
    circle: { label: 'Circle', icon: '◯' },
    rect: { label: 'Rectangle', icon: '▭' },
    freehand: { label: 'Drawing', icon: '✏️' },
    approve: { label: 'Approved', icon: '✓' },
    hotspot: { label: 'Hotspot', icon: '🔗' },
  }

  const filtered = annotations.filter(a => {
    if (filter === 'open') return !a.resolved && a.type !== 'approve'
    if (filter === 'resolved') return a.resolved
    return true
  })

  const openCount = annotations.filter(a => !a.resolved && a.type !== 'approve').length
  const resolvedCount = annotations.filter(a => a.resolved).length

  function handleReplySubmit(annotationId) {
    if (!replyText.trim() || !onAddReply) return
    onAddReply(annotationId, replyText.trim()); setReplyText(''); setReplyingTo(null)
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-1 min-h-0 flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-semibold text-gray-900 text-[13px]">Comments</h3>
          <span className="text-[13px] text-gray-400">{openCount} open &middot; {resolvedCount} resolved</span>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {['all', 'open', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 text-[13px] py-1 rounded-md font-medium transition-colors capitalize ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{f}</button>
          ))}
        </div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-16 px-4">
            <MessageSquare size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[13px] text-gray-400">{filter === 'all' ? 'No comments yet' : `No ${filter} comments`}</p>
          </div>
        )}

        {filtered.map((ann) => {
          const isSelected = ann.id === selectedId
          const num = annIndex(ann)
          const isOpen = !collapsed[ann.id]
          const annReplies = replies[ann.id] || []
          const initials = getInitials(ann.author)
          const avatarColor = getAvatarColor(ann.author)

          return (
            <div key={ann.id} id={`comment-${ann.id}`}
              className={`border-b border-gray-50 transition-all cursor-pointer ${
                isSelected ? 'bg-brand-50/50 border-l-2 border-l-brand-500' : 'hover:bg-gray-50/80'
              } ${ann.resolved ? 'opacity-50' : ''}`}
              onClick={() => onSelect(ann)}>
              <div className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                  {/* Numbered badge for ALL annotation types */}
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: ann.type === 'approve' ? '#22c55e' : (ann.color || avatarColor) }}>
                    {ann.type === 'approve' ? '✓' : annIndex(ann)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-gray-800">{ann.author || 'Anonymous'}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wider">
                          {TYPE_LABELS[ann.type]?.label || ann.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ann.resolved && <span className="text-[13px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-medium">Resolved</span>}
                        <button onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [ann.id]: isOpen })) }} className="text-gray-300 hover:text-gray-500">
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <>
                        {ann.type === 'approve' ? (
                          <p className="text-[13px] text-green-600 font-medium mt-1">Approved this section</p>
                        ) : editingId === ann.id ? (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <textarea
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editValue.trim() && onEditAnnotation) { onEditAnnotation(ann.id, editValue.trim()); setEditingId(null) } } if (e.key === 'Escape') setEditingId(null) }}
                              rows={2}
                              autoFocus
                              className="w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"
                            />
                            <div className="flex gap-1.5 mt-1">
                              <button onClick={() => { if (editValue.trim() && onEditAnnotation) { onEditAnnotation(ann.id, editValue.trim()); setEditingId(null) } }}
                                className="text-[11px] bg-brand-500 text-white px-2 py-1 rounded font-medium">Save</button>
                              <button onClick={() => setEditingId(null)}
                                className="text-[11px] text-gray-400 px-2 py-1 rounded hover:text-gray-600">Cancel</button>
                            </div>
                          </div>
                        ) : ann.text ? (
                          <div className="mt-1">
                            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap" style={{ textDecoration: ann.resolved ? 'line-through' : 'none' }}>
                              {ann.text.replace(/\[Screenshot:.*?\]/g, '').trim()}
                            </p>
                            {(ann.text.match(/\[Screenshot: (.*?)\]/g) || []).map((m, i) => {
                              const url = m.match(/\[Screenshot: (.*?)\]/)?.[1]
                              return url ? <img key={i} src={url} alt="Screenshot" className="mt-2 rounded-lg border border-gray-200 max-w-full max-h-32 object-cover cursor-pointer" onClick={e => { e.stopPropagation(); window.open(url, '_blank') }} /> : null
                            })}
                          </div>
                        ) : (
                          <p className="text-[13px] text-gray-400 italic mt-1 cursor-pointer hover:text-gray-500"
                            onClick={e => { e.stopPropagation(); setEditingId(ann.id); setEditValue('') }}>
                            Click to add a note…
                          </p>
                        )}

                        {ann.created_at && <p className="text-[13px] text-gray-400 mt-1.5">{format(new Date(ann.created_at), 'MMM d, h:mm a')}</p>}

                        {/* Replies */}
                        {annReplies.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {annReplies.map(r => (
                              <div key={r.id} className="pl-3 border-l-2 border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-full text-white text-[7px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: getAvatarColor(r.author) }}>{getInitials(r.author)}</div>
                                  <span className="text-[13px] font-medium text-gray-700">{r.author}</span>
                                  {r.created_at && <span className="text-[13px] text-gray-400">{format(new Date(r.created_at), 'MMM d, h:mm a')}</span>}
                                </div>
                                <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed">{r.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {ann.type !== 'approve' && onEditAnnotation && (
                            <button onClick={e => { e.stopPropagation(); setEditingId(ann.id); setEditValue(ann.text || '') }}
                              className="text-[13px] text-gray-400 hover:text-brand-500 flex items-center gap-1 transition-colors">
                              <Reply size={9} /> Edit
                            </button>
                          )}
                          {ann.type !== 'approve' && onDeleteAnnotation && (
                            <button onClick={e => { e.stopPropagation(); if (confirm('Delete this annotation?')) onDeleteAnnotation(ann.id) }}
                              className="text-[13px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                              <Send size={9} /> Delete
                            </button>
                          )}
                          {onAddReply && ann.type !== 'approve' && (
                            <button onClick={e => { e.stopPropagation(); setReplyingTo(replyingTo === ann.id ? null : ann.id); setReplyText('') }}
                              className="text-[13px] text-gray-400 hover:text-brand-500 flex items-center gap-1 transition-colors">
                              <Reply size={9} /> Reply{annReplies.length > 0 ? ` (${annReplies.length})` : ''}
                            </button>
                          )}
                          {onCreateTask && ann.type !== 'approve' && (
                            <button onClick={e => { e.stopPropagation(); onCreateTask(ann) }}
                              className="text-[13px] text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors">
                              <ListTodo size={9} /> Task
                            </button>
                          )}
                          {onUploadScreenshot && (
                            <label className="text-[13px] text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer transition-colors" onClick={e => e.stopPropagation()}>
                              <Paperclip size={9} /> Attach
                              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) onUploadScreenshot(e.target.files[0], ann); e.target.value = '' }} />
                            </label>
                          )}
                        </div>

                        {replyingTo === ann.id && (
                          <div className="mt-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                            <input className="flex-1 text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                              placeholder="Reply..." value={replyText} onChange={e => setReplyText(e.target.value)}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleReplySubmit(ann.id); if (e.key === 'Escape') setReplyingTo(null) }}
                              autoFocus />
                            <button onClick={() => handleReplySubmit(ann.id)} disabled={!replyText.trim()}
                              className="text-[13px] bg-brand-500 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"><Send size={10} /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Typing indicator */}
      {typingUser && (
        <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0">
          <span className="text-[13px] text-gray-400 flex items-center gap-1">
            {typingUser} is typing
            <span className="inline-flex gap-0.5"><span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></span>
          </span>
        </div>
      )}
    </div>
  )
}
