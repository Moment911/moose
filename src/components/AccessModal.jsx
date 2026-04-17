"use client";
import { useState } from 'react'
import { Globe, Lock, KeyRound, X, Copy, Check, Palette } from 'lucide-react'
import { updateProject } from '../lib/supabase'
import ColorPicker from './ColorPicker'
import toast from 'react-hot-toast'

const OPTIONS = [
  {
    key: 'public',
    icon: Globe,
    title: 'Public',
    desc: 'Anyone with the link can view and add comments — no login required.',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-400',
  },
  {
    key: 'password',
    icon: KeyRound,
    title: 'Password protected',
    desc: 'Clients need a password to access. Great for confidential work.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
  },
  {
    key: 'private',
    icon: Lock,
    title: 'Private',
    desc: 'Only you (admin) can access. Clients cannot view this project.',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    border: 'border-gray-400',
  },
]

export default function AccessModal({ project, onClose, onUpdate }) {
  const [access, setAccess] = useState(project.access_level || 'private')
  const [password, setPassword] = useState(project.access_password || '')
  const [dueDate, setDueDate] = useState(project.due_date || '')
  const [maxRounds, setMaxRounds] = useState(project.max_rounds || 2)
  const [webhookUrl, setWebhookUrl] = useState(project.webhook_url || '')
  const [slackUrl, setSlackUrl] = useState(project.slack_webhook_url || '')
  const [slackChannel, setSlackChannel] = useState(project.slack_channel_url || '')
  const [brandName, setBrandName] = useState(project.brand_name || '')
  const [brandColor, setBrandColor] = useState(project.brand_color || '#E6007E')
  const [brandLogo, setBrandLogo] = useState(project.brand_logo || '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Legacy projects may have no public_token (it only started being
  // generated on file upload later in the product's life). Without it the
  // /proof-review/:token landing link is broken. Mint one lazily and
  // persist on save so old projects heal without a manual migration.
  const [publicToken, setPublicToken] = useState(
    project.public_token || (typeof crypto !== 'undefined' ? crypto.randomUUID().replace(/-/g, '') : '')
  )

  // /proof-review/:token renders ProjectReviewPage which shows ALL files
  // in the project. /review/:token is the per-file route — wrong thing
  // to hand a client when they're reviewing the whole package.
  const publicUrl = `${window.location.origin}/proof-review/${publicToken}`

  async function handleSave() {
    if (access === 'password' && !password.trim()) {
      toast.error('Please enter a password'); return
    }
    const rounds = Math.max(1, Math.min(20, Number(maxRounds) || 2))
    setSaving(true)

    // Core fields that have always existed on projects. These must save
    // or the whole action fails. Include public_token so legacy projects
    // without one get a valid share link on first save.
    const core = {
      access_level: access,
      access_password: access === 'password' ? password : null,
      due_date: dueDate || null,
      public_token: publicToken,
    }

    // Extended fields that require the 20260506 migration. If any of
    // these columns aren't in the schema yet, Supabase rejects the
    // whole update with 'column X does not exist'. We try with the
    // full payload first; on column-error we retry with core-only and
    // surface a clear message about which fields didn't stick.
    const extended = {
      max_rounds: rounds,
      webhook_url: webhookUrl.trim() || null,
      slack_webhook_url: slackUrl.trim() || null,
      slack_channel_url: slackChannel.trim() || null,
      brand_name: brandName.trim() || null,
      brand_color: brandName.trim() ? brandColor : null,
      brand_logo: brandLogo.trim() || null,
    }

    let { error } = await updateProject(project.id, { ...core, ...extended })
    let missingColumns = false
    if (error && /column .* does not exist|column ".*" of relation/i.test(error.message || '')) {
      missingColumns = true
      const retry = await updateProject(project.id, core)
      error = retry.error
    }

    if (error) { toast.error('Failed to save: ' + (error.message || 'unknown error')); setSaving(false); return }

    if (missingColumns) {
      toast('Saved core settings. Revision rounds + branding + webhooks need the 20260506 migration applied before they\'ll stick.',
        { duration: 7000, icon: '⚠️' })
    } else {
      toast.success('Access settings saved')
    }

    onUpdate({ ...project, ...core, ...(missingColumns ? {} : extended) })
    setSaving(false)
    onClose()
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied!')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md shadow-2xl" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100" style={{ flexShrink: 0 }}>
          <h2 className="font-semibold text-gray-900">Access Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Access options */}
          {OPTIONS.map(opt => {
            const Icon = opt.icon
            const selected = access === opt.key
            return (
              <div
                key={opt.key}
                onClick={() => setAccess(opt.key)}
                className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                  selected ? `${opt.bg} ${opt.border}` : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon size={18} className={selected ? opt.color : 'text-gray-400'} />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${selected ? opt.color : 'text-gray-700'}`}>{opt.title}</div>
                    <div className="text-sm text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                    {opt.key === 'password' && selected && (
                      <input
                        className="input mt-3 text-sm"
                        type="text"
                        placeholder="Enter password for clients…"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    )}
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all ${
                    selected ? `${opt.border} bg-white` : 'border-gray-300'
                  }`}>
                    {selected && <div className={`w-2 h-2 rounded-full m-auto mt-0.5 ${opt.bg.replace('bg-', 'bg-').replace('-50', '-500').replace('amber', 'amber').replace('green', 'green').replace('gray-100', 'gray-400')}`} />}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Due date */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <div className="text-sm font-medium text-gray-500 mb-2">Client feedback due by</div>
            <input type="date" className="input text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            {dueDate && <p className="text-[13px] text-gray-400 mt-1">Client will see a countdown on their review page</p>}
          </div>

          {/* Revision rounds — per-project; default 2 */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-500">Revision rounds included</div>
              <span className="text-[13px] text-gray-400">1–20</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMaxRounds(r => Math.max(1, Number(r) - 1))}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 font-semibold text-sm"
              >−</button>
              <input
                type="number"
                min={1}
                max={20}
                className="input text-sm text-center flex-1"
                value={maxRounds}
                onChange={e => setMaxRounds(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMaxRounds(r => Math.min(20, Number(r) + 1))}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 font-semibold text-sm"
              >+</button>
            </div>
            <p className="text-[13px] text-gray-400 mt-2">
              Client can submit up to {Math.max(1, Math.min(20, Number(maxRounds) || 2))} round{(Number(maxRounds) || 2) !== 1 ? 's' : ''} of feedback before the proof locks.
              Changes apply immediately.
            </p>
          </div>

          {/* White label branding */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl space-y-3">
            <div className="text-sm font-medium text-gray-500 flex items-center gap-1"><Palette size={11} /> White Label Branding</div>
            <div>
              <label className="text-[13px] text-gray-400 mb-1 block">Brand Name (replaces "Koto")</label>
              <input className="input text-sm" placeholder="Your Agency Name" value={brandName} onChange={e => setBrandName(e.target.value)} />
            </div>
            {brandName && (
              <>
                <ColorPicker label="Brand Color" value={brandColor} onChange={setBrandColor} />
                <div>
                  <label className="text-[13px] text-gray-400 mb-1 block">Logo URL (optional)</label>
                  <input className="input text-sm" placeholder="https://yoursite.com/logo.png" value={brandLogo} onChange={e => setBrandLogo(e.target.value)} />
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-[13px] text-gray-400 mb-2">Preview</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#231f20' }}>
                    {brandLogo ? <img src={brandLogo} alt="" className="h-5 object-contain" /> : <div className="w-5 h-5 rounded" style={{ background: brandColor }} />}
                    <span className="text-white text-sm font-medium">{brandName}</span>
                  </div>
                </div>
              </>
            )}
            <p className="text-[13px] text-gray-400">Client portal will show your brand instead of Koto</p>
          </div>

          {/* Webhook integrations */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl space-y-3">
            <div className="text-sm font-medium text-gray-500">Integrations</div>
            <div>
              <label className="text-[13px] text-gray-400 mb-1 block">Zapier / Make / n8n Webhook URL</label>
              <input className="input text-sm" placeholder="https://hooks.zapier.com/..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-[13px] text-gray-400 mb-1 block">Slack Incoming Webhook URL</label>
              <input className="input text-sm" placeholder="https://hooks.slack.com/services/..." value={slackUrl} onChange={e => setSlackUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-[13px] text-gray-400 mb-1 block">Slack Channel URL (direct link to channel)</label>
              <input className="input text-sm" placeholder="https://app.slack.com/client/T00/C00..." value={slackChannel} onChange={e => setSlackChannel(e.target.value)} />
            </div>
            <p className="text-[13px] text-gray-400">Webhook: auto-posts on events. Channel URL: adds "Open in Slack" button.</p>
          </div>

          {/* Share link */}
          {access !== 'private' && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-2">Client review link</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 truncate">
                  {publicUrl}
                </code>
                <button onClick={copyLink} className="btn-secondary py-2 px-3 flex-shrink-0">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
