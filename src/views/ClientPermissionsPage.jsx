'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  Save,
  Eye,
  Shield,
  FileText,
  Star,
  BarChart2,
  CheckSquare,
  CreditCard,
  Sparkles,
  Target,
  Phone,
  Brain,
  Globe,
  Settings,
  Loader2,
  Check,
} from 'lucide-react';

const R = '#ea2729',
  T = '#5bc6d0',
  BLK = '#0a0a0a',
  GRY = '#f2f2f0',
  GRN = '#16a34a',
  AMB = '#f59e0b';
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

const DEFAULT_PERMISSIONS = {
  can_view_pages: true,
  can_view_reviews: true,
  can_view_reports: true,
  can_view_rankings: true,
  can_view_tasks: true,
  can_edit_tasks: false,
  can_view_proposals: true,
  can_view_billing: false,
  can_use_page_builder: false,
  can_use_seo_hub: false,
  can_use_scout: false,
  can_use_voice_agent: false,
  can_use_cmo_agent: false,
  show_agency_branding: true,
  custom_dashboard_message: '',
};

const SECTIONS = [
  {
    title: 'Content Access',
    icon: Eye,
    fields: [
      { key: 'can_view_pages', label: 'Can View Pages', icon: FileText },
      { key: 'can_view_reviews', label: 'Can View Reviews', icon: Star },
      { key: 'can_view_reports', label: 'Can View Reports', icon: BarChart2 },
      { key: 'can_view_rankings', label: 'Can View Rankings', icon: Globe },
    ],
  },
  {
    title: 'Task & Workflow',
    icon: CheckSquare,
    fields: [
      { key: 'can_view_tasks', label: 'Can View Tasks', icon: CheckSquare },
      { key: 'can_edit_tasks', label: 'Can Edit Tasks', icon: CheckSquare },
      { key: 'can_view_proposals', label: 'Can View Proposals', icon: FileText },
      { key: 'can_view_billing', label: 'Can View Billing', icon: CreditCard },
    ],
  },
  {
    title: 'Tool Access',
    icon: Settings,
    fields: [
      { key: 'can_use_page_builder', label: 'Can Use Page Builder', icon: Sparkles },
      { key: 'can_use_seo_hub', label: 'Can Use SEO Hub', icon: BarChart2 },
      { key: 'can_use_scout', label: 'Can Use Scout', icon: Target },
      { key: 'can_use_voice_agent', label: 'Can Use Voice Agent', icon: Phone },
      { key: 'can_use_cmo_agent', label: 'Can Use CMO Agent', icon: Brain },
    ],
  },
  {
    title: 'Branding',
    icon: Shield,
    fields: [
      { key: 'show_agency_branding', label: 'Show Agency Branding', icon: Shield },
    ],
  },
];

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 48,
        height: 26,
        borderRadius: 13,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: checked ? GRN : '#d1d5db',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 25 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export default function ClientPermissionsPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user, previewAsClient } = useAuth();

  const [client, setClient] = useState(null);
  const [permissions, setPermissions] = useState({ ...DEFAULT_PERMISSIONS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [permissionId, setPermissionId] = useState(null);

  useEffect(() => {
    if (clientId && user) {
      fetchData();
    }
  }, [clientId, user]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch existing permissions
      const { data: permData, error: permError } = await supabase
        .from('koto_client_permissions')
        .select('*')
        .eq('client_id', clientId)
        .eq('agency_id', user.agency_id)
        .single();

      if (permError && permError.code !== 'PGRST116') {
        throw permError;
      }

      if (permData) {
        setPermissionId(permData.id);
        const merged = { ...DEFAULT_PERMISSIONS };
        Object.keys(DEFAULT_PERMISSIONS).forEach((key) => {
          if (permData[key] !== undefined && permData[key] !== null) {
            merged[key] = permData[key];
          }
        });
        setPermissions(merged);
      } else {
        // Create default permissions record
        const { data: newPerm, error: createError } = await supabase
          .from('koto_client_permissions')
          .insert({
            client_id: clientId,
            agency_id: user.agency_id,
            ...DEFAULT_PERMISSIONS,
          })
          .select()
          .single();

        if (createError) throw createError;
        setPermissionId(newPerm.id);
        setPermissions({ ...DEFAULT_PERMISSIONS });
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        client_id: clientId,
        agency_id: user.agency_id,
        ...permissions,
        updated_at: new Date().toISOString(),
      };

      if (permissionId) {
        const { error } = await supabase
          .from('koto_client_permissions')
          .update(payload)
          .eq('id', permissionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('koto_client_permissions')
          .upsert(payload, { onConflict: 'client_id,agency_id' })
          .select()
          .single();
        if (error) throw error;
        if (data) setPermissionId(data.id);
      }

      setSaved(true);
      toast.success('Permissions saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving permissions:', err);
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewAsClient() {
    try {
      await previewAsClient(clientId);
      navigate('/');
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Failed to start client preview');
    }
  }

  function updatePermission(key, value) {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: GRY }}>
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader2
            size={32}
            style={{ animation: 'spin 1s linear infinite', color: T }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => navigate(`/clients/${clientId}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GRY)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
            >
              <ChevronLeft size={18} color={BLK} />
            </button>
            <div>
              <p
                style={{
                  fontFamily: FB,
                  fontSize: 13,
                  color: '#6b7280',
                  margin: 0,
                  marginBottom: 2,
                }}
              >
                {client?.name || 'Client'}
              </p>
              <h1
                style={{
                  fontFamily: FH,
                  fontSize: 24,
                  fontWeight: 700,
                  color: BLK,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Shield size={22} color={T} />
                Permissions
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handlePreviewAsClient}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 8,
                border: `1px solid ${T}`,
                backgroundColor: '#fff',
                color: T,
                fontFamily: FH,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
            >
              <Eye size={16} />
              Preview as Client
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: saved ? GRN : T,
                color: '#fff',
                fontFamily: FH,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'background-color 0.2s, opacity 0.2s',
              }}
            >
              {saving ? (
                <>
                  <Loader2
                    size={16}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check size={16} />
                  Saved
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Permissions
                </>
              )}
            </button>
          </div>
        </div>

        {/* Permission Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div
                key={section.title}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '16px 24px',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <SectionIcon size={18} color={T} />
                  <h2
                    style={{
                      fontFamily: FH,
                      fontSize: 16,
                      fontWeight: 700,
                      color: BLK,
                      margin: 0,
                    }}
                  >
                    {section.title}
                  </h2>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {section.fields.map((field) => {
                    const FieldIcon = field.icon;
                    return (
                      <div
                        key={field.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 24px',
                          borderBottom: '1px solid #f9fafb',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <FieldIcon size={16} color="#6b7280" />
                          <span
                            style={{
                              fontFamily: FB,
                              fontSize: 14,
                              color: BLK,
                            }}
                          >
                            {field.label}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={!!permissions[field.key]}
                          onChange={(val) => updatePermission(field.key, val)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Custom Dashboard Message */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '16px 24px',
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: '#fafafa',
              }}
            >
              <FileText size={18} color={T} />
              <h2
                style={{
                  fontFamily: FH,
                  fontSize: 16,
                  fontWeight: 700,
                  color: BLK,
                  margin: 0,
                }}
              >
                Custom Dashboard Message
              </h2>
            </div>
            <div style={{ padding: 24 }}>
              <p
                style={{
                  fontFamily: FB,
                  fontSize: 13,
                  color: '#6b7280',
                  margin: '0 0 12px 0',
                }}
              >
                This message will appear on the client's dashboard when they log in.
              </p>
              <textarea
                value={permissions.custom_dashboard_message || ''}
                onChange={(e) =>
                  updatePermission('custom_dashboard_message', e.target.value)
                }
                placeholder="Welcome to your client portal! Here you can track your project progress..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontFamily: FB,
                  fontSize: 14,
                  color: BLK,
                  backgroundColor: GRY,
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = T)}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div style={{ height: 48 }} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
