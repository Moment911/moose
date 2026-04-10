'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const T = '#00C2CB'
const R = '#E6007E'
const BLK = '#111'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"

function timeAgo(date) {
  if (!date) return ''
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString()
}

export default function NotificationCenter() {
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const bellRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    if (!aid) return
    try {
      const action = showAll ? 'all' : 'list'
      const res = await fetch(`/api/notifications?action=${action}&agency_id=${aid}`)
      const data = await res.json()
      if (Array.isArray(data?.data)) setNotifications(data.data)
    } catch {
      /* silent — never break the shell */
    }
  }, [aid, showAll])

  // Initial load + 30s polling
  useEffect(() => {
    fetchNotifications()
    const iv = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(iv)
  }, [fetchNotifications])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (panelRef.current?.contains(e.target)) return
      if (bellRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', id, agency_id: aid }),
      })
    } catch { /* silent */ }
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read', agency_id: aid }),
      })
    } catch { /* silent */ }
  }

  async function deleteNotif(id, ev) {
    if (ev) ev.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id, agency_id: aid }),
      })
    } catch { /* silent */ }
  }

  function handleRowClick(n) {
    if (!n.is_read) markRead(n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
  }

  async function toggleShowAll() {
    setShowAll(v => !v)
    setLoading(true)
    // fetchNotifications will rerun via the useCallback dep change
    setTimeout(() => setLoading(false), 200)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell */}
      <button
        ref={bellRef}
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{
          position: 'relative',
          padding: 5,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          borderRadius: 6,
          transition: 'color .15s',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#374151' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af' }}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 14,
              height: 14,
              borderRadius: 999,
              background: R,
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              fontFamily: FH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '2px solid #fff',
              boxSizing: 'content-box',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: 70,
            left: 16,
            width: 360,
            maxHeight: 480,
            background: '#fff',
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 20px 50px rgba(0,0,0,.15), 0 6px 20px rgba(0,0,0,.08)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: FH,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: BLK, flex: 1 }}>
              Notifications
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '1px 8px',
                    borderRadius: 10,
                    background: R,
                    color: '#fff',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: MUTED,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 && !loading ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: MUTED,
                }}
              >
                <Bell size={24} color="#d1d5db" />
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: BLK }}>
                  No notifications
                </div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  You're all caught up.
                </div>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onClick={() => handleRowClick(n)}
                  onDelete={ev => deleteNotif(n.id, ev)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: `1px solid ${BORDER}`,
              background: '#fafafa',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            <button
              onClick={toggleShowAll}
              style={{
                background: 'none',
                border: 'none',
                color: T,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {showAll ? 'Show unread only' : 'View all'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({ n, onClick, onDelete }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        cursor: n.link ? 'pointer' : 'default',
        background: n.is_read ? '#fff' : '#f0fffe',
        transition: 'background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = n.is_read ? '#fafafa' : '#e6fcfd' }}
      onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? '#fff' : '#f0fffe' }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#e6fcfd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {n.icon || '🔔'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: BLK,
            lineHeight: 1.35,
            marginBottom: 2,
          }}
        >
          {n.title}
        </div>
        {n.body && (
          <div
            style={{
              fontSize: 12,
              color: MUTED,
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: 3,
            }}
          >
            {n.body}
          </div>
        )}
        <div style={{ fontSize: 10, color: '#9ca3af' }}>{timeAgo(n.created_at)}</div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        title="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: '#9ca3af',
          borderRadius: 6,
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#dc2626' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af' }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
