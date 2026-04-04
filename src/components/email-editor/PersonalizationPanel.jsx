"use client";
import { useState } from 'react'
import { X, Copy, Search, ChevronDown, ChevronRight, User, Building2, MapPin, Calendar, FileText, Code } from 'lucide-react'
import toast from 'react-hot-toast'

const TOKEN_CATEGORIES = [
  { name: 'Personal', icon: User, tokens: [
    { token: '{{first_name}}', label: 'First Name', example: 'Sarah', fallback: 'Friend' },
    { token: '{{last_name}}', label: 'Last Name', example: 'Johnson', fallback: '' },
    { token: '{{full_name}}', label: 'Full Name', example: 'Sarah Johnson', fallback: '' },
    { token: '{{email}}', label: 'Email', example: 'sarah@company.com', fallback: '' },
    { token: '{{phone}}', label: 'Phone', example: '+1 (555) 123-4567', fallback: '' },
    { token: '{{prefix}}', label: 'Prefix', example: 'Dr.', fallback: '' },
    { token: '{{nickname}}', label: 'Nickname', example: 'Sarah', fallback: '' },
  ]},
  { name: 'Company', icon: Building2, tokens: [
    { token: '{{company}}', label: 'Company', example: 'Acme Corp', fallback: 'your company' },
    { token: '{{job_title}}', label: 'Job Title', example: 'Marketing Director', fallback: '' },
    { token: '{{department}}', label: 'Department', example: 'Marketing', fallback: '' },
    { token: '{{industry}}', label: 'Industry', example: 'Technology', fallback: '' },
    { token: '{{website}}', label: 'Website', example: 'https://acme.com', fallback: '' },
  ]},
  { name: 'Location', icon: MapPin, tokens: [
    { token: '{{city}}', label: 'City', example: 'Miami', fallback: '' },
    { token: '{{state}}', label: 'State', example: 'Florida', fallback: '' },
    { token: '{{country}}', label: 'Country', example: 'United States', fallback: '' },
    { token: '{{zip_code}}', label: 'Zip Code', example: '33101', fallback: '' },
  ]},
  { name: 'Date & Time', icon: Calendar, tokens: [
    { token: '{{today}}', label: 'Today (full)', example: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), fallback: '' },
    { token: '{{today_short}}', label: 'Today (short)', example: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), fallback: '' },
    { token: '{{current_year}}', label: 'Current Year', example: new Date().getFullYear().toString(), fallback: '' },
    { token: '{{current_month}}', label: 'Current Month', example: new Date().toLocaleDateString('en-US', { month: 'long' }), fallback: '' },
  ]},
  { name: 'Campaign', icon: FileText, tokens: [
    { token: '{{campaign_name}}', label: 'Campaign Name', example: 'April Newsletter', fallback: '' },
    { token: '{{subject_line}}', label: 'Subject Line', example: 'Your designs are ready!', fallback: '' },
    { token: '{{unsubscribe_link}}', label: 'Unsubscribe Link', example: '#unsubscribe', fallback: '' },
    { token: '{{view_in_browser}}', label: 'View in Browser', example: '#browser', fallback: '' },
  ]},
]

// Replace all personalization tokens in text with contact data
export function replaceTokens(text, contact = {}, campaign = {}) {
  if (!text) return text
  let result = text

  const replacements = {
    '{{first_name}}': contact.first_name || '',
    '{{last_name}}': contact.last_name || '',
    '{{full_name}}': [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '',
    '{{email}}': contact.email || '',
    '{{phone}}': contact.phone || contact.phone_mobile || '',
    '{{prefix}}': contact.prefix || '',
    '{{nickname}}': contact.nickname || contact.first_name || '',
    '{{company}}': contact.company || '',
    '{{job_title}}': contact.job_title || '',
    '{{department}}': contact.department || '',
    '{{industry}}': contact.industry || '',
    '{{website}}': contact.website || '',
    '{{city}}': contact.city || '',
    '{{state}}': contact.state || '',
    '{{country}}': contact.country || '',
    '{{zip_code}}': contact.zip_code || '',
    '{{today}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '{{today_short}}': new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    '{{current_year}}': new Date().getFullYear().toString(),
    '{{current_month}}': new Date().toLocaleDateString('en-US', { month: 'long' }),
    '{{campaign_name}}': campaign.name || '',
    '{{subject_line}}': campaign.subject || '',
    '{{unsubscribe_link}}': '#unsubscribe',
    '{{view_in_browser}}': '#browser',
  }

  // Handle tokens with fallback: {{first_name|Friend}}
  result = result.replace(/\{\{(\w+)\|([^}]+)\}\}/g, (match, key, fallback) => {
    const val = replacements[`{{${key}}}`]
    return val || fallback
  })

  // Handle regular tokens
  for (const [token, val] of Object.entries(replacements)) {
    result = result.split(token).join(val)
  }

  // Handle conditional: {{#if field}}...{{/if}}
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, field, content) => {
    const val = contact[field]
    return val ? replaceTokens(content, contact, campaign) : ''
  })

  return result
}

