"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Loader2, Play, Square, RotateCcw, CheckCircle2,
  XCircle, Clock, Zap, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react'
import { FH } from '../../lib/theme'

/**
 * KotoIQ Publish Queue Dashboard (ORCH-04)
 *
 * Shows campaigns with their publish progress.
 * Per-variant status rows: pending / publishing / published / failed.
 * Retry button on failed variants. Stop/Resume on campaigns.
 * Polls /api/wp/builder/publish with action=status every 5s while active.
 */

const API = '/api/wp/builder/publish'

async function publishAction(action, payload = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

// ── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:    { color: '#6b6b70', bg: '#f1f1f6', icon: Clock,         label: 'Pending' },
  generating: { color: '#8b5cf6', bg: '#f5f3ff', icon: Loader2,       label: 'Generating' },
  ready:      { color: '#2563eb', bg: '#eff6ff', icon: Zap,           label: 'Ready' },
  publishing: { color: '#d97706', bg: '#fffbeb', icon: Loader2,       label: 'Publishing' },
  published:  { color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2,  label: 'Published' },
  failed:     { color: '#dc2626', bg: '#fef2f2', icon: XCircle,       label: 'Failed' },
}

const CAMPAIGN_STATUS = {
  draft:      { color: '#6b6b70', label: 'Draft' },
  publishing: { color: '#d97706', label: 'Publishing' },
  live:       { color: '#16a34a', label: 'Live' },
  cancelled:  { color: '#8e8e93', label: 'Cancelled' },
  paused:     { color: '#6b6b70', label: 'Paused' },
  failed:     { color: '#dc2626', label: 'Failed' },
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PublishQueueTab({ agencyId, campaigns: initialCampaigns }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns || [])
  const [expandedId, setExpandedId] = useState(null)
  const [statusData, setStatusData] = useState({}) // { campaign_id: { counts, variants } }
  const [loading, setLoading] = useState({})
  const pollRef = useRef(null)

  // Determine if any campaign is actively publishing
  const hasActivePublish = campaigns.some(c =>
    c.status === 'publishing' || statusData[c.id]?.campaign?.status === 'publishing'
  )

  // Poll for status while a publish is active
  useEffect(() => {
    if (hasActivePublish) {
      pollRef.current = setInterval(() => {
        campaigns.forEach(c => {
          if (c.status === 'publishing' || statusData[c.id]?.campaign?.status === 'publishing') {
            loadStatus(c.id, true)
          }
        })
      }, 5000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [hasActivePublish, campaigns.length])

  // Load status for expanded campaign
  useEffect(() => {
    if (expandedId) loadStatus(expandedId)
  }, [expandedId])

  async function loadStatus(campaignId, silent = false) {
    if (!silent) setLoading(prev => ({ ...prev, [campaignId]: true }))
    try {
      const data = await publishAction('status', { campaign_id: campaignId, agency_id: agencyId })
      setStatusData(prev => ({ ...prev, [campaignId]: data }))
      // Sync campaign status back
      if (data.campaign) {
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId ? { ...c, status: data.campaign.status, ...data.counts } : c
        ))
      }
    } finally {
      if (!silent) setLoading(prev => ({ ...prev, [campaignId]: false }))
    }
  }

  async function handleRun(campaignId) {
    setLoading(prev => ({ ...prev, [`run-${campaignId}`]: true }))
    try {
      await publishAction('run', { campaign_id: campaignId, agency_id: agencyId })
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, status: 'publishing' } : c
      ))
      // Start polling
      setTimeout(() => loadStatus(campaignId), 1000)
    } finally {
      setLoading(prev => ({ ...prev, [`run-${campaignId}`]: false }))
    }
  }

  async function handleStop(campaignId) {
    setLoading(prev => ({ ...prev, [`stop-${campaignId}`]: true }))
    try {
      await publishAction('stop', { campaign_id: campaignId, agency_id: agencyId })
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, status: 'cancelled' } : c
      ))
    } finally {
      setLoading(prev => ({ ...prev, [`stop-${campaignId}`]: false }))
    }
  }

  async function handleKick(campaignId) {
    setLoading(prev => ({ ...prev, [`kick-${campaignId}`]: true }))
    try {
      await publishAction('kick', { campaign_id: campaignId, agency_id: agencyId })
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, status: 'publishing' } : c
      ))
      setTimeout(() => loadStatus(campaignId), 1000)
    } finally {
      setLoading(prev => ({ ...prev, [`kick-${campaignId}`]: false }))
    }
  }

  async function handleRetry(campaignId, variantId) {
    setLoading(prev => ({ ...prev, [`retry-${variantId}`]: true }))
    try {
      await publishAction('retry_variant', {
        campaign_id: campaignId,
        variant_id: variantId,
        agency_id: agencyId,
      })
      await loadStatus(campaignId)
    } finally {
      setLoading(prev => ({ ...prev, [`retry-${variantId}`]: false }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (!campaigns.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8e8e93', fontFamily: FH }}>
        <Zap size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>No campaigns yet</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Create a campaign in the Builder tab to start publishing.</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FH }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>
          Publish Queue
        </div>
        {hasActivePublish && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#d97706', fontWeight: 600,
          }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Publishing in progress
          </div>
        )}
      </div>

      {/* Campaign list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {campaigns.map(campaign => {
          const isExpanded = expandedId === campaign.id
          const data = statusData[campaign.id]
          const cs = CAMPAIGN_STATUS[campaign.status] || CAMPAIGN_STATUS.draft
          const isPublishing = campaign.status === 'publishing'
          const isStopped = campaign.status === 'cancelled' || campaign.status === 'paused' || campaign.status === 'failed'

          return (
            <div key={campaign.id} style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* Campaign header row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '14px 18px',
                  cursor: 'pointer', gap: 12,
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#fafafb'}
                onMouseOut={e => e.currentTarget.style.background = '#fff'}
              >
                {/* Expand chevron */}
                {isExpanded
                  ? <ChevronDown size={16} color="#9ca3af" />
                  : <ChevronRight size={16} color="#9ca3af" />
                }

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#111',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {campaign.name || `Campaign ${campaign.id.slice(0, 8)}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>
                    {campaign.cadence || 'burst'} cadence
                    {campaign.total_variants ? ` \u00B7 ${campaign.total_variants} variants` : ''}
                  </div>
                </div>

                {/* Status badge */}
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 20, background: cs.color + '12',
                  color: cs.color, textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                  {cs.label}
                </div>

                {/* Progress bar */}
                {campaign.total_variants > 0 && (
                  <div style={{
                    width: 100, height: 6, borderRadius: 3, background: '#f1f1f6',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: campaign.failed_variants > 0 ? '#dc2626' : '#16a34a',
                      width: `${Math.round(((campaign.published_variants || 0) + (campaign.failed_variants || 0)) / campaign.total_variants * 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  {!isPublishing && !isStopped && campaign.status !== 'live' && (
                    <ActionButton
                      icon={Play}
                      label="Publish"
                      color="#16a34a"
                      loading={loading[`run-${campaign.id}`]}
                      onClick={() => handleRun(campaign.id)}
                    />
                  )}
                  {isPublishing && (
                    <ActionButton
                      icon={Square}
                      label="Stop"
                      color="#dc2626"
                      loading={loading[`stop-${campaign.id}`]}
                      onClick={() => handleStop(campaign.id)}
                    />
                  )}
                  {isStopped && (
                    <ActionButton
                      icon={Play}
                      label="Resume"
                      color="#2563eb"
                      loading={loading[`kick-${campaign.id}`]}
                      onClick={() => handleKick(campaign.id)}
                    />
                  )}
                </div>
              </div>

              {/* Expanded: variant list */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid #f3f4f6',
                  padding: '0 18px 14px',
                }}>
                  {loading[campaign.id] ? (
                    <div style={{
                      padding: 24, textAlign: 'center', color: '#8e8e93',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Loading variants...
                    </div>
                  ) : data?.variants?.length ? (
                    <>
                      {/* Summary counts */}
                      <div style={{
                        display: 'flex', gap: 16, padding: '12px 0 8px',
                        borderBottom: '1px solid #f3f4f6', marginBottom: 8,
                      }}>
                        {Object.entries(data.counts || {}).map(([status, count]) => {
                          if (!count) return null
                          const sc = STATUS_CONFIG[status]
                          if (!sc) return null
                          return (
                            <div key={status} style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 12, color: sc.color, fontWeight: 600,
                            }}>
                              <sc.icon size={13} />
                              {count} {sc.label.toLowerCase()}
                            </div>
                          )
                        })}
                      </div>

                      {/* Variant rows */}
                      {data.variants.map(variant => {
                        const sc = STATUS_CONFIG[variant.status] || STATUS_CONFIG.pending
                        const StatusIcon = sc.icon
                        return (
                          <div key={variant.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 0', borderBottom: '1px solid #f9fafb',
                            fontSize: 13,
                          }}>
                            {/* Status icon */}
                            <StatusIcon
                              size={15}
                              color={sc.color}
                              style={variant.status === 'publishing' ? { animation: 'spin 1s linear infinite' } : {}}
                            />

                            {/* Name + URL */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: 600, color: '#111',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {variant.title || variant.name || `Variant ${variant.id.slice(0, 8)}`}
                              </div>
                              {variant.url && (
                                <a
                                  href={variant.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 11, color: '#6b6b70', textDecoration: 'none',
                                    display: 'block', marginTop: 1,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}
                                  onMouseOver={e => e.currentTarget.style.color = '#2563eb'}
                                  onMouseOut={e => e.currentTarget.style.color = '#6b6b70'}
                                >
                                  {variant.url}
                                </a>
                              )}
                              {variant.error && (
                                <div style={{
                                  fontSize: 11, color: '#dc2626', marginTop: 2,
                                  display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                  <AlertTriangle size={11} />
                                  {variant.error}
                                </div>
                              )}
                            </div>

                            {/* Status badge */}
                            <div style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px',
                              borderRadius: 20, background: sc.bg, color: sc.color,
                              textTransform: 'uppercase', letterSpacing: '.04em',
                              flexShrink: 0,
                            }}>
                              {sc.label}
                            </div>

                            {/* Retry button for failed */}
                            {variant.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(campaign.id, variant.id)}
                                disabled={loading[`retry-${variant.id}`]}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '4px 10px', borderRadius: 8,
                                  border: '1px solid #e5e7eb', background: '#fff',
                                  fontSize: 11, fontWeight: 600, color: '#6b6b70',
                                  cursor: 'pointer', flexShrink: 0,
                                  opacity: loading[`retry-${variant.id}`] ? 0.5 : 1,
                                }}
                              >
                                {loading[`retry-${variant.id}`]
                                  ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                  : <RotateCcw size={12} />
                                }
                                Retry
                              </button>
                            )}

                            {/* Published timestamp */}
                            {variant.published_at && (
                              <div style={{ fontSize: 11, color: '#8e8e93', flexShrink: 0 }}>
                                {new Date(variant.published_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', color: '#8e8e93', fontSize: 13 }}>
                      No variants found for this campaign.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CSS keyframes for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ── Action Button ───────────────────────────────────────────────────────────

function ActionButton({ icon: Icon, label, color, loading: isLoading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 8,
        border: '1px solid #e5e7eb', background: '#fff',
        fontSize: 12, fontWeight: 600, color,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.5 : 1,
        fontFamily: FH,
        transition: 'all 0.15s',
      }}
    >
      {isLoading
        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        : <Icon size={13} />
      }
      {label}
    </button>
  )
}
