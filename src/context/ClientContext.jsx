"use client";
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const { agencyId } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClientState] = useState(null)
  const [loading, setLoading] = useState(false)

  // Load clients whenever agencyId changes
  useEffect(() => {
    if (agencyId) loadClients(agencyId)
    else {
      setClients([])
      setSelectedClientState(null)
    }
  }, [agencyId])

  // Restore last selected client for THIS agency from localStorage
  useEffect(() => {
    if (clients.length === 0 || !agencyId) return
    const saved = localStorage.getItem(`moose_selected_client_${agencyId}`)
    if (saved) {
      const found = clients.find(c => c.id === saved)
      if (found) { setSelectedClientState(found); return }
    }
    // No saved client for this agency -- don't auto-select (let user pick)
    // Unless there's only one client
    if (clients.length === 1) setSelectedClientState(clients[0])
  }, [clients, agencyId])

  async function loadClients(aid) {
    setLoading(true)
    setSelectedClientState(null) // clear stale selection from previous agency
    const { data } = await supabase
      .from('clients')
      .select('id, name, industry, email, phone, website, status, city, state, primary_service')
      .eq('agency_id', aid)
      .is('deleted_at', null)
      .order('name')
    setClients(data || [])
    setLoading(false)
  }

  const selectClient = useCallback((client) => {
    setSelectedClientState(client)
    if (client?.id && agencyId) {
      localStorage.setItem(`moose_selected_client_${agencyId}`, client.id)
    }
  }, [agencyId])

  const selectClientById = useCallback((id) => {
    const found = clients.find(c => c.id === id)
    if (found) selectClient(found)
  }, [clients, selectClient])

  function clearSelectedClient() {
    setSelectedClientState(null)
    if (agencyId) localStorage.removeItem(`moose_selected_client_${agencyId}`)
  }

  async function refreshClients() {
    if (agencyId) await loadClients(agencyId)
  }

  return (
    <ClientContext.Provider value={{
      clients,
      selectedClient,
      clientId: selectedClient?.id || null,
      selectClient,
      selectClientById,
      clearSelectedClient,
      refreshClients,
      loading,
      agencyId,
    }}>
      {children}
    </ClientContext.Provider>
  )
}

export const useClient = () => {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClient must be used within ClientProvider')
  return ctx
}
