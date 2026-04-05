"use client"
import { useState, useEffect, useCallback } from 'react'
import { useMobile } from '../hooks/useMobile'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Building2, Globe, Phone, Mail, MapPin, Users, Calendar,
  DollarSign, Hash, Share2, Camera, AtSign, Briefcase, Video,
  Server, Palette, Target, UserPlus, Link2, Copy, Check, X, Plus, Trash2,
  ExternalLink, Shield, CreditCard, Crown, Eye, EyeOff, Lock, Sparkles,
  ShoppingBag, TrendingUp, Building
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import {
  getClients, getClientProfile, upsertClientProfile,
  createOnboardingToken, getProjects, supabase
} from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'social', label: 'Social Media' },
  { key: 'hosting', label: 'Hosting & Tech' },
  { key: 'brand', label: 'Brand' },
  { key: 'google', label: 'Google' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'profile', label: 'Full Profile' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'access', label: 'Access' },
  { key: 'persona', label: 'AI Persona' },
]

const REVENUE_RANGES = [
  'Under $100K', '$100K - $500K', '$500K - $1M', '$1M - $5M',
  '$5M - $10M', '$10M - $50M', '$50M+',
]

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Real Estate',
  'Restaurant / Food', 'Professional Services', 'Construction',
  'Education', 'Non-Profit', 'Manufacturing', 'Automotive',
  'Beauty / Wellness', 'Legal', 'Entertainment', 'Other',
]


// ── Masked password field ─────────────────────────────────────────────────────
function MaskedPw({ value }) {
  const [show, setShow] = useState(false)
  if (!value) return <span style={{ color: '#4b5563', fontSize: 15 }}>—</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: show ? 'inherit' : 'monospace', fontSize: 15, color: '#111', letterSpacing: show ? 'normal' : '0.15em' }}>
        {show ? value : '••••••••••••'}
      </span>
      <button onClick={() => setShow(s => !s)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied!') }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }}>
        <Copy size={13} />
      </button>
    </div>
  )
}

function DataRow({ label, value, masked, link, mono }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null
  const displayVal = Array.isArray(value) ? value.join(', ') : String(value)
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{label}</div>
      <div>
        {masked ? <MaskedPw value={displayVal} /> : link && value ? (
          <a href={value.startsWith('http') ? value : 'https://' + value} target="_blank" rel="noreferrer"
            style={{ fontSize: 15, color: '#ea2729', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 700, wordBreak: 'break-all' }}>
            {displayVal.length > 60 ? displayVal.slice(0, 60) + '…' : displayVal} <ExternalLink size={13} />
          </a>
        ) : (
          <div style={{ fontSize: 15, color: '#111', fontFamily: mono ? 'monospace' : 'inherit', lineHeight: 1.65, fontWeight: 600, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {displayVal}
          </div>
        )}
      </div>
    </div>
  )
}

function DataPills({ label, value, color = '#ea2729' }) {
  const arr = Array.isArray(value) ? value : (value || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!arr.length) return null
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {arr.map((item, i) => (
          <span key={i} style={{ fontSize: 15, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: color + '15', color, border: `1px solid ${color}30` }}>{item}</span>
        ))}
      </div>
    </div>
  )
}

