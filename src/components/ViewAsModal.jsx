"use client";
import { useState, useEffect } from 'react';
import { Search, X, Users, Globe, ChevronRight, Check, Shield, Building2, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const R   = '#E6007E', T = '#00C2CB', BLK = '#111111', GRN = '#16a34a', AMB = '#f59e0b';
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

export default function ViewAsModal({ open, onClose }) {
  const auth = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [agencies, setAgencies] = useState([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Fetch agencies on open
  useEffect(() => {
    if (!open) return;
    setLoadingAgencies(true);
    supabase
      .from('agencies')
      .select('id, name, slug, status, brand_name, created_at')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setAgencies(data);
        setLoadingAgencies(false);
      });
    // Reset state on open
    setSelectedAgency(null);
    setSelectedClient(null);
    setClients([]);
    setSearch('');
  }, [open]);

  // Fetch clients when agency selected
  useEffect(() => {
    if (!selectedAgency) { setClients([]); setSelectedClient(null); return; }
    setLoadingClients(true);
    setSelectedClient(null);
    supabase
      .from('clients')
      .select('id, name, industry, status')
      .eq('agency_id', selectedAgency.id)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setClients(data);
        setLoadingClients(false);
      });
  }, [selectedAgency]);

  const filtered = agencies.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.brand_name?.toLowerCase().includes(q) ||
      a.slug?.toLowerCase().includes(q)
    );
  });

  function handleViewAs() {
    if (!selectedAgency) return;
    auth.impersonateAgency(selectedAgency);
    if (selectedClient) {
      auth.impersonateClient(selectedClient);
      try { sessionStorage.setItem('koto_view_as_client', JSON.stringify(selectedClient)); } catch {}
    }
    try { sessionStorage.setItem('koto_view_as_agency', JSON.stringify(selectedAgency)); } catch {}
    onClose();
    navigate('/');
    toast.success(`Now viewing as ${selectedAgency.brand_name || selectedAgency.name}`);
  }

  if (!open) return null;

  const base = { fontFamily: FH };

  const statusBadge = (status) => {
    const colors = {
      active: { bg: '#dcfce7', color: GRN },
      inactive: { bg: '#fef3c7', color: AMB },
      suspended: { bg: '#fee2e2', color: R },
    };
    const c = colors[status] || colors.inactive;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '2px 6px',
          borderRadius: 4,
          background: c.bg,
          color: c.color,
          ...base,
        }}
      >
        {status || 'unknown'}
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...base,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          maxWidth: 900,
          width: '95vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={20} style={{ color: R }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: BLK, ...base }}>View As</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} style={{ color: '#6b7280' }} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <Search size={16} style={{ color: '#9ca3af' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agencies..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                color: BLK,
                ...base,
              }}
            />
          </div>
        </div>

        {/* Three-column body */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Column 1: Agencies */}
          <div
            style={{
              width: 300,
              borderRight: '1px solid #e5e7eb',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                borderBottom: '1px solid #f3f4f6',
                ...base,
              }}
            >
              <Building2 size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Agencies ({filtered.length})
            </div>
            {loadingAgencies ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Loader2 size={20} style={{ color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#9ca3af', ...base }}>
                No agencies found
              </div>
            ) : (
              filtered.map((agency) => {
                const isSelected = selectedAgency?.id === agency.id;
                return (
                  <div
                    key={agency.id}
                    onClick={() => setSelectedAgency(agency)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      background: isSelected ? '#fef2f2' : 'transparent',
                      borderLeft: isSelected ? `3px solid ${R}` : '3px solid transparent',
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: BLK, ...base }}>
                        {agency.brand_name || agency.name}
                      </span>
                      {statusBadge(agency.status)}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, ...base }}>
                      {agency.slug} &middot; {agency.created_at ? new Date(agency.created_at).toLocaleDateString() : ''}
                    </div>
                    {isSelected && (
                      <Check size={14} style={{ color: R, position: 'absolute', right: 12 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Column 2: Clients */}
          <div
            style={{
              width: 300,
              borderRight: '1px solid #e5e7eb',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                borderBottom: '1px solid #f3f4f6',
                ...base,
              }}
            >
              <Users size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Clients {selectedAgency ? `(${clients.length})` : ''}
            </div>

            {!selectedAgency ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#9ca3af', ...base }}>
                Select an agency
              </div>
            ) : loadingClients ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Loader2 size={20} style={{ color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <>
                {/* View as Agency button */}
                <div
                  onClick={() => setSelectedClient(null)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: selectedClient === null ? '#eff6ff' : 'transparent',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Eye size={14} style={{ color: T }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T, ...base }}>
                    View as Agency (no client)
                  </span>
                </div>

                {clients.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#9ca3af', ...base }}>
                    No clients found
                  </div>
                ) : (
                  clients.map((client) => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                      <div
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          background: isSelected ? '#fef2f2' : 'transparent',
                          borderLeft: isSelected ? `3px solid ${R}` : '3px solid transparent',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: BLK, ...base }}>
                          {client.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {client.industry && (
                            <span style={{ fontSize: 11, color: '#6b7280', ...base }}>{client.industry}</span>
                          )}
                          {statusBadge(client.status)}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Column 3: Actions */}
          <div
            style={{
              flex: 1,
              minWidth: 200,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
            }}
          >
            {!selectedAgency ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  color: '#9ca3af',
                }}
              >
                <Globe size={32} />
                <span style={{ fontSize: 14, ...base }}>Select an agency to begin</span>
              </div>
            ) : (
              <>
                {/* Selected summary */}
                <div
                  style={{
                    background: '#f9fafb',
                    borderRadius: 12,
                    padding: 16,
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8, letterSpacing: '0.05em', ...base }}>
                    Viewing as
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Building2 size={14} style={{ color: R }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: BLK, ...base }}>
                      {selectedAgency.brand_name || selectedAgency.name}
                    </span>
                  </div>
                  {selectedClient && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ChevronRight size={12} style={{ color: '#9ca3af' }} />
                      <Users size={14} style={{ color: T }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: BLK, ...base }}>
                        {selectedClient.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <button
                  onClick={() => { setSelectedClient(null); handleViewAs(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 16px',
                    background: '#fef2f2',
                    border: `1px solid ${R}33`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    color: R,
                    ...base,
                  }}
                >
                  <Eye size={14} />
                  View as Agency Admin
                </button>

                {selectedClient && (
                  <button
                    onClick={handleViewAs}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '10px 16px',
                      background: `${T}15`,
                      border: `1px solid ${T}33`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      color: T,
                      ...base,
                    }}
                  >
                    <Users size={14} />
                    View as Client
                  </button>
                )}

                {/* Preview info */}
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6, ...base }}>
                    <Eye size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                    Preview
                  </div>
                  <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5, ...base }}>
                    You will see{' '}
                    <strong>{selectedAgency.brand_name || selectedAgency.name}</strong>
                    {selectedClient ? `'s client "${selectedClient.name}"` : "'s dashboard, clients, and data"}.
                  </p>
                </div>

                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', margin: 0, ...base }}>
                    ⚠ All actions will affect this agency's real data
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 24px',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              ...base,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleViewAs}
            disabled={!selectedAgency}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: selectedAgency ? R : '#d1d5db',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedAgency ? 'pointer' : 'not-allowed',
              opacity: selectedAgency ? 1 : 0.6,
              ...base,
            }}
          >
            View as Selected
          </button>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
