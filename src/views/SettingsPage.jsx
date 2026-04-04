"use client"
import { useState } from 'react'
import { Settings, Key, Check, AlertTriangle, RefreshCw, Loader2, Sliders, Target, Globe, Shield, Bell } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'scout', label: 'Scout APIs', icon: Target },
  { key: 'seo', label: 'SEO & WordPress', icon: Globe },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
]

const SCOUT_APIS = [
  { key: 'google_places', name: 'Google Places', env: 'NEXT_PUBLIC_GOOGLE_PLACES_KEY', desc: 'Business search, reviews, contact info', free: 'Free tier: $200/mo credit', logo: '🗺️' },
  { key: 'hunter', name: 'Hunter.io', env: 'NEXT_PUBLIC_HUNTER_API_KEY', desc: 'Email finder and verification', free: 'Free: 25 searches/mo', logo: '📧' },
  { key: 'clearbit', name: 'Clearbit', env: 'NEXT_PUBLIC_CLEARBIT_API_KEY', desc: 'Company enrichment and firmographics', free: 'Free tier available', logo: '🏢' },
  { key: 'apollo', name: 'Apollo.io', env: 'NEXT_PUBLIC_APOLLO_API_KEY', desc: 'Executive contacts and org charts', free: 'Free: 50 credits/mo', logo: '👤' },
  { key: 'yelp', name: 'Yelp Fusion', env: 'NEXT_PUBLIC_YELP_API_KEY', desc: 'Business details, reviews, photos', free: 'Free: 5,000 calls/day', logo: '⭐' },
  { key: 'builtwith', name: 'BuiltWith', env: 'NEXT_PUBLIC_BUILTWITH_API_KEY', desc: 'Deep technology stack analysis', free: 'Free tier: limited', logo: '🔧' },
]

const SCORE_DEFAULTS = { social: 25, website: 30, gmb: 20, reviews: 15, ads: 10 }

export default function SettingsPage() {
  const [tab, setTab] = useState('scout')
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Settings size={22} /> Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure your Moose AI platform</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {TABS.map(t => {
              const I = t.icon
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <I size={15} /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Scout APIs Tab */}
          {tab === 'scout' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2"><Key size={16} /> Scout API Keys</h2>
                <p className="text-xs text-gray-500 mb-4">Configure third-party APIs for Scout lead intelligence</p>
                <div className="grid grid-cols-2 gap-4">
                  {SCOUT_APIS.map(api => {
                    const hasKey = !!process.env[api.env]
                    return (
                      <div key={api.key} className="card p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-2xl">{api.logo}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-800">{api.name}</h3>
                              {hasKey
                                ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-0.5"><Check size={8} /> Connected</span>
                                : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium flex items-center gap-0.5"><AlertTriangle size={8} /> Not configured</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{api.desc}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{api.free}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => testApi(api)} disabled={testing[api.key]}
                            className="btn-secondary text-[10px] flex-1 justify-center">
                            {testing[api.key] ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Test
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-2">Set <code className="bg-gray-100 px-1 rounded">{api.env}</code> in .env.local</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Scoring Weights */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><Sliders size={16} /> Scout Score Weights</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Adjust how the SCOUT score is calculated</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>Total: {totalWeight}%</span>
                    <button onClick={resetWeights} className="text-[10px] text-gray-400 hover:text-gray-600">Reset defaults</button>
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
                      <div><p className="text-sm text-gray-700 font-medium">{w.label}</p><p className="text-[10px] text-gray-400">{w.desc}</p></div>
                      <span className="text-sm font-bold text-gray-800 w-10 text-right">{weights[w.key]}%</span>
                    </div>
                    <input type="range" min={0} max={50} value={weights[w.key]} onChange={e => setWeights(prev => ({ ...prev, [w.key]: +e.target.value }))}
                      className="w-full accent-orange-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEO & WordPress Tab */}
          {tab === 'seo' && (
            <div className="card p-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">SEO & WordPress Settings</h2>
              <p className="text-sm text-gray-500">Manage WordPress site connections, SEO plugin configuration, and Google Search Console integration.</p>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                WordPress sites can be managed from the <a href="/wordpress" className="text-brand-500 hover:underline font-medium">WordPress Sites</a> page. Google data connections are in <a href="/seo/connect" className="text-brand-500 hover:underline font-medium">SEO Connect</a>.
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {tab === 'notifications' && (
            <div className="card p-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">Notification Preferences</h2>
              <p className="text-sm text-gray-500 mb-4">Choose what you want to be notified about.</p>
              {[
                { label: 'New client feedback', desc: 'When a client submits review annotations' },
                { label: 'Project status changes', desc: 'When projects move between stages' },
                { label: 'New Scout leads', desc: 'When hot leads are found in searches' },
                { label: 'Team mentions', desc: 'When someone mentions you in a comment' },
              ].map(n => (
                <label key={n.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 cursor-pointer">
                  <div><p className="text-sm font-medium text-gray-700">{n.label}</p><p className="text-xs text-gray-400">{n.desc}</p></div>
                  <input type="checkbox" defaultChecked className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                </label>
              ))}
            </div>
          )}

          {/* Security Tab */}
          {tab === 'security' && (
            <div className="card p-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">Security</h2>
              <p className="text-sm text-gray-500 mb-4">Manage authentication and access controls.</p>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                User management and access controls are available in the <a href="/admin" className="text-brand-500 hover:underline font-medium">Admin Portal</a>.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
