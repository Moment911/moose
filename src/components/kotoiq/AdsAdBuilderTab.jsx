"use client"
import { useState } from 'react'
import { Zap, Loader2, Copy, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }
const input = { width: '100%', padding: '10px 12px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 700, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4, display: 'block' }

const PLATFORMS = [
  { id: 'google', name: 'Google RSA', desc: '15 headlines + 4 descriptions' },
  { id: 'meta', name: 'Meta Ads', desc: '3-5 creative variants' },
  { id: 'linkedin', name: 'LinkedIn', desc: '3-5 B2B variants' },
  { id: 'tiktok', name: 'TikTok', desc: '3-5 hook concepts' },
]

export default function AdsAdBuilderTab({ clientId, agencyId }) {
  const [platform, setPlatform] = useState('google')
  const [brief, setBrief] = useState({ offer: '', campaign_theme: '', audience_persona: '', landing_page_url: '' })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)

  const generate = async () => {
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_generate_copy', client_id: clientId, agency_id: agencyId, platform, brief }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult(json.data || json)
      toast.success(`Generated ${json.variants_saved || 0} ad variants`)
    } catch (e) { toast.error(e.message || 'Generation failed') }
    finally { setGenerating(false) }
  }

  const copyText = (text) => { navigator.clipboard.writeText(text); toast.success('Copied') }

  return (
    <div>
      <HowItWorks tool="ads-ad-builder" />
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 16 }}>Ad Copy Builder</div>

      {/* Platform Selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => { setPlatform(p.id); setResult(null) }}
            style={{ flex: 1, padding: '14px', borderRadius: 10, border: platform === p.id ? `2px solid ${T}` : '2px solid #ececef', background: platform === p.id ? '#f0f9ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 800, fontSize: 14, color: platform === p.id ? '#5aa0ff' : BLK }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#6b6b70', marginTop: 2 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      {/* Brief Form */}
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14 }}>Creative Brief</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <span style={label}>Offer / CTA</span>
            <input style={input} value={brief.offer} onChange={e => setBrief({ ...brief, offer: e.target.value })} placeholder="e.g., Get 30% off your first month" />
          </div>
          <div>
            <span style={label}>Landing Page URL</span>
            <input style={input} value={brief.landing_page_url} onChange={e => setBrief({ ...brief, landing_page_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <span style={label}>{platform === 'google' ? 'Campaign Theme' : 'Audience Persona'}</span>
            <input style={input} value={platform === 'google' ? brief.campaign_theme : brief.audience_persona}
              onChange={e => setBrief({ ...brief, [platform === 'google' ? 'campaign_theme' : 'audience_persona']: e.target.value })}
              placeholder={platform === 'google' ? 'e.g., Brand Search' : 'e.g., Marketing managers, 30-45'} />
          </div>
          <div>
            <span style={label}>{platform === 'google' ? 'Ad Group Theme' : 'Format'}</span>
            <input style={input} value={brief.ad_group_theme || brief.format || ''}
              onChange={e => setBrief({ ...brief, [platform === 'google' ? 'ad_group_theme' : 'format']: e.target.value })}
              placeholder={platform === 'google' ? 'e.g., Core Product' : 'e.g., single_image, video'} />
          </div>
        </div>
        <button onClick={generate} disabled={generating || !brief.offer}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: "#0a0a0a", color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer', opacity: generating || !brief.offer ? 0.6 : 1 }}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {generating ? 'Generating...' : 'Generate Ad Copy'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Google RSA */}
          {platform === 'google' && result.headlines && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Google RSA — 15 Headlines + 4 Descriptions</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', marginBottom: 8 }}>HEADLINES</div>
                {result.headlines.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f1f6' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8e8e93', width: 20 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{h.text}</span>
                    <span style={{ fontSize: 10, color: h.text.length > 30 ? '#e9695c' : GRN }}>{h.text.length}/30</span>
                    {h.pin && <span style={{ fontSize: 10, padding: '1px 4px', background: '#eff6ff', color: T, borderRadius: 3 }}>pin {h.pin}</span>}
                    <span style={{ fontSize: 10, padding: '1px 4px', background: '#f1f1f6', borderRadius: 3 }}>{h.category}</span>
                    <Copy size={12} color="#8e8e93" style={{ cursor: 'pointer' }} onClick={() => copyText(h.text)} />
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', marginBottom: 8 }}>DESCRIPTIONS</div>
                {result.descriptions.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f1f6' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8e8e93', width: 20 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{d.text}</span>
                    <span style={{ fontSize: 10, color: d.text.length > 90 ? '#e9695c' : GRN }}>{d.text.length}/90</span>
                    {d.pin && <span style={{ fontSize: 10, padding: '1px 4px', background: '#eff6ff', color: T, borderRadius: 3 }}>pin {d.pin}</span>}
                    <Copy size={12} color="#8e8e93" style={{ cursor: 'pointer' }} onClick={() => copyText(d.text)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-variant platforms */}
          {result.variants && (
            <div style={{ display: 'grid', gap: 12 }}>
              {result.variants.map((v, i) => (
                <div key={i} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 800, fontSize: 14, color: T }}>Variant {String.fromCharCode(65 + i)}</span>
                    {v.hook_concept && <span style={{ fontSize: 11, color: '#6b6b70', fontStyle: 'italic' }}>{v.hook_concept}</span>}
                  </div>
                  {Object.entries(v).filter(([k]) => !['hook_concept', 'creative_brief'].includes(k)).map(([key, val]) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 13, color: BLK, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{Array.isArray(val) ? val.join(' → ') : String(val)}</span>
                        <Copy size={11} color="#d1d5db" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => copyText(String(val))} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {result.rationale && (
            <div style={{ ...card, background: '#f9f9fb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', marginBottom: 4 }}>RATIONALE</div>
              <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6 }}>{result.rationale}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
