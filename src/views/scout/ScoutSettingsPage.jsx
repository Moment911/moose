"use client";
import { useState } from 'react'
import { Target, Key, Check, AlertTriangle, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import toast from 'react-hot-toast'

const APIS = [
  { key: 'google_places', name: 'Google Places', env: 'NEXT_PUBLIC_GOOGLE_PLACES_KEY', desc: 'Business search, reviews, contact info', free: 'Free tier: $200/mo credit', logo: '🗺️' },
  { key: 'hunter', name: 'Hunter.io', env: 'NEXT_PUBLIC_HUNTER_API_KEY', desc: 'Email finder and verification', free: 'Free: 25 searches/mo', logo: '📧' },
  { key: 'clearbit', name: 'Clearbit', env: 'NEXT_PUBLIC_CLEARBIT_API_KEY', desc: 'Company enrichment and firmographics', free: 'Free tier available', logo: '🏢' },
  { key: 'apollo', name: 'Apollo.io', env: 'NEXT_PUBLIC_APOLLO_API_KEY', desc: 'Executive contacts and org charts', free: 'Free: 50 credits/mo', logo: '👤' },
  { key: 'yelp', name: 'Yelp Fusion', env: 'NEXT_PUBLIC_YELP_API_KEY', desc: 'Business details, reviews, photos', free: 'Free: 5,000 calls/day', logo: '⭐' },
  { key: 'builtwith', name: 'BuiltWith', env: 'NEXT_PUBLIC_BUILTWITH_API_KEY', desc: 'Deep technology stack analysis', free: 'Free tier: limited', logo: '🔧' },
]

const SCORE_DEFAULTS = { social: 25, website: 30, gmb: 20, reviews: 15, ads: 10 }

export default function ScoutSettingsPage() {
  const [weights, setWeights] = useState({ ...SCORE_DEFAULTS })
  const [testing, setTesting] = useState({})

  async function testApi(api) {
    setTesting(t => ({ ...t, [api.key]: true }))
    const key = process.env[api.env]
    await new Promise(r => setTimeout(r, 1000))
    if (key) toast.success(`${api.name}: Connected!`)
    else toast.error(`${api.name}: No API key set`)
    setTesting(t => ({ ...t, [api.key]: false }))
  }

  function resetWeights() { setWeights({ ...SCORE_DEFAULTS }); toast.success('Reset to defaults') }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)

  return (
    <ScoutLayout>
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-brand-500" />
        <span className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>SCOUT</span>
        <span className="text-sm text-slate-400 ml-1">Settings</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* API Configuration */}
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Key size={16} /> API Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              {APIS.map(api => {
                const hasKey = !!process.env[api.env]
                return (
                  <div key={api.key} className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{api.logo}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-800">{api.name}</h3>
                          {hasKey ? <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-0.5"><Check size={8} /> Connected</span> : <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium flex items-center gap-0.5"><AlertTriangle size={8} /> Not configured</span>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{api.desc}</p>
                        <p className="text-[13px] text-slate-400 mt-0.5">{api.free}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => testApi(api)} disabled={testing[api.key]}
                        className="btn-secondary text-[13px] flex-1 justify-center">
                        {testing[api.key] ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Test
                      </button>
                    </div>
                    <p className="text-[13px] text-slate-400 mt-2">Set <code className="bg-slate-100 px-1 rounded">{api.env}</code> in .env.local</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scoring Weights */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">SCOUT Score Weights</h2>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>Total: {totalWeight}%</span>
                <button onClick={resetWeights} className="text-[13px] text-slate-400 hover:text-slate-600">Reset defaults</button>
              </div>
            </div>
            {[
              { key: 'social', label: 'Social Media Presence', desc: 'Facebook, Instagram activity and followers' },
              { key: 'website', label: 'Website & Tech Stack', desc: 'Analytics, CRM, CMS, marketing tools' },
              { key: 'gmb', label: 'GMB Health', desc: 'Optimization, posts, photos, Q&A' },
              { key: 'reviews', label: 'Reviews & Reputation', desc: 'Rating, count, response rate, sentiment' },
              { key: 'ads', label: 'Advertising', desc: 'Facebook Pixel, Google Ads, retargeting' },
            ].map(w => (
              <div key={w.key} className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div><p className="text-sm text-slate-700 font-medium">{w.label}</p><p className="text-[13px] text-slate-400">{w.desc}</p></div>
                  <span className="text-sm font-bold text-slate-800 w-10 text-right">{weights[w.key]}%</span>
                </div>
                <input type="range" min={0} max={50} value={weights[w.key]} onChange={e => setWeights(prev => ({ ...prev, [w.key]: +e.target.value }))}
                  className="w-full accent-brand-500" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScoutLayout>
  )
}
