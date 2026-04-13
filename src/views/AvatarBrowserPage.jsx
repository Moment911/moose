"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Search, Check, Play, Pause, User, Loader2, RefreshCw, Sparkles, Send
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const W = '#ffffff'

const API = '/api/video-voicemails'

export default function AvatarBrowserPage() {
  const { agencyId } = useAuth()
  const [avatars, setAvatars] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [playingId, setPlayingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [scriptText, setScriptText] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generatedVideoId, setGeneratedVideoId] = useState(null)
  const videoRef = useRef(null)
  const debounceRef = useRef(null)

  // Load current default avatar
  useEffect(() => {
    fetch(`${API}?action=get_avatars&agency_id=${agencyId}`).then(r => r.json()).then(r => {
      if (r.data?.[0]?.avatar_id) setSelectedId(r.data[0].avatar_id)
    })
  }, [])

  // Load avatars with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadAvatars(0), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, gender])

  async function loadAvatars(p) {
    setLoading(true)
    const url = new URL(API, window.location.origin)
    url.searchParams.set('action', 'get_all_avatars')
    url.searchParams.set('page', String(p))
    if (gender) url.searchParams.set('gender', gender)
    if (search) url.searchParams.set('search', search)
    const res = await fetch(url).then(r => r.json())
    if (p === 0) setAvatars(res.data || [])
    else setAvatars(prev => [...prev, ...(res.data || [])])
    setTotal(res.total || 0)
    setPage(p)
    setPages(res.pages || 0)
    setLoading(false)
  }

  async function selectAvatar(avatarId, avatarName) {
    setSaving(true)
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_default_avatar', agency_id: agencyId, avatar_id: avatarId, avatar_name: avatarName }),
    }).then(r => r.json())
    setSelectedId(avatarId)
    toast.success(`Avatar set to ${avatarName}`)
    setSaving(false)
  }

  function toggleVideo(avatarId, videoUrl) {
    if (playingId === avatarId) {
      if (videoRef.current) { videoRef.current.pause(); videoRef.current = null }
      setPlayingId(null)
      return
    }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.muted = true }
    const vid = document.getElementById(`vid-${avatarId}`)
    if (vid) { vid.muted = false; vid.play(); videoRef.current = vid; setPlayingId(avatarId) }
  }

  async function generateAiMessage() {
    if (!aiMessage.trim()) { toast.error('Describe what you want to say'); return }
    setAiGenerating(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
      // Use the video-voicemails API to generate a script
      const res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_script', prompt: aiMessage, agency_id: agencyId }),
      }).then(r => r.json())
      setAiResult(res.script || 'Could not generate script. Try being more specific.')
    } catch { setAiResult('Generation failed. Try again.') }
    setAiGenerating(false)
  }

  async function createVideoFromScript() {
    if (!scriptText.trim()) { toast.error('Enter or generate a script first'); return }
    if (!selectedId) { toast.error('Select an avatar first'); return }
    setGeneratingVideo(true)
    try {
      const res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          agency_id: agencyId,
          lead: { prospect_email: emailTo || '', business_name: 'Video Message' },
          avatar_id: selectedId,
          custom_script: scriptText,
          email_to: emailTo || undefined,
        }),
      }).then(r => r.json())
      if (res.success) {
        setGeneratedVideoId(res.vm_id)
        toast.success('Video generating! This takes 30-60 seconds.')
      } else { toast.error(res.error || 'Failed to create video') }
    } catch { toast.error('Failed to create video') }
    setGeneratingVideo(false)
  }

  function useAiScript() {
    if (aiResult) { setScriptText(aiResult); toast.success('Script loaded into editor') }
  }

  const FILTERS = [
    { key: '', label: 'All' },
    { key: 'female', label: 'Female' },
    { key: 'male', label: 'Male' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: W, padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>AI Avatar Browser</h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '2px 0 0' }}>Choose the face for your video voicemails -- {total} avatars available</p>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Create Video Message Panel */}
          <div style={{ background: W, borderRadius: 8, border: selectedId ? `2px solid ${R}` : '1px solid rgba(0,0,0,0.08)', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Send size={16} color={R} />
              <span style={{ fontSize: 15, fontWeight: 500, color: BLK }}>Create Video Message</span>
              {selectedId && (
                <span style={{ fontSize: 12, color: R, fontWeight: 500 }}>
                  Avatar: {avatars.find(a => a.avatar_id === selectedId)?.avatar_name || 'Selected'}
                </span>
              )}
              {!selectedId && <span style={{ fontSize: 12, color: '#6b7280' }}>-- select an avatar below first</span>}
            </div>

            {/* Step 1: AI assist OR paste script */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Option A: Let AI write it
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={aiMessage}
                  onChange={e => setAiMessage(e.target.value)}
                  placeholder="Describe what you want to say... e.g. I tried calling Mike about their low Google reviews"
                  onKeyDown={e => e.key === 'Enter' && generateAiMessage()}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
                />
                <button onClick={generateAiMessage} disabled={aiGenerating} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 6,
                  border: 'none', background: '#111', color: W, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  opacity: aiGenerating ? 0.5 : 1,
                }}>
                  {aiGenerating ? <Loader2 size={14} className="ds-spin" /> : <Sparkles size={14} />}
                  Write with AI
                </button>
              </div>
              {aiResult && (
                <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #dcfce7', fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: GRN, marginBottom: 4, textTransform: 'uppercase' }}>AI Generated:</div>
                  {aiResult}
                  <button onClick={useAiScript} style={{ marginTop: 8, padding: '5px 12px', borderRadius: 4, border: 'none', background: GRN, color: W, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Use This Script
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Script editor */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Option B: Type or paste your script
                </span>
                <span style={{ fontSize: 12, color: scriptText.length > 80 ? (scriptText.length > 120 ? '#dc2626' : '#d97706') : '#999' }}>
                  {scriptText.length} chars {scriptText.length > 0 && `(~${Math.round(scriptText.split(/\s+/).filter(Boolean).length / 2.5)}s)`}
                </span>
              </div>
              <textarea
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                placeholder="Type or paste what you want the avatar to say... Keep it under 60 words for a 15-20 second video."
                rows={4}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Step 3: Email (optional) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Send to email (optional)
              </div>
              <input
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="prospect@business.com (leave blank to just generate the video)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={createVideoFromScript}
              disabled={generatingVideo || !scriptText.trim() || !selectedId}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8,
                border: 'none', background: (!scriptText.trim() || !selectedId) ? '#e5e7eb' : R,
                color: (!scriptText.trim() || !selectedId) ? '#999' : W,
                fontSize: 14, fontWeight: 500, cursor: (!scriptText.trim() || !selectedId) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {generatingVideo ? (
                <><Loader2 size={16} className="ds-spin" /> Generating Video...</>
              ) : (
                <><Send size={16} /> Generate Video{emailTo ? ' & Send Email' : ''}</>
              )}
            </button>

            {/* Success state */}
            {generatedVideoId && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={16} color={GRN} />
                <span style={{ fontSize: 13, color: '#374151' }}>Video generating! Takes 30-60 seconds.</span>
                <a href="/video-voicemails" style={{ fontSize: 12, color: R, fontWeight: 500, marginLeft: 'auto' }}>View in Dashboard</a>
              </div>
            )}
          </div>

          {/* Search + Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} color="#999" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search avatars by name..."
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setGender(f.key)} style={{
                  padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  background: gender === f.key ? BLK : '#f9fafb',
                  color: gender === f.key ? W : '#555',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{total} avatars</span>
          </div>

          {/* Avatar Grid */}
          {loading && page === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={24} color={R} className="ds-spin" /></div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {avatars.map(av => {
              const isSelected = selectedId === av.avatar_id
              const isPlaying = playingId === av.avatar_id
              return (
                <div key={av.avatar_id} style={{
                  background: W, borderRadius: 10, overflow: 'hidden',
                  border: isSelected ? `2px solid ${R}` : '1px solid rgba(0,0,0,0.08)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  {/* Image / Video */}
                  <div style={{ position: 'relative', aspectRatio: '1', background: '#f9fafb', overflow: 'hidden' }}>
                    {av.preview_image_url && (
                      <img src={av.preview_image_url} alt={av.avatar_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: isPlaying ? 'none' : 'block' }} loading="lazy" />
                    )}
                    {av.preview_video_url && (
                      <video
                        id={`vid-${av.avatar_id}`}
                        src={isPlaying ? av.preview_video_url : undefined}
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: isPlaying ? 'block' : 'none' }}
                        onEnded={() => setPlayingId(null)}
                      />
                    )}

                    {/* Play button overlay */}
                    {av.preview_video_url && (
                      <button onClick={e => { e.stopPropagation(); toggleVideo(av.avatar_id, av.preview_video_url) }} style={{
                        position: 'absolute', bottom: 8, right: 8,
                        width: 32, height: 32, borderRadius: '50%',
                        background: isPlaying ? 'rgba(0,0,0,0.6)' : 'rgba(230,0,126,0.8)',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isPlaying ? <Pause size={12} color={W} /> : <Play size={12} color={W} style={{ marginLeft: 2 }} />}
                      </button>
                    )}

                    {/* Selected badge */}
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', borderRadius: 99, background: R, color: W, fontSize: 12, fontWeight: 600 }}>
                        <Check size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Current
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: BLK, marginBottom: 2 }}>{av.avatar_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{av.gender}</div>

                    <button
                      onClick={() => selectAvatar(av.avatar_id, av.avatar_name)}
                      disabled={saving || isSelected}
                      style={{
                        width: '100%', marginTop: 8, padding: '6px 0', borderRadius: 6,
                        fontSize: 12, fontWeight: 500, cursor: isSelected ? 'default' : 'pointer',
                        border: isSelected ? 'none' : '1px solid rgba(0,0,0,0.14)',
                        background: isSelected ? BLK : W,
                        color: isSelected ? W : '#555',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Load more */}
          {page < pages - 1 && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => loadAvatars(page + 1)} disabled={loading} style={{
                padding: '10px 28px', borderRadius: 6, border: '1px solid #e5e7eb',
                background: W, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151',
              }}>
                {loading ? <Loader2 size={14} className="ds-spin" /> : `Load More (${avatars.length}/${total})`}
              </button>
            </div>
          )}
        </div>
        <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}} .ds-spin{animation:ds-spin 1s linear infinite}`}</style>
      </div>
    </div>
  )
}
