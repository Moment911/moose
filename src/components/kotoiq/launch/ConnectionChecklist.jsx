"use client"
import { useState, useEffect } from 'react'
import { CheckCircle, Circle, Loader2, Link2, Shield, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const PROVIDERS = [
  { id: 'search_console', label: 'Google Search Console', icon: '🔍', color: '#4285F4', oauthType: 'google' },
  { id: 'analytics', label: 'Google Analytics 4', icon: '📊', color: '#F57C00', oauthType: 'google' },
  { id: 'ads', label: 'Google Ads', icon: '💰', color: '#34A853', oauthType: 'google' },
  { id: 'meta', label: 'Meta Ads', icon: '📱', color: '#1877F2', oauthType: 'meta' },
  { id: 'linkedin', label: 'LinkedIn Ads', icon: '💼', color: '#0A66C2', oauthType: 'linkedin' },
  { id: 'gmb', label: 'Google Business Profile', icon: '📍', color: '#4285F4', oauthType: 'google' },
  { id: 'hotjar', label: 'Hotjar', icon: '🔥', color: '#FF3C00', oauthType: 'apikey' },
  { id: 'clarity', label: 'Microsoft Clarity', icon: '🔬', color: '#5B2D8E', oauthType: 'apikey' },
  { id: 'ghl', label: 'GoHighLevel CRM', icon: '🤝', color: '#1DB954', oauthType: 'ghl' },
]

export default function ConnectionChecklist({ clientId, agencyId, profileText }) {
  const [connections, setConnections] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    // Fetch existing connections
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_connections', client_id: clientId }),
    }).then(r => r.json()).then(res => {
      const conns = (res.data || []).map(c => c.provider)
      setConnections(conns)

      // Detect relevant connections
      if (profileText) {
        fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'detect_relevant_connections', profile_text: profileText, existing_providers: conns }),
        }).then(r => r.json()).then(recRes => {
          setRecommendations(recRes.data || [])
        }).catch(() => {})
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clientId, profileText])

  const connectedSet = new Set(connections)
  const connectedCount = PROVIDERS.filter(p => connectedSet.has(p.id)).length
  const recSet = new Set(recommendations.map(r => r.provider))

  const navigateToConnect = () => {
    window.location.href = `/kotoiq?tab=connect`
  }

  if (loading) return null

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={18} color={T} /> Connect Your Platforms
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {connectedCount} of {PROVIDERS.length} connected — more connections = better insights
          </div>
        </div>
        <div style={{
          fontFamily: FH, fontSize: 24, fontWeight: 900,
          color: connectedCount >= 5 ? GRN : connectedCount >= 3 ? AMB : R,
        }}>
          {Math.round((connectedCount / PROVIDERS.length) * 100)}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: connectedCount >= 5 ? GRN : connectedCount >= 3 ? AMB : R,
          width: `${(connectedCount / PROVIDERS.length) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>

      {/* Connection list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {PROVIDERS.map(p => {
          const isConnected = connectedSet.has(p.id)
          const isRecommended = recSet.has(p.id)
          const rec = recommendations.find(r => r.provider === p.id)

          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, border: `1px solid ${isConnected ? GRN + '40' : isRecommended ? T + '40' : '#e5e7eb'}`,
              background: isConnected ? '#f0fdf4' : isRecommended ? '#f0f9ff' : '#fff',
            }}>
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>{p.label}</div>
                {isConnected && <div style={{ fontSize: 11, color: GRN }}>Connected</div>}
                {!isConnected && rec && <div style={{ fontSize: 11, color: T }}>{rec.reason}</div>}
              </div>
              {isConnected ? (
                <CheckCircle size={18} color={GRN} />
              ) : isRecommended ? (
                <button onClick={navigateToConnect}
                  style={{ fontSize: 11, padding: '4px 12px', background: T, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontFamily: FH }}>
                  Connect
                </button>
              ) : (
                <Circle size={18} color="#d1d5db" />
              )}
            </div>
          )
        })}
      </div>

      {connectedCount < 3 && (
        <button onClick={navigateToConnect}
          style={{ width: '100%', marginTop: 14, padding: '12px', background: T, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>
          Connect APIs →
        </button>
      )}
    </div>
  )
}
