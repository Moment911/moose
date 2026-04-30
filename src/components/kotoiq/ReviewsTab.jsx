"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Star, Loader2, RefreshCw, AlertTriangle, MessageSquare, TrendingUp,
  TrendingDown, ArrowRight, CheckCircle, Plus, BarChart2, Users, Clock,
  ChevronDown, ChevronUp, Send, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const VELOCITY_COLORS = { accelerating: GRN, stable: '#6b6b70', declining: R }
const VELOCITY_ICONS = { accelerating: TrendingUp, declining: TrendingDown, stable: ArrowRight }

function ScoreBadge({ score, label, size = 'md' }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : score > 0 ? '#e9695c' : '#d1d5db'
  const fontSize = size === 'lg' ? 36 : 18
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize, fontWeight: 900, color, lineHeight: 1 }}>{score ?? '—'}</div>
      <div style={{ fontSize: 11, color: '#1f2937', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    </div>
  )
}

function RatingStars({ rating }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star key={i} size={16} fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
        color={i <= Math.round(rating) ? '#f59e0b' : '#d1d5db'} />
    )
  }
  return <div style={{ display: 'flex', gap: 2 }}>{stars}</div>
}

export default function ReviewsTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [campaignTarget, setCampaignTarget] = useState(10)
  const [expandedTopic, setExpandedTopic] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [intRes, campRes] = await Promise.all([
        fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_review_intelligence', client_id: clientId }) }),
        fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_review_campaigns', client_id: clientId }) }),
      ])
      const intData = await intRes.json()
      const campData = await campRes.json()
      setData(intData.data || null)
      setCampaigns(campData.campaigns || [])
    } catch (e) { toast.error('Failed to load review data') }
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const analyze = async () => {
    setAnalyzing(true)
    toast('Analyzing reviews...', { icon: '🔍' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_reviews', client_id: clientId }) })
      const result = await res.json()
      if (result.error) { toast.error(result.error); return }
      toast.success('Review analysis complete!')
      setData(result.data)
    } catch (e) { toast.error('Analysis failed') }
    setAnalyzing(false)
  }

  const createCampaign = async () => {
    if (!campaignName.trim()) { toast.error('Campaign name required'); return }
    setCreatingCampaign(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_review_campaign', client_id: clientId, name: campaignName, target_count: campaignTarget }) })
      const result = await res.json()
      if (result.error) { toast.error(result.error); return }
      toast.success('Campaign created!')
      setCampaigns(prev => [result.campaign, ...prev])
      setShowCampaignForm(false)
      setCampaignName('')
    } catch (e) { toast.error('Failed to create campaign') }
    setCreatingCampaign(false)
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 24px' }

  // ── Empty state ──
  if (!loading && !data) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK }}>Review & Reputation Intelligence</div>
            <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>Analyze your reviews, track sentiment, and build review campaigns.</div>
          </div>
        </div>
        <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
          <Star size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 8 }}>No review analysis yet</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            Run an analysis to pull reviews from Google Business Profile, score sentiment, and identify response gaps.
          </div>
          <button onClick={analyze} disabled={analyzing} style={{
            padding: '12px 28px', borderRadius: 10, border: 'none', background: BLK, color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: analyzing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {analyzing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Star size={16} />}
            Analyze Reviews
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: '#1f2937' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading review data...
      </div>
    )
  }

  const dist = data?.rating_distribution || {}
  const maxDist = Math.max(...Object.values(dist).map(Number), 1)
  const sentimentTopics = data?.sentiment_by_topic || []
  const unresponded = data?.unresponded_reviews || []

  return (
    <div>
      <HowItWorks tool="reviews" />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK }}>Review & Reputation Intelligence</div>
          <div style={{ fontSize: 12, color: '#1f2937', marginTop: 2 }}>
            Last scanned: {data?.scanned_at ? new Date(data.scanned_at).toLocaleDateString() : 'Never'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={analyze} disabled={analyzing} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: '1px solid #ececef', background: '#fff', fontSize: 12, fontWeight: 700, cursor: analyzing ? 'wait' : 'pointer', color: BLK,
          }}>
            {analyzing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
            Re-analyze
          </button>
        </div>
      </div>

      {/* Score + Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, marginBottom: 20 }}>
        {/* Big Score */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 36px', minWidth: 140 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 48, fontWeight: 900, color: (data?.overall_score || 0) >= 70 ? GRN : (data?.overall_score || 0) >= 40 ? AMB : R, lineHeight: 1 }}>
            {data?.overall_score || 0}
          </div>
          <div style={{ fontSize: 11, color: '#1f2937', marginTop: 4, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.05em' }}>Review Score</div>
          <div style={{ marginTop: 8 }}><RatingStars rating={data?.avg_rating || 0} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginTop: 4 }}>{data?.avg_rating || '—'} avg</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', marginBottom: 4 }}>Total Reviews</div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: BLK }}>{data?.total_reviews || 0}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', marginBottom: 4 }}>Velocity</div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: BLK }}>{data?.review_velocity || 0}</div>
            <div style={{ fontSize: 11, color: VELOCITY_COLORS[data?.velocity_trend] || '#6b6b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {(() => { const Icon = VELOCITY_ICONS[data?.velocity_trend] || ArrowRight; return <Icon size={12} /> })()}
              {data?.velocity_trend || 'unknown'}/mo
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', marginBottom: 4 }}>Response Rate</div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: (data?.response_rate || 0) >= 80 ? GRN : (data?.response_rate || 0) >= 50 ? AMB : R }}>{data?.response_rate || 0}%</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', marginBottom: 4 }}>Avg Response</div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: BLK }}>{data?.avg_response_time_hours ? `${Math.round(data.avg_response_time_hours)}h` : '—'}</div>
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12 }}>Rating Distribution</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[5, 4, 3, 2, 1].map(star => {
            const count = dist[String(star)] || 0
            const pct = maxDist > 0 ? (count / maxDist) * 100 : 0
            const barColor = star >= 4 ? GRN : star === 3 ? AMB : R
            return (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 18, fontSize: 12, fontWeight: 700, color: BLK, textAlign: 'right' }}>{star}</div>
                <Star size={12} fill="#f59e0b" color="#f59e0b" />
                <div style={{ flex: 1, height: 16, background: '#f1f1f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: '#1f1f22', textAlign: 'right' }}>{count}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sentiment by Topic */}
      {sentimentTopics.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12 }}>Sentiment by Topic</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {sentimentTopics.map((topic, i) => (
              <div key={i} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #ececef', cursor: 'pointer' }}
                onClick={() => setExpandedTopic(expandedTopic === i ? null : i)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: BLK }}>{topic.topic}</div>
                  {expandedTopic === i ? <ChevronUp size={14} color="#8e8e93" /> : <ChevronDown size={14} color="#8e8e93" />}
                </div>
                {/* Sentiment bar */}
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${topic.positive_pct || 0}%`, background: GRN }} />
                  <div style={{ width: `${topic.neutral_pct || 0}%`, background: '#d1d5db' }} />
                  <div style={{ width: `${topic.negative_pct || 0}%`, background: "#0a0a0a" }} />
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: GRN }}>{topic.positive_pct || 0}% positive</span>
                  <span style={{ color: '#1f2937' }}>{topic.neutral_pct || 0}% neutral</span>
                  <span style={{ color: R }}>{topic.negative_pct || 0}% negative</span>
                </div>
                {/* Expanded quotes */}
                {expandedTopic === i && topic.sample_quotes?.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #f1f1f6', paddingTop: 10 }}>
                    {topic.sample_quotes.map((q, qi) => (
                      <div key={qi} style={{ fontSize: 12, color: '#1f1f22', fontStyle: 'italic', marginBottom: 4, lineHeight: 1.5 }}>
                        "{q}"
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unresponded Reviews */}
      {unresponded.length > 0 && (
        <div style={{ ...card, marginBottom: 20, borderColor: '#fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="#0a0a0a" />
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: R }}>Unresponded Negative Reviews ({unresponded.length})</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {unresponded.slice(0, 10).map((review, i) => (
              <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RatingStars rating={review.rating} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{review.reviewer}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#1f2937' }}>{review.date ? new Date(review.date).toLocaleDateString() : ''}</span>
                </div>
                <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.5, marginBottom: 8 }}>{review.text || 'No text'}</div>
                <button onClick={() => toast('Draft response feature coming soon!')} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
                  border: '1px solid ' + R, background: '#fff', fontSize: 11, fontWeight: 700, color: R, cursor: 'pointer',
                }}>
                  <MessageSquare size={12} /> Draft Response
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Campaigns */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK }}>Review Campaigns</div>
          <button onClick={() => setShowCampaignForm(!showCampaignForm)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
            border: 'none', background: BLK, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={13} /> New Campaign
          </button>
        </div>

        {/* Campaign creation form */}
        {showCampaignForm && (
          <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid #ececef', marginBottom: 16, background: GRY }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                placeholder="Campaign name (e.g. Q2 Review Push)"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ececef', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }} />
              <input type="number" value={campaignTarget} onChange={e => setCampaignTarget(parseInt(e.target.value) || 10)}
                min={1} max={100} style={{ width: 80, padding: '10px 14px', borderRadius: 8, border: '1px solid #ececef', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: '#1f1f22', alignSelf: 'center' }}>target</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createCampaign} disabled={creatingCampaign} style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', background: GRN, color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: creatingCampaign ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {creatingCampaign ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
                Create Campaign
              </button>
              <button onClick={() => { setShowCampaignForm(false); setCampaignName('') }} style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid #ececef', background: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#1f1f22',
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {campaigns.length === 0 && !showCampaignForm && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#1f2937', fontSize: 13 }}>
            No campaigns yet. Create one to start collecting reviews from customers.
          </div>
        )}
        {campaigns.map(camp => {
          const pct = camp.target_count > 0 ? Math.round((camp.collected_count / camp.target_count) * 100) : 0
          const statusColor = camp.status === 'active' ? GRN : camp.status === 'completed' ? '#5aa0ff' : camp.status === 'paused' ? AMB : '#6b6b70'
          return (
            <div key={camp.id} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #ececef', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: BLK }}>{camp.name}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: statusColor + '18', color: statusColor, textTransform: 'uppercase' }}>
                    {camp.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#1f1f22' }} title={camp.created_at ? new Date(camp.created_at).toISOString() : ''}>
                  {camp.created_at ? new Date(camp.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: '#f1f1f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: GRN, borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: BLK, minWidth: 60, textAlign: 'right' }}>
                  {camp.collected_count}/{camp.target_count}
                </div>
              </div>
              {/* Funnel stats */}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#1f1f22' }}>
                <span>Sent: {camp.sent_count || 0}</span>
                <span>Opened: {camp.opened_count || 0}</span>
                <span>Completed: {camp.completed_count || 0}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
