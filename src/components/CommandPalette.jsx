'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, ChevronRight, LayoutGrid, Users, Star, Target, BarChart2,
  Globe, FileText, Settings, Zap, Brain, Phone, Bug, Activity, HelpCircle,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b';
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

const PAGES = [
  { label: 'Dashboard', path: '/', icon: LayoutGrid, category: 'Main' },
  { label: 'Clients', path: '/clients', icon: Users, category: 'Main' },
  { label: 'Reviews', path: '/reviews', icon: Star, category: 'Main' },
  { label: 'SEO Hub', path: '/seo', icon: Globe, category: 'Marketing' },
  { label: 'Scout', path: '/scout', icon: Target, category: 'Sales' },
  { label: 'Tasks', path: '/tasks', icon: Activity, category: 'Main' },
  { label: 'Proposals', path: '/proposals', icon: FileText, category: 'Sales' },
  { label: 'Page Builder', path: '/page-builder', icon: LayoutGrid, category: 'Build' },
  { label: 'WordPress', path: '/wordpress', icon: Globe, category: 'Build' },
  { label: 'KotoDesk', path: '/desk', icon: HelpCircle, category: 'Support' },
  { label: 'Performance', path: '/perf', icon: BarChart2, category: 'Analytics' },
  { label: 'Voice Agent', path: '/voice', icon: Phone, category: 'AI' },
  { label: 'Calendar', path: '/calendar', icon: LayoutGrid, category: 'Main' },
  { label: 'Contacts', path: '/contacts', icon: Users, category: 'CRM' },
  { label: 'Campaigns', path: '/campaigns', icon: Zap, category: 'Marketing' },
  { label: 'Templates', path: '/templates', icon: FileText, category: 'Build' },
  { label: 'Email Designer', path: '/email-designer', icon: FileText, category: 'Marketing' },
  { label: 'Revenue', path: '/revenue', icon: BarChart2, category: 'Analytics' },
  { label: 'Team', path: '/employees', icon: Users, category: 'Admin' },
  { label: 'Integrations', path: '/integrations', icon: Zap, category: 'Settings' },
  { label: 'Settings', path: '/agency-settings', icon: Settings, category: 'Settings' },
  { label: 'Billing', path: '/billing', icon: BarChart2, category: 'Settings' },
  { label: 'Admin', path: '/admin', icon: Settings, category: 'Admin' },
  { label: 'Debug Console', path: '/debug', icon: Bug, category: 'Dev' },
  { label: 'Help Center', path: '/help', icon: HelpCircle, category: 'Support' },
  { label: 'Status Page', path: '/status', icon: Activity, category: 'Dev' },
  { label: 'Uptime Monitor', path: '/uptime', icon: Activity, category: 'Dev' },
  { label: 'Master Admin', path: '/master-admin', icon: Settings, category: 'Admin' },
  { label: 'Documents', path: '/clients', icon: FileText, category: 'Main' },
  { label: 'Onboarding', path: '/onboarding-dashboard', icon: Sparkles, category: 'Main' },
  { label: 'Marketplace', path: '/marketplace', icon: Globe, category: 'Main' },
];

const QUICK_ACTIONS = [
  { label: 'Create Client', path: '/clients', icon: Users, action: true },
  { label: 'New Proposal', path: '/proposals', icon: FileText, action: true },
  { label: 'Run Scout Search', path: '/scout', icon: Target, action: true },
  { label: 'Generate Pages', path: '/page-builder', icon: Sparkles, action: true },
];

