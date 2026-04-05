"use client"
import { useState, useEffect } from 'react'
import SearchableSelect from './SearchableSelect'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'

/**
 * ClientSearchSelect — drop-in replacement for the dark header client <select>
 * used across all SEO tools. Auto-loads clients, integrates with ClientContext.
 *
 * Props:
 *   value       string — selected clientId
 *   onChange    (clientId, clientObj) => void
 *   style       object — override wrapper style
 *   dark        bool — use dark theme (default true for page headers)
 *   minWidth    number — min width of trigger button
 */
export default function ClientSearchSelect({
  value, onChange, style = {}, dark = true, minWidth = 220, placeholder = 'Select client',
}) {
  const { agencyId } = useAuth()
  const [clients, setClients] = useState([])
  const [loaded,  setLoaded]  = useState(false)

  useEffect(() => {
    supabase.from('clients')
      .select('id,name,industry,sic_code,city,state,website,google_place_id')
      .order('name')
      .then(({ data }) => { setClients(data || []); setLoaded(true) })
  }, [agencyId])

  const options = clients.map(cl => ({
    value:    cl.id,
    label:    cl.name,
    sub:      [cl.industry, cl.city].filter(Boolean).join(' · '),
    keywords: cl.industry || '',
    client:   cl,
  }))

  return (
    <SearchableSelect
      value={value}
      onChange={(id, opt) => onChange(id, opt?.client || null)}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Search clients…"
      dark={dark}
      style={{ minWidth, ...style }}
    />
  )
}
