"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getOnboardingToken, upsertClientProfile, markTokenUsed, uploadOnboardingFile } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

const TOTAL_STEPS = 7;
const ACCENT = '#E8551A';

const INDUSTRY_OPTIONS = [
  'Accounting', 'Agriculture', 'Automotive', 'Construction', 'Consulting',
  'Dental', 'E-commerce', 'Education', 'Entertainment', 'Financial Services',
  'Fitness & Wellness', 'Food & Beverage', 'Healthcare', 'Hospitality',
  'Insurance', 'Legal', 'Manufacturing', 'Marketing & Advertising',
  'Nonprofit', 'Real Estate', 'Retail', 'SaaS / Technology', 'Transportation', 'Other',
];

const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const REVENUE_RANGES = ['Under $100K', '$100K-$500K', '$500K-$1M', '$1M-$5M', '$5M+'];
const CMS_OPTIONS = ['WordPress', 'Shopify', 'Squarespace', 'Wix', 'Custom', 'Other'];
const BUDGET_RANGES = ['Under $1,000', '$1,000-$3,000', '$3,000-$5,000', '$5,000-$10,000', '$10,000-$25,000', '$25,000+'];
const GOAL_OPTIONS = [
  'More traffic', 'More leads', 'Better SEO', 'Social growth',
  'Email marketing', 'Brand awareness', 'PPC/Ads', 'Content marketing',
];

// ─── Reusable form primitives ──────────────────────────────────────────────────

function Label({ children, htmlFor }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

function Input({ id, value, onChange, placeholder, type = 'text', ...rest }) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition"
      {...rest}
    />
  );
}

