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

  // Load clients whenever agencyId is available
  useEffect(() => {
    if (agencyId) loadClients(agencyId)
  }, [agencyId])

  // Restore last selected client from localStorage
  useEffect(() => {
    if (clients.length === 0) return
    const saved = localStorage.getItem('moose_selected_client_id')
    if (saved) {
      const found = clients.find(c => c.id === saved)
      if (found && !selectedClient) setSelectedClientState(found)
    } else if (!selectedClient) {
      // Default to first client
      setSelectedClientState(clients[0])
    }
  }, [clients])

  async function loadClients(aid) {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('id, name, industry, email, phone, website, status')
      .eq('agency_id', aid)
      .order('name')
    setClients(data || [])
    setLoading(false)
  }

  function selectClient(client) {
    setSelectedClientState(client)
    if (client?.id) localStorage.setItem('moose_selected_client_id', client.id)
  }

  function clearSelectedClient() {
    setSelectedClientState(null)
    localStorage.removeItem('moose_selected_client_id')
  }

  async function refreshClients() {
    if (agencyId) await loadClients(agencyId)
  }

  return (
    <ClientContext.Provider value={{
      clients,
      selectedClient,
      selectClient,
      clearSelectedClient,
      refreshClients,
      loading,
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
