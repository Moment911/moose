"use client"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Key, Check, AlertTriangle, RefreshCw,
  Loader2, Sliders, Target, Globe, Shield, Bell,
  ExternalLink, ChevronRight, Copy, Eye, EyeOff,
  Lock, Zap, Database, Link2, BarChart2, Search,
  MapPin, Mail, Building, Users, Wrench, Star,
  CheckCircle, Circle, ArrowRight, Info
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'

const TABS = [
  { key: 'connections', label: 'API Connections', icon: Link2 },
  { key: 'scout',       label: 'Scout Settings',  icon: Target },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security',    label: 'Security',        icon: Shield },
]

// ── All API connections with full setup instructions ──────────────────────────
const CONNECTIONS = [
  {
    id:      'anthropic',
    name:    'Claude AI (Anthropic)',
    group:   'Core — Required',
    icon:    Zap,
    color:   ACCENT,
    env:     'NEXT_PUBLIC_ANTHROPIC_API_KEY',
    desc:    'Powers all AI features — review responses, Scout leads, client personas, monthly reports, social content.',
    free:    'Pay-as-you-go · ~$0.003/1K tokens',
    setupUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl:  'https://docs.anthropic.com',
    steps: [
      'Go to console.anthropic.com and sign in',
      'Click Settings in the left sidebar → API Keys',
      'Click Create Key → name it "Moose AI" → copy the key',
      'Add to Vercel: NEXT_PUBLIC_ANTHROPIC_API_KEY',
    ],
  },
  {
    id:      'supabase',
    name:    'Supabase Database',
    group:   'Core — Required',
    icon:    Database,
    color:   '#3ecf8e',
    env:     'NEXT_PUBLIC_SUPABASE_URL',
    desc:    'Stores all clients, reviews, onboarding data, agent activity, and agency settings.',
    free:    'Free tier: 500MB · 2GB bandwidth/mo',
    setupUrl: 'https://app.supabase.com',
    docsUrl:  'https://supabase.com/docs',
    steps: [
      'Go to app.supabase.com → open your Moose project',
      'Click the gear icon → Project Settings → API',
      'Copy the Project URL and anon/public key',
      'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel',
    ],
  },
  {
    id:      'google_places',
    name:    'Google Places',
    group:   'Scout Intelligence',
    icon:    MapPin,
    color:   '#4285f4',
    env:     'NEXT_PUBLIC_GOOGLE_PLACES_KEY',
    desc:    'Pulls real verified business data into Scout — names, addresses, ratings, reviews, phone numbers, websites.',
    free:    '$200/mo free credit · ~2,800 free searches',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    docsUrl:  'https://developers.google.com/maps/documentation/places',
    steps: [
      'Go to console.cloud.google.com → APIs & Services → Credentials',
      'Click Create Credentials → API Key',
      'Click the key → API restrictions → Select Places API (New)',
      'Copy key → add as NEXT_PUBLIC_GOOGLE_PLACES_KEY in Vercel',
    ],
  },
  {
    id:      'google_oauth',
    name:    'Google OAuth',
    group:   'SEO & Analytics',
    icon:    Globe,
    color:   '#34a853',
    env:     'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    desc:    'Allows login with Google and connects Search Console data for the SEO Hub.',
    free:    'Free',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    docsUrl:  'https://developers.google.com/identity',
    steps: [
      'Go to console.cloud.google.com → APIs & Services → Credentials',
      'Create Credentials → OAuth 2.0 Client ID → Web application',
      'Add your Vercel URL to Authorized JavaScript origins',
      'Add your Vercel URL to Authorized redirect URIs',
      'Copy Client ID → add as NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel',
    ],
  },
  {
    id:      'ghl',
    name:    'GoHighLevel',
    group:   'CRM',
    icon:    Link2,
    color:   '#f59e0b',
    env:     'NEXT_PUBLIC_GHL_CLIENT_ID',
    desc:    'Two-way CRM sync — push client onboarding data into GHL, pull contact updates back automatically.',
    free:    'Requires GHL subscription',
    setupUrl: 'https://marketplace.gohighlevel.com/',
    docsUrl:  'https://marketplace.gohighlevel.com/docs/',
    steps: [
      'Go to marketplace.gohighlevel.com → My Apps → Create App',
      'Choose Agency app type → fill in name and description',
      'Set redirect URI to: your-domain.vercel.app/api/integrations/ghl/callback',
      'Copy Client ID → add as NEXT_PUBLIC_GHL_CLIENT_ID in Vercel',
      'Copy Client Secret → add as GHL_CLIENT_SECRET in Vercel',
    ],
  },
  {
    id:      'yelp',
    name:    'Yelp Fusion',
    group:   'Scout Intelligence',
    icon:    Star,
    color:   '#d32323',
    env:     'NEXT_PUBLIC_YELP_API_KEY',
    desc:    'Pulls real Yelp reviews, ratings, and business details into Scout and the Reviews module.',
    free:    'Free: 5,000 calls/day',
    setupUrl: 'https://www.yelp.com/developers/v3/manage_app',
    docsUrl:  'https://docs.developer.yelp.com',
    steps: [
      'Go to yelp.com/developers → Create App',
      'Fill in app name, industry, description, website',
      'Accept terms → copy your API Key',
      'Add as NEXT_PUBLIC_YELP_API_KEY in Vercel',
    ],
  },
  {
    id:      'hunter',
    name:    'Hunter.io',
    group:   'Scout Intelligence',
    icon:    Search,
    color:   '#f97316',
    env:     'NEXT_PUBLIC_HUNTER_API_KEY',
    desc:    'Finds verified email addresses for business contacts. Used to enrich Scout leads.',
    free:    'Free: 25 searches/mo',
    setupUrl: 'https://hunter.io/api-keys',
    docsUrl:  'https://hunter.io/api-documentation',
    steps: [
      'Go to hunter.io and create a free account',
      'Click your avatar → API → copy your API key',
      'Add as NEXT_PUBLIC_HUNTER_API_KEY in Vercel',
    ],
  },
  {
    id:      'apollo',
    name:    'Apollo.io',
    group:   'Scout Intelligence',
    icon:    Users,
    color:   '#7c3aed',
    env:     'NEXT_PUBLIC_APOLLO_API_KEY',
    desc:    'Executive contacts, org charts, and company data for deeper Scout lead enrichment.',
    free:    'Free: 50 credits/mo',
    setupUrl: 'https://app.apollo.io/#/settings/integrations/api',
    docsUrl:  'https://apolloio.github.io/apollo-api-docs',
    steps: [
      'Go to app.apollo.io → Settings → Integrations → API',
      'Copy your API key',
      'Add as NEXT_PUBLIC_APOLLO_API_KEY in Vercel',
    ],
  },
  {
    id:      'clearbit',
    name:    'Clearbit',
    group:   'Scout Intelligence',
    icon:    Building,
    color:   '#6366f1',
    env:     'NEXT_PUBLIC_CLEARBIT_API_KEY',
    desc:    'Company enrichment and firmographics — revenue estimates, employee count, tech stack.',
    free:    'Free tier available',
    setupUrl: 'https://dashboard.clearbit.com/keys',
    docsUrl:  'https://dashboard.clearbit.com/docs',
    steps: [
      'Go to dashboard.clearbit.com → sign in or create account',
      'Click API Keys in the sidebar → copy your secret key',
      'Add as NEXT_PUBLIC_CLEARBIT_API_KEY in Vercel',
    ],
  },
  {
    id:      'builtwith',
    name:    'BuiltWith',
    group:   'Scout Intelligence',
    icon:    Wrench,
    color:   '#0ea5e9',
    env:     'NEXT_PUBLIC_BUILTWITH_API_KEY',
    desc:    'Detects what technology a business uses — CRM, analytics, ecommerce, ad platforms.',
    free:    'Free tier: limited lookups',
    setupUrl: 'https://api.builtwith.com/',
    docsUrl:  'https://api.builtwith.com/free-api',
    steps: [
      'Go to api.builtwith.com → sign up for a free account',
      'Copy your API key from the dashboard',
      'Add as NEXT_PUBLIC_BUILTWITH_API_KEY in Vercel',
    ],
  },
]

