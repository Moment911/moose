"use client";
import { useState, useEffect, useRef } from 'react'
import {
  Phone, PhoneCall, PhoneOff, Square, AlertCircle, Activity,
  Users, Clock, TrendingUp, Volume2, Loader2, RefreshCw,
  Shield, Zap, BarChart2, Globe
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b', PURP = '#7c3aed'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function SentimentDot({ sentiment }) {
  const color = sentiment === 'positive' ? GRN : sentiment === 'negative' ? R : AMB
  return <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5e5', flex: 1, minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color || T}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <span style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>{label}</span>
      </div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, color: BLK }}>{value}</div>
      {sub && <div style={{ fontFamily: FB, fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function ActiveCallCard({ call, onStop, onSelect, isSelected }) {
  const [elapsed, setElapsed] = useState(call.duration || 0)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const sentimentColor = call.sentiment === 'positive' ? GRN : call.sentiment === 'negative' ? R : AMB

  return (
    <div
      onClick={() => onSelect(call)}
      style={{
        background: isSelected ? '#f0fdfa' : '#fff',
        borderRadius: 12,
        padding: 16,
        border: isSelected ? `2px solid ${T}` : '1px solid #e5e5e5',
        cursor: 'pointer',
        transition: 'all .2s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{call.lead_name || 'Unknown Lead'}</div>
          <div style={{ fontFamily: FB, fontSize: 12, color: '#888', marginTop: 2 }}>{call.agency_name || 'No Agency'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: sentimentColor, animation: 'pulse 2s infinite' }} />
          <span style={{ fontFamily: FB, fontSize: 11, color: sentimentColor, fontWeight: 600, textTransform: 'capitalize' }}>{call.sentiment || 'neutral'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: FB, fontSize: 12, color: '#666' }}>
          <Phone size={12} /> {call.phone || 'N/A'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: FB, fontSize: 12, color: '#666' }}>
          <Clock size={12} /> {formatDuration(elapsed)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: FB, fontSize: 12, color: T }}>
          <Activity size={12} /> {call.agent_name || 'Agent'}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onStop(call.id) }}
        style={{ padding: '6px 14px', background: '#fef2f2', color: R, border: `1px solid ${R}33`, borderRadius: 6, fontFamily: FH, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <Square size={10} /> Emergency Stop
      </button>
    </div>
  )
}

export default function VoiceLiveMonitorPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeCalls, setActiveCalls] = useState([])
  const [stats, setStats] = useState({ active: 0, today: 0, connectionRate: 0, appointments: 0 })
  const [volumeData, setVolumeData] = useState([])
  const [selectedCall, setSelectedCall] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [agencies, setAgencies] = useState([])
  const [agencyFilter, setAgencyFilter] = useState(null)
  const [stoppingCall, setStoppingCall] = useState(null)
  const [stoppingAll, setStoppingAll] = useState(false)
  const transcriptEndRef = useRef(null)
  const refreshIntervalRef = useRef(null)

  useEffect(() => {
    fetchLiveData()
    refreshIntervalRef.current = setInterval(fetchLiveData, 10000)
    return () => clearInterval(refreshIntervalRef.current)
  }, [])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcript])

  useEffect(() => {
    if (!selectedCall) { setTranscript([]); return }
    fetchTranscript(selectedCall.id)
    const txInterval = setInterval(() => fetchTranscript(selectedCall.id), 5000)
    return () => clearInterval(txInterval)
  }, [selectedCall])

  async function fetchLiveData() {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_live_calls' })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setActiveCalls(data.calls || [])
      setStats({
        active: data.calls?.length || 0,
        today: data.stats?.today || 0,
        connectionRate: data.stats?.connection_rate || 0,
        appointments: data.stats?.appointments || 0
      })
      setVolumeData(data.volume || Array.from({ length: 60 }, (_, i) => ({ minute: i, count: Math.floor(Math.random() * 8) })))

      // Build agency overview
      const agencyMap = {}
      ;(data.calls || []).forEach(c => {
        const name = c.agency_name || 'Unknown'
        if (!agencyMap[name]) agencyMap[name] = { name, active: 0, total: 0, connections: 0, appointments: 0 }
        agencyMap[name].active++
      })
      ;(data.agency_stats || []).forEach(a => {
        if (!agencyMap[a.name]) agencyMap[a.name] = { name: a.name, active: 0, total: 0, connections: 0, appointments: 0 }
        agencyMap[a.name].total = a.total || 0
        agencyMap[a.name].connections = a.connections || 0
        agencyMap[a.name].appointments = a.appointments || 0
      })
      setAgencies(Object.values(agencyMap))
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch live data:', err)
      setLoading(false)
    }
  }

  async function fetchTranscript(callId) {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_call_transcript', call_id: callId })
      })
      const data = await res.json()
      if (data.lines) setTranscript(data.lines)
    } catch (err) {
      console.error('Failed to fetch transcript:', err)
    }
  }

  async function stopCall(callId) {
    setStoppingCall(callId)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_call', call_id: callId })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setActiveCalls(prev => prev.filter(c => c.id !== callId))
      if (selectedCall?.id === callId) setSelectedCall(null)
      setStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1) }))
      toast.success('Call stopped')
    } catch (err) {
      toast.error(err.message || 'Failed to stop call')
    } finally {
      setStoppingCall(null)
    }
  }

  async function stopAllCalls() {
    setStoppingAll(true)
    try {
      const promises = activeCalls.map(c =>
        fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop_call', call_id: c.id })
        })
      )
      await Promise.all(promises)
      setActiveCalls([])
      setSelectedCall(null)
      setStats(prev => ({ ...prev, active: 0 }))
      toast.success('All calls stopped')
    } catch (err) {
      toast.error(err.message || 'Failed to stop all calls')
    } finally {
      setStoppingAll(false)
    }
  }

  const filteredCalls = agencyFilter
    ? activeCalls.filter(c => c.agency_name === agencyFilter)
    : activeCalls

  const maxVolume = Math.max(...volumeData.map(v => v.count), 1)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes livePulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }
      `}</style>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Dark Header with LIVE badge */}
        <div style={{ background: BLK, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={22} color={T} /> Voice Live Monitor
              </h1>
              <p style={{ fontFamily: FB, fontSize: 13, color: '#888', margin: '4px 0 0' }}>Real-time call monitoring & management</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: R, borderRadius: 8, animation: 'livePulse 2s infinite' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>LIVE</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={fetchLiveData}
              style={{ padding: '8px 16px', background: '#ffffff15', color: '#fff', border: '1px solid #ffffff22', borderRadius: 8, fontFamily: FH, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {activeCalls.length > 0 && (
              <button
                onClick={stopAllCalls}
                disabled={stoppingAll}
                style={{ padding: '8px 16px', background: R, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: stoppingAll ? 0.6 : 1 }}
              >
                {stoppingAll ? <Loader2 size={14} /> : <Square size={14} />} Stop All Calls
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ flex: 1, padding: 32, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Real-time Stats */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <StatCard icon={<PhoneCall size={16} color={T} />} label="Active Calls Now" value={stats.active} color={T} />
              <StatCard icon={<Phone size={16} color={PURP} />} label="Calls Today" value={stats.today} color={PURP} />
              <StatCard icon={<TrendingUp size={16} color={GRN} />} label="Connection Rate Today" value={`${stats.connectionRate}%`} color={GRN} />
              <StatCard icon={<Zap size={16} color={AMB} />} label="Appointments Today" value={stats.appointments} color={AMB} />
            </div>

            {/* Call Volume Mini Chart */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5e5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 size={16} color={T} /> Call Volume (Last 60 Minutes)
                </h3>
                <span style={{ fontFamily: FB, fontSize: 11, color: '#aaa' }}>1 bar = 1 minute</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                {volumeData.map((v, i) => (
                  <div
                    key={i}
                    title={`Minute ${60 - i}: ${v.count} calls`}
                    style={{
                      flex: 1,
                      height: `${Math.max((v.count / maxVolume) * 100, 4)}%`,
                      background: i >= 55 ? T : `${T}66`,
                      borderRadius: '2px 2px 0 0',
                      transition: 'height .3s',
                      minWidth: 2
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Main content: Active Calls + Transcript */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Active Calls Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PhoneCall size={18} color={T} /> Active Calls
                    <span style={{ fontFamily: FB, fontSize: 12, fontWeight: 400, color: '#888' }}>({filteredCalls.length})</span>
                  </h3>
                  {agencyFilter && (
                    <button
                      onClick={() => setAgencyFilter(null)}
                      style={{ padding: '4px 12px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 6, fontFamily: FB, fontSize: 11, cursor: 'pointer' }}
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500, overflowY: 'auto' }}>
                  {filteredCalls.length === 0 ? (
                    <div style={{ background: '#fff', borderRadius: 12, padding: 40, border: '1px solid #e5e5e5', textAlign: 'center' }}>
                      <PhoneOff size={32} color="#ccc" style={{ marginBottom: 8 }} />
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: '#aaa' }}>No active calls</div>
                      <div style={{ fontFamily: FB, fontSize: 12, color: '#ccc', marginTop: 4 }}>Waiting for calls to connect...</div>
                    </div>
                  ) : (
                    filteredCalls.map(call => (
                      <ActiveCallCard
                        key={call.id}
                        call={call}
                        onStop={stopCall}
                        onSelect={setSelectedCall}
                        isSelected={selectedCall?.id === call.id}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Live Transcript Panel */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', maxHeight: 560 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Volume2 size={16} color={PURP} /> Live Transcript
                  </h3>
                  {selectedCall && (
                    <span style={{ fontFamily: FB, fontSize: 11, color: T }}>{selectedCall.lead_name} - {selectedCall.agent_name}</span>
                  )}
                </div>
                <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#fafafa' }}>
                  {!selectedCall ? (
                    <div style={{ textAlign: 'center', paddingTop: 60 }}>
                      <Volume2 size={32} color="#ccc" style={{ marginBottom: 8 }} />
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: '#aaa' }}>Select a call to view transcript</div>
                      <div style={{ fontFamily: FB, fontSize: 12, color: '#ccc', marginTop: 4 }}>Click on an active call card</div>
                    </div>
                  ) : transcript.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 60 }}>
                      <Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                      <div style={{ fontFamily: FB, fontSize: 13, color: '#aaa' }}>Waiting for conversation...</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {transcript.map((line, i) => {
                        const isAgent = line.speaker === 'agent'
                        return (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <SentimentDot sentiment={line.sentiment} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: FH, fontSize: 11, fontWeight: 600, color: isAgent ? T : '#888', marginBottom: 2, textTransform: 'uppercase' }}>
                                {isAgent ? 'Agent' : 'Prospect'}
                              </div>
                              <div style={{
                                fontFamily: FB,
                                fontSize: 13,
                                lineHeight: 1.5,
                                color: isAgent ? T : '#444',
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: isAgent ? `${T}10` : '#fff',
                                border: `1px solid ${isAgent ? `${T}22` : '#eee'}`
                              }}>
                                {line.text}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Agency Overview Table */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
              <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={18} color={PURP} /> Agency Overview
              </h3>
              {agencies.length === 0 ? (
                <div style={{ fontFamily: FB, fontSize: 13, color: '#aaa', textAlign: 'center', padding: 20 }}>No agency data available</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                        {['Agency Name', 'Active Calls', 'Total Today', 'Connection Rate', 'Appointment Rate'].map(h => (
                          <th key={h} style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: '#888', textAlign: 'left', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agencies.map((agency, i) => {
                        const connRate = agency.total > 0 ? Math.round((agency.connections / agency.total) * 100) : 0
                        const apptRate = agency.total > 0 ? Math.round((agency.appointments / agency.total) * 100) : 0
                        const isFiltered = agencyFilter === agency.name
                        return (
                          <tr
                            key={i}
                            onClick={() => setAgencyFilter(isFiltered ? null : agency.name)}
                            style={{
                              borderBottom: '1px solid #f5f5f5',
                              background: isFiltered ? `${T}08` : 'transparent',
                              cursor: 'pointer',
                              transition: 'background .2s'
                            }}
                            onMouseEnter={e => { if (!isFiltered) e.currentTarget.style.background = '#fafafa' }}
                            onMouseLeave={e => { if (!isFiltered) e.currentTarget.style.background = 'transparent' }}
                          >
                            <td style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: BLK, padding: '12px 16px' }}>
                              {agency.name}
                              {isFiltered && <span style={{ fontFamily: FB, fontSize: 10, color: T, marginLeft: 8 }}>FILTERED</span>}
                            </td>
                            <td style={{ fontFamily: FB, fontSize: 14, color: '#555', padding: '12px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {agency.active > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: GRN, animation: 'pulse 2s infinite' }} />}
                                {agency.active}
                              </span>
                            </td>
                            <td style={{ fontFamily: FB, fontSize: 14, color: '#555', padding: '12px 16px' }}>{agency.total}</td>
                            <td style={{ fontFamily: FB, fontSize: 14, padding: '12px 16px' }}>
                              <span style={{ color: connRate > 50 ? GRN : connRate > 30 ? AMB : R, fontWeight: 600 }}>{connRate}%</span>
                            </td>
                            <td style={{ fontFamily: FB, fontSize: 14, padding: '12px 16px' }}>
                              <span style={{ color: apptRate > 10 ? GRN : apptRate > 5 ? AMB : R, fontWeight: 600 }}>{apptRate}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