function Select({ id, value, onChange, options, placeholder }) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition bg-white"
    >
      <option value="">{placeholder || 'Select...'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Textarea({ id, value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition resize-y"
    />
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function FieldGroup({ children, className = '' }) {
  return <div className={`grid gap-4 ${className}`}>{children}</div>;
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const pct = (step / TOTAL_STEPS) * 100;
  return (
    <div className="mb-8">
      <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
        <span>Step {step} of {TOTAL_STEPS}</span>
        <span>{Math.round(pct)}% complete</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
        />
      </div>
    </div>
  );
}

// ─── Step components ───────────────────────────────────────────────────────────

function StepBusiness({ data, set }) {
  const f = data;
  const s = (key) => (e) => set({ ...f, [key]: e.target.value });
  const sa = (key) => (e) => set({ ...f, address: { ...f.address, [key]: e.target.value } });

  return (
    <>
      <SectionHeading title="Business Information" subtitle="Tell us about your business so we can tailor our strategy." />
      <FieldGroup className="sm:grid-cols-2">
        <div><Label htmlFor="biz-name">Business Name *</Label><Input id="biz-name" value={f.business_name} onChange={s('business_name')} placeholder="Acme Corp" /></div>
        <div><Label htmlFor="legal-name">Legal Name</Label><Input id="legal-name" value={f.legal_name} onChange={s('legal_name')} placeholder="Acme Corporation LLC" /></div>
        <div><Label htmlFor="ein">EIN</Label><Input id="ein" value={f.ein} onChange={s('ein')} placeholder="XX-XXXXXXX" /></div>
        <div><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" value={f.phone} onChange={s('phone')} placeholder="(555) 123-4567" /></div>
        <div><Label htmlFor="website">Website</Label><Input id="website" type="url" value={f.website} onChange={s('website')} placeholder="https://example.com" /></div>
        <div><Label htmlFor="industry">Industry</Label><Select id="industry" value={f.industry} onChange={s('industry')} options={INDUSTRY_OPTIONS} placeholder="Select industry..." /></div>
        <div><Label htmlFor="founded">Founded Date</Label><Input id="founded" type="date" value={f.founded_date} onChange={s('founded_date')} /></div>
        <div><Label htmlFor="employees">Employee Count</Label><Select id="employees" value={f.employee_count} onChange={s('employee_count')} options={EMPLOYEE_RANGES} placeholder="Select range..." /></div>
        <div className="sm:col-span-2"><Label htmlFor="revenue">Revenue Range</Label><Select id="revenue" value={f.revenue_range} onChange={s('revenue_range')} options={REVENUE_RANGES} placeholder="Select range..." /></div>
      </FieldGroup>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Address</h3>
        <FieldGroup className="sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="street">Street</Label><Input id="street" value={f.address.street} onChange={sa('street')} placeholder="123 Main St" /></div>
          <div><Label htmlFor="city">City</Label><Input id="city" value={f.address.city} onChange={sa('city')} placeholder="Springfield" /></div>
          <div><Label htmlFor="state">State</Label><Input id="state" value={f.address.state} onChange={sa('state')} placeholder="IL" /></div>
          <div><Label htmlFor="zip">Zip</Label><Input id="zip" value={f.address.zip} onChange={sa('zip')} placeholder="62704" /></div>
          <div><Label htmlFor="country">Country</Label><Input id="country" value={f.address.country} onChange={sa('country')} placeholder="United States" /></div>
        </FieldGroup>
      </div>
    </>
  );
}

function StepSocial({ data, set }) {
  const platforms = [
    { key: 'facebook', label: 'Facebook', ph: 'https://facebook.com/yourbusiness' },
    { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/yourbusiness' },
    { key: 'twitter', label: 'Twitter / X', ph: 'https://x.com/yourbusiness' },
    { key: 'linkedin', label: 'LinkedIn', ph: 'https://linkedin.com/company/yourbusiness' },
    { key: 'tiktok', label: 'TikTok', ph: 'https://tiktok.com/@yourbusiness' },
    { key: 'youtube', label: 'YouTube', ph: 'https://youtube.com/@yourbusiness' },
    { key: 'pinterest', label: 'Pinterest', ph: 'https://pinterest.com/yourbusiness' },
  ];
  return (
    <>
      <SectionHeading title="Social Media" subtitle="Share your social profiles so we can audit your online presence." />
      <FieldGroup>
        {platforms.map(({ key, label, ph }) => (
          <div key={key}>
            <Label htmlFor={`social-${key}`}>{label}</Label>
            <Input
              id={`social-${key}`}
              type="url"
              value={data[key]?.url || ''}
              onChange={(e) => set({ ...data, [key]: { url: e.target.value } })}
              placeholder={ph}
            />
          </div>
        ))}
      </FieldGroup>
    </>
  );
}

function StepHosting({ data, set }) {
  const s = (key) => (e) => set({ ...data, [key]: e.target.value });
  return (
    <>
      <SectionHeading title="Hosting & Technology" subtitle="Help us understand your current tech stack." />
      <FieldGroup className="sm:grid-cols-2">
        <div><Label htmlFor="registrar">Domain Registrar</Label><Input id="registrar" value={data.domain_registrar} onChange={s('domain_registrar')} placeholder="GoDaddy, Namecheap, etc." /></div>
        <div><Label htmlFor="hosting">Hosting Provider</Label><Input id="hosting" value={data.hosting_provider} onChange={s('hosting_provider')} placeholder="Bluehost, AWS, Vercel, etc." /></div>
        <div><Label htmlFor="cms">CMS</Label><Select id="cms" value={data.cms} onChange={s('cms')} options={CMS_OPTIONS} placeholder="Select CMS..." /></div>
        <div><Label htmlFor="cms-login">CMS Login URL</Label><Input id="cms-login" type="url" value={data.cms_login_url} onChange={s('cms_login_url')} placeholder="https://yourdomain.com/wp-admin" /></div>
        <div><Label htmlFor="dns">DNS Provider</Label><Input id="dns" value={data.dns_provider} onChange={s('dns_provider')} placeholder="Cloudflare, Route53, etc." /></div>
        <div className="sm:col-span-2"><Label htmlFor="hosting-notes">Notes</Label><Textarea id="hosting-notes" value={data.notes} onChange={s('notes')} placeholder="Any additional details about your tech setup..." /></div>
      </FieldGroup>
    </>
  );
}

function StepBrand({ data, set, clientId }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) { toast.error('Please upload a PNG, JPG, SVG, or WEBP file.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB.'); return; }
    setUploading(true);
    try {
      const { url, path } = await uploadOnboardingFile(file, clientId);
      set({ ...data, logo_url: url, logo_storage_path: path });
      toast.success('Logo uploaded!');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const addColor = () => set({ ...data, colors: [...data.colors, '#E8551A'] });
  const updateColor = (i, v) => { const c = [...data.colors]; c[i] = v; set({ ...data, colors: c }); };
  const removeColor = (i) => { const c = [...data.colors]; c.splice(i, 1); set({ ...data, colors: c }); };

  return (
    <>
      <SectionHeading title="Brand Assets" subtitle="Share your brand elements so we maintain consistency across all marketing." />

      {/* Logo upload */}
      <div className="mb-6">
        <Label>Logo</Label>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {data.logo_url ? (
            <div className="flex flex-col items-center gap-3">
              <img src={data.logo_url} alt="Logo preview" className="max-h-24 object-contain" />
              <span className="text-xs text-gray-500">Click or drag to replace</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" /></svg>
              <p className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Drag & drop your logo here, or click to browse'}</p>
              <p className="text-xs text-gray-400">PNG, JPG, SVG, or WEBP up to 10 MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      </div>

      {/* Brand colors */}
      <div className="mb-6">
        <Label>Brand Colors</Label>
        <div className="flex flex-wrap gap-3 items-center">
          {data.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 border">
              <input type="color" value={c} onChange={(e) => updateColor(i, e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
              <span className="text-xs font-mono text-gray-600 uppercase">{c}</span>
              <button type="button" onClick={() => removeColor(i)} className="ml-1 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
            </div>
          ))}
          <button type="button" onClick={addColor} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition">+ Add color</button>
        </div>
      </div>

      <FieldGroup>
        <div><Label htmlFor="fonts">Fonts Used</Label><Input id="fonts" value={data.fonts.join(', ')} onChange={(e) => set({ ...data, fonts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Helvetica, Georgia, Open Sans" /></div>
        <div><Label htmlFor="voice">Brand Voice / Tone</Label><Textarea id="voice" value={data.voice_tone} onChange={(e) => set({ ...data, voice_tone: e.target.value })} placeholder="Professional yet approachable, warm and conversational..." /></div>
        <div><Label htmlFor="tagline">Tagline</Label><Input id="tagline" value={data.tagline} onChange={(e) => set({ ...data, tagline: e.target.value })} placeholder="Your catchy tagline" /></div>
        <div><Label htmlFor="mission">Mission Statement</Label><Textarea id="mission" value={data.mission_statement} onChange={(e) => set({ ...data, mission_statement: e.target.value })} placeholder="Our mission is to..." /></div>
      </FieldGroup>
    </>
  );
}

function StepGoogle({ data, set }) {
  const s = (key) => (e) => set({ ...data, [key]: e.target.value });
  return (
    <>
      <SectionHeading title="Google Accounts" subtitle="These help us audit your current marketing setup." />
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-700">
        <strong>Note:</strong> Sharing these details lets us analyze your current performance and identify quick wins. You can skip any you don't have.
      </div>
      <FieldGroup>
        <div><Label htmlFor="gbp">Google Business Profile URL</Label><Input id="gbp" type="url" value={data.gbp_url} onChange={s('gbp_url')} placeholder="https://business.google.com/..." /></div>
        <div><Label htmlFor="ga">Google Analytics Property ID</Label><Input id="ga" value={data.analytics_id} onChange={s('analytics_id')} placeholder="G-XXXXXXXXXX or UA-XXXXXXXX-X" /></div>
        <div><Label htmlFor="gads">Google Ads Account ID</Label><Input id="gads" value={data.ads_id} onChange={s('ads_id')} placeholder="XXX-XXX-XXXX" /></div>
        <div><Label htmlFor="gsc">Google Search Console URL</Label><Input id="gsc" type="url" value={data.search_console_url} onChange={s('search_console_url')} placeholder="https://search.google.com/search-console/..." /></div>
      </FieldGroup>
    </>
  );
}

function StepMarketing({ data, set }) {
  const toggleGoal = (goal) => {
    const goals = data.goals.includes(goal) ? data.goals.filter((g) => g !== goal) : [...data.goals, goal];
    set({ ...data, goals });
  };
  return (
    <>
      <SectionHeading title="Marketing Info" subtitle="Help us understand your goals and competitive landscape." />
      <FieldGroup>
        <div><Label htmlFor="audience">Target Audience</Label><Textarea id="audience" value={data.target_audience} onChange={(e) => set({ ...data, target_audience: e.target.value })} placeholder="Describe your ideal customer: demographics, interests, pain points..." rows={4} /></div>
        <div><Label htmlFor="competitors">Main Competitors</Label><Textarea id="competitors" value={data.competitors.join('\n')} onChange={(e) => set({ ...data, competitors: e.target.value.split('\n').filter(Boolean) })} placeholder="One competitor per line&#10;e.g. Competitor A&#10;Competitor B" rows={4} /></div>
        <div><Label htmlFor="budget">Current Monthly Marketing Budget</Label><Select id="budget" value={data.current_budget} onChange={(e) => set({ ...data, current_budget: e.target.value })} options={BUDGET_RANGES} placeholder="Select range..." /></div>
        <div>
          <Label>Marketing Goals</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {GOAL_OPTIONS.map((goal) => (
              <label key={goal} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-all ${
                data.goals.includes(goal) ? 'border-orange-400 bg-orange-50 text-orange-800 font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}>
                <input type="checkbox" checked={data.goals.includes(goal)} onChange={() => toggleGoal(goal)} className="accent-orange-500" />
                {goal}
              </label>
            ))}
          </div>
        </div>
      </FieldGroup>
    </>
  );
}

function StepContacts({ data, set }) {
  const blank = { name: '', role: '', email: '', phone: '', is_primary: false, is_billing: false, is_decision_maker: false };
  const contacts = data.length > 0 ? data : [{ ...blank }];

  const update = (i, key, val) => {
    const c = [...contacts];
    c[i] = { ...c[i], [key]: val };
    set(c);
  };

  const add = () => set([...contacts, { ...blank }]);
  const remove = (i) => { if (contacts.length === 1) return; const c = [...contacts]; c.splice(i, 1); set(c); };

  return (
    <>
      <SectionHeading title="Team Contacts" subtitle="Who should we be in touch with? Add all relevant team members." />
      {contacts.map((c, i) => (
        <div key={i} className={`rounded-xl border border-gray-200 p-5 mb-4 ${i > 0 ? '' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Contact {i + 1}</span>
            {contacts.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
            )}
          </div>
          <FieldGroup className="sm:grid-cols-2">
            <div><Label htmlFor={`c-name-${i}`}>Name *</Label><Input id={`c-name-${i}`} value={c.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Jane Smith" /></div>
            <div><Label htmlFor={`c-role-${i}`}>Role / Title</Label><Input id={`c-role-${i}`} value={c.role} onChange={(e) => update(i, 'role', e.target.value)} placeholder="Marketing Director" /></div>
            <div><Label htmlFor={`c-email-${i}`}>Email *</Label><Input id={`c-email-${i}`} type="email" value={c.email} onChange={(e) => update(i, 'email', e.target.value)} placeholder="jane@company.com" /></div>
            <div><Label htmlFor={`c-phone-${i}`}>Phone</Label><Input id={`c-phone-${i}`} type="tel" value={c.phone} onChange={(e) => update(i, 'phone', e.target.value)} placeholder="(555) 123-4567" /></div>
          </FieldGroup>
          <div className="flex flex-wrap gap-4 mt-3">
            {[['is_primary', 'Primary Contact'], ['is_billing', 'Billing Contact'], ['is_decision_maker', 'Decision Maker']].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={c[key]} onChange={(e) => update(i, key, e.target.checked)} className="accent-orange-500 w-4 h-4" />
                {label}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="w-full py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-600 transition">
        + Add another contact
      </button>
    </>
  );
}

// ─── Initial state factories ───────────────────────────────────────────────────

const initBusiness = () => ({
  business_name: '', legal_name: '', ein: '', phone: '', website: '', industry: '',
  founded_date: '', employee_count: '', revenue_range: '',
  address: { street: '', city: '', state: '', zip: '', country: '' },
});

const initSocial = () => ({
  facebook: { url: '' }, instagram: { url: '' }, twitter: { url: '' }, linkedin: { url: '' },
  tiktok: { url: '' }, youtube: { url: '' }, pinterest: { url: '' },
});

const initHosting = () => ({ domain_registrar: '', hosting_provider: '', cms: '', cms_login_url: '', dns_provider: '', notes: '' });

const initBrand = () => ({ logo_url: '', logo_storage_path: '', colors: [], fonts: [], voice_tone: '', tagline: '', mission_statement: '' });

const initGoogle = () => ({ gbp_url: '', analytics_id: '', ads_id: '', search_console_url: '' });

const initMarketing = () => ({ target_audience: '', competitors: [], current_budget: '', goals: [] });

const initContacts = () => [{ name: '', role: '', email: '', phone: '', is_primary: true, is_billing: false, is_decision_maker: false }];

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | invalid | expired | used | ready | submitted
  const [tokenData, setTokenData] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [business, setBusiness] = useState(initBusiness);
  const [social, setSocial] = useState(initSocial);
  const [hosting, setHosting] = useState(initHosting);
  const [brand, setBrand] = useState(initBrand);
  const [google, setGoogle] = useState(initGoogle);
  const [marketing, setMarketing] = useState(initMarketing);
  const [contacts, setContacts] = useState(initContacts);

  // ─── Restore from localStorage ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    try {
      const saved = localStorage.getItem(`onboarding-${token}`);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.business) setBusiness(d.business);
        if (d.social) setSocial(d.social);
        if (d.hosting) setHosting(d.hosting);
        if (d.brand) setBrand(d.brand);
        if (d.google) setGoogle(d.google);
        if (d.marketing) setMarketing(d.marketing);
        if (d.contacts) setContacts(d.contacts);
        if (d.step) setStep(d.step);
      }
    } catch { /* ignore parse errors */ }
  }, [token]);

  // ─── Save to localStorage on every step change ──────────────────────────────
  const persist = useCallback(() => {
    if (!token) return;
    try {
      localStorage.setItem(`onboarding-${token}`, JSON.stringify({ business, social, hosting, brand, google, marketing, contacts, step }));
    } catch { /* quota exceeded, ignore */ }
  }, [token, business, social, hosting, brand, google, marketing, contacts, step]);

  useEffect(() => { persist(); }, [persist]);

  // ─── Validate token on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const { data, error } = await getOnboardingToken(token);
        if (error || !data) { setStatus('invalid'); return; }
        if (data.used_at) { setStatus('used'); return; }
        if (data.expires_at && new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }
        setTokenData(data);
        setStatus('ready');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [token]);

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    if (step === 1 && !business.business_name.trim()) {
      toast.error('Business name is required.');
      return false;
    }
    if (step === 7) {
      const first = contacts[0];
      if (!first?.name?.trim() || !first?.email?.trim()) {
        toast.error('At least one contact with name and email is required.');
        return false;
      }
    }
    return true;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        business_name: business.business_name,
        legal_name: business.legal_name,
        ein: business.ein,
        phone: business.phone,
        website: business.website,
        industry: business.industry,
        founded_date: business.founded_date || null,
        employee_count: business.employee_count,
        revenue_range: business.revenue_range,
        address: business.address,
        social_media: social,
        hosting,
        brand,
        google_accounts: google,
        marketing,
        contacts,
        onboarding_completed_at: new Date().toISOString(),
      };

      const { error: profileError } = await upsertClientProfile(tokenData.client_id, payload);
      if (profileError) throw profileError;

      const { error: tokenError } = await markTokenUsed(token);
      if (tokenError) throw tokenError;

      localStorage.removeItem(`onboarding-${token}`);
      setStatus('submitted');
      toast.success('Onboarding complete!');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
      console.error('Onboarding submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Navigation ─────────────────────────────────────────────────────────────
  const next = () => { if (!validate()) return; setStep((s) => Math.min(s + 1, TOTAL_STEPS)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const back = () => { setStep((s) => Math.max(s - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1: return <StepBusiness data={business} set={setBusiness} />;
      case 2: return <StepSocial data={social} set={setSocial} />;
      case 3: return <StepHosting data={hosting} set={setHosting} />;
      case 4: return <StepBrand data={brand} set={setBrand} clientId={tokenData?.client_id} />;
      case 5: return <StepGoogle data={google} set={setGoogle} />;
      case 6: return <StepMarketing data={marketing} set={setMarketing} />;
      case 7: return <StepContacts data={contacts} set={setContacts} />;
      default: return null;
    }
  };

  const MooseHeader = () => (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
          <span className="text-white font-bold text-sm">M</span>
        </div>
        <span className="text-xl font-bold text-gray-900">Moose AI</span>
      </div>
      {status === 'ready' && tokenData?.clients?.name && (
        <p className="text-sm text-gray-500">Onboarding for <span className="font-medium text-gray-700">{tokenData.clients.name}</span></p>
      )}
    </div>
  );

  // ─── Error / status screens ─────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid' || status === 'expired' || status === 'used') {
    const messages = {
      invalid: { icon: '!', title: 'Invalid Link', desc: 'This onboarding link is not valid. Please contact your agency for a new link.' },
      expired: { icon: '!', title: 'Link Expired', desc: 'This onboarding link has expired. Please contact your agency to request a new one.' },
      used: { icon: '\u2713', title: 'Already Completed', desc: 'This onboarding form has already been submitted. If you need to make changes, please contact your agency.' },
    };
    const m = messages[status];
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <MooseHeader />
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white ${status === 'used' ? 'bg-green-500' : 'bg-red-500'}`}>
            {m.icon}
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{m.title}</h1>
          <p className="text-gray-500">{m.desc}</p>
        </div>
      </div>
    );
  }

  // ─── Thank you screen ──────────────────────────────────────────────────────
  if (status === 'submitted') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <MooseHeader />
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-500 mb-6">Your onboarding information has been submitted successfully. Our team will review everything and be in touch soon.</p>
          <div className="inline-block rounded-lg bg-gray-50 border px-4 py-3 text-sm text-gray-600">
            You can safely close this page.
          </div>
        </div>
      </div>
    );
  }

  // ─── Wizard ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      <div className="max-w-2xl mx-auto">
        <MooseHeader />
        <ProgressBar step={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition ${
              step === 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm'
            }`}
          >
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={next}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 transition"
              style={{ backgroundColor: ACCENT }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 transition disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Submitting...
                </span>
              ) : 'Submit'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">Your data is securely transmitted and stored. Questions? Contact your agency rep.</p>
      </div>
    </div>
  );
}
