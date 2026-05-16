"use client"
// ─────────────────────────────────────────────────────────────────────────
// Campaigns — easy-to-read directory of every Page Factory rollout.
//
// Groups kotoiq_page_suggestions rows by metadata.campaign_label OR the
// strategy_generated_at timestamp (one campaign per local-strategist run).
// Each campaign shows progress (suggested → built → published), drilling
// down to a sortable list of pages. Built-but-not-yet-published briefs
// have a quick "Publish to WP" action that calls publish_brief_to_wp.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import {
  FolderOpen, Loader2, RefreshCw, ChevronDown, ChevronUp,
  ExternalLink, FileText, Send, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

const STATUS_COLORS = {
  suggested:  '#6b6789',
  accepted:   '#2563eb',
  generating: '#D97706',
  built:      '#a855f7',
  published:  '#16a34a',
  dismissed:  '#9d9ab3',
}
const STATUS_LABELS = {
  suggested:  'Queued',
  accepted:   'Approved',
  generating: 'Generating',
  built:      'Built',
  published:  'Published',
  dismissed:  'Skipped',
}

async function api(action, body = {}) {
  const r = await fetch('/api/kotoiq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return r.json()
}

export default function CampaignsTab({ clientId, agencyId }) {
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [openKey, setOpenKey] = useState(null)
  const [running, setRunning] = useState(null)      // suggestion id currently being published

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const r = await api('list_page_campaigns', { client_id: clientId })
      if (r.error) throw new Error(r.error)
      setCampaigns(r.campaigns || [])
    } catch (e) {
      toast.error(e.message || 'Failed to load campaigns')
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  const runBulk = async (campaign) => {
    const ids = campaign.pages.filter(p => p.status === 'suggested' || p.status === 'accepted').map(p => p.id)
    if (ids.length === 0) { toast.error('Nothing pending in this campaign'); return }
    const limit = 5
    setRunning(`bulk:${campaign.key}`)
    try {
      const r = await api('bulk_generate_pages', {
        client_id: clientId, agency_id: agencyId,
        suggestion_ids: ids.slice(0, limit),
        campaign_label: campaign.label,
      })
      if (r.error) throw new Error(r.error)
      const ok = (r.generated || []).length
      const failed = (r.failed || []).length
      toast.success(`Built ${ok}${failed ? `, ${failed} failed` : ''} · ${r.remaining || 0} remaining`)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Bulk build failed')
    } finally { setRunning(null) }
  }

  const publish = async (page) => {
    const brief_id = page.metadata?.brief_id
    if (!brief_id) { toast.error('No brief found on this page'); return }
    setRunning(`pub:${page.id}`)
    try {
      const r = await api('publish_brief_to_wp', {
        client_id: clientId, agency_id: agencyId, brief_id,
      })
      if (!r.ok || r.error) throw new Error(r.error || 'Publish failed')
      toast.success(`Published → ${r.url}`)
      // Reflect locally then refresh from server
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Publish failed')
    } finally { setRunning(null) }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderOpen size={16} color="var(--koto-pink)" />
          <span style={S.toolbarTitle}>{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</span>
        </div>
        <button onClick={refresh} disabled={loading} style={S.ghostBtn}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      {loading && campaigns.length === 0 && (
        <div style={S.empty}>
          <Loader2 size={18} className="animate-spin" style={{ marginBottom: 10, color: 'var(--koto-muted)' }} />
          <div>Loading campaigns…</div>
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div style={S.empty}>
          <FolderOpen size={28} color="var(--koto-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--koto-navy)', letterSpacing: '.02em', marginBottom: 6 }}>
            No campaigns yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--koto-muted)', maxWidth: 480, lineHeight: 1.55 }}>
            Run a Local Strategist plan in Page Factory or ask Atlas Brain to seed a hyperlocal rollout. Every batch of page suggestions shows up here as one campaign you can build out and deploy.
          </div>
        </div>
      )}

      {campaigns.map(c => (
        <CampaignCard
          key={c.key}
          campaign={c}
          open={openKey === c.key}
          onToggle={() => setOpenKey(openKey === c.key ? null : c.key)}
          onRunBulk={() => runBulk(c)}
          onPublish={publish}
          running={running}
        />
      ))}
    </div>
  )
}

function CampaignCard({ campaign, open, onToggle, onRunBulk, onPublish, running }) {
  const { label, generated_at, total, status_counts, pages } = campaign
  const pending   = (status_counts.suggested || 0) + (status_counts.accepted || 0)
  const built     = status_counts.built     || 0
  const published = status_counts.published || 0
  const progressPct = total > 0 ? Math.round(((built + published) / total) * 100) : 0

  return (
    <div style={S.card}>
      <button onClick={onToggle} style={S.cardHeader}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--koto-pink)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 6 }}>
            CAMPAIGN
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'var(--koto-navy)', letterSpacing: '.02em', lineHeight: 1 }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--koto-muted)', marginTop: 6 }}>
            {new Date(generated_at).toLocaleString()} · {total} page{total === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(status_counts)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <span key={k} style={{
                  ...S.chip,
                  background: STATUS_COLORS[k] + '14',
                  color: STATUS_COLORS[k],
                  border: `1px solid ${STATUS_COLORS[k]}40`,
                }}>
                  {STATUS_LABELS[k] || k} {n}
                </span>
              ))}
          </div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--koto-muted)' }}>{progressPct}% complete</div>
        </div>

        <div style={{ flexShrink: 0, marginLeft: 10 }}>
          {open ? <ChevronUp size={16} color="var(--koto-muted)" /> : <ChevronDown size={16} color="var(--koto-muted)" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '4px 18px 18px' }}>
          {pending > 0 && (
            <div style={S.banner}>
              <Zap size={13} color="var(--koto-pink)" />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--koto-navy)', fontWeight: 500 }}>
                {pending} page{pending === 1 ? '' : 's'} ready to build. Click Build to generate up to 5 briefs now.
              </span>
              <button
                onClick={onRunBulk}
                disabled={running === `bulk:${campaign.key}`}
                style={S.primaryBtn}
              >
                {running === `bulk:${campaign.key}`
                  ? <><Loader2 size={13} className="animate-spin" /> Building…</>
                  : <><Zap size={13} /> Build 5</>}
              </button>
            </div>
          )}

          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>URL</th>
                <th style={S.thCenter}>Priority</th>
                <th style={S.thCenter}>Status</th>
                <th style={S.thRight}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(p => (
                <PageRow
                  key={p.id}
                  page={p}
                  onPublish={() => onPublish(p)}
                  publishing={running === `pub:${p.id}`}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PageRow({ page, onPublish, publishing }) {
  const meta = page.metadata || {}
  const url = meta.url || (page.service ? `/${page.service}/${page.state}/${page.city}/`.toLowerCase() : '(no url)')
  const briefId = meta.brief_id
  return (
    <tr style={S.tr}>
      <td style={S.td}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <code style={{ fontSize: 12, color: 'var(--koto-navy)', fontFamily: 'var(--font-mono, monospace)' }}>{url}</code>
          {meta.h1 && <span style={{ fontSize: 11, color: 'var(--koto-muted)' }}>{meta.h1}</span>}
        </div>
      </td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor(page.priority) }}>
          P{priorityBucket(page.priority)}
        </span>
      </td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        <span style={{ ...S.chip, background: STATUS_COLORS[page.status] + '14', color: STATUS_COLORS[page.status], border: `1px solid ${STATUS_COLORS[page.status]}40` }}>
          {STATUS_LABELS[page.status] || page.status}
        </span>
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        {page.status === 'built' && briefId && (
          <button onClick={onPublish} disabled={publishing} style={S.miniPrimary}>
            {publishing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {page.status === 'published' && meta.published_url && (
          <a href={meta.published_url} target="_blank" rel="noopener noreferrer" style={S.miniGhost}>
            <ExternalLink size={11} /> Live
          </a>
        )}
        {page.status === 'generating' && (
          <span style={{ fontSize: 11, color: 'var(--koto-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Loader2 size={11} className="animate-spin" /> …
          </span>
        )}
        {briefId && (page.status === 'built' || page.status === 'published') && (
          <a href={`/kotoiq?tab=briefs&brief_id=${briefId}`} style={{ ...S.miniGhost, marginLeft: 6 }}>
            <FileText size={11} /> Brief
          </a>
        )}
      </td>
    </tr>
  )
}

function priorityBucket(p) {
  if (p >= 90) return 0
  if (p >= 70) return 1
  if (p >= 40) return 2
  return 3
}
function priorityColor(p) {
  const colors = ['#cb1c6b', '#D97706', '#2563EB', '#6b6789']
  return colors[priorityBucket(p)]
}

const S = {
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
    gap: 12, padding: '12px 18px', marginBottom: 14,
    background: '#fff', border: '1px solid var(--koto-line)', borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
  },
  toolbarTitle: { fontSize: 14, fontWeight: 600, color: 'var(--koto-navy)', fontFamily: SF },
  ghostBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', background: '#fff',
    border: '1px solid var(--koto-line)', borderRadius: 8,
    fontSize: 12, fontWeight: 500, color: 'var(--koto-navy)',
    fontFamily: SF, cursor: 'pointer',
  },
  empty: {
    padding: '60px 30px', textAlign: 'center',
    background: '#fff', borderRadius: 12, border: '1px solid var(--koto-line)',
    color: 'var(--koto-muted)', fontFamily: SF, fontSize: 13,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  card: {
    background: '#fff', borderRadius: 14, border: '1px solid var(--koto-line)',
    marginBottom: 12,
    boxShadow: '0 4px 24px rgba(32, 27, 81, .04)',
    fontFamily: SF, overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 16,
    width: '100%', padding: '18px 20px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: SF, textAlign: 'left',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
    letterSpacing: '.02em', fontFamily: SF,
  },
  progressTrack: {
    width: 160, height: 5, background: 'var(--koto-line)', borderRadius: 999, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: 'var(--koto-pink)', transition: 'width 400ms ease-out',
  },
  banner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: 'rgba(203, 28, 107, 0.05)',
    border: '1px solid rgba(203, 28, 107, 0.18)', borderRadius: 10,
    marginBottom: 14,
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', background: 'var(--koto-pink)', color: '#fff',
    border: 'none', borderRadius: 9999, fontSize: 12, fontWeight: 600,
    letterSpacing: '.06em', textTransform: 'uppercase',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(203,28,107,.22)',
    fontFamily: SF,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: SF, fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: 'var(--koto-muted)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--koto-line)' },
  thCenter: { textAlign: 'center', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: 'var(--koto-muted)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--koto-line)' },
  thRight: { textAlign: 'right', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: 'var(--koto-muted)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--koto-line)' },
  tr: { borderBottom: '1px solid var(--koto-line)' },
  td: { padding: '10px 8px', color: 'var(--koto-navy)', verticalAlign: 'top' },
  miniPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', background: 'var(--koto-pink)', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: SF,
  },
  miniGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', background: '#fff', color: 'var(--koto-navy)',
    border: '1px solid var(--koto-line)', borderRadius: 6,
    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: SF, textDecoration: 'none',
  },
}