export default function PersonalizationPanel({ open, onClose, onInsert, contacts = [], campaign = {} }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({ Personal: true })
  const [previewContact, setPreviewContact] = useState(null)

  function handleInsert(token) {
    onInsert(token)
    toast.success('Token inserted')
  }

  function handleCopy(token) {
    navigator.clipboard.writeText(token)
    toast.success('Copied!')
  }

  const allTokens = TOKEN_CATEGORIES.flatMap(c => c.tokens)
  const filtered = search ? allTokens.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.token.includes(search.toLowerCase())) : null

  if (!open) return null

  return (
    <div className="w-72 bg-gray-900 text-white flex flex-col h-full border-l border-gray-700 flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-momenta-400" />
          <span className="text-sm font-semibold">Personalization</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={14} /></button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2.5 py-1.5">
          <Search size={12} className="text-gray-400" />
          <input className="text-xs bg-transparent outline-none flex-1 text-white placeholder-gray-500" placeholder="Search tokens..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto">
        {filtered ? (
          <div className="p-2 space-y-0.5">
            {filtered.map(t => (
              <TokenRow key={t.token} token={t} onInsert={handleInsert} onCopy={handleCopy} previewContact={previewContact} campaign={campaign} />
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No matching tokens</p>}
          </div>
        ) : (
          TOKEN_CATEGORIES.map(cat => {
            const I = cat.icon
            const isExpanded = expanded[cat.name]
            return (
              <div key={cat.name}>
                <button onClick={() => setExpanded(e => ({ ...e, [cat.name]: !isExpanded }))}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <I size={12} />
                  {cat.name}
                  <span className="ml-auto text-gray-600 text-[10px]">{cat.tokens.length}</span>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-1 space-y-0.5">
                    {cat.tokens.map(t => (
                      <TokenRow key={t.token} token={t} onInsert={handleInsert} onCopy={handleCopy} previewContact={previewContact} campaign={campaign} />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Fallback guide */}
        <div className="px-4 py-3 border-t border-white/10 mt-2">
          <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1.5">Fallback Values</p>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Use <code className="bg-white/10 px-1 rounded text-momenta-300">{'{{first_name|Friend}}'}</code> to show "Friend" when name is empty.
          </p>
          <p className="text-[9px] text-gray-500 mt-2 uppercase font-semibold mb-1.5">Conditionals</p>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            <code className="bg-white/10 px-1 rounded text-momenta-300">{'{{#if company}}At {{company}}{{/if}}'}</code>
          </p>
        </div>
      </div>

      {/* Preview with contact */}
      <div className="px-3 py-2.5 border-t border-white/10 flex-shrink-0">
        <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1">Preview with:</p>
        <select className="w-full text-xs bg-white/10 border-0 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-momenta-400"
          value={previewContact?.id || ''} onChange={e => setPreviewContact(contacts.find(c => c.id === e.target.value) || null)}>
          <option value="">Example values</option>
          {contacts.slice(0, 20).map(c => <option key={c.id} value={c.id}>{c.first_name ? `${c.first_name} ${c.last_name || ''}` : c.email}</option>)}
        </select>
      </div>
    </div>
  )
}

function TokenRow({ token: t, onInsert, onCopy, previewContact, campaign }) {
  const previewValue = previewContact ? replaceTokens(t.token, previewContact, campaign) : t.example
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => onInsert(t.token)}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 font-mono">{t.token}</p>
        <p className="text-[10px] text-gray-500 truncate">{previewValue || <span className="italic">empty</span>}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); onCopy(t.token) }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white p-0.5"><Copy size={10} /></button>
    </div>
  )
}
