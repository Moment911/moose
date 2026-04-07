"use client"
import { useEffect, useRef, useState } from 'react'

const FB = "'Raleway','Helvetica Neue',sans-serif"

export default function PlacesAutocomplete({
  value, onChange, onPlaceSelected,
  placeholder = 'Start typing...', type = 'address', style: sx = {}
}) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.google?.maps?.places) { initAutocomplete(); return }

    const existing = document.getElementById('google-maps-places')
    if (existing) { existing.addEventListener('load', initAutocomplete); return }

    const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
    if (!key) return

    const script = document.createElement('script')
    script.id = 'google-maps-places'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.onload = initAutocomplete
    document.head.appendChild(script)
  }, [])

  function initAutocomplete() {
    if (!inputRef.current || !window.google?.maps?.places) return

    const options = {
      types: type === 'establishment' ? ['establishment'] : ['address'],
      componentRestrictions: { country: 'us' },
      fields: [
        'address_components', 'formatted_address', 'name', 'place_id',
        'geometry', 'website', 'formatted_phone_number', 'rating',
        'user_ratings_total', 'business_status', 'types', 'photos'
      ],
    }

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, options)

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (!place.address_components && !place.name) return

      const get = (t) => place.address_components?.find(c => c.types.includes(t))?.long_name || ''
      const getShort = (t) => place.address_components?.find(c => c.types.includes(t))?.short_name || ''

      const parsed = {
        name: place.name || '',
        formatted_address: place.formatted_address || '',
        address: `${get('street_number')} ${get('route')}`.trim(),
        city: get('locality') || get('sublocality_level_1'),
        state: getShort('administrative_area_level_1'),
        zip: get('postal_code'),
        country: getShort('country'),
        phone: place.formatted_phone_number || '',
        website: place.website || '',
        rating: place.rating || null,
        review_count: place.user_ratings_total || null,
        place_id: place.place_id || '',
        lat: place.geometry?.location?.lat() || null,
        lng: place.geometry?.location?.lng() || null,
        business_type: place.types?.[0] || '',
        photo_url: place.photos?.[0]?.getUrl?.({ maxWidth: 400 }) || '',
      }

      onChange(place.formatted_address || place.name || '')
      onPlaceSelected?.(parsed)
    })

    setLoaded(true)
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8,
        border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB,
        outline: 'none', boxSizing: 'border-box', ...sx,
      }}
    />
  )
}
