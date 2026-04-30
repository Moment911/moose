"use client"
import { useState } from 'react'
import {
  Link2, Loader2, CheckCircle, XCircle, Send, Clock,
  Hash, MessageSquare, Save, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const ALERT_TYPES = [
  ['ranking_changes', 'Ranking Changes'],
  ['competitor_events', 'Competitor Events'],
  ['reviews', 'New Reviews'],
  ['weekly_digest', 'Weekly Digest'],
  ['monthly_report', 'Monthly Report'],
]

// ── Integration card (shared for Slack + Teams) ────────────────────────────
function IntegrationCard({ type, label, icon: Icon, color, state, setState, clientId, agencyId }) {
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const toggleAlert = (key) => {
    const next = new Set(state.alert_types)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setState({ ...state, alert_types: Array.from(next) })
  }

  const save = async () => {
    if (!state.webhook_url) { toast.error('Webhook URL required'); return }
    setSaving(true)
    try {
      const body = {
        action: type === 'slack' ? 'setup_slack_integration' : 'setup_teams_integration',
        webhook_url: state.webhook_url,
        alert_types: state.alert_types,
      }
      if (clientId) body.client_id = clientId
      else if (agencyId) body.agency_id = agencyId
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success(`${label} connected`)
      setState({ ...state, connected: true })
    } catch (e) {
      toast.error(e.message || 'Failed to connect')
    } finally {
      setSaving(false)
    }
  }

  const testMessage = async () => {
    if (!state.webhook_url) { toast.error('Add a webhook URL first'); return }
    setTesting(true)
    try {
      // Use daily digest as a simple test ping (uses existing config)
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_daily_digest',
          ...(clientId ? { client_id: clientId } : { agency_id: agencyId }),
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Test message sent')
    } catch (e) {
      toast.error(e.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const disconnect = () => {
    if (!confirm(`Disconnect ${label}?`)) return
    setState({ webhook_url: '', alert_types: state.alert_types, connected: false })
    toast.success(`${label} disconnected locally — re-save to reconnect.`)
  }

  return (
    <div style={{ ...card, marginBottom: 0, borderTop: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            {state.connected ? (
              <><CheckCircle size={12} color={GRN} /><span style={{ fontSize: 12, fontWeight: 700, color: GRN }}>Connected</span></>
            ) : (
              <><XCircle size={12} color="#8e8e93" /><span style={{ fontSize: 12, fontWeight: 700, color: '#6b6b70' }}>Not Connected</span></>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', marginBottom: 5, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", textTransform: 'uppercase', letterSpacing: '.05em' }}>Webhook URL</div>
        <input value={state.webhook_url} onChange={e => setState({ ...state, webhook_url: e.target.value })}
          placeholder={type === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://outlook.office.com/webhook/...'}
          style={{
            width: '100%', padding: '9px 12px', border: '1px solid #ececef', borderRadius: 8,
            fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", boxSizing: 'border-box',
          }} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', marginBottom: 8, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", textTransform: 'uppercase', letterSpacing: '.05em' }}>Alert Types</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ALERT_TYPES.map(([key, lbl]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#1f2937' }}>
              <input type="checkbox" checked={state.alert_types.includes(key)} onChange={() => toggleAlert(key)} />
              {lbl}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={save} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8,
          border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
          {state.connected ? 'Update' : 'Save'}
        </button>
        <button onClick={testMessage} disabled={testing || !state.connected} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8,
          border: '1px solid #ececef', background: '#fff', color: '#1f1f22', fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: testing ? 'wait' : (state.connected ? 'pointer' : 'not-allowed'), opacity: testing || !state.connected ? 0.6 : 1,
        }}>
          {testing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
          Test Message
        </button>
        {state.connected && (
          <button onClick={disconnect} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
            border: '1px solid #fecaca', background: '#fff', color: R, fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
            cursor: 'pointer', marginLeft: 'auto',
          }}>
            <Trash2 size={12} /> Disconnect
          </button>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsTab({ clientId, agencyId }) {
  const [slack, setSlack] = useState({ webhook_url: '', alert_types: ['ranking_changes', 'competitor_events', 'weekly_digest'], connected: false })
  const [teams, setTeams] = useState({ webhook_url: '', alert_types: ['weekly_digest', 'monthly_report'], connected: false })
  const [sending, setSending] = useState(false)
  const [history] = useState([]) // TODO: wire to a real feed endpoint when one exists

  const sendDigest = async () => {
    setSending(true)
    try {
      const body = { action: 'send_daily_digest' }
      if (clientId) body.client_id = clientId
      else if (agencyId) body.agency_id = agencyId
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      if (j.reason === 'no_active_integrations') {
        toast.error('Connect Slack or Teams first')
      } else if (j.reason === 'no_clients') {
        toast.error('No clients to digest')
      } else {
        toast.success(`Digest sent (${j.sent || 0} channel${j.sent === 1 ? '' : 's'})`)
      }
    } catch (e) {
      toast.error(e.message || 'Digest failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="integrations" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={20} color="#0a0a0a" /> Integrations
          </div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>
            Pipe KotoIQ alerts into your team's existing tools — Slack, Microsoft Teams, email.
          </div>
        </div>
        <button onClick={sendDigest} disabled={sending} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '12px 22px', borderRadius: 8,
          border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.6 : 1,
        }}>
          {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
          Send Daily Digest Now
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <IntegrationCard
          type="slack" label="Slack" icon={Hash} color="#611f69"
          state={slack} setState={setSlack}
          clientId={clientId} agencyId={agencyId}
        />
        <IntegrationCard
          type="teams" label="Microsoft Teams" icon={MessageSquare} color="#6264a7"
          state={teams} setState={setTeams}
          clientId={clientId} agencyId={agencyId}
        />
      </div>

      <div style={{ ...card, background: 'linear-gradient(135deg,#f0f9ff 0%,#fefce8 100%)', borderLeft: `4px solid ${T}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Clock size={16} color="#0a0a0a" />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK }}>Automated Schedule</div>
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
          Daily digests fire at <strong>9:00 AM</strong> in the client's timezone. Competitor watch checks run on the cadence you set per-watch. Weekly digests ship Monday morning, monthly reports the 1st.
        </div>
      </div>

      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>
          Alert History
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#6b6b70', fontSize: 13 }}>
            No alert history yet. Sent alerts will show up here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.slice(0, 20).map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9f9fb', borderRadius: 8, fontSize: 13 }}>
                {h.status === 'sent' ? <CheckCircle size={14} color={GRN} /> : <XCircle size={14} color="#0a0a0a" />}
                <span style={{ flex: 1 }}>{h.title}</span>
                <span style={{ fontSize: 11, color: '#6b6b70' }}>{new Date(h.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
