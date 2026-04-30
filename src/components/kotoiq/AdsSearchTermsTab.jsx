"use client"
import { useState, useEffect } from 'react'
import { Search, Loader2, Filter, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function AdsSearchTermsTab({ clientId, agencyId }) {
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState('cost')

  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ads_get_search_terms', client_id: clientId }),
    }).then(r => r.json()).then(res => { setTerms(res.data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [clientId])

  const filtered = terms
    .filter(t => !filter || t.search_term?.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'cost') return (b.cost_usd || 0) - (a.cost_usd || 0)
      if (sortBy === 'clicks') return (b.clicks || 0) - (a.clicks || 0)
      return (b.impressions || 0) - (a.impressions || 0)
    })

  return (
    <div>
      <HowItWorks tool="ads-search-terms" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Search Terms Explorer</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter terms..."
              style={{ paddingLeft: 30, padding: '8px 12px 8px 30px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", width: 200 }} />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            <option value="cost">Sort by Cost</option>
            <option value="clicks">Sort by Clicks</option>
            <option value="impressions">Sort by Impressions</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b6b70', marginBottom: 12 }}>{filtered.length} search terms</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Search Term', 'Impressions', 'Clicks', 'Cost', 'Conv', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Search Term' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 6px', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.search_term}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>{(t.impressions || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>{(t.clicks || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: t.cost_usd > 50 ? '#e9695c' : BLK }}>${(t.cost_usd || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: t.conversions > 0 ? GRN : '#8e8e93' }}>{t.conversions || 0}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    {t.status === 'added_as_negative' && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: R }}>Negative</span>}
                    {t.status === 'added_as_keyword' && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: GRN }}>Keyword</span>}
                    {!t.status && <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && <div style={{ textAlign: 'center', padding: 12, color: '#8e8e93', fontSize: 12 }}>Showing 100 of {filtered.length} terms</div>}
        </div>
      )}
    </div>
  )
}
