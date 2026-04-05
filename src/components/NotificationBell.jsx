"use client";
import { useState, useEffect, useRef } from 'react'
import { Bell, Check, MessageSquare, FileImage, Clock, CheckCircle, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'

const ICONS = { comment: MessageSquare, round: CheckCircle, file: FileImage, task: Check, due: Clock, message: MessageSquare, default: Bell }

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => { if (user?.email) loadNotifications() }, [user])

  useEffect(() => {
    if (!user?.email) return
    const channel = supabase.channel('notif-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_email=eq.${user.email}` }, () => loadNotifications()).subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function loadNotifications() {
    try {
      const { data } = await supabase.from('notifications').select('*').eq('user_email', user.email).order('created_at', { ascending: false }).limit(15)
      setNotifications(data || [])
    } catch { setNotifications([]) }
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_email', user?.email).eq('read', false)
    loadNotifications()
  }

  const unread = notifications.filter(n => !n.read).length

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <Bell size={16} strokeWidth={1.5} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && <button onClick={markAllRead} className="text-[13px] text-brand-500 hover:text-brand-700 font-medium">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No notifications</div>}
            {notifications.map(n => {
              const Icon = ICONS[n.type] || ICONS.default
              return (
                <div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex items-start gap-3 ${n.read ? '' : 'bg-brand-50/30'}`}
                  onClick={async () => { if (!n.read) { await supabase.from('notifications').update({ read: true }).eq('id', n.id); loadNotifications() }; if (n.link) window.location.href = n.link }}>
                  <Icon size={14} strokeWidth={1.5} className="text-brand-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${n.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{n.message || n.title}</p>
                    <p className="text-[13px] text-gray-400 mt-0.5">{n.created_at && formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