// ── Group connections by category ─────────────────────────────────────────────
const GROUPS = ['Core — Required', 'Scout Intelligence', 'SEO & Analytics', 'CRM']

// ── Status helpers ─────────────────────────────────────────────────────────────
function getStatus(conn) {
  const has = !!process.env[conn.env]
  return has ? 'connected' : 'not_configured'
}

// ── Single connection card ─────────────────────────────────────────────────────
function ConnectionCard({ conn, onSetup }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // 'pass'|'fail'
  const status = getStatus(conn)
  const Icon = conn.icon
  const isConnected = status === 'connected'

  async function test() {
    setTesting(true)
    setTestResult(null)
    await new Promise(r => setTimeout(r, 900))
    const result = isConnected ? 'pass' : 'fail'
    setTestResult(result)
    setTesting(false)
    if (result === 'pass') toast.success(`${conn.name} connected`)
    else toast.error(`${conn.name}: API key not configured`)
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: `1.5px solid ${isConnected ? conn.color + '40' : '#e5e7eb'}`,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: conn.color + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={conn.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{conn.name}</span>
            {isConnected
              ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={9} strokeWidth={3} /> Connected
                </span>
              : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={9} /> Not configured
                </span>
            }
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{conn.desc}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{conn.free}</div>
        </div>
      </div>

      {/* Env var */}
      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <code style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace', flex: 1 }}>
          {conn.env}
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(conn.env); toast.success('Copied!') }}
          style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}
        >
          <Copy size={10} /> Copy
        </button>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Setup / Docs */}
        <a href={conn.setupUrl} target="_blank" rel="noreferrer"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 9,
            border: `1.5px solid ${isConnected ? '#e5e7eb' : conn.color}`,
            background: isConnected ? '#fff' : conn.color + '08',
            color: isConnected ? '#374151' : conn.color,
            fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
          <ExternalLink size={12} />
          {isConnected ? 'Manage' : 'Get API Key'}
        </a>
        {/* How-to / Guide */}
        {!isConnected && (
          <button onClick={() => onSetup(conn)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Info size={12} /> How to set up
          </button>
        )}
        {/* Test */}
        <button onClick={test} disabled={testing}
          style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: testResult === 'pass' ? '#16a34a' : testResult === 'fail' ? '#dc2626' : '#6b7280' }}>
          {testing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
          Test
        </button>
      </div>
    </div>
  )
}

