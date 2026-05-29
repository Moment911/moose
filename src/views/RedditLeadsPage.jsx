// ─────────────────────────────────────────────────────────────
// RedditLeadsPage — Reddit lead-gen v0 (dogfood)
//
// Find buyer-intent Reddit threads → AI-score → AI-draft a reply → a HUMAN
// reviews + posts manually. No auto-posting.
//
// Flow: pick client → set subreddits/keywords → Refresh feed → work the
// ranked list (Draft → Copy → mark Posted/Skipped).
//
// Styling follows DESIGN.md tokens (navy/pink/cream, Bebas Neue title,
// JetBrains Mono for the score numerals).
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getClients } from '../lib/supabase'

const C = {
  navy: '#201b51',
  pink: '#cb1c6b',
  warm: '#faf9f6',
  off: '#f5f3ee',
  white: '#ffffff',
  line: 'rgba(32,27,81,.12)',
  muted: '#6b6789',
  faint: '#9d9ab3',
  success: '#0d9e6e',
  display: "'Bebas Neue','Arial Narrow',sans-serif",
  body: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
  mono: "'JetBrains Mono','SF Mono',Menlo,monospace",
}

function scoreColor(s) {
  if (s >= 80) return C.pink
  if (s >= 51) return '#c47a16'
  return C.faint
}

