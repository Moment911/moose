"use client"
import { useState, useEffect } from 'react'
import {
  Globe, Check, X, Loader2, Link2, Copy, Download, RefreshCw,
  Plug, AlertCircle, CheckCircle, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FH, FB, BLK, GRN, R } from '../../lib/theme'

const API = '/api/wp'

/**
 * WordPress Connection Manager — connect sites, verify, download plugin
 * Lives in KotoIQ Settings tab and Page Factory.
 */
export default function WordPressConnectionManager({ agencyId }) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newKey, setNewKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(null)

  useEffect(() => {
    if (agencyId) loadSites()
  }, [agencyId])

  async function loadSites() {
    setLoading(true)
    try {
      const res = await fetch(`${API}?agency_id=${agencyId}`)
      const data = await res.json()
      setSites(data.sites || [])
    } catch {}
    setLoading(false)
  }

  async function connectSite() {
    if (!newUrl.trim() || !newKey.trim()) {
      toast.error('Enter the site URL and API key')
      return
    }
    setConnecting(true)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          agency_id: agencyId,
          site_url: newUrl.trim(),
          api_key: newKey.trim(),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Site connected')
      setNewUrl('')
      setNewKey('')
      setShowAdd(false)
      loadSites()
    } catch (e) {
      toast.error(e.message || 'Connection failed')
    }
    setConnecting(false)
  }

  async function testConnection(siteId) {
    setTesting(siteId)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          agency_id: agencyId,
          site_id: siteId,
        }),
      })
      const data = await res.json()
      if (data.ok) toast.success('Connection verified')
      else toast.error(data.error || 'Connection failed')
      loadSites()
    } catch (e) {
      toast.error('Connection test failed')
    }
    setTesting(null)
  }

  async function disconnectSite(siteId, siteName) {
    if (!confirm(`Disconnect ${siteName}? Published pages will remain on WordPress.`)) return
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          agency_id: agencyId,
          site_id: siteId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Site disconnected')
      loadSites()
    } catch (e) {
      toast.error(e.message || 'Disconnect failed')
    }
  }

  function copyApiKey(key) {
    navigator.clipboard.writeText(key)
    toast.success('API key copied')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>
            WordPress Connections
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            Connect WordPress sites for page publishing. Install the Koto plugin, paste the API key.
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}>
          <Plug size={14} /> Add Site
        </button>
      </div>

      {/* ── Plugin Download Instructions ────────────────────────── */}
      <div style={{
        background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd',
        padding: 16, marginBottom: 16, fontSize: 13, color: '#0c4a6e', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Setup Instructions
        </div>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>Download <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 4 }}>koto-builder-endpoints.php</code> from the repo's <code>wp-plugin/</code> folder</li>
          <li>Add it to your WordPress site's active Koto plugin directory</li>
          <li>Include it from the main plugin file: <code>require_once __DIR__ . '/koto-builder-endpoints.php';</code></li>
          <li>The plugin will register REST endpoints at <code>/wp-json/koto/v1/builder/*</code></li>
          <li>Enter the site URL and API key below to connect</li>
        </ol>
      </div>

      {/* ── Add Site Form ───────────────────────────────────────── */}
      {showAdd && (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #ececef',
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, marginBottom: 12 }}>
            Connect a WordPress Site
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://example.com"
              style={inputStyle}
            />
            <input
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="API Key from Koto plugin"
              style={{ ...inputStyle, flex: 2 }}
              type="password"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={btnSecondary}>Cancel</button>
            <button onClick={connectSite} disabled={connecting} style={btnPrimary}>
              {connecting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={14} />}
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* ── Connected Sites List ────────────────────────────────── */}
      {sites.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #ececef',
          padding: 40, textAlign: 'center', color: '#6b7280',
        }}>
          <Globe size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No sites connected</div>
          <div style={{ fontSize: 13 }}>Click "Add Site" to connect a WordPress site.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sites.map(site => (
            <div key={site.id} style={{
              background: '#fff', borderRadius: 12, border: '1px solid #ececef',
              padding: '14px 16px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: site.connected ? GRN : '#d1d5db',
                }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {site.site_name || site.site_url}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {site.site_url}
                    {site.last_ping && ` · Last ping: ${new Date(site.last_ping).toLocaleDateString()}`}
                    {site.wp_version && ` · WP ${site.wp_version}`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {site.connected ? (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: '#dcfce7', color: '#166534',
                  }}>
                    <CheckCircle size={12} /> Connected
                  </span>
                ) : (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: '#fecaca', color: '#991b1b',
                  }}>
                    <AlertCircle size={12} /> Disconnected
                  </span>
                )}

                <button
                  onClick={() => testConnection(site.id)}
                  disabled={testing === site.id}
                  style={btnSmall}
                  title="Test connection"
                >
                  {testing === site.id
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <RefreshCw size={13} />
                  }
                </button>

                {site.api_key && (
                  <button onClick={() => copyApiKey(site.api_key)} style={btnSmall} title="Copy API key">
                    <Copy size={13} />
                  </button>
                )}

                <button
                  onClick={() => disconnectSite(site.id, site.site_name || site.site_url)}
                  style={{ ...btnSmall, borderColor: '#fecaca', color: '#dc2626' }}
                  title="Disconnect"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const inputStyle = {
  flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ececef',
  fontSize: 13, fontFamily: FB, outline: 'none',
}

const btnPrimary = {
  padding: '7px 14px', borderRadius: 8, border: 'none',
  background: '#111', color: '#fff', fontSize: 12, fontWeight: 600,
  fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
}

const btnSecondary = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid #ececef',
  background: '#fff', color: BLK, fontSize: 12, fontWeight: 600,
  fontFamily: FH, cursor: 'pointer',
}

const btnSmall = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: '1px solid #ececef', background: '#fff', cursor: 'pointer',
  color: '#6b7280',
}