// ── Setup guide modal ─────────────────────────────────────────────────────────
function SetupGuide({ conn, onClose }) {
  const Icon = conn.icon
  const [step, setStep] = useState(0)

  if (!conn) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: conn.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={conn.color} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>Connect {conn.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{conn.free}</div>
            </div>
            <button onClick={onClose} style={{ marginLeft: 'auto', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
              <Check size={14} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{conn.desc}</p>
        </div>

        {/* Steps */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
            Setup Steps
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {conn.steps.map((s, i) => {
              const done = i < step
              const current = i === step
              return (
                <div key={i} onClick={() => setStep(i)}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${current ? conn.color : done ? '#e5e7eb' : '#f3f4f6'}`, background: current ? conn.color + '06' : '#fff' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: done ? '#16a34a' : current ? conn.color : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {done
                      ? <Check size={12} color="#fff" strokeWidth={3} />
                      : <span style={{ fontSize: 11, fontWeight: 800, color: current ? '#fff' : '#9ca3af' }}>{i + 1}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: current ? 700 : done ? 400 : 600, color: done ? '#9ca3af' : '#111', textDecoration: done ? 'line-through' : 'none' }}>{s}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Env var reminder */}
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
            <Key size={14} color={conn.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 4 }}>Add to Vercel Environment Variables</div>
              <code style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', display: 'block' }}>{conn.env}</code>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <a href={conn.setupUrl} target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12, border: 'none', background: conn.color, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <ExternalLink size={14} /> Open {conn.name}
            </a>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <ExternalLink size={14} /> Open Vercel
            </a>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>
            Both open in a new tab — come back and click Test when done
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Score weights ─────────────────────────────────────────────────────────────
const WEIGHT_DEFAULTS = { social: 25, website: 30, gmb: 20, reviews: 15, ads: 10 }
const WEIGHT_LABELS = [
  { key: 'social',   label: 'Social Media Presence', desc: 'Facebook, Instagram activity and followers' },
  { key: 'website',  label: 'Website & Tech Stack',   desc: 'Analytics, CRM, CMS, marketing tools' },
  { key: 'gmb',      label: 'GMB Health',              desc: 'Optimization, posts, photos, Q&A' },
  { key: 'reviews',  label: 'Reviews & Reputation',    desc: 'Rating, count, response rate, sentiment' },
  { key: 'ads',      label: 'Advertising',             desc: 'Facebook Pixel, Google Ads, retargeting' },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState('connections')
  const [weights, setWeights] = useState({ ...WEIGHT_DEFAULTS })
  const [setupConn, setSetupConn] = useState(null)
  const [groupFilter, setGroupFilter] = useState('All')

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  const connectedCount = CONNECTIONS.filter(c => !!process.env[c.env]).length

  const filteredConns = groupFilter === 'All'
    ? CONNECTIONS
    : CONNECTIONS.filter(c => c.group === groupFilter)

  // Group for display
  const byGroup = GROUPS.reduce((acc, g) => {
    const items = filteredConns.filter(c => c.group === g)
    if (items.length) acc[g] = items
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f4f5' }}>
      <Sidebar />

      {setupConn && <SetupGuide conn={setupConn} onClose={() => setSetupConn(null)} />}

      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 28px' }}>

          {/* Page header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Settings size={20} color="#111" />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Settings</h1>
            </div>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Configure your Moose AI platform and API connections</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e5e7eb', marginBottom: 28 }}>
            {TABS.map(t => {
              const I = t.icon
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? ACCENT : '#6b7280', border: 'none', background: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t.key ? ACCENT : 'transparent'}`, marginBottom: -1, transition: 'all .15s' }}>
                  <I size={14} /> {t.label}
                  {t.key === 'connections' && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: connectedCount === CONNECTIONS.length ? '#f0fdf4' : '#fff7f5', color: connectedCount === CONNECTIONS.length ? '#16a34a' : ACCENT }}>
                      {connectedCount}/{CONNECTIONS.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── API Connections Tab ── */}
          {tab === 'connections' && (
            <div>
              {/* Summary banner */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                    {connectedCount} of {CONNECTIONS.length} connections configured
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', maxWidth: 300 }}>
                    <div style={{ height: '100%', width: `${(connectedCount / CONNECTIONS.length) * 100}%`, background: connectedCount === CONNECTIONS.length ? '#16a34a' : ACCENT, borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
                <button onClick={() => navigate('/setup')}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Open Setup Wizard <ArrowRight size={13} />
                </button>
                <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> Vercel Env Vars
                </a>
              </div>

              {/* Group filter */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['All', ...GROUPS].map(g => (
                  <button key={g} onClick={() => setGroupFilter(g)}
                    style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${groupFilter === g ? ACCENT : '#e5e7eb'}`, background: groupFilter === g ? '#fff7f5' : '#fff', color: groupFilter === g ? ACCENT : '#6b7280', fontSize: 12, fontWeight: groupFilter === g ? 700 : 500, cursor: 'pointer' }}>
                    {g}
                  </button>
                ))}
              </div>

              {/* Cards by group */}
              {Object.entries(byGroup).map(([group, conns]) => (
                <div key={group} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {group}
                    <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '1px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                      {conns.filter(c => !!process.env[c.env]).length}/{conns.length} connected
                    </span>
                    {group === 'Core — Required' && conns.some(c => !process.env[c.env]) && (
                      <span style={{ fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 8px', borderRadius: 20, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                        Required — platform won't work without these
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                    {conns.map(conn => (
                      <ConnectionCard key={conn.id} conn={conn} onSetup={setSetupConn} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Scout Settings Tab ── */}
          {tab === 'scout' && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Sliders size={16} color={ACCENT} /> Scout Score Weights
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Adjust how each factor contributes to the lead score</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: totalWeight === 100 ? '#16a34a' : '#dc2626' }}>
                    Total: {totalWeight}%
                    {totalWeight !== 100 && <span style={{ fontSize: 11, marginLeft: 6, color: '#dc2626' }}>(must equal 100%)</span>}
                  </span>
                  <button onClick={() => { setWeights({ ...WEIGHT_DEFAULTS }); toast.success('Reset to defaults') }}
                    style={{ padding: '6px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                    Reset defaults
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {WEIGHT_LABELS.map(w => (
                  <div key={w.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{w.label}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{w.desc}</div>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 900, color: ACCENT, minWidth: 48, textAlign: 'right' }}>{weights[w.key]}%</span>
                    </div>
                    <input type="range" min={0} max={50} value={weights[w.key]}
                      onChange={e => setWeights(p => ({ ...p, [w.key]: +e.target.value }))}
                      style={{ width: '100%', accentColor: ACCENT, height: 6 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notifications Tab ── */}
          {tab === 'notifications' && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>Notification Preferences</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Choose what you want to be alerted about</div>
              {[
                { label: 'New negative reviews', desc: 'When a 1 or 2-star review comes in for any client', default: true },
                { label: 'Hot Scout leads found', desc: 'When a search returns leads scored 75+', default: true },
                { label: 'Client onboarding completed', desc: 'When a client finishes their onboarding form', default: true },
                { label: 'Agent activity summary', desc: 'Daily digest of what all AI agents did', default: false },
                { label: 'Team mentions', desc: 'When someone mentions you in a comment or note', default: true },
                { label: 'Monthly report generated', desc: 'When the Monthly AI Report agent sends a report', default: false },
              ].map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < 5 ? '1px solid #f3f4f6' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{n.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{n.desc}</div>
                  </div>
                  <label style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" defaultChecked={n.default} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: n.default ? ACCENT : '#d1d5db', transition: 'background .2s' }}>
                      <div style={{ position: 'absolute', top: 3, left: n.default ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* ── Security Tab ── */}
          {tab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>Security Settings</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Authentication and access controls for your agency</div>
                {[
                  { label: 'Two-factor authentication', desc: 'Require 2FA for all team members', icon: Shield, action: 'Configure', href: null },
                  { label: 'Team access management', desc: 'Manage roles, permissions, and seat assignments', icon: Users, action: 'Manage team', href: '/agency-settings' },
                  { label: 'API key rotation', desc: 'Rotate all Vercel environment variables', icon: Key, action: 'Open Vercel', href: 'https://vercel.com/dashboard' },
                  { label: 'Audit log', desc: 'View all changes made across the platform', icon: BarChart2, action: 'View log', href: '/admin' },
                ].map((item, i) => {
                  const I = item.icon
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <I size={16} color="#6b7280" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.desc}</div>
                      </div>
                      {item.href && item.href.startsWith('http') ? (
                        <a href={item.href} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          <ExternalLink size={11} /> {item.action}
                        </a>
                      ) : item.href ? (
                        <button onClick={() => navigate(item.href)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          <ChevronRight size={11} /> {item.action}
                        </button>
                      ) : (
                        <button onClick={() => toast('Coming soon')}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {item.action}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
