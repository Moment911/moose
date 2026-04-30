"use client"
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const TYPES = [
  { id: 'negatives', label: 'Negative Keywords', table: 'kotoiq_ads_rec_negatives' },
  { id: 'new_keywords', label: 'New Keywords', table: 'kotoiq_ads_rec_new_keywords' },
  { id: 'ad_copy', label: 'Ad Copy', table: 'kotoiq_ads_rec_ad_copy' },
]

export default function AdsRecommendationsTab({ clientId, agencyId }) {
  const [type, setType] = useState('negatives')
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')

  const load = () => {
    if (!clientId) return
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ads_get_recommendations', client_id: clientId, rec_type: type, status: statusFilter }),
    }).then(r => r.json()).then(res => { setRecs(res.data || []); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { setLoading(true); load() }, [clientId, type, statusFilter])

  const handleAction = async (recId, action) => {
    try {
      await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_approve_rec', rec_type: type, rec_id: recId, action_type: action }) })
      toast.success(action === 'approved' ? 'Approved' : 'Rejected')
      load()
    } catch (e) { toast.error('Action failed') }
  }

  const bulkApprove = async () => {
    const pendingIds = recs.filter(r => r.status === 'pending').map(r => r.id)
    if (!pendingIds.length) return
    try {
      await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_bulk_approve', rec_type: type, rec_ids: pendingIds, action_type: 'approved' }) })
      toast.success(`Approved ${pendingIds.length} recommendations`)
      load()
    } catch (e) { toast.error('Bulk approve failed') }
  }

  const pendingCount = recs.filter(r => r.status === 'pending').length

  return (
    <div>
      <HowItWorks tool="ads-recommendations" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK }}>Recommendations</div>
        {pendingCount > 0 && statusFilter === 'pending' && (
          <button onClick={bulkApprove}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: GRN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>
            <CheckCircle size={14} /> Approve All ({pendingCount})
          </button>
        )}
      </div>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)}
            style={{ padding: '8px 16px', borderRadius: 8, border: type === t.id ? `2px solid ${T}` : '1px solid #e5e7eb', background: type === t.id ? '#f0f9ff' : '#fff', fontFamily: FH, fontWeight: 700, fontSize: 13, color: type === t.id ? T : '#6b6b70', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FB }}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {loading ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div> : (
        <>
          {recs.length === 0 && <div style={{ ...card, textAlign: 'center', padding: 40, color: '#8e8e93' }}>
            <div style={{ fontFamily: FH, fontWeight: 700 }}>No {statusFilter || ''} recommendations</div>
            <div style={{ fontSize: 13 }}>Run an analysis to generate recommendations</div>
          </div>}

          {recs.map((r, i) => (
            <div key={i} style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: BLK, marginBottom: 4 }}>
                  {type === 'negatives' && `[${r.proposed_match_type}] ${r.search_term}`}
                  {type === 'new_keywords' && `${r.keyword} (${r.proposed_match_type})`}
                  {type === 'ad_copy' && `${r.platform?.toUpperCase()} — Variant ${r.variant_label || 'A'}`}
                </div>
                <div style={{ fontSize: 12, color: '#6b6b70', marginBottom: 4 }}>
                  {r.reason || r.rationale_md || r.rationale || ''}
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#8e8e93' }}>
                  {r.estimated_savings_usd && <span>Saves ~${r.estimated_savings_usd.toFixed(2)}/mo</span>}
                  {r.est_monthly_clicks && <span>{r.est_monthly_clicks} est. clicks/mo</span>}
                  {r.intent && <span style={{ padding: '1px 4px', background: '#f1f1f6', borderRadius: 3 }}>{r.intent}</span>}
                  {r.priority && <span style={{ padding: '1px 4px', background: r.priority === 'high' ? '#fef2f2' : '#f1f1f6', color: r.priority === 'high' ? R : '#6b6b70', borderRadius: 3 }}>{r.priority}</span>}
                  <span>via {r.model_used || 'AI'}</span>
                  <span>{r.created_at?.split('T')[0]}</span>
                </div>
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleAction(r.id, 'approved')}
                    style={{ padding: '6px 12px', background: GRN, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                  <button onClick={() => handleAction(r.id, 'rejected')}
                    style={{ padding: '6px 12px', background: '#f1f1f6', color: '#6b6b70', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                </div>
              )}
              {r.status !== 'pending' && (
                <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: r.status === 'approved' ? '#dcfce7' : '#fef2f2', color: r.status === 'approved' ? GRN : R, fontWeight: 700 }}>{r.status}</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
