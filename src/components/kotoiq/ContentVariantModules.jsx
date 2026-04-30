"use client"
import { useState } from 'react'
import { LayoutGrid, Loader2, Sparkles, Copy, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const MODULES = [
  { id: 'intro', label: 'Introduction', desc: 'Opening headline + value proposition', icon: '📝' },
  { id: 'what_is', label: 'What Is This Service', desc: 'Educational explainer content', icon: '❓' },
  { id: 'why_us', label: 'Why Choose Us', desc: 'Trust signals + differentiators', icon: '✅' },
  { id: 'services', label: 'Services Offered', desc: 'Service breakdown with descriptions', icon: '📋' },
  { id: 'local', label: 'Local Area Focus', desc: 'Hyperlocal city/area content', icon: '📍' },
  { id: 'process', label: 'Our Process', desc: 'Step-by-step how-it-works', icon: '⚙️' },
  { id: 'trust', label: 'Trust & Social Proof', desc: 'Reviews + testimonials', icon: '⭐' },
  { id: 'comparison', label: 'Comparison / vs.', desc: 'Pro vs DIY, local vs national', icon: '⚖️' },
  { id: 'faq', label: 'FAQ Block', desc: 'AEO-optimized with schema markup', icon: '💬' },
  { id: 'internal_links', label: 'Internal Links', desc: 'Service area + related page links', icon: '🔗' },
  { id: 'cta', label: 'Call to Action', desc: 'Conversion-focused closing section', icon: '📞' },
]

export default function ContentVariantModules({ clientId, agencyId }) {
  const [keyword, setKeyword] = useState('')
  const [generating, setGenerating] = useState(null) // module id
  const [generatingAll, setGeneratingAll] = useState(false)
  const [results, setResults] = useState({}) // { [moduleId]: { variants: string[] } }
  const [expanded, setExpanded] = useState(null)

  const generateModule = async (mod) => {
    setGenerating(mod.id)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_content_variant',
          client_id: clientId,
          agency_id: agencyId,
          module_id: mod.id,
          module_label: mod.label,
          module_desc: mod.desc,
          keyword: keyword || undefined,
          variant_count: 2,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setResults(prev => ({ ...prev, [mod.id]: j }))
      toast.success(`${mod.label} variants generated`)
    } catch (e) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setGenerating(null)
    }
  }

  const generateAll = async () => {
    setGeneratingAll(true)
    for (const mod of MODULES) {
      await generateModule(mod)
    }
    setGeneratingAll(false)
    toast.success('All modules generated')
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <LayoutGrid size={18} color={AMB} /> Content Variant Modules
        </div>
        <button onClick={generateAll} disabled={generatingAll || generating}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: generatingAll ? 'wait' : 'pointer', opacity: generatingAll ? 0.6 : 1 }}>
          {generatingAll ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
          {generatingAll ? 'Generating All...' : 'Generate All Variants'}
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="Target keyword (optional — e.g. emergency plumber boca raton)"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ececef', fontSize: 13, outline: 'none' }} />
      </div>

      <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 14, lineHeight: 1.6 }}>
        Generate multiple content variants per section. Click a module to generate, or use "Generate All" for the full set.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODULES.map(mod => {
          const hasResult = results[mod.id]
          const isRunning = generating === mod.id
          return (
            <div key={mod.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, border: `1px solid ${hasResult ? GRN + '40' : '#ececef'}`, background: hasResult ? GRN + '04' : '#fff', cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}>
                <span style={{ fontSize: 20, width: 36, textAlign: 'center' }}>{mod.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: BLK }}>{mod.label}</div>
                  <div style={{ fontSize: 12, color: '#1f1f22' }}>{mod.desc}</div>
                </div>
                {hasResult && <CheckCircle size={16} color={GRN} />}
                {hasResult && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: GRN + '12', color: GRN }}>{hasResult.variants?.length || 0} variants</span>}
                <button onClick={e => { e.stopPropagation(); generateModule(mod) }} disabled={isRunning || generatingAll}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: `1px solid #ececef`, background: '#fff', fontSize: 11, fontWeight: 700, cursor: isRunning ? 'wait' : 'pointer', color: T }}>
                  {isRunning ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={10} />}
                  {isRunning ? 'Generating...' : hasResult ? 'Regenerate' : 'Generate'}
                </button>
              </div>

              {expanded === mod.id && hasResult && (
                <div style={{ padding: '14px 18px', background: '#f9f9fb', borderRadius: '0 0 10px 10px', border: '1px solid #ececef', borderTop: 'none', marginTop: -2 }}>
                  {(hasResult.variants || []).map((v, vi) => (
                    <div key={vi} style={{ marginBottom: 12, padding: '12px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ececef', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: T, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Variant {vi + 1}</span>
                        <button onClick={() => copyToClipboard(v.content || v)}
                          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid #ececef', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#6b6b70' }}>
                          <Copy size={10} /> Copy
                        </button>
                      </div>
                      <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {typeof v === 'string' ? v : v.content || JSON.stringify(v)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: '#f9f9fb', border: `1px solid #ececef`, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
        <strong>How rotation works:</strong> After publishing via the WP plugin, each section's variants rotate every 10 page views — updating <code>last_modified</code> and pinging Google/Bing for re-indexing.
      </div>
    </div>
  )
}
