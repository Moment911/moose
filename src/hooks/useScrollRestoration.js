"use client"
// ─────────────────────────────────────────────────────────────
// useScrollRestoration
//
// Remembers scroll position per unique route (pathname + search)
// in an in-memory Map so navigating back to a previously-visited
// page restores the scroll position. Module-level map = survives
// component unmounts but not full page reloads.
//
// Usage:
//   const scrollRef = useRef(null)
//   useScrollRestoration(scrollRef)
//   <div ref={scrollRef} style={{ overflowY: 'auto' }}>...</div>
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const scrollMap = new Map()

export function useScrollRestoration(containerRef) {
  const { pathname, search } = useLocation()
  const key = pathname + search
  const keyRef = useRef(key)

  // Keep the live key in a ref so the scroll-listener captures
  // the latest value without re-subscribing on every change.
  useEffect(() => { keyRef.current = key }, [key])

  // Restore on mount / key change
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const saved = scrollMap.get(key)
    if (typeof saved === 'number') {
      // Use rAF so it runs after the DOM settles
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = saved
      })
    }
  }, [key, containerRef])

  // Track scroll position
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      scrollMap.set(keyRef.current, el.scrollTop)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef])
}
