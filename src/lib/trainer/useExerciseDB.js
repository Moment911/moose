import { useEffect, useState, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useExerciseDB — client hook to fetch ExerciseDB data for exercise names.
//
// Given an array of exercise names/IDs, fetches GIF URLs + muscle data
// from /api/trainer/exercise-db (which proxies oss.exercisedb.dev).
// Returns a Map<exerciseName, ExerciseDBMatch>.
//
// Batches requests and caches across renders.
// ─────────────────────────────────────────────────────────────────────────────

// Module-level cache — survives across component mounts
const globalCache = new Map()
const inflight = new Map() // name → Promise

async function fetchOne(name) {
  if (!name || name.length < 2) return null
  const key = name.toLowerCase().replace(/[_-]/g, ' ').trim()

  if (globalCache.has(key)) return globalCache.get(key)
  if (inflight.has(key)) return inflight.get(key)

  const promise = (async () => {
    try {
      const res = await fetch(`/api/trainer/exercise-db?name=${encodeURIComponent(name)}`)
      if (!res.ok) return null
      const data = await res.json()
      const match = data.match || null
      globalCache.set(key, match)
      return match
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

/**
 * @param {string[]} exerciseNames — array of exercise names or exercise_id slugs
 * @returns {{ data: Map<string, object>, loading: boolean }}
 */
export function useExerciseDB(exerciseNames) {
  const [data, setData] = useState(() => new Map())
  const [loading, setLoading] = useState(false)
  const prevNamesRef = useRef('')

  useEffect(() => {
    if (!exerciseNames || exerciseNames.length === 0) return
    const namesKey = exerciseNames.sort().join('|')
    if (namesKey === prevNamesRef.current) return
    prevNamesRef.current = namesKey

    let cancelled = false
    setLoading(true)

    // Fetch all in parallel (max 10 concurrent to be polite)
    const batch = async () => {
      const results = new Map()
      const chunks = []
      for (let i = 0; i < exerciseNames.length; i += 10) {
        chunks.push(exerciseNames.slice(i, i + 10))
      }
      for (const chunk of chunks) {
        const promises = chunk.map(async (name) => {
          const match = await fetchOne(name)
          if (match) results.set(name.toLowerCase().replace(/[_-]/g, ' ').trim(), match)
        })
        await Promise.all(promises)
        if (cancelled) return
        // Update incrementally so cards show as they load
        setData(new Map(results))
      }
      if (!cancelled) setLoading(false)
    }

    batch()
    return () => { cancelled = true }
  }, [exerciseNames])

  return { data, loading }
}
