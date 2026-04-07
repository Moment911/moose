"use client";
import { useState } from 'react';
import { Shield, X, ChevronRight, AlertTriangle, Eye, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRN = '#16a34a', AMB = '#f59e0b';
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

const BAR_HEIGHT = 36;

export default function ImpersonationBar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [viewRole, setViewRole] = useState('agency_admin');

  const isImpersonating = auth?.isImpersonating;
  const hasSessionAgency = (() => {
    try { return !!sessionStorage.getItem('koto_view_as_agency'); } catch { return false; }
  })();

  if (!isImpersonating && !hasSessionAgency) return null;

  const agencyName = auth?.impersonatedAgency?.name || (() => {
    try {
      const stored = sessionStorage.getItem('koto_view_as_agency');
      return stored ? JSON.parse(stored).name : 'Unknown Agency';
    } catch { return 'Unknown Agency'; }
  })();

  const clientName = auth?.impersonatedClient?.name || (() => {
    try {
      const stored = sessionStorage.getItem('koto_view_as_client');
      return stored ? JSON.parse(stored).name : null;
    } catch { return null; }
  })();

  function handleExit() {
    auth?.stopImpersonating?.();
    try {
      sessionStorage.removeItem('koto_view_as_agency');
      sessionStorage.removeItem('koto_view_as_client');
    } catch {}
    navigate('/');
  }

  function handleRoleChange(e) {
    const role = e.target.value;
    setViewRole(role);
    // Future: auth.setViewAs could be wired here
  }

  const base = {
    fontSize: 12,
    fontFamily: FH,
    fontWeight: 600,
  };

  return (
    <>
      {/* Spacer to push content down */}
      <div style={{ height: BAR_HEIGHT }} />

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          height: BAR_HEIGHT,
          background: '#7f1d1d',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          ...base,
        }}
      >
        {/* Left — Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 0' }}>
          <Shield size={14} style={{ flexShrink: 0 }} />
          <span style={{ opacity: 0.8, whiteSpace: 'nowrap' }}>Koto Super Admin</span>
          <ChevronRight size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', color: T }}>{agencyName}</span>
          {clientName && (
            <>
              <ChevronRight size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', color: '#fbbf24' }}>{clientName}</span>
            </>
          )}
        </div>

        {/* Middle — Warning */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: '0 0 auto',
            padding: '0 24px',
          }}
        >
          <AlertTriangle size={13} style={{ color: AMB }} />
          <span style={{ color: AMB, whiteSpace: 'nowrap' }}>
            View-as mode — changes affect real data
          </span>
        </div>

        {/* Right — Role selector + Exit */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: '1 1 0',
            justifyContent: 'flex-end',
          }}
        >
          <select
            value={viewRole}
            onChange={handleRoleChange}
            style={{
              ...base,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 4,
              padding: '2px 8px',
              height: 24,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="super_admin" style={{ color: BLK }}>Super Admin</option>
            <option value="agency_admin" style={{ color: BLK }}>Agency Admin</option>
            <option value="client" style={{ color: BLK }}>Client</option>
          </select>

          <button
            onClick={handleExit}
            style={{
              ...base,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 4,
              padding: '2px 10px',
              height: 24,
              cursor: 'pointer',
            }}
          >
            <X size={12} />
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
