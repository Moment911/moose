'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Clock, AlertCircle, Star, Zap, Trash2, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b';
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

function timeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getIcon(type) {
  const size = 16;
  switch (type) {
    case 'error': return <AlertCircle size={size} color={R} />;
    case 'warn': return <Zap size={size} color={AMB} />;
    case 'notification': return <Star size={size} color={T} />;
    default: return <Bell size={size} color={BLK} />;
  }
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('koto_read_notifications') || '[]'));
    } catch { return new Set(); }
  });
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  // Fetch notifications from supabase
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('koto_system_logs')
          .select('*')
          .in('level', ['error', 'warn', 'notification'])
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Persist read state
  useEffect(() => {
    localStorage.setItem('koto_read_notifications', JSON.stringify([...readIds]));
  }, [readIds]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markRead = (id) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const markAllRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const clearAll = () => {
    setNotifications([]);
    setReadIds(new Set());
  };

  const handleNotificationClick = (notif) => {
    markRead(notif.id);
    if (notif.metadata?.url) {
      window.location.href = notif.metadata.url;
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 200ms',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
        title="Notifications"
      >
        <Bell size={20} color={BLK} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: R,
            color: '#fff',
            fontSize: 10,
            fontFamily: FH,
            fontWeight: 700,
            width: 16,
            height: 16,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            width: 340,
            maxHeight: 440,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            border: '1px solid #e5e7eb',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            animation: 'notifFadeIn 200ms ease-out',
          }}
        >
          <style>{`
            @keyframes notifFadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontFamily: FH,
              fontWeight: 700,
              fontSize: 15,
              color: BLK,
            }}>
              Notifications
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: FB,
                      fontSize: 12,
                      color: T,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = GRY}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={clearAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Clear all"
                    onMouseEnter={e => e.currentTarget.style.background = GRY}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Trash2 size={14} color="#9ca3af" />
                  </button>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = GRY}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <X size={14} color="#9ca3af" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{
            overflowY: 'auto',
            flex: 1,
            padding: '4px 0',
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 16px',
                textAlign: 'center',
                fontFamily: FB,
                fontSize: 13,
                color: '#9ca3af',
              }}>
                <Bell size={28} color="#d1d5db" style={{ marginBottom: 8 }} />
                <div>No notifications</div>
              </div>
            ) : (
              notifications.map(notif => {
                const isRead = readIds.has(notif.id);
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 16px',
                      background: isRead ? 'transparent' : 'rgba(91,198,208,0.06)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = GRY}
                    onMouseLeave={e => e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(91,198,208,0.06)'}
                  >
                    <div style={{
                      marginTop: 2,
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: GRY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {getIcon(notif.level)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: FH,
                        fontSize: 13,
                        fontWeight: isRead ? 400 : 700,
                        color: BLK,
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {notif.message}
                      </div>
                      <div style={{
                        fontFamily: FB,
                        fontSize: 11,
                        color: '#9ca3af',
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <Clock size={10} />
                        {timeAgo(notif.created_at)}
                      </div>
                    </div>
                    {notif.metadata?.url && (
                      <ChevronRight size={14} color="#d1d5db" style={{ marginTop: 4, flexShrink: 0 }} />
                    )}
                    {!isRead && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: R,
                        flexShrink: 0,
                        marginTop: 6,
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
