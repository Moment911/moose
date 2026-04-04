"use client";
"use client";
import { useRef, useState, useEffect, useCallback } from 'react'
import { PenSquare } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function DraggableComposeFAB() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [pos, setPos] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const hasDragged = useRef(false)
  const dragStart = useRef(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setPos({ x: window.innerWidth - 70, y: window.innerHeight - 56 - 54 - 16 })
  }, [isMobile])

  const onTouchStart = useCallback(e => {
    const t = e.touches[0]
    dragStart.current = { tx: t.clientX, ty: t.clientY, ox: pos.x, oy: pos.y }
    hasDragged.current = false
    setIsDragging(true)
  }, [pos])

  const onTouchMove = useCallback(e => {
    if (!dragStart.current) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - dragStart.current.tx
    const dy = t.clientY - dragStart.current.ty
    if (Math.hypot(dx, dy) > 8) hasDragged.current = true
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - 62, dragStart.current.ox + dx)),
      y: Math.max(60, Math.min(window.innerHeight - 120, dragStart.current.oy + dy)),
    })
  }, [])

  const onTouchEnd = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
    if (!hasDragged.current) { navigate('/messages'); return }
    setPos(p => ({ ...p, x: p.x + 27 < window.innerWidth / 2 ? 16 : window.innerWidth - 70 }))
  }, [navigate])

  if (!isMobile || !pos) return null
  // Hide on messages page (compose is there) and login
  if (pathname === '/messages' || pathname === '/login') return null

  return (
    <button className="md:hidden"
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 35,
        width: 54, height: 54, borderRadius: 27,
        background: '#ea2729', color: '#fff', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(232,85,26,0.35)',
        transform: isDragging ? 'scale(1.12)' : 'scale(1)',
        transition: isDragging ? 'transform 0.1s' : 'transform 0.2s, left 0.25s cubic-bezier(0.22,1,0.36,1)',
        opacity: isDragging ? 0.9 : 1,
        touchAction: 'none', cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <PenSquare size={22} strokeWidth={2} />
    </button>
  )
}
