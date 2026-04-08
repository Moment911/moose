"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Search, Check, Play, Pause, User, Loader2, RefreshCw, Sparkles, Send
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R='#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a'
const W='#ffffff'

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
        <div style={{ background: W, padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 500, color: BLK, margin: 0 }}>AI Avatar Browser</h1>
            <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>Choose the face for your video voicemails -- {total} avatars available</p>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* AI Message Composer */}
          <div style={{ background: W, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', padding: '18px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={16} color={R} />
              <span style={{ fontSize: 14, fontWeight: 500, color: BLK }}>AI Message Writer</span>
              <span style={{ fontSize: 11, color: '#999' }}>-- describe what you want to say and AI writes the script</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={aiMessage}
                onChange={e => setAiMessage(e.target.value)}
                placeholder="e.g. I tried calling Mike at Martinez Plumbing about their low Google reviews..."
                onKeyDown={e => e.key === 'Enter' && generateAiMessage()}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', fontSize: 13, boxSizing: 'border-box' }}
              />
              <button onClick={generateAiMessage} disabled={aiGenerating} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 6,
                border: 'none', background: R, color: W, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                opacity: aiGenerating ? 0.5 : 1,
              }}>
                {aiGenerating ? <Loader2 size={14} className="ds-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
            </div>
            {aiResult && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#F5F5F5', borderRadius: 6, fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Generated Script:</div>
                {aiResult}
                <button onClick={() => { navigator.clipboard.writeText(aiResult); toast.success('Copied') }} style={{ marginTop: 8, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 11, cursor: 'pointer', color: '#555' }}>
                  Copy Script
                </button>
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
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setGender(f.key)} style={{
                  padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  background: gender === f.key ? BLK : '#F5F5F5',
                  color: gender === f.key ? W : '#555',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#999' }}>{total} avatars</span>
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
                  <div style={{ position: 'relative', aspectRatio: '1', background: '#F5F5F5', overflow: 'hidden' }}>
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
                      <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', borderRadius: 99, background: R, color: W, fontSize: 10, fontWeight: 600 }}>
                        <Check size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Current
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: BLK, marginBottom: 2 }}>{av.avatar_name}</div>
                    <div style={{ fontSize: 11, color: '#999', textTransform: 'capitalize' }}>{av.gender}</div>

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
                padding: '10px 28px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)',
                background: W, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#555',
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
