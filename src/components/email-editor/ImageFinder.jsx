"use client";
import { useState, useEffect } from 'react'
import { Search, X, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const UNSPLASH_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
const PEXELS_KEY = process.env.NEXT_PUBLIC_PEXELS_API_KEY
const PIXABAY_KEY = process.env.NEXT_PUBLIC_PIXABAY_API_KEY

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return { results: [], error: 'Unsplash API key not set' }
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`, {
      headers: { 'Authorization': `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' }
    })
    if (!res.ok) throw new Error(`Unsplash error: ${res.status}`)
    const data = await res.json()
    return {
      results: (data.results || []).map(item => ({
        id: item.id,
        url: item.urls.regular,
        thumb: item.urls.thumb,
        small: item.urls.small,
        credit: item.user?.name || 'Unknown',
        alt: item.alt_description || query,
        width: item.width,
        height: item.height,
        source: 'unsplash'
      }))
    }
  } catch (e) {
    return { results: [], error: e.message }
  }
}

async function searchPexels(query) {
  if (!PEXELS_KEY) return { results: [], error: 'Pexels API key not set' }
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20`, {
      headers: { 'Authorization': PEXELS_KEY }
    })
    if (!res.ok) throw new Error(`Pexels error: ${res.status}`)
    const data = await res.json()
    return {
      results: (data.photos || []).map(photo => ({
        id: photo.id,
        url: photo.src.large,
        thumb: photo.src.tiny,
        small: photo.src.medium,
        credit: photo.photographer || 'Unknown',
        alt: photo.alt || query,
        width: photo.width,
        height: photo.height,
        source: 'pexels'
      }))
    }
  } catch (e) {
    return { results: [], error: e.message }
  }
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return { results: [], error: 'Pixabay API key not set' }
  try {
    const res = await fetch(`https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=20`)
    if (!res.ok) throw new Error(`Pixabay error: ${res.status}`)
    const data = await res.json()
    return {
      results: (data.hits || []).map(hit => ({
        id: hit.id,
        url: hit.largeImageURL,
        thumb: hit.previewURL,
        small: hit.webformatURL,
        credit: hit.user || 'Unknown',
        alt: hit.tags || query,
        width: hit.imageWidth,
        height: hit.imageHeight,
        source: 'pixabay'
      }))
    }
  } catch (e) {
    return { results: [], error: e.message }
  }
}

export default function ImageFinder({ open, onClose, onSelect, suggestedQuery }) {
  const [query, setQuery] = useState(suggestedQuery || '')
  const [tab, setTab] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (suggestedQuery && open) setQuery(suggestedQuery)
  }, [suggestedQuery, open])

  async function handleSearch(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      let allResults = []
      const errors = []

      if (tab === 'all' || tab === 'unsplash') {
        const u = await searchUnsplash(query)
        allResults.push(...u.results)
        if (u.error) errors.push(u.error)
      }
      if (tab === 'all' || tab === 'pexels') {
        const p = await searchPexels(query)
        allResults.push(...p.results)
        if (p.error) errors.push(p.error)
      }
      if (tab === 'all' || tab === 'pixabay') {
        const px = await searchPixabay(query)
        allResults.push(...px.results)
        if (px.error) errors.push(px.error)
      }

      // Shuffle if "all" tab so sources are mixed
      if (tab === 'all') allResults.sort(() => Math.random() - 0.5)

      setResults(allResults)
      if (allResults.length === 0 && errors.length > 0) {
        setError(errors.join('. '))
      }
    } catch (e) {
      setError(e.message)
      toast.error('Image search failed')
    }
    setLoading(false)
  }

  function handleUse(img) {
    onSelect(img.url, img.alt, img.credit)
    toast.success('Image inserted')
    onClose()
  }

  if (!open) return null

  const availableApis = [
    UNSPLASH_KEY && 'Unsplash',
    PEXELS_KEY && 'Pexels',
    PIXABAY_KEY && 'Pixabay'
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ImageIcon size={16} /> Find Images</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {availableApis.length > 0
                ? `Search ${availableApis.join(', ')}`
                : 'No image API keys configured. Add NEXT_PUBLIC_UNSPLASH_ACCESS_KEY, NEXT_PUBLIC_PEXELS_API_KEY, or NEXT_PUBLIC_PIXABAY_API_KEY to .env'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Search bar + tabs */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input className="flex-1 text-sm bg-transparent outline-none" placeholder="Search for images..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            </div>
            <button type="submit" disabled={loading || !query.trim()} className="btn-primary text-sm px-4 disabled:opacity-40">
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
            </button>
          </form>
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'unsplash', label: 'Unsplash', disabled: !UNSPLASH_KEY },
              { key: 'pexels', label: 'Pexels', disabled: !PEXELS_KEY },
              { key: 'pixabay', label: 'Pixabay', disabled: !PIXABAY_KEY },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} disabled={t.disabled}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${tab === t.key ? 'bg-gray-900 text-white' : t.disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Searching images...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-sm text-red-500 mb-2">{error}</p>
              <p className="text-sm text-gray-400">Check your API keys in .env file</p>
            </div>
          )}

          {!loading && !error && searched && results.length === 0 && (
            <div className="text-center py-16">
              <ImageIcon size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No images found for "{query}"</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </div>
          )}

          {!loading && !searched && (
            <div className="text-center py-16">
              <Search size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Search for free stock images</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {['Marketing', 'Business', 'Technology', 'Nature', 'Office', 'Abstract'].map(s => (
                  <button key={s} onClick={() => { setQuery(s); }} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200">{s}</button>
                ))}
              </div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {results.map(img => (
                <div key={`${img.source}-${img.id}`} className="group relative rounded-xl overflow-hidden border border-gray-200 hover:border-brand-400 hover:shadow-lg transition-all">
                  <div className="aspect-video bg-gray-100">
                    <img src={img.thumb || img.small} alt={img.alt} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[13px] text-gray-400 flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[13px] font-medium ${img.source === 'unsplash' ? 'bg-gray-900 text-white' : img.source === 'pexels' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {img.source}
                      </span>
                      by {img.credit}
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <button onClick={() => handleUse(img)}
                      className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg shadow-lg hover:bg-brand-500 hover:text-white transition-all transform scale-90 group-hover:scale-100">
                      Use this image
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
