"use client"
import { useState } from 'react'
import {
  ChevronDown, Play, Loader2, BarChart2, Search, Award,
  Target, Shield, Eye, Globe, Map, Brain, Sparkles, Link2,
  GitBranch, Layers, FileText, Zap, RefreshCw, Calendar,
  Activity, Code, Star, ImageIcon, Grid, Settings, DollarSign,
  MessageCircle, Check, Sunrise, Megaphone, Mail,
} from 'lucide-react'
import { useKotoIQData } from '../../../context/KotoIQDataContext'

/**
 * Left navigation rail for the redesigned KotoIQ dashboard.
 * Variant C — macOS Finder / Mail-style sidebar.
 *
 * Owns:
 *   - Client picker pill
 *   - Launch All Audits primary action
 *   - Last-synced indicator
 *   - Collapsible tool nav grouped by section
 */

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif"

const NAV_GROUPS = [
  { label: 'Overview', items: [
    { id: 'today',             label: 'Today',             tab: 'today',             icon: Sunrise },
    { id: 'competitor_pulse',  label: 'Competitor Pulse',  tab: 'competitor_pulse',  icon: Activity },
    { id: 'dashboard',         label: 'Dashboard',         tab: 'dashboard',         icon: BarChart2 },
    { id: 'ask',               label: 'Ask KotoIQ',        tab: 'ask',               icon: MessageCircle },
    { id: 'keywords',          label: 'Keywords',          tab: 'keywords',          icon: Search },
    { id: 'authority',         label: 'Authority Score',   tab: 'topical_authority', icon: Award },
  ]},
  { label: 'Competitor Intel', items: [
    { id: 'competitor_pages',  label: 'Pages',             tab: 'competitor_pages',  icon: FileText },
    { id: 'pricing_tracker',   label: 'Pricing',           tab: 'pricing_tracker',   icon: DollarSign },
    { id: 'competitor_ads',    label: 'Ads',               tab: 'competitor_ads',    icon: Megaphone },
    { id: 'competitor_youtube',label: 'YouTube',           tab: 'competitor_youtube', icon: Play },
    { id: 'newsletter_intel',  label: 'Newsletter',        tab: 'newsletter_intel',  icon: Mail },
    { id: 'tech_stack',        label: 'Tech Stack',        tab: 'tech_stack',        icon: Layers },
    { id: 'competitor_watch',  label: 'Watch (alerts)',    tab: 'competitor_watch',  icon: Eye },
    { id: 'competitors',       label: 'Competitors',       tab: 'competitors',       icon: Globe },
    { id: 'comp_map',          label: 'Competitor Maps',   tab: 'competitor_map',    icon: Map },
    { id: 'scorecard',         label: 'Scorecard',         tab: 'scorecard',         icon: Shield },
  ]},
  { label: 'AI Search', items: [
    { id: 'aeo_visibility',    label: 'AEO Visibility',    tab: 'aeo_visibility',    icon: Sparkles },
    { id: 'aeo',               label: 'AEO Research',      tab: 'aeo',               icon: Brain },
    { id: 'multi_aeo',         label: 'Multi-Engine AEO',  tab: 'multi_engine_aeo',  icon: Sparkles },
    { id: 'brand_serp',        label: 'Brand SERP',        tab: 'brand_serp',        icon: Search },
  ]},
  { label: 'Strategy & Authority', items: [
    { id: 'strategy',          label: 'Strategic Plan',    tab: 'strategy',          icon: Target },
    { id: 'competitors',       label: 'Competitors',       tab: 'competitors',       icon: Globe },
    { id: 'comp_map',          label: 'Competitor Maps',   tab: 'competitor_map',    icon: Map },
    { id: 'backlinks',         label: 'Backlinks',         tab: 'backlinks',         icon: Link2 },
    { id: 'link_opps',         label: 'Link Opportunities',tab: 'backlink_opportunities', icon: GitBranch },
    { id: 'eeat',              label: 'E-E-A-T',           tab: 'eeat',              icon: Shield },
    { id: 'kg',                label: 'Knowledge Graph',   tab: 'knowledge_graph',   icon: Layers },
    { id: 'query_paths',       label: 'Query Paths',       tab: 'query_paths',       icon: GitBranch },
  ]},
  { label: 'Content', items: [
    { id: 'autopilot',         label: 'Auto-Pilot',        tab: 'autonomous_pipeline', icon: Zap },
    { id: 'page_factory',      label: 'Page Factory',      tab: 'page_factory',      icon: Layers },
    { id: 'briefs',            label: 'PageIQ Writer',     tab: 'briefs',            icon: FileText },
    { id: 'hyperlocal',        label: 'Hyperlocal Content',tab: 'hyperlocal',        icon: Map },
    { id: 'topical_map',       label: 'Topical Map',       tab: 'topical_map',       icon: Map },
    { id: 'content_health',    label: 'Content Health',    tab: 'content_refresh',   icon: RefreshCw },
    { id: 'semantic',          label: 'KotoIQ Network',    tab: 'semantic',          icon: Brain },
    { id: 'calendar',          label: 'Content Calendar',  tab: 'content_calendar',  icon: Calendar },
  ]},
  { label: 'Technical', items: [
    { id: 'activity',          label: 'Activity',          tab: 'activity',          icon: Activity },
    { id: 'seo_audit',         label: 'SEO Audit',         tab: 'gsc_audit',         icon: Search },
    { id: 'tech_deep',         label: 'Technical Deep',    tab: 'technical_deep',    icon: Code },
    { id: 'schema',            label: 'Schema Markup',     tab: 'schema',            icon: Code },
    { id: 'int_links',         label: 'Internal Links',    tab: 'internal_links',    icon: Link2 },
    { id: 'sitemap',           label: 'Sitemap Crawler',   tab: 'sitemap',           icon: Map },
  ]},
  { label: 'Local & Reviews', items: [
    { id: 'gbp',               label: 'Google Business',   tab: 'gbp',               icon: Globe },
    { id: 'gmb_images',        label: 'GMB Images',        tab: 'gmb_images',        icon: ImageIcon },
    { id: 'rank_grid',         label: 'Rank Grid Pro',     tab: 'rank_grid',         icon: Grid },
    { id: 'reviews',           label: 'Reviews',           tab: 'reviews',           icon: Star },
  ]},
  { label: 'Reports & Tools', items: [
    { id: 'roi',               label: 'ROI Projections',   tab: 'roi',               icon: BarChart2 },
    { id: 'bulk',              label: 'Bulk Operations',   tab: 'bulk_ops',          icon: Layers },
    { id: 'connect',           label: 'Connect APIs',      tab: 'connect',           icon: Settings },
  ]},
]