function DataSection({ title, icon: Icon, color = '#ea2729', children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${color}25`, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 22px', borderBottom: `1.5px solid ${color}20`, display: 'flex', alignItems: 'center', gap: 12, background: `linear-gradient(135deg, ${color}08, transparent)` }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: -0.2 }}>{title}</span>
      </div>
      <div style={{ padding: '4px 22px 16px' }}>{children}</div>
    </div>
  )
}

export default function ClientDetailPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [profile, setProfile] = useState({})
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [tokens,      setTokens]      = useState([])
  const [portalLink,  setPortalLink]  = useState('')
  const [portalCopied,setPortalCopied]= useState(false)
  const [genPortal,   setGenPortal]   = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)

  // ─── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (clientId) loadAll()
  }, [clientId])

  async function loadAll() {
    setLoading(true)
    try {
      const [{ data: clients }, profileRes, { data: proj }] = await Promise.all([
        getClients(),
        getClientProfile(clientId),
        getProjects(clientId),
      ])
      const c = (clients || []).find(cl => cl.id === clientId)
      if (!c) { navigate('/clients'); return }
      setClient(c)
      setProfile(profileRes.data || {})
      setProjects(proj || [])
      await loadTokens()
    } catch (err) {
      toast.error('Failed to load client')
    } finally {
      setLoading(false)
    }
  }

  async function loadTokens() {
    try {
      const { data } = await supabase
        .from('onboarding_tokens')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      setTokens(data || [])
    } catch { setTokens([]) }
  }

  // ─── Auto-save helpers ──────────────────────────────────────────────────────
  const saveField = useCallback(async (field, value) => {
    const { error } = await upsertClientProfile(clientId, { [field]: value })
    if (error) { toast.error('Save failed'); return }
    setProfile(prev => ({ ...prev, [field]: value }))
    toast.success('Saved', { duration: 1500 })
  }, [clientId])

  const saveNestedField = useCallback(async (parentKey, childKey, value) => {
    const current = profile[parentKey] || {}
    const updated = { ...current, [childKey]: value }
    const { error } = await upsertClientProfile(clientId, { [parentKey]: updated })
    if (error) { toast.error('Save failed'); return }
    setProfile(prev => ({ ...prev, [parentKey]: updated }))
    toast.success('Saved', { duration: 1500 })
  }, [clientId, profile])

  const saveDeepNestedField = useCallback(async (parentKey, childKey, grandchildKey, value) => {
    const current = profile[parentKey] || {}
    const child = current[childKey] || {}
    const updatedChild = { ...child, [grandchildKey]: value }
    const updated = { ...current, [childKey]: updatedChild }
    const { error } = await upsertClientProfile(clientId, { [parentKey]: updated })
    if (error) { toast.error('Save failed'); return }
    setProfile(prev => ({ ...prev, [parentKey]: updated }))
    toast.success('Saved', { duration: 1500 })
  }, [clientId, profile])

  // ─── Inline editable field ─────────────────────────────────────────────────
  function InlineField({ label, value, onSave, type = 'text', placeholder, icon: Icon, options }) {
    const [val, setVal] = useState(value || '')
    useEffect(() => { setVal(value || '') }, [value])

    const handleBlur = () => {
      if (val !== (value || '')) onSave(val)
    }

    if (options) {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <select
            className="input w-full"
            value={val}
            onChange={(e) => { setVal(e.target.value); onSave(e.target.value) }}
          >
            <option value="">Select...</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )
    }

    if (type === 'textarea') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <textarea
            className="input w-full min-h-[80px] resize-y"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={3}
          />
        </div>
      )
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="relative">
          {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />}
          <input
            type={type}
            className={`input w-full ${Icon ? 'pl-10' : ''}`}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
          />
        </div>
      </div>
    )
  }

  // ─── Section wrapper ───────────────────────────────────────────────────────
  function Section({ title, description, children }) {
    return (
      <div className="card p-6 mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {description && <p className="text-sm text-gray-700 mt-1">{description}</p>}
        </div>
        {children}
      </div>
    )
  }

  // ─── Tab: Overview ─────────────────────────────────────────────────────────
  function OverviewTab() {
    const address = profile.address || {}
    return (
      <div className="space-y-6">
        <Section title="Business Information" description="Core business details for this client.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InlineField label="Business Name" value={profile.business_name} onSave={(v) => saveField('business_name', v)} icon={Building2} placeholder="Acme Corp" />
            <InlineField label="Legal Name" value={profile.legal_name} onSave={(v) => saveField('legal_name', v)} icon={Building2} placeholder="Acme Corporation LLC" />
            <InlineField label="EIN / Tax ID" value={profile.ein} onSave={(v) => saveField('ein', v)} icon={Hash} placeholder="XX-XXXXXXX" />
            <InlineField label="Phone" value={profile.phone} onSave={(v) => saveField('phone', v)} icon={Phone} type="tel" placeholder="(555) 123-4567" />
            <InlineField label="Website" value={profile.website} onSave={(v) => saveField('website', v)} icon={Globe} type="url" placeholder="https://example.com" />
            <InlineField label="Industry" value={profile.industry} onSave={(v) => saveField('industry', v)} options={INDUSTRIES} />
            <InlineField label="Founded Date" value={profile.founded_date} onSave={(v) => saveField('founded_date', v)} icon={Calendar} type="date" />
            <InlineField label="Employee Count" value={profile.employee_count} onSave={(v) => saveField('employee_count', v)} icon={Users} type="number" placeholder="25" />
            <InlineField label="Revenue Range" value={profile.revenue_range} onSave={(v) => saveField('revenue_range', v)} options={REVENUE_RANGES} />
          </div>
        </Section>

        <Section title="Address" description="Primary business address.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InlineField label="Street" value={address.street} onSave={(v) => saveNestedField('address', 'street', v)} icon={MapPin} placeholder="123 Main St" />
            </div>
            <InlineField label="City" value={address.city} onSave={(v) => saveNestedField('address', 'city', v)} placeholder="New York" />
            <InlineField label="State" value={address.state} onSave={(v) => saveNestedField('address', 'state', v)} placeholder="NY" />
            <InlineField label="Zip Code" value={address.zip} onSave={(v) => saveNestedField('address', 'zip', v)} placeholder="10001" />
            <InlineField label="Country" value={address.country} onSave={(v) => saveNestedField('address', 'country', v)} placeholder="United States" />
          </div>
        </Section>

        {projects.length > 0 && (
          <Section title="Active Projects" description={`${projects.length} project${projects.length !== 1 ? 's' : ''} linked to this client.`}>
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigate(`/project/${p.id}`)}>
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-700">Created {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-700" />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    )
  }

  // ─── Tab: Social Media ─────────────────────────────────────────────────────
  function SocialMediaTab() {
    const social = profile.social_media || {}
    const platforms = [
      { key: 'facebook', label: 'Facebook', icon: Share2, placeholder: 'https://facebook.com/...' },
      { key: 'instagram', label: 'Instagram', icon: Camera, placeholder: 'https://instagram.com/...' },
      { key: 'twitter', label: 'Twitter / X', icon: AtSign, placeholder: 'https://x.com/...' },
      { key: 'linkedin', label: 'LinkedIn', icon: Briefcase, placeholder: 'https://linkedin.com/company/...' },
      { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
      { key: 'youtube', label: 'YouTube', icon: Video, placeholder: 'https://youtube.com/@...' },
      { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/...' },
    ]

    return (
      <Section title="Social Media Accounts" description="Links to the client's social media profiles.">
        <div className="space-y-4">
          {platforms.map(({ key, label, icon: PIcon, placeholder }) => (
            <InlineField
              key={key}
              label={label}
              value={social[key]?.url || ''}
              onSave={(v) => saveDeepNestedField('social_media', key, 'url', v)}
              icon={PIcon || Globe}
              type="url"
              placeholder={placeholder}
            />
          ))}
        </div>
      </Section>
    )
  }

  // ─── Tab: Hosting & Tech ───────────────────────────────────────────────────
  function HostingTab() {
    const hosting = profile.hosting || {}
    return (
      <Section title="Hosting & Technology" description="Technical infrastructure details.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InlineField label="Domain Registrar" value={hosting.domain_registrar} onSave={(v) => saveNestedField('hosting', 'domain_registrar', v)} icon={Globe} placeholder="GoDaddy, Namecheap..." />
          <InlineField label="Hosting Provider" value={hosting.hosting_provider} onSave={(v) => saveNestedField('hosting', 'hosting_provider', v)} icon={Server} placeholder="Vercel, AWS, WP Engine..." />
          <InlineField label="CMS" value={hosting.cms} onSave={(v) => saveNestedField('hosting', 'cms', v)} placeholder="WordPress, Webflow, Shopify..." />
          <InlineField label="CMS Login URL" value={hosting.cms_login_url} onSave={(v) => saveNestedField('hosting', 'cms_login_url', v)} icon={ExternalLink} type="url" placeholder="https://..." />
          <InlineField label="DNS Provider" value={hosting.dns_provider} onSave={(v) => saveNestedField('hosting', 'dns_provider', v)} placeholder="Cloudflare, Route 53..." />
        </div>
        <div className="mt-4">
          <InlineField label="Notes" value={hosting.notes} onSave={(v) => saveNestedField('hosting', 'notes', v)} type="textarea" placeholder="Any additional technical notes..." />
        </div>
      </Section>
    )
  }

  // ─── Tab: Brand ────────────────────────────────────────────────────────────
  function BrandTab() {
    const brand = profile.brand || {}
    const [newColor, setNewColor] = useState('#000000')

    async function addColor() {
      const colors = [...(brand.colors || []), newColor]
      await saveNestedField('brand', 'colors', colors)
      setNewColor('#000000')
    }

    async function removeColor(idx) {
      const colors = (brand.colors || []).filter((_, i) => i !== idx)
      await saveNestedField('brand', 'colors', colors)
    }

    async function addFont(font) {
      if (!font.trim()) return
      const fonts = [...(brand.fonts || []), font.trim()]
      await saveNestedField('brand', 'fonts', fonts)
    }

    async function removeFont(idx) {
      const fonts = (brand.fonts || []).filter((_, i) => i !== idx)
      await saveNestedField('brand', 'fonts', fonts)
    }

    return (
      <div className="space-y-6">
        <Section title="Logo" description="The client's primary logo.">
          {brand.logo_url ? (
            <div className="flex items-center gap-4">
              <img src={brand.logo_url} alt="Logo" className="h-20 w-auto object-contain rounded-lg border border-gray-200 p-2 bg-white" />
              <button className="btn-secondary text-sm" onClick={() => saveNestedField('brand', 'logo_url', '')}>Remove</button>
            </div>
          ) : (
            <div className="text-sm text-gray-700 italic">No logo uploaded. Set via onboarding form or paste URL below.</div>
          )}
          <div className="mt-3">
            <InlineField label="Logo URL" value={brand.logo_url} onSave={(v) => saveNestedField('brand', 'logo_url', v)} type="url" placeholder="https://..." />
          </div>
        </Section>

        <Section title="Brand Colors" description="Primary and secondary brand colors.">
          <div className="flex flex-wrap gap-3 mb-4">
            {(brand.colors || []).map((color, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-md border border-gray-200 shadow-inner" style={{ backgroundColor: color }} />
                <span className="text-sm font-mono text-gray-700">{color}</span>
                <button onClick={() => removeColor(idx)} className="text-gray-700 hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {!(brand.colors || []).length && <p className="text-sm text-gray-700 italic">No brand colors defined.</p>}
          </div>
          <div className="flex items-center gap-3">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
            <span className="text-sm font-mono text-gray-600">{newColor}</span>
            <button onClick={addColor} className="btn-secondary text-sm">Add Color</button>
          </div>
        </Section>

        <Section title="Fonts" description="Typefaces used in the brand.">
          <div className="flex flex-wrap gap-2 mb-4">
            {(brand.fonts || []).map((font, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
                {font}
                <button onClick={() => removeFont(idx)} className="text-gray-700 hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {!(brand.fonts || []).length && <p className="text-sm text-gray-700 italic">No fonts defined.</p>}
          </div>
          <FontAdder onAdd={addFont} />
        </Section>

        <Section title="Voice & Messaging" description="Brand voice, tagline, and mission.">
          <div className="space-y-4">
            <InlineField label="Voice / Tone" value={brand.voice_tone} onSave={(v) => saveNestedField('brand', 'voice_tone', v)} type="textarea" placeholder="Professional yet approachable..." />
            <InlineField label="Tagline" value={brand.tagline} onSave={(v) => saveNestedField('brand', 'tagline', v)} placeholder="Your tagline here" />
            <InlineField label="Mission Statement" value={brand.mission_statement} onSave={(v) => saveNestedField('brand', 'mission_statement', v)} type="textarea" placeholder="Our mission is to..." />
          </div>
        </Section>
      </div>
    )
  }

  // ─── Tab: Google ───────────────────────────────────────────────────────────
  function GoogleTab() {
    const google = profile.google_accounts || {}
    return (
      <Section title="Google Accounts" description="Google Business Profile, Analytics, Ads, and Search Console.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <InlineField label="Google Business Profile URL" value={google.gbp_url} onSave={(v) => saveNestedField('google_accounts', 'gbp_url', v)} type="url" icon={ExternalLink} placeholder="https://business.google.com/..." />
          </div>
          <InlineField label="Analytics ID" value={google.analytics_id} onSave={(v) => saveNestedField('google_accounts', 'analytics_id', v)} placeholder="G-XXXXXXXXXX or UA-..." />
          <InlineField label="Analytics URL" value={google.analytics_url} onSave={(v) => saveNestedField('google_accounts', 'analytics_url', v)} type="url" icon={ExternalLink} placeholder="https://analytics.google.com/..." />
          <InlineField label="Ads ID" value={google.ads_id} onSave={(v) => saveNestedField('google_accounts', 'ads_id', v)} placeholder="XXX-XXX-XXXX" />
          <InlineField label="Ads URL" value={google.ads_url} onSave={(v) => saveNestedField('google_accounts', 'ads_url', v)} type="url" icon={ExternalLink} placeholder="https://ads.google.com/..." />
          <div className="md:col-span-2">
            <InlineField label="Search Console URL" value={google.search_console_url} onSave={(v) => saveNestedField('google_accounts', 'search_console_url', v)} type="url" icon={ExternalLink} placeholder="https://search.google.com/search-console/..." />
          </div>
          <InlineField label="Access Status" value={google.access_status} onSave={(v) => saveNestedField('google_accounts', 'access_status', v)} options={['Not Requested', 'Requested', 'Granted', 'Admin Access']} />
        </div>
      </Section>
    )
  }

  // ─── Tab: Marketing ────────────────────────────────────────────────────────
  function MarketingTab() {
    const marketing = profile.marketing || {}
    return (
      <Section title="Marketing Strategy" description="Target audience, competition, and marketing goals.">
        <div className="space-y-4">
          <InlineField label="Target Audience" value={marketing.target_audience} onSave={(v) => saveNestedField('marketing', 'target_audience', v)} type="textarea" placeholder="Demographics, psychographics, buying behavior..." />
          <InlineField label="Competitors (comma-separated)" value={(marketing.competitors || []).join(', ')} onSave={(v) => saveNestedField('marketing', 'competitors', v.split(',').map(s => s.trim()).filter(Boolean))} type="textarea" placeholder="Competitor A, Competitor B, Competitor C" />
          <InlineField label="Current Monthly Budget" value={marketing.current_budget} onSave={(v) => saveNestedField('marketing', 'current_budget', v)} icon={DollarSign} placeholder="5,000" />
          <InlineField label="Goals (comma-separated)" value={(marketing.goals || []).join(', ')} onSave={(v) => saveNestedField('marketing', 'goals', v.split(',').map(s => s.trim()).filter(Boolean))} type="textarea" placeholder="Increase leads, Improve SEO, Social growth..." />
          <InlineField label="Notes" value={marketing.notes} onSave={(v) => saveNestedField('marketing', 'notes', v)} type="textarea" placeholder="Additional marketing notes..." />
        </div>
      </Section>
    )
  }

  // ─── Tab: Contacts ─────────────────────────────────────────────────────────
  function ContactsTab() {
    const contacts = profile.contacts || []
    const [showAdd, setShowAdd] = useState(false)
    const [form, setForm] = useState({ name: '', role: '', email: '', phone: '', is_primary: false, is_billing: false, is_decision_maker: false })

    async function addContact() {
      if (!form.name.trim()) { toast.error('Name is required'); return }
      const updated = [...contacts, { ...form, name: form.name.trim(), role: form.role.trim(), email: form.email.trim(), phone: form.phone.trim() }]
      await saveField('contacts', updated)
      setForm({ name: '', role: '', email: '', phone: '', is_primary: false, is_billing: false, is_decision_maker: false })
      setShowAdd(false)
    }

    async function removeContact(idx) {
      const updated = contacts.filter((_, i) => i !== idx)
      await saveField('contacts', updated)
    }

    async function toggleBadge(idx, field) {
      const updated = contacts.map((c, i) => i === idx ? { ...c, [field]: !c[field] } : c)
      await saveField('contacts', updated)
    }

    return (
      <Section title="Client Contacts" description="People associated with this client account.">
        <div className="space-y-3 mb-4">
          {contacts.map((c, idx) => (
            <div key={idx} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {c.role && <span className="text-sm text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full">{c.role}</span>}
                  {c.is_primary && (
                    <button onClick={() => toggleBadge(idx, 'is_primary')} className="inline-flex items-center gap-1 text-sm bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">
                      <Crown className="w-3 h-3" /> Primary
                    </button>
                  )}
                  {c.is_billing && (
                    <button onClick={() => toggleBadge(idx, 'is_billing')} className="inline-flex items-center gap-1 text-sm bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
                      <CreditCard className="w-3 h-3" /> Billing
                    </button>
                  )}
                  {c.is_decision_maker && (
                    <button onClick={() => toggleBadge(idx, 'is_decision_maker')} className="inline-flex items-center gap-1 text-sm bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" /> Decision Maker
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-700">
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                </div>
              </div>
              <button onClick={() => removeContact(idx)} className="text-gray-700 hover:text-red-500 ml-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!contacts.length && <p className="text-sm text-gray-700 italic">No contacts added yet.</p>}
        </div>

        {showAdd ? (
          <div className="card p-4 border-2 border-brand-500/20">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="input" placeholder="Role" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} />
              <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              <input className="input" placeholder="Phone" type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="flex items-center gap-4 mb-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded text-brand-500" />
                Primary
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.is_billing} onChange={(e) => setForm(f => ({ ...f, is_billing: e.target.checked }))} className="rounded text-brand-500" />
                Billing
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.is_decision_maker} onChange={(e) => setForm(f => ({ ...f, is_decision_maker: e.target.checked }))} className="rounded text-brand-500" />
                Decision Maker
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={addContact} className="btn-primary text-sm">Add Contact</button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        )}
      </Section>
    )
  }

  // ─── Tab: Onboarding ───────────────────────────────────────────────────────
  function OnboardingTab() {
    const [generating, setGenerating] = useState(false)

    async function handleGenerate() {
      setGenerating(true)
      try {
        const { data, error } = await createOnboardingToken(clientId, 'agency')
        if (error) { toast.error('Failed to generate link'); return }
        toast.success('Onboarding link created')
        await loadTokens()
      } catch {
        toast.error('Failed to generate link')
      } finally {
        setGenerating(false)
      }
    }

    async function generatePortalLink() {
      setGenPortal(true)
      try {
        const res = await fetch('/api/client-portal', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'generate_link', client_id: clientId, agency_id: agencyId }),
        })
        const data = await res.json()
        if (data.portal_url) {
          setPortalLink(data.portal_url)
          navigator.clipboard.writeText(data.portal_url)
          setPortalCopied(true)
          toast.success('Portal link copied!')
          setTimeout(()=>setPortalCopied(false), 3000)
        } else { toast.error(data.error || 'Failed to generate') }
      } catch(e) { toast.error('Failed: ' + e.message) }
      setGenPortal(false)
    }

    function copyLink(token) {
      const url = `${window.location.origin}/onboarding/${token}`
      navigator.clipboard.writeText(url)
      setCopiedToken(token)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopiedToken(null), 2000)
    }

    return (
      <Section title="Client Onboarding" description="Generate and manage onboarding links for this client to self-fill their profile.">
        <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm inline-flex items-center gap-1.5 mb-6">
          <Link2 className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate Onboarding Link'}
        </button>

        {/* Client Portal Link */}
        <div style={{ background:'#f0fbfc', borderRadius:12, border:'1px solid #5bc6d040', padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#0e7490', marginBottom:3 }}>🔗 Client Portal Link</div>
            {portalLink ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <code style={{ fontSize:12, color:'#374151', background:'#f3f4f6', padding:'4px 8px', borderRadius:6, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portalLink}</code>
              </div>
            ) : (
              <div style={{ fontSize:13, color:'#6b7280' }}>Generate a shareable link — your client can view projects, reviews, and submit requests without logging in.</div>
            )}
          </div>
          <button onClick={generatePortalLink} disabled={genPortal}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:9, border:'none', background:'#5bc6d0', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            {genPortal ? '…' : portalCopied ? '✓ Copied!' : portalLink ? '↻ Refresh' : '🔗 Generate Portal Link'}
          </button>
        </div>

        <div className="space-y-3">
          {tokens.map(t => (
            <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center text-sm font-medium px-2 py-0.5 rounded-full ${t.used_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {t.used_at ? 'Completed' : 'Pending'}
                  </span>
                  <span className="text-sm text-gray-700">
                    Created {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 font-mono truncate">{window.location.origin}/onboarding/{t.token}</p>
              </div>
              <button onClick={() => copyLink(t.token)} className="btn-secondary text-sm inline-flex items-center gap-1.5 ml-3 shrink-0">
                {copiedToken === t.token ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Link</>}
              </button>
            </div>
          ))}
          {!tokens.length && <p className="text-sm text-gray-700 italic">No onboarding links generated yet.</p>}
        </div>
      </Section>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-shell flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-700">Loading client...</div>
        </main>
      </div>
    )
  }

  if (!client) return null

  const tabContent = {
    overview: <OverviewTab />,
    social: <SocialMediaTab />,
    hosting: <HostingTab />,
    brand: <BrandTab />,
    google: <GoogleTab />,
    marketing: <MarketingTab />,
    contacts: <ContactsTab />,
    onboarding: <OnboardingTab />,
    profile: (() => {
      const p = profile || {}
      const contact = p.contact || {}
      const products = p.products_services || {}
      const customers = p.customers || {}
      const competitors = p.competitors || {}
      const geo = p.geography || {}
      const brand = p.brand || {}
      const social = p.social || {}
      const hosting = p.hosting || {}
      const cms = p.cms || {}
      const tracking = p.tracking || {}
      const marketing = p.marketing || {}
      const goals = p.goals || {}
      const parsePersona = (raw) => {
        if (!raw) return {}
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return {} }
      }
      const persona = parsePersona(p.ai_persona)

      return (
        <div style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111', margin: 0 }}>Client Intelligence Profile</h2>
              <p style={{ fontSize: 15, color: '#4b5563', margin: '4px 0 0' }}>All data submitted via client onboarding form</p>
            </div>
            <button onClick={() => window.location.reload()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 15, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
              ↻ Refresh
            </button>
          </div>
          {!p.business_name && !p.description && (
            <div style={{ background: '#f0fbfc', borderRadius: 14, border: `1.5px dashed #ea272940`, padding: 40, textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#374151', marginBottom: 8 }}>No onboarding data yet</div>
              <div style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
                Go to the <strong>Onboarding</strong> tab to generate a link, then send it to your client to fill out. All their data will appear here automatically once submitted.
              </div>
            </div>
          )}

          <DataSection title="Business Identity" icon={Building2} color="#3b82f6">
            <DataRow label="Business Name" value={p.business_name} />
            <DataRow label="Legal Name" value={p.legal_name} />
            <DataRow label="EIN" value={p.ein} mono />
            <DataRow label="Industry" value={p.industry} />
            <DataRow label="Business Type" value={p.business_type} />
            <DataRow label="Year Founded" value={p.year_founded} />
            <DataRow label="Employees" value={p.num_employees} />
            <DataRow label="Annual Revenue" value={p.annual_revenue} />
            <DataRow label="Website" value={p.website} link />
            <DataRow label="Description" value={p.description} />
            <DataRow label="Address" value={[p.address?.street, p.address?.city, p.address?.state, p.address?.zip].filter(Boolean).join(', ')} />
          </DataSection>

          <DataSection title="Primary Contact" icon={Users} color="#8b5cf6">
            <DataRow label="Name" value={[contact.first_name, contact.last_name].filter(Boolean).join(' ')} />
            <DataRow label="Title" value={contact.title} />
            <DataRow label="Email" value={contact.email} />
            <DataRow label="Phone" value={contact.phone} />
          </DataSection>

          <DataSection title="Products & Services" icon={ShoppingBag} color={ACCENT}>
            <DataRow label="Description" value={products.description} />
            <DataPills label="Top Services" value={products.top_services} color="#ea2729" />
            <DataRow label="Pricing Model" value={products.pricing_model} />
            <DataRow label="Avg Transaction" value={products.avg_transaction ? "$" + products.avg_transaction : null} />
            <DataRow label="Avg Project Value" value={products.avg_project ? "$" + products.avg_project : null} />
            <DataRow label="Visits / Year" value={products.visits_per_year} />
            <DataRow label="Client LTV" value={products.ltv ? "$" + products.ltv : null} />
            <DataRow label="Seasonal Notes" value={products.seasonal_notes} />
          </DataSection>

          <DataSection title="Ideal Customers" icon={Target} color="#10b981">
            <DataPills label="Customer Types" value={customers.types} color="#10b981" />
            <DataRow label="Ideal Customer" value={customers.ideal_desc} />
            <DataRow label="Age Range" value={customers.age} />
            <DataRow label="Gender Split" value={customers.gender} />
            <DataRow label="Income Level" value={customers.income} />
            <DataRow label="Pain Points" value={customers.pain_points} />
            <DataRow label="Customer Goals" value={customers.goals} />
            <DataRow label="Lifestyle / Behavior" value={customers.lifestyle} />
          </DataSection>

          <DataSection title="Competitive Landscape" icon={Target} color="#ef4444">
            <DataRow label="Why Choose Them" value={competitors.why_choose} />
            <DataRow label="Unique Value Prop" value={competitors.uvp} />
            {(competitors.list || []).filter(c => c.name).map((comp, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginTop: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>#{i+1} {comp.name} {comp.url && <a href={comp.url.startsWith('http') ? comp.url : 'https://' + comp.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontSize: 14, marginLeft: 8 }}>↗</a>}</div>
                {comp.strengths && <div style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}><strong style={{ color: '#dc2626' }}>Strengths:</strong> {comp.strengths}</div>}
                {comp.weaknesses && <div style={{ fontSize: 14, color: '#374151' }}><strong style={{ color: '#16a34a' }}>Weaknesses:</strong> {comp.weaknesses}</div>}
              </div>
            ))}
          </DataSection>

          <DataSection title="Target Geography" icon={MapPin} color="#3b82f6">
            <DataRow label="Primary Market" value={[geo.primary_city, geo.primary_state].filter(Boolean).join(', ')} />
            <DataRow label="Service Radius" value={geo.radius} />
            <DataPills label="Target Cities" value={geo.target_cities} color="#3b82f6" />
            <DataRow label="Notes" value={geo.notes} />
          </DataSection>

          <DataSection title="Brand Identity" icon={Palette} color="#f59e0b">
            <DataRow label="Primary Color" value={brand.primary_color} />
            <DataRow label="Accent Color" value={brand.accent_color} />
            <DataRow label="Fonts" value={brand.fonts} />
            <DataRow label="Tagline" value={brand.tagline} />
            <DataRow label="Tone / Personality" value={brand.tone} />
            <DataRow label="Logo URL" value={brand.logo_url} link />
            <DataRow label="Assets Folder" value={brand.assets_url} link />
            <DataRow label="Brand DO's" value={brand.dos} />
            <DataRow label="Brand DON'Ts" value={brand.donts} />
          </DataSection>

          <DataSection title="Social Media" icon={Globe} color="#ec4899">
            <DataRow label="Facebook" value={social.facebook} link />
            <DataRow label="Instagram" value={social.instagram} link />
            <DataRow label="Google Business" value={social.google_biz} link />
            <DataRow label="Yelp" value={social.yelp} link />
            <DataRow label="LinkedIn" value={social.linkedin} link />
            <DataRow label="TikTok" value={social.tiktok} link />
            <DataRow label="YouTube" value={social.youtube} link />
            <DataRow label="Twitter / X" value={social.twitter} link />
            <DataRow label="Facebook Followers" value={social.fb_followers} />
            <DataRow label="Instagram Followers" value={social.ig_followers} />
            <DataRow label="Google Rating" value={social.google_rating ? social.google_rating + "★" : null} />
            <DataRow label="Google Reviews" value={social.google_reviews} />
          </DataSection>

          <DataSection title="Website & Hosting" icon={Server} color="#6b7280">
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '8px 12px', display: 'flex', gap: 7, marginBottom: 12, alignItems: 'center' }}>
              <Lock size={12} color="#dc2626" />
              <span style={{ fontSize: 14, color: '#991b1b', fontWeight: 700 }}>Credentials are encrypted — click the eye to reveal and copy icon to copy</span>
            </div>
            <DataRow label="Hosting Provider" value={hosting.provider} />
            <DataRow label="Hosting URL" value={hosting.url} link />
            <DataRow label="Hosting Login" value={hosting.login} />
            <DataRow label="Hosting Password" value={hosting.password} masked />
            <DataRow label="Domain Registrar" value={hosting.domain_registrar} />
            <DataRow label="Domain Expiry" value={hosting.domain_expiry} />
            <DataRow label="CMS Platform" value={cms.platform} />
            <DataRow label="CMS URL" value={cms.url} link />
            <DataRow label="CMS Username" value={cms.username} />
            <DataRow label="CMS Password" value={cms.password} masked />
            <DataRow label="GA4 ID" value={tracking.ga4_id} mono />
            <DataRow label="GTM ID" value={tracking.gtm_id} mono />
            <DataRow label="Facebook Pixel" value={tracking.fb_pixel} mono />
            <DataRow label="Google Ads ID" value={tracking.google_ads_id} mono />
          </DataSection>

          <DataSection title="Marketing & Goals" icon={TrendingUp} color={ACCENT}>
            <DataRow label="Monthly Ad Budget" value={marketing.monthly_budget} />
            <DataPills label="Ad Platforms" value={marketing.platforms} color="#3b82f6" />
            <DataRow label="Current SEO Agency" value={marketing.seo_agency} />
            <DataRow label="Email Platform" value={marketing.email_platform} />
            <DataRow label="Email List Size" value={marketing.email_list} />
            <DataRow label="What Worked" value={marketing.what_worked} />
            <DataRow label="What Didn't Work" value={marketing.what_didnt} />
            <DataRow label="Primary Goal" value={goals.primary} />
            <DataPills label="Secondary Goals" value={goals.secondary} color="#8b5cf6" />
            <DataRow label="Target Leads/Mo" value={goals.leads_per_month} />
            <DataRow label="Timeline" value={goals.timeline} />
            <DataRow label="Agency Budget" value={goals.budget} />
            <DataRow label="Success Metrics" value={goals.metrics} />
            <DataRow label="Additional Notes" value={goals.notes} />
          </DataSection>

          {persona.persona_name && (
            <DataSection title={`AI Persona: "${persona.persona_name}"`} icon={Sparkles} color="#8b5cf6">
              <DataRow label="Tagline" value={persona.tagline} />
              <DataRow label="Age Range" value={persona.age_range} />
              <DataRow label="Gender" value={persona.gender} />
              <DataRow label="Income" value={persona.income} />
              <DataRow label="Location Type" value={persona.location_type} />
              <DataRow label="Psychographic Profile" value={persona.psychographic_summary} />
              <DataRow label="Search Triggers" value={persona.triggers} />
              <DataRow label="Fears / Objections" value={persona.fears} />
              <DataRow label="Decision Factors" value={persona.decision_factors} />
              <DataPills label="Google Keywords" value={persona.google_keywords} color="#3b82f6" />
              <DataPills label="Facebook Interests" value={persona.facebook_interests} color="#8b5cf6" />
              <DataRow label="Ad Headlines" value={persona.ad_headline_angles} />
              <DataPills label="Trust Signals" value={persona.trust_signals} color="#10b981" />
              <DataPills label="Best Channels" value={persona.best_channels} color="#f59e0b" />
              <DataRow label="Persona Approved" value={p.persona_approved ? "✓ Approved by client" : "Pending review"} />
              <DataRow label="Client Feedback" value={p.persona_notes} />
            </DataSection>
          )}
        </div>
      )
    })(),
    persona: (
      <Section title="AI Marketing Persona" description="AI-generated ideal customer profile, ad targeting, messaging playbook, and channel recommendations.">
        <a href={`/clients/${clientId}/persona`}
          style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#8b5cf6', color:'#fff', border:'none', borderRadius:10, padding:'11px 24px', fontSize:15, fontWeight:700, cursor:'pointer', textDecoration:'none' }}>
          ✨ Open AI Persona Builder
        </a>
        <p style={{ fontSize:14, color:'#4b5563', marginTop:10 }}>Generates: ideal customer profile, demographics, psychographics, Google/Facebook targeting, headline angles, channel recommendations, 30-day quick wins, LTV analysis.</p>
      </Section>
    ),
    access: (
      <Section title="Account Access Checklist" description="Track all platform logins, invites, and credentials needed for this client's campaigns.">
        <a href={`/clients/${clientId}/access`}
          style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#ea2729', color:'#fff', border:'none', borderRadius:10, padding:'11px 24px', fontSize:15, fontWeight:700, cursor:'pointer', textDecoration:'none' }}>
          🔑 Open Access Checklist
        </a>
        <p style={{ fontSize:14, color:'#4b5563', marginTop:10, marginBottom:0 }}>40+ platforms tracked: Website, Analytics, Ads, SEO, Social, CRM. Real-time updates when clients fill out their form.</p>
      </Section>
    ),
  }

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  if (isMobile) {
    const mTabs = [
      {key:'profile',  label:'Profile'},
      {key:'projects', label:'Projects', count:projects?.length},
      {key:'access',   label:'Access'},
    ]
    const statusColor = client?.status==='active'?'#16a34a':client?.status==='prospect'?'#ea2729':'#9a9a96'

    if (loading) return (
      <MobilePage padded={false}>
        <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Loading…</div>
      </MobilePage>
    )

    return (
      <MobilePage padded={false}>
        {/* Header */}
        <div style={{background:'#0a0a0a',padding:'16px 16px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:12,background:'#ea2729'+'20',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:20,fontWeight:800,color:'#ea2729'}}>
              {(client?.name||'?')[0].toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:18,fontWeight:800,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{client?.name}</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:statusColor+'20',color:statusColor,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",textTransform:'capitalize'}}>{client?.status||'active'}</span>
                {client?.industry && <span style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>{client.industry}</span>}
              </div>
            </div>
          </div>
        </div>

        <MobileTabs tabs={mTabs} active={activeTab} onChange={setActiveTab}/>

        {activeTab==='profile' && (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            <MobileCard style={{padding:'14px'}}>
              {[
                {label:'Email',   value:client?.email,   href:`mailto:${client?.email}`},
                {label:'Phone',   value:client?.phone,   href:`tel:${client?.phone}`},
                {label:'Website', value:client?.website, href:client?.website},
              ].filter(f=>f.value).map((f,i,arr)=>(
                <div key={f.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<arr.length-1?'1px solid #f2f2f0':'none'}}>
                  <span style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#9a9a96',textTransform:'uppercase',letterSpacing:'.05em'}}>{f.label}</span>
                  <a href={f.href} target={f.label==='Website'?'_blank':'_self'} style={{fontSize:14,color:'#ea2729',fontFamily:"'Raleway',sans-serif",textDecoration:'none',maxWidth:'60%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.value}</a>
                </div>
              ))}
            </MobileCard>
          </div>
        )}

        {activeTab==='projects' && (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {!projects?.length ? (
              <div style={{padding:'40px 0',textAlign:'center',color:'#9a9a96',fontSize:14}}>No projects yet</div>
            ) : (
              <MobileCard style={{margin:0}}>
                {projects.map((p,i)=>(
                  <MobileRow key={p.id}
                    onClick={()=>navigate(`/project/${p.id}`)}
                    borderBottom={i<projects.length-1}
                    title={p.name}
                    subtitle={p.status?.replace('_',' ')||'active'}
                    left={<div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,marginTop:4,background:'#ea2729'}}/>}/>
                ))}
              </MobileCard>
            )}
          </div>
        )}

        {activeTab==='access' && (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            <MobileCard style={{padding:'14px'}}>
              <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#9a9a96',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Portal Access</div>
              {(tokens||[]).length===0 ? (
                <div style={{fontSize:14,color:'#9a9a96',marginBottom:12}}>No access links yet</div>
              ) : (
                tokens.map((t,i)=>(
                  <div key={t.id} style={{padding:'10px 0',borderBottom:'1px solid #f2f2f0'}}>
                    <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#0a0a0a',marginBottom:4}}>{t.label||'Portal Link'}</div>
                    <div style={{fontSize:12,color:'#9a9a96',fontFamily:"'Raleway',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.url||`/access/${t.token}`}</div>
                  </div>
                ))
              )}
              <button style={{width:'100%',padding:'11px',borderRadius:10,border:'none',background:'#ea2729',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",marginTop:10}}>
                Generate Access Link
              </button>
            </MobileCard>
          </div>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/clients')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-900">{client.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {client.email && <span className="text-sm text-gray-700 flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
                {profile.industry && <span className="text-sm bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">{profile.industry}</span>}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-500 hover:underline flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-6 pb-px">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-gray-700 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tabContent[activeTab]}
        </div>
      </main>
    </div>
  )
}

// ─── Small helper components ──────────────────────────────────────────────────
function FontAdder({ onAdd }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input
        className="input flex-1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Font name (e.g. Inter, Playfair Display)"
        onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(val); setVal('') } }}
      />
      <button onClick={() => { onAdd(val); setVal('') }} className="btn-secondary text-sm">Add Font</button>
    </div>
  )
}
