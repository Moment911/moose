"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getGHLOAuthURL, CRMAdapter, mooseClientToGHLContact } from '../lib/ghl'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'
import {
  Link2, Check, X, RefreshCw, ExternalLink, Copy, Zap,
  AlertTriangle, Settings, Activity, ArrowRight, Loader2,
  ChevronRight, Globe, Shield, Database, Webhook
} from 'lucide-react'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const PROVIDERS = [
  {
    id: 'gohighlevel', name: 'GoHighLevel', shortName: 'GHL',
    logo: '🟡', color: '#f59e0b',
    desc: 'Sync contacts, opportunities, conversations, appointments, and custom fields. Webhooks for real-time updates.',
    features: ['Contacts sync (bi-directional)', 'Opportunities → Client status', 'Webhook events (50+ types)', 'Custom field mapping', 'SMS/Email via GHL', 'Calendar appointments'],
    docsUrl: 'https://marketplace.gohighlevel.com/docs/',
    category: 'CRM',
  },
  {
    id: 'hubspot', name: 'HubSpot', shortName: 'HubSpot',
    logo: '🟠', color: '#ff7a59',
    desc: 'Sync contacts, deals, companies, and notes. Map Moose client profiles to HubSpot properties.',
    features: ['Contacts & Companies sync', 'Deals pipeline sync', 'Custom properties mapping', 'Timeline events', 'Notes & activities', 'Workflows trigger'],
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    category: 'CRM', comingSoon: true,
  },
  {
    id: 'salesforce', name: 'Salesforce', shortName: 'SF',
    logo: '🔵', color: '#0ea5e9',
    desc: 'Enterprise-grade sync with Salesforce CRM. Leads, contacts, accounts, and opportunities.',
    features: ['Leads & Contacts sync', 'Accounts mapping', 'Opportunities sync', 'Custom objects', 'Apex triggers support', 'SOQL query integration'],
    docsUrl: 'https://developer.salesforce.com/docs/apis',
    category: 'CRM', comingSoon: true,
  },
  {
    id: 'zapier', name: 'Zapier', shortName: 'Zapier',
    logo: '⚡', color: '#ff4a00',
    desc: 'Connect Moose AI to 6,000+ apps via Zapier. Trigger zaps on client events, onboarding completion, and more.',
    features: ['Trigger: Client created', 'Trigger: Onboarding submitted', 'Trigger: Persona generated', 'Action: Create client', 'Action: Update status', 'Works with any Zapier app'],
    docsUrl: 'https://zapier.com/developer/documentation',
    category: 'Automation', comingSoon: true,
  },
  {
    id: 'make', name: 'Make (Integromat)', shortName: 'Make',
    logo: '🟣', color: '#6d28d9',
    desc: 'Visual workflow automation connecting Moose AI to hundreds of apps with advanced logic.',
    features: ['Visual scenario builder', 'Real-time webhooks', 'Data transformation', 'Error handling', 'Schedule triggers', 'Custom HTTP modules'],
    docsUrl: 'https://www.make.com/en/api-documentation',
    category: 'Automation', comingSoon: true,
  },
  {
    id: 'webhook', name: 'Custom Webhook', shortName: 'Webhook',
    logo: '🔗', color: '#10b981',
    desc: 'Send real-time event notifications to any URL. Works with any platform that accepts webhooks.',
    features: ['All Moose events supported', 'HMAC signature verification', 'Retry on failure (3x)', 'Custom headers support', 'Test webhook tool', 'Event filtering'],
    category: 'Custom',
  },
  {
    id: 'rest_api', name: 'REST API', shortName: 'API',
    logo: '📡', color: '#3b82f6',
    desc: "Full programmatic access to all your agency's Moose data. Build your own integrations.",
    features: ['All agency data endpoints', 'Client CRUD', 'Onboarding data', 'Persona data', 'JWT authentication', 'Rate limit: 1000 req/min'],
    category: 'Custom',
  },
]

function StatusBadge({ status }) {
  const cfg = {
    connected:    { color: '#16a34a', bg: '#f0fdf4', label: '● Connected' },
    disconnected: { color: '#4b5563', bg: '#f3f4f6', label: '○ Not Connected' },
    error:        { color: '#dc2626', bg: '#fef2f2', label: '⚠ Error' },
    syncing:      { color: '#d97706', bg: '#fffbeb', label: '↻ Syncing' },
  }
  const c = cfg[status] || cfg.disconnected
  return <span style={{ fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color }}>{c.label}</span>
}

function SyncLog({ logs }) {
  if (!logs?.length) return <div style={{ fontSize: 15, color: '#4b5563', padding: '20px 0', textAlign: 'center' }}>No sync activity yet</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {logs.map(log => (
        <div key={log.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: log.status === 'success' ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{log.action} {log.entity_type} · {log.entity_id?.slice(0, 12)}…</div>
            {log.error_msg && <div style={{ fontSize: 13, color: '#dc2626' }}>{log.error_msg}</div>}
          </div>
          <div style={{ fontSize: 13, color: '#4b5563' }}>{log.direction}</div>
          <div style={{ fontSize: 13, color: '#4b5563' }}>{new Date(log.created_at).toLocaleTimeString()}</div>
        </div>
      ))}
    </div>
  )
}