export default function SideNav({
  currentTab = 'dashboard',
  onSwitchTab,
  clientName,
  clients = [],
  clientId,
  onSwitchClient,
  onLaunchAll,
  launching,
  lastSyncedAgo,
}) {
  const [collapsed, setCollapsed] = useState({
    'Local & Reviews': true,
    'Reports & Tools': false,
  })
  const [pickerOpen, setPickerOpen] = useState(false)

  const toggle = (label) => setCollapsed(p => ({ ...p, [label]: !p[label] }))

  return (
    <aside style={S.aside}>
      <div style={S.brand}>KotoIQ</div>

      {/* Client picker — clicking opens a dropdown of all clients for this agency */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          style={S.clientPicker}
          onClick={() => setPickerOpen(o => !o)}
          title={clientName || 'No client selected'}
        >
          <span style={S.clientName}>{clientName || 'Select client'}</span>
          <ChevronDown size={12} color="#9CA3AF" style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
        </button>
        {pickerOpen && (
          <>
            <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={S.pickerMenu}>
              {(clients || []).length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>No clients</div>
              )}
              {(clients || []).map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSwitchClient && onSwitchClient(c.id)
                    setPickerOpen(false)
                  }}
                  style={{
                    ...S.pickerItem,
                    ...(c.id === clientId ? S.pickerItemActive : null),
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Untitled'}</span>
                  {c.id === clientId && <Check size={12} color="#0E7C7B" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button type="button" onClick={onLaunchAll} disabled={launching} style={{
        ...S.launchBtn,
        opacity: launching ? 0.6 : 1,
        cursor: launching ? 'wait' : 'pointer',
      }}>
        {launching ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} fill="white" />}
        {launching ? 'Running…' : 'Launch All Audits'}
      </button>

      {lastSyncedAgo && (
        <div style={S.lastSync}>
          <span style={S.lastSyncDot} />
          Last synced {lastSyncedAgo}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {NAV_GROUPS.map(group => {
          const isCollapsed = !!collapsed[group.label]
          return (
            <div key={group.label} style={S.navSection}>
              <button onClick={() => toggle(group.label)} style={S.navLabel}>
                <ChevronDown size={10} style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                  transition: 'transform .15s',
                  marginRight: 4,
                  opacity: 0.6,
                }} />
                {group.label}
              </button>
              {!isCollapsed && group.items.map(item => {
                const isActive = item.tab === currentTab
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => onSwitchTab && onSwitchTab(item.tab)}
                    style={{
                      ...S.navItem,
                      ...(isActive ? S.navItemActive : null),
                    }}
                  >
                    <span style={{
                      ...S.navIndicator,
                      visibility: isActive ? 'visible' : 'hidden',
                    }} />
                    {Icon && <Icon size={13} color={isActive ? '#0E7C7B' : '#6B6B70'} strokeWidth={1.75} />}
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </aside>
  )
}

const COLORS = {
  bg:        '#F5F4F2',
  ink:       '#0A0A0A',
  text:      '#1F1F22',
  muted:     '#6B6B70',
  faint:     '#9CA3AF',
  rule:      '#E8E6E1',
  teal:      '#0E7C7B',
  tealBg:    '#E8F4F3',
  green:     '#16A34A',
}

const S = {
  aside: {
    width: 260,
    flexShrink: 0,
    background: COLORS.bg,
    padding: '16px 14px 24px',
    overflowY: 'auto',
    height: '100%',
    fontFamily: SF,
    fontSize: 14,
    color: COLORS.text,
    borderRight: '1px solid ' + COLORS.rule,
  },
  brand: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: COLORS.ink,
    padding: '6px 10px',
    marginBottom: 14,
  },
  clientPicker: {
    width: '100%',
    background: 'white',
    border: '1px solid ' + COLORS.rule,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.ink,
    fontFamily: SF,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    textAlign: 'left',
  },
  pickerMenu: {
    position: 'absolute',
    top: '100%',
    left: 0, right: 0,
    marginTop: 4,
    background: 'white',
    border: '1px solid ' + COLORS.rule,
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,.10)',
    maxHeight: 320,
    overflowY: 'auto',
    zIndex: 41,
    padding: 4,
  },
  pickerItem: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 500,
    color: COLORS.text,
    fontFamily: SF,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    textAlign: 'left',
  },
  pickerItemActive: {
    background: COLORS.tealBg,
    color: COLORS.teal,
    fontWeight: 600,
  },
  clientName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  launchBtn: {
    width: '100%',
    background: COLORS.ink,
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '11px 14px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: SF,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lastSync: {
    fontSize: 12,
    color: COLORS.faint,
    padding: '12px 10px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  lastSyncDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: COLORS.green,
    display: 'inline-block',
  },
  navSection: {
    marginBottom: 18,
  },
  navLabel: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: COLORS.faint,
    fontFamily: SF,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 10px 6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    textAlign: 'left',
  },
  navItem: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: COLORS.text,
    fontFamily: SF,
    fontSize: 14,
    fontWeight: 500,
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 6,
    textAlign: 'left',
  },
  navItemActive: {
    background: COLORS.tealBg,
    color: COLORS.teal,
    fontWeight: 700,
  },
  navIndicator: {
    width: 4, height: 4,
    borderRadius: '50%',
    background: COLORS.teal,
    flexShrink: 0,
  },
}