async function api(body) {
  const res = await fetch('/api/reddit-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export default function RedditLeadsPage() {
  const { agencyId } = useAuth()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [subreddits, setSubreddits] = useState('')
  const [keywords, setKeywords] = useState('')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [drafting, setDrafting] = useState({}) // id -> bool

  // Load the agency's clients.
  useEffect(() => {
    if (!agencyId) return
    getClients(agencyId).then(({ data }) => setClients(data || []))
  }, [agencyId])

  // When a client is picked, load its config + stored leads.
  useEffect(() => {
    if (!agencyId || !clientId) return
    setError('')
    setLoading(true)
    Promise.all([
      api({ action: 'get_config', agency_id: agencyId, client_id: clientId }),
      api({ action: 'list', agency_id: agencyId, client_id: clientId }),
    ])
      .then(([cfg, list]) => {
        setSubreddits((cfg.config?.subreddits || []).join(', '))
        setKeywords((cfg.config?.keywords || []).join(', '))
        setLeads(list.leads || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [agencyId, clientId])

  const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function saveConfig() {
    setError('')
    try {
      await api({
        action: 'save_config',
        agency_id: agencyId,
        client_id: clientId,
        subreddits: csv(subreddits),
        keywords: csv(keywords),
      })
      setSavedNote('Saved')
      setTimeout(() => setSavedNote(''), 1800)
    } catch (e) {
      setError(e.message)
    }
  }

  async function refresh() {
    setError('')
    setRefreshing(true)
    try {
      await saveConfig()
      const res = await api({ action: 'refresh_feed', agency_id: agencyId, client_id: clientId })
      setLeads(res.leads || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  async function draft(id) {
    setDrafting((d) => ({ ...d, [id]: true }))
    setError('')
    try {
      const res = await api({ action: 'draft', agency_id: agencyId, id })
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, draft_reply: res.draft, status: l.status === 'new' ? 'drafted' : l.status } : l)))
    } catch (e) {
      setError(e.message)
    } finally {
      setDrafting((d) => ({ ...d, [id]: false }))
    }
  }

  async function setStatus(id, status) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)))
    try {
      await api({ action: 'update_status', agency_id: agencyId, id, status })
    } catch (e) {
      setError(e.message)
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 8,
    fontFamily: C.body, fontSize: 14, background: C.white, color: C.navy, boxSizing: 'border-box',
  }

  return (
    <div style={{ flex: 1, padding: 40, background: C.warm, minHeight: '100vh', fontFamily: C.body, color: C.navy }}>
      {/* Header */}
      <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: C.muted }}>
        // Lead Gen
      </div>
      <h1 style={{ fontFamily: C.display, fontSize: 44, fontWeight: 400, letterSpacing: '.02em', margin: '0 0 4px' }}>
        REDDIT LEADS
      </h1>
      <p style={{ color: C.muted, fontSize: 14, margin: '0 0 24px', maxWidth: 620 }}>
        Find buyer-intent threads, score them, draft a reply in the brand voice. You review and
        post manually from a real account — nothing auto-posts.
      </p>

      {/* Controls */}
      <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: 20, marginBottom: 24, maxWidth: 820 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted, marginBottom: 6 }}>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.business_name || c.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted, marginBottom: 6 }}>Subreddits (comma-separated)</label>
            <input style={inputStyle} value={subreddits} onChange={(e) => setSubreddits(e.target.value)} placeholder="hvacadvice, phoenix, homeowners" disabled={!clientId} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted, marginBottom: 6 }}>Keywords (comma-separated)</label>
            <input style={inputStyle} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="AC not cooling, hvac recommendation" disabled={!clientId} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={refresh}
            disabled={!clientId || refreshing}
            style={{ background: C.pink, color: C.white, border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: clientId && !refreshing ? 'pointer' : 'not-allowed', fontFamily: C.body, opacity: !clientId ? 0.5 : 1 }}
          >
            {refreshing ? 'Searching Reddit…' : 'Refresh feed'}
          </button>
          <button
            onClick={saveConfig}
            disabled={!clientId}
            style={{ background: 'none', color: C.navy, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: clientId ? 'pointer' : 'not-allowed', fontFamily: C.body }}
          >
            Save config
          </button>
          {savedNote && <span style={{ color: C.success, fontSize: 13, fontWeight: 600 }}>{savedNote}</span>}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(203,28,107,.06)', border: `1px solid ${C.pink}`, color: C.pink, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, maxWidth: 820 }}>
          {error}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div style={{ color: C.muted, fontSize: 14 }}>Loading…</div>
      ) : !clientId ? (
        <div style={{ color: C.faint, fontSize: 14 }}>Pick a client to begin.</div>
      ) : leads.length === 0 ? (
        <div style={{ color: C.faint, fontSize: 14 }}>No threads yet. Set subreddits + keywords and hit Refresh feed.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
          {leads.map((l) => (
            <div key={l.id} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, opacity: l.status === 'skipped' ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Score badge */}
                <div style={{ textAlign: 'center', minWidth: 56 }}>
                  <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 600, color: scoreColor(l.intent_score) }}>{l.intent_score ?? 0}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint }}>AI-est.</div>
                </div>
                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 12, color: C.muted }}>r/{l.subreddit}</span>
                    <StatusPill status={l.status} />
                  </div>
                  <a href={l.thread_url} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 600, color: C.navy, textDecoration: 'none', display: 'block', marginBottom: 4 }}>
                    {l.title}
                  </a>
                  {l.intent_reason && <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>{l.intent_reason}</div>}

                  {l.draft_reply ? (
                    <div style={{ background: C.off, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, marginTop: 8 }}>
                      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l.draft_reply}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => copy(l.draft_reply)} style={miniBtn(C)}>Copy</button>
                        <button onClick={() => draft(l.id)} disabled={drafting[l.id]} style={miniBtn(C)}>{drafting[l.id] ? 'Redrafting…' : 'Redraft'}</button>
                        <button onClick={() => setStatus(l.id, 'posted')} style={{ ...miniBtn(C), color: C.success, borderColor: C.success }}>Mark posted</button>
                        <button onClick={() => setStatus(l.id, 'skipped')} style={miniBtn(C)}>Skip</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => draft(l.id)} disabled={drafting[l.id]} style={{ background: C.navy, color: C.white, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.body }}>
                        {drafting[l.id] ? 'Drafting…' : 'Draft reply'}
                      </button>
                      <button onClick={() => setStatus(l.id, 'skipped')} style={miniBtn(C)}>Skip</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function miniBtn(C) {
  return { background: 'none', color: C.navy, border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.body }
}

function StatusPill({ status }) {
  const map = {
    new: { bg: 'rgba(32,27,81,.06)', fg: '#6b6789', label: 'NEW' },
    drafted: { bg: 'rgba(196,122,22,.1)', fg: '#c47a16', label: 'DRAFTED' },
    posted: { bg: 'rgba(13,158,110,.1)', fg: '#0d9e6e', label: 'POSTED' },
    skipped: { bg: 'rgba(157,154,179,.12)', fg: '#9d9ab3', label: 'SKIPPED' },
  }
  const s = map[status] || map.new
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', padding: '2px 7px', borderRadius: 4 }}>{s.label}</span>
  )
}