export default function IntegrationsPage() {
  const { user, agencyId } = useAuth()
  const [agency, setAgency] = useState(null)
  const [integrations, setIntegrations] = useState([])
  const [syncLogs, setSyncLogs] = useState([])
  const [selected, setSelected] = useState(null)
  const [syncing, setSyncing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => { loadData() }, [])

  // Check for OAuth callback result
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'ghl') {
      toast.success('GoHighLevel connected successfully! 🎉')
      window.history.replaceState({}, '', '/integrations')
      loadData()
    }
    if (params.get('error')) {
      toast.error(`Connection failed: ${params.get('error')}`)
      window.history.replaceState({}, '', '/integrations')
    }
  }, [])

  async function loadData() {
    setLoading(true)
    const aid = agencyId || '00000000-0000-0000-0000-000000000099'
    const [{ data: ag }, { data: ints }, { data: logs }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', aid).single(),
      supabase.from('crm_integrations').select('*').eq('agency_id', aid).order('created_at', { ascending: false }),
      supabase.from('crm_sync_log').select('*').eq('agency_id', aid).order('created_at', { ascending: false }).limit(50),
    ])
    setAgency(ag || { id: aid, name: 'Your Agency', plan: 'growth', slug: 'your-agency' })
    setIntegrations(ints || []); setSyncLogs(logs || [])
    setLoading(false)
  }

  function connectGHL() {
    if (!agency) return
    const ghlClientId = process.env.NEXT_PUBLIC_GHL_CLIENT_ID || 'YOUR_GHL_CLIENT_ID'
    const redirectUri = `${appUrl}/api/integrations/ghl/callback`
    const url = getGHLOAuthURL(ghlClientId, redirectUri)
    // Pass agency_id as state parameter for the OAuth callback
    window.location.href = `${url}&state=${agency.id}`
  }

  async function syncAllClients(integrationId) {
    setSyncing(integrationId)
    const integration = integrations.find(i => i.id === integrationId)
    if (!integration) return

    try {
      const { data: clients } = await supabase.from('clients').select('*, client_profiles(*)').eq('agency_id', agency.id).limit(50)
      if (!clients) { setSyncing(null); return }

      const adapter = new CRMAdapter(integration.provider, { access_token: integration.access_token, location_id: integration.location_id })
      let pushed = 0, errors = 0

      for (const client of clients) {
        try {
          const profile = client.client_profiles?.[0] || {}
          const payload = mooseClientToGHLContact(client, profile)
          
          if (client.ghl_contact_id) {
            await adapter.updateContact(client.ghl_contact_id, client, profile)
          } else {
            const result = await adapter.createContact(client, profile)
            const externalId = result.contact?.id || result.id
            if (externalId) {
              await supabase.from('clients').update({ ghl_contact_id: externalId, ghl_location_id: integration.location_id }).eq('id', client.id)
            }
          }
          pushed++
        } catch (e) {
          errors++
          await supabase.from('crm_sync_log').insert({ integration_id: integrationId, agency_id: agency.id, client_id: client.id, direction: 'push', entity_type: 'contact', action: 'update', status: 'error', error_msg: e.message })
        }
      }

      await supabase.from('crm_integrations').update({ last_sync_at: new Date().toISOString(), total_synced: (integration.total_synced || 0) + pushed }).eq('id', integrationId)
      toast.success(`Sync complete: ${pushed} pushed, ${errors} errors`)
      loadData()
    } catch (e) {
      toast.error(`Sync failed: ${e.message}`)
    }
    setSyncing(null)
  }

  async function disconnect(integrationId) {
    if (!confirm('Disconnect this integration? Client links will be preserved but no new syncs will occur.')) return
    await supabase.from('crm_integrations').update({ status: 'disconnected', access_token: null, refresh_token: null }).eq('id', integrationId)
    toast.success('Integration disconnected'); loadData()
  }

  function getIntegration(providerId) {
    return integrations.find(i => i.provider === providerId)
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f4f5' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0 }}>Integrations</h1>
            <p style={{ fontSize: 14, color: '#4b5563', margin: '3px 0 0' }}>Connect Moose AI to your CRM, automation tools, and custom systems</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 14, color: '#4b5563', padding: '6px 14px', borderRadius: 9, background: '#f3f4f6' }}>
              Webhook URL: <code style={{ fontFamily: 'monospace', color: '#374151' }}>{appUrl}/api/webhooks/ghl</code>
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0, height: 'calc(100vh - 65px)' }}>
          {/* Main */}
          <div style={{ overflowY: 'auto', padding: '22px 28px' }}>

            {/* GHL featured integration */}
            <div style={{ background: 'linear-gradient(135deg,#18181b,#1f1f1f)', borderRadius: 18, padding: '24px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #f59e0b15 0%, transparent 70%)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 44 }}>🟡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>GoHighLevel</div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', background: '#f59e0b20', border: '1px solid #f59e0b40', borderRadius: 20, padding: '2px 10px' }}>RECOMMENDED</span>
                    {getIntegration('gohighlevel') && <StatusBadge status={getIntegration('gohighlevel').status} />}
                  </div>
                  <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.6, marginBottom: 16, maxWidth: 580 }}>
                    Full bi-directional sync between Moose AI and GHL. Contacts, opportunities, conversations, appointments, and custom fields. Real-time webhooks for 50+ event types.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                    {['Contacts sync', 'Opportunities', 'Webhooks (50+ events)', 'Custom fields', 'SMS/Email send', 'Calendar sync'].map(f => (
                      <span key={f} style={{ fontSize: 14, fontWeight: 700, color: '#4b5563', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '3px 11px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Check size={10} color="#22c55e" strokeWidth={3} /> {f}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {getIntegration('gohighlevel')?.status === 'connected' ? (
                      <>
                        <button onClick={() => syncAllClients(getIntegration('gohighlevel').id)} disabled={syncing === getIntegration('gohighlevel').id}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#f59e0b', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: syncing ? .7 : 1 }}>
                          {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                          {syncing ? 'Syncing…' : 'Sync All Clients Now'}
                        </button>
                        <button onClick={() => disconnect(getIntegration('gohighlevel').id)}
                          style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#4b5563', fontSize: 15, cursor: 'pointer' }}>
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button onClick={connectGHL}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 9, border: 'none', background: '#f59e0b', color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                        Connect GoHighLevel <ArrowRight size={15} />
                      </button>
                    )}
                    <a href="https://marketplace.gohighlevel.com/docs/" target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#4b5563', fontSize: 15, textDecoration: 'none' }}>
                      <ExternalLink size={12} /> Docs
                    </a>
                  </div>
                  {getIntegration('gohighlevel')?.status === 'connected' && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 16, fontSize: 14, color: '#52525b' }}>
                      <span>Location: <strong style={{ color: '#4b5563' }}>{getIntegration('gohighlevel').location_id}</strong></span>
                      <span>Last sync: <strong style={{ color: '#4b5563' }}>{getIntegration('gohighlevel').last_sync_at ? new Date(getIntegration('gohighlevel').last_sync_at).toLocaleString() : 'Never'}</strong></span>
                      <span>Total synced: <strong style={{ color: '#22c55e' }}>{getIntegration('gohighlevel').total_synced || 0}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Setup guide for GHL */}
            {!getIntegration('gohighlevel') && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 14 }}>📋 How to connect GoHighLevel</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { n: '1', title: 'Create GHL App', desc: 'Go to marketplace.gohighlevel.com → My Apps → Create App', icon: '🏪' },
                    { n: '2', title: 'Set Redirect URI', desc: `Add ${appUrl}/api/integrations/ghl/callback to your app`, icon: '🔗' },
                    { n: '3', title: 'Add Webhook URL', desc: `Set ${appUrl}/api/webhooks/ghl in GHL app Webhooks section`, icon: '📡' },
                    { n: '4', title: 'Click Connect', desc: 'Click Connect GoHighLevel above to authorize via OAuth 2.0', icon: '✅' },
                  ].map(s => (
                    <div key={s.n} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px', border: '1px solid #f3f4f6', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 5 }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other integrations grid */}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>More Integrations</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {PROVIDERS.filter(p => p.id !== 'gohighlevel').map(provider => {
                const integration = getIntegration(provider.id)
                return (
                  <div key={provider.id} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${integration?.status === 'connected' ? provider.color + '40' : '#e5e7eb'}`, padding: '20px 20px', opacity: provider.comingSoon ? .65 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 32 }}>{provider.logo}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{provider.name}</span>
                          {provider.comingSoon && <span style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', background: '#f3f4f6', borderRadius: 20, padding: '1px 7px' }}>SOON</span>}
                          {integration && <StatusBadge status={integration.status} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#4b5563', background: '#f3f4f6', borderRadius: 20, padding: '2px 8px' }}>{provider.category}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.55, marginBottom: 14 }}>{provider.desc}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                      {provider.features.slice(0, 3).map(f => (
                        <div key={f} style={{ display: 'flex', gap: 7, fontSize: 14, color: '#374151' }}>
                          <Check size={12} color={provider.color} strokeWidth={3} style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                        </div>
                      ))}
                    </div>
                    <button disabled={provider.comingSoon || (provider.id === 'rest_api')}
                      onClick={() => provider.id === 'gohighlevel' ? connectGHL() : null}
                      style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${provider.comingSoon ? '#e5e7eb' : provider.color}`, background: provider.comingSoon ? '#f9fafb' : '#fff', color: provider.comingSoon ? '#9ca3af' : provider.color, fontSize: 15, fontWeight: 700, cursor: provider.comingSoon ? 'not-allowed' : 'pointer' }}>
                      {provider.comingSoon ? 'Coming Soon' : integration?.status === 'connected' ? '✓ Connected' : `Connect ${provider.shortName}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right — sync log */}
          <div style={{ borderLeft: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color={ACCENT} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Sync Activity</span>
              <span style={{ fontSize: 13, color: '#4b5563', marginLeft: 'auto' }}>{syncLogs.length} events</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px' }}>
              <SyncLog logs={syncLogs} />
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
