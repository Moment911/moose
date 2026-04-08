"use client"

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Download, Volume2 } from 'lucide-react'

const R   = '#E6007E'
const T = '#00C2CB'

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function AudioPlayer({ src, duration }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(duration || 0)
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [bars] = useState(() =>
    Array.from({ length: 50 }, () => 0.15 + Math.random() * 0.85)
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration)
      }
    }
    const onEnd = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [src])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }

  const scrub = (e) => {
    const audio = audioRef.current
    if (!audio || !totalDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * totalDuration
    setCurrentTime(audio.currentTime)
  }

  const changeSpeed = (s) => {
    setSpeed(s)
    setShowSpeedMenu(false)
    if (audioRef.current) audioRef.current.playbackRate = s
  }

  const progress = totalDuration ? currentTime / totalDuration : 0

  if (!src) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 300,
          height: 48,
          padding: '0 12px',
          borderRadius: 8,
          background: '#f3f4f6',
          fontFamily: 'FH, sans-serif',
          color: '#9ca3af',
          fontSize: 13,
        }}
      >
        <Volume2 size={16} />
        Recording not available
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: 300,
        height: 48,
        padding: '0 10px',
        borderRadius: 8,
        background: '#f9fafb',
        fontFamily: 'FH, sans-serif',
        fontSize: 12,
        position: 'relative',
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause */}
      <button
        onClick={toggle}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: 'none',
          background: playing ? R : '#e5e7eb',
          color: playing ? '#fff' : '#374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>

      {/* Waveform + progress */}
      <div
        onClick={scrub}
        style={{
          flex: 1,
          height: 28,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {bars.map((h, i) => {
          const barPct = i / bars.length
          const played = barPct <= progress
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: 1,
                background: played ? R : '#d1d5db',
                transition: 'background 0.15s',
              }}
            />
          )
        })}
      </div>

      {/* Time */}
      <span style={{ color: '#6b7280', whiteSpace: 'nowrap', fontSize: 11, minWidth: 70, textAlign: 'center' }}>
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>

      {/* Speed selector */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            padding: '2px 5px',
            fontSize: 10,
            cursor: 'pointer',
            color: '#374151',
            fontFamily: 'FH, sans-serif',
          }}
        >
          {speed}x
        </button>
        {showSpeedMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,.12)',
              zIndex: 10,
              overflow: 'hidden',
            }}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '4px 12px',
                  border: 'none',
                  background: s === speed ? '#f3f4f6' : '#fff',
                  cursor: 'pointer',
                  fontSize: 11,
                  textAlign: 'left',
                  fontFamily: 'FH, sans-serif',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Download */}
      <a
        href={src}
        download
        style={{
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Download size={14} />
      </a>
    </div>
  )
}
