"use client";
import { useEffect, useMemo, useState } from 'react'
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail,
  Mail, MailOpen, MailCheck, Forward,
  MessageSquare,
  Calendar, CalendarCheck, CalendarX,
  FileText, FileCheck, FileX, Receipt, PenLine,
  Eye, TrendingUp, Tag, UserCheck, StickyNote,
  ShieldCheck, ShieldAlert,
  GitBranch, Sparkles, Globe,
  ChevronDown, ChevronRight, Loader2, AlertCircle,
} from 'lucide-react'

// ── Icon + label mapping ─────────────────────────────────────────────────
// Keep in sync with the recommended activity_type taxonomy in migration
// 20260509_scout_spine.sql. Unknown types render a default icon.
const ACTIVITY_META = {
  call_inbound:       { icon: PhoneIncoming, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Inbound call' },
  call_outbound:      { icon: PhoneOutgoing, color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'Outbound call' },
  call_missed:        { icon: PhoneMissed,   color: 'text-red-500',     bg: 'bg-red-50',     label: 'Missed call' },
  call_voicemail:     { icon: Voicemail,     color: 'text-slate-600',   bg: 'bg-slate-100',  label: 'Voicemail' },
  email_sent:         { icon: Mail,          color: 'text-indigo-600',  bg: 'bg-indigo-50',  label: 'Email sent' },
  email_opened:       { icon: MailOpen,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  label: 'Email opened' },
  email_replied:      { icon: MailCheck,     color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Email replied' },
  email_forwarded:    { icon: Forward,       color: 'text-amber-600',   bg: 'bg-amber-50',   label: 'Email forwarded' },
  email_bounced:      { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-50',     label: 'Email bounced' },
  sms_sent:           { icon: MessageSquare, color: 'text-teal-600',    bg: 'bg-teal-50',    label: 'SMS sent' },
  sms_received:       { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'SMS received' },
  sms_delivered:      { icon: MessageSquare, color: 'text-teal-600',    bg: 'bg-teal-50',    label: 'SMS delivered' },
  sms_failed:         { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-50',     label: 'SMS failed' },
  meeting_scheduled:  { icon: Calendar,      color: 'text-purple-600',  bg: 'bg-purple-50',  label: 'Meeting scheduled' },
  meeting_rescheduled:{ icon: Calendar,      color: 'text-amber-600',   bg: 'bg-amber-50',   label: 'Meeting rescheduled' },
  meeting_held:       { icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Meeting held' },
  meeting_no_show:    { icon: CalendarX,     color: 'text-red-500',     bg: 'bg-red-50',     label: 'No-show' },
  stage_changed:      { icon: GitBranch,     color: 'text-slate-600',   bg: 'bg-slate-100',  label: 'Stage changed' },
  assigned:           { icon: UserCheck,     color: 'text-slate-600',   bg: 'bg-slate-100',  label: 'Assigned' },
  tag_added:          { icon: Tag,           color: 'text-slate-600',   bg: 'bg-slate-100',  label: 'Tag added' },
  tag_removed:        { icon: Tag,           color: 'text-slate-500',   bg: 'bg-slate-100',  label: 'Tag removed' },
  note_added:         { icon: StickyNote,    color: 'text-amber-600',   bg: 'bg-amber-50',   label: 'Note' },
  intent_signal:      { icon: TrendingUp,    color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', label: 'Intent signal' },
  enrichment_update:  { icon: Sparkles,      color: 'text-violet-600',  bg: 'bg-violet-50',  label: 'Profile enriched' },
  score_change:       { icon: TrendingUp,    color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'Score changed' },
  dnc_scrub:          { icon: ShieldAlert,   color: 'text-red-500',     bg: 'bg-red-50',     label: 'DNC scrub' },
  consent_captured:   { icon: ShieldCheck,   color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Consent captured' },
}

const DOC_META = {
  proposal:       { icon: FileText,  color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Proposal' },
  agreement:      { icon: FileText,  color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Agreement' },
  sow:            { icon: FileText,  color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'SOW' },
  nda:            { icon: FileText,  color: 'text-slate-600',  bg: 'bg-slate-100', label: 'NDA' },
  invoice:        { icon: Receipt,   color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Invoice' },
  discovery_doc:  { icon: FileText,  color: 'text-teal-600',   bg: 'bg-teal-50',   label: 'Discovery doc' },
  quote:          { icon: FileText,  color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Quote' },
  contract:       { icon: FileText,  color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Contract' },
  receipt:        { icon: Receipt,   color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Receipt' },
}

const DOC_STATUS_META = {
  draft:     { icon: FileText,  color: 'text-slate-500',   label: 'Draft' },
  sent:      { icon: FileText,  color: 'text-indigo-600',  label: 'Sent' },
  viewed:    { icon: Eye,       color: 'text-indigo-600',  label: 'Viewed' },
  accepted:  { icon: FileCheck, color: 'text-emerald-600', label: 'Accepted' },
  rejected:  { icon: FileX,     color: 'text-red-500',     label: 'Rejected' },
  signed:    { icon: PenLine,   color: 'text-emerald-600', label: 'Signed' },
  paid:      { icon: Receipt,   color: 'text-emerald-600', label: 'Paid' },
  expired:   { icon: FileX,     color: 'text-slate-500',   label: 'Expired' },
  void:      { icon: FileX,     color: 'text-slate-500',   label: 'Void' },
}

const DEFAULT_META = { icon: StickyNote, color: 'text-slate-500', bg: 'bg-slate-100', label: 'Activity' }

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

function formatAbsolute(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatMoney(n) {
  if (n === null || n === undefined) return null
  const num = Number(n)
  if (Number.isNaN(num)) return null
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}

// ── Timeline item renderers ──────────────────────────────────────────────

function ActivityRow({ item, expanded, onToggle }) {
  const meta = ACTIVITY_META[item.activity_type] || { ...DEFAULT_META, label: item.activity_type || 'Activity' }
  const Icon = meta.icon
  const md = item.metadata || {}
  const hasTranscript = typeof md.transcript === 'string' && md.transcript.length > 0
  const hasDetails = hasTranscript || Object.keys(md).some(k => k !== 'transcript' && md[k] !== null && md[k] !== undefined && md[k] !== '')

  return (
    <div className="flex gap-3">
      <div className={`shrink-0 h-9 w-9 rounded-full ${meta.bg} ${meta.color} flex items-center justify-center`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b border-slate-100 last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900">{meta.label}</div>
            {item.description && (
              <div className="text-sm text-slate-600 mt-0.5 break-words">{item.description}</div>
            )}
          </div>
          <div className="shrink-0 text-xs text-slate-500" title={formatAbsolute(item.at)}>
            {formatRelative(item.at)}
          </div>
        </div>
        {hasDetails && (
          <button
            onClick={onToggle}
            className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
        {expanded && hasDetails && (
          <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-2">
            {hasTranscript && (
              <div>
                <div className="font-semibold text-slate-800 mb-1">Transcript</div>
                <pre className="whitespace-pre-wrap font-sans leading-relaxed text-slate-700">{md.transcript}</pre>
              </div>
            )}
            {Object.entries(md)
              .filter(([k, v]) => k !== 'transcript' && v !== null && v !== undefined && v !== '')
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-semibold text-slate-800 shrink-0">{k}:</span>
                  <span className="break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PageViewRow({ item }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 h-9 w-9 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
        <Globe className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b border-slate-100 last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">
              {item.page_title || 'Page view'}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-700 hover:underline break-all"
            >
              {item.url}
            </a>
            <div className="text-xs text-slate-500 mt-0.5">
              {item.duration_seconds ? `${item.duration_seconds}s on page` : 'Visited'}
              {item.referrer ? ` · from ${item.referrer}` : ''}
            </div>
          </div>
          <div className="shrink-0 text-xs text-slate-500" title={formatAbsolute(item.at)}>
            {formatRelative(item.at)}
          </div>
        </div>
      </div>
    </div>
  )
}

function DocumentRow({ item, onClick }) {
  const typeMeta = DOC_META[item.document_type] || { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100', label: item.document_type || 'Document' }
  const Icon = typeMeta.icon
  const status = item.status || 'draft'
  const statusMeta = DOC_STATUS_META[status] || { color: 'text-slate-500', label: status }
  const money = formatMoney(item.total_value)
  const clickable = onClick || item.external_url

  const inner = (
    <>
      <div className={`shrink-0 h-9 w-9 rounded-full ${typeMeta.bg} ${typeMeta.color} flex items-center justify-center`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b border-slate-100 last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900">
              {typeMeta.label}{item.title ? ` — ${item.title}` : ''}
            </div>
            <div className={`text-xs ${statusMeta.color} mt-0.5 font-medium`}>
              {statusMeta.label}
              {money ? ` · ${money}` : ''}
            </div>
            {(item.sent_at || item.viewed_at || item.accepted_at) && (
              <div className="text-xs text-slate-500 mt-0.5 space-x-2">
                {item.sent_at && <span>Sent {formatRelative(item.sent_at)}</span>}
                {item.viewed_at && <span>· Viewed {formatRelative(item.viewed_at)}</span>}
                {item.accepted_at && <span>· Accepted {formatRelative(item.accepted_at)}</span>}
              </div>
            )}
          </div>
          <div className="shrink-0 text-xs text-slate-500" title={formatAbsolute(item.at)}>
            {formatRelative(item.at)}
          </div>
        </div>
      </div>
    </>
  )

  if (onClick) {
    return <button type="button" onClick={() => onClick(item)} className="flex gap-3 w-full text-left hover:bg-slate-50 -mx-2 px-2 rounded">{inner}</button>
  }
  if (item.external_url) {
    return <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:bg-slate-50 -mx-2 px-2 rounded">{inner}</a>
  }
  return <div className="flex gap-3">{inner}</div>
}

// ── Main component ──────────────────────────────────────────────────────

export default function OpportunityTimeline({
  opportunityId,
  limit = 200,
  onDocumentClick,
  className = '',
  filterKinds,
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())

  useEffect(() => {
    if (!opportunityId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/scout/timeline?opportunity_id=${encodeURIComponent(opportunityId)}&limit=${limit}`, {
      credentials: 'include',
    })
      .then(r => r.json().then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) {
          setError(body?.error || 'Failed to load timeline')
          setItems([])
        } else {
          setItems(body.items || [])
          setCounts(body.counts || null)
        }
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Network error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [opportunityId, limit])

  const filtered = useMemo(() => {
    if (!filterKinds || filterKinds.length === 0) return items
    return items.filter(i => filterKinds.includes(i.kind))
  }, [items, filterKinds])

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!opportunityId) {
    return <div className={`text-sm text-slate-500 ${className}`}>No opportunity selected.</div>
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-600 ${className}`}>
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    )
  }

  if (filtered.length === 0) {
    return <div className={`text-sm text-slate-500 ${className}`}>No activity yet.</div>
  }

  return (
    <div className={className}>
      {counts && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
          <span>{counts.activities} activities</span>
          <span>{counts.page_views} page views</span>
          <span>{counts.documents} documents</span>
        </div>
      )}
      <div className="space-y-0">
        {filtered.map(item => {
          if (item.kind === 'activity') {
            return (
              <ActivityRow
                key={`a-${item.id}`}
                item={item}
                expanded={expanded.has(item.id)}
                onToggle={() => toggle(item.id)}
              />
            )
          }
          if (item.kind === 'page_view') {
            return <PageViewRow key={`v-${item.id}`} item={item} />
          }
          if (item.kind === 'document') {
            return <DocumentRow key={`d-${item.id}`} item={item} onClick={onDocumentClick} />
          }
          return null
        })}
      </div>
    </div>
  )
}