const RECENT_KEY = 'koto_cmd_recent';

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function addRecent(item) {
  const recent = getRecent().filter(r => r.path !== item.path);
  recent.unshift({ label: item.label, path: item.path });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

function fuzzyMatch(text, query) {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = query.trim()
    ? PAGES.filter(p => fuzzyMatch(p.label, query) || fuzzyMatch(p.path, query))
    : [];

  const recentItems = getRecent();
  const showRecent = !query.trim() && recentItems.length > 0;
  const showQuickActions = !query.trim();
  const displayItems = query.trim() ? filtered : [];

  // Total navigable items count
  const totalItems = (showQuickActions ? QUICK_ACTIONS.length : 0) +
    (showRecent ? recentItems.length : 0) +
    displayItems.length;

  const getAllItems = useCallback(() => {
    const items = [];
    if (showQuickActions) {
      QUICK_ACTIONS.forEach(a => items.push(a));
    }
    if (showRecent) {
      recentItems.forEach(r => {
        const page = PAGES.find(p => p.path === r.path);
        items.push({ ...r, icon: page?.icon || FileText, category: 'Recent' });
      });
    }
    displayItems.forEach(d => items.push(d));
    return items;
  }, [showQuickActions, showRecent, recentItems, displayItems]);

  const handleSelect = useCallback((item) => {
    addRecent(item);
    navigate(item.path);
    setOpen(false);
  }, [navigate]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    const items = getAllItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        handleSelect(items[selectedIndex]);
      }
    }
  }, [getAllItems, selectedIndex, handleSelect]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const allItems = getAllItems();

  let itemIndex = -1;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        animation: 'cmdFadeIn 150ms ease-out',
      }}
    >
      <style>{`
        @keyframes cmdFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cmdSlideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 600,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 16px 64px rgba(0,0,0,0.24)',
          overflow: 'hidden',
          animation: 'cmdSlideIn 200ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
        }}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid #e5e7eb',
          gap: 10,
        }}>
          <Search size={18} color="#9ca3af" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontFamily: FH,
              fontSize: 15,
              color: BLK,
              background: 'transparent',
            }}
          />
          <kbd style={{
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            background: GRY,
            color: '#9ca3af',
            border: '1px solid #e5e7eb',
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {/* Quick Actions */}
          {showQuickActions && (
            <div>
              <div style={{
                padding: '8px 16px 4px',
                fontFamily: FH,
                fontSize: 11,
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Quick Actions
              </div>
              {QUICK_ACTIONS.map((action) => {
                itemIndex++;
                const idx = itemIndex;
                const isSelected = idx === selectedIndex;
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    data-index={idx}
                    onClick={() => handleSelect(action)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 16px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isSelected ? R : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isSelected ? 'rgba(255,255,255,0.2)' : GRY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={14} color={isSelected ? '#fff' : T} />
                    </div>
                    <span style={{
                      fontFamily: FH,
                      fontSize: 13,
                      fontWeight: 600,
                      color: isSelected ? '#fff' : BLK,
                      flex: 1,
                    }}>
                      {action.label}
                    </span>
                    <Zap size={12} color={isSelected ? 'rgba(255,255,255,0.6)' : AMB} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent */}
          {showRecent && (
            <div>
              <div style={{
                padding: '10px 16px 4px',
                fontFamily: FH,
                fontSize: 11,
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Recent
              </div>
              {recentItems.map((recent) => {
                itemIndex++;
                const idx = itemIndex;
                const isSelected = idx === selectedIndex;
                const page = PAGES.find(p => p.path === recent.path);
                const Icon = page?.icon || FileText;
                return (
                  <button
                    key={recent.path + '-recent'}
                    data-index={idx}
                    onClick={() => handleSelect(recent)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 16px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isSelected ? R : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isSelected ? 'rgba(255,255,255,0.2)' : GRY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={14} color={isSelected ? '#fff' : '#6b7280'} />
                    </div>
                    <span style={{
                      fontFamily: FH,
                      fontSize: 13,
                      fontWeight: 500,
                      color: isSelected ? '#fff' : BLK,
                      flex: 1,
                    }}>
                      {recent.label}
                    </span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: isSelected ? 'rgba(255,255,255,0.5)' : '#d1d5db',
                    }}>
                      {recent.path}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Results */}
          {query.trim() && (
            <div>
              {filtered.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  fontFamily: FB,
                  fontSize: 13,
                  color: '#9ca3af',
                }}>
                  No results for &quot;{query}&quot;
                </div>
              ) : (
                filtered.map((page) => {
                  itemIndex++;
                  const idx = itemIndex;
                  const isSelected = idx === selectedIndex;
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.path + page.label}
                      data-index={idx}
                      onClick={() => handleSelect(page)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: isSelected ? R : 'transparent',
                        transition: 'background 100ms',
                      }}
                    >
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: isSelected ? 'rgba(255,255,255,0.2)' : GRY,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Icon size={14} color={isSelected ? '#fff' : T} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: FH,
                          fontSize: 13,
                          fontWeight: 600,
                          color: isSelected ? '#fff' : BLK,
                        }}>
                          {page.label}
                        </div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: isSelected ? 'rgba(255,255,255,0.5)' : '#d1d5db',
                        }}>
                          {page.path}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: FB,
                        fontSize: 10,
                        fontWeight: 600,
                        color: isSelected ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                        background: isSelected ? 'rgba(255,255,255,0.15)' : GRY,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        {page.category}
                      </span>
                      <ChevronRight size={14} color={isSelected ? 'rgba(255,255,255,0.5)' : '#d1d5db'} />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Empty default state */}
          {!query.trim() && !showRecent && (
            <div style={{
              padding: '16px 16px 8px',
              fontFamily: FB,
              fontSize: 12,
              color: '#9ca3af',
              textAlign: 'center',
            }}>
              Start typing to search pages and actions...
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          {[
            { keys: ['\u2191', '\u2193'], label: 'navigate' },
            { keys: ['\u21B5'], label: 'select' },
            { keys: ['esc'], label: 'close' },
          ].map(hint => (
            <span key={hint.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#9ca3af',
            }}>
              {hint.keys.map(k => (
                <kbd key={k} style={{
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: GRY,
                  border: '1px solid #e5e7eb',
                  fontSize: 10,
                }}>
                  {k}
                </kbd>
              ))}
              <span style={{ fontFamily: FB, fontSize: 11 }}>{hint.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
