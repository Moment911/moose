"use client";
import { useState, useEffect } from 'react'
import { MessageSquare, Mail, Zap, Calendar, Phone, Cloud, HardDrive, Plug, Check, X, ExternalLink, Settings } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const INTEGRATIONS = [
  { key: 'resend', name: 'Resend (Email)', desc: 'Send emails to clients and team. Powered by Supabase Edge Functions.', icon: Mail, status: 'connected', fields: [] },
  { key: 'supabase', name: 'Supabase', desc: 'Database, auth, storage, and realtime. The backbone of Moose.', icon: Cloud, status: 'connected', fields: [] },
  { key: 'vercel', name: 'Vercel', desc: 'Hosting and deployment. Auto-deploys from GitHub.', icon: Zap, status: 'connected', fields: [] },
  { key: 'slack', name: 'Slack', desc: 'Post notifications to Slack channels when events happen.', icon: MessageSquare, fields: [
    { key: 'webhook_url', label: 'Incoming Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
    { key: 'channel', label: 'Default Channel', placeholder: '#design-reviews' },
  ], events: ['comment_added', 'round_submitted', 'annotation_resolved', 'file_uploaded'] },
  { key: 'zapier', name: 'Zapier / Make / n8n', desc: 'Connect to 5000+ apps via webhook. Also works with Make.com, n8n, and Go High Level.', icon: Zap, fields: [
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/...' },
  ], events: ['comment_added', 'round_submitted', 'annotation_resolved'] },
  { key: 'google_calendar', name: 'Google Calendar', desc: 'Sync calendar events with Google Calendar.', icon: Calendar, fields: [], comingSoon: false, note: 'Export iCal from Calendar page to sync with Google Calendar' },
  { key: 'twilio', name: 'Twilio SMS', desc: 'Send SMS notifications to clients and team members.', icon: Phone, fields: [
    { key: 'account_sid', label: 'Account SID', placeholder: 'AC...' },
    { key: 'auth_token', label: 'Auth Token', placeholder: 'Token...' },
    { key: 'phone_number', label: 'From Phone Number', placeholder: '+1234567890' },
  ]},
  { key: 'google_drive', name: 'Google Drive', desc: 'Attach files from Google Drive to tasks and projects.', icon: HardDrive, comingSoon: true },
  { key: 'dropbox', name: 'Dropbox', desc: 'Attach files from Dropbox to tasks.', icon: HardDrive, comingSoon: true },
  { key: 'hubspot', name: 'HubSpot CRM', desc: 'Sync clients as contacts in HubSpot.', icon: Plug, comingSoon: true },
  { key: 'stripe', name: 'Stripe', desc: 'Accept payments and send invoices.', icon: Plug, comingSoon: true },
  { key: 'figma', name: 'Figma', desc: 'Import designs directly from Figma.', icon: Plug, comingSoon: true },
  { key: 'notion', name: 'Notion', desc: 'Sync tasks and projects with Notion.', icon: Plug, comingSoon: true },
]

export default function IntegrationsPage() {
  const [settings, setSettings] = useState({})
  const [editing, setEditing] = useState(null)
  const [formConfig, setFormConfig] = useState({})

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    try {
      const { data } = await supabase.from('integration_settings').select('*')
      const map = {}; (data || []).forEach(s => { map[s.integration_name] = s }); setSettings(map)
    } catch {}
  }

  async function saveSettings(key) {
    const existing = settings[key]
    if (existing) {
      await supabase.from('integration_settings').update({ config: formConfig, enabled: true, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('integration_settings').insert({ integration_name: key, config: formConfig, enabled: true, connected_at: new Date().toISOString() })
    }
    toast.success('Settings saved'); setEditing(null); loadSettings()
  }

  async function disconnect(key) {
    const existing = settings[key]
    if (existing) await supabase.from('integration_settings').update({ enabled: false }).eq('id', existing.id)
    toast.success('Disconnected'); loadSettings()
  }

  function openEdit(int) {
    setEditing(int.key)
    setFormConfig(settings[int.key]?.config || {})
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        <div style={{ background: '#231f20' }} className="px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm text-gray-400 mt-1">Connect Moose to your favorite tools</p>
        </div>

        <div className="px-8 py-6">
          {/* Connected */}
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Connected</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {INTEGRATIONS.filter(i => i.status === 'connected' || settings[i.key]?.enabled).map(int => {
              const I = int.icon
              return (
                <div key={int.key} className="card p-5 relative">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0"><I size={18} strokeWidth={1.5} className="text-green-600" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{int.name}</h3>
                        <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Connected</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{int.desc}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Configurable */}
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Available</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {INTEGRATIONS.filter(i => !i.comingSoon && i.status !== 'connected' && !settings[i.key]?.enabled && i.fields?.length > 0).map(int => {
              const I = int.icon; const isEditing = editing === int.key
              return (
                <div key={int.key} className="card p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><I size={18} strokeWidth={1.5} className="text-gray-500" /></div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">{int.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{int.desc}</p>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2 mt-3">
                      {int.fields.map(f => (
                        <div key={f.key}>
                          <label className="text-[10px] text-gray-500 block mb-0.5">{f.label}</label>
                          <input className="input text-xs" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => setFormConfig(prev => ({ ...prev, [f.key]: e.target.value }))} />
                        </div>
                      ))}
                      {int.events && (
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Events</label>
                          <div className="space-y-1">
                            {int.events.map(ev => (
                              <label key={ev} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={formConfig[`event_${ev}`] !== false} onChange={e => setFormConfig(prev => ({ ...prev, [`event_${ev}`]: e.target.checked }))} className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500" />
                                {ev.replace(/_/g, ' ')}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => saveSettings(int.key)} className="btn-primary text-xs">Connect</button>
                        <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openEdit(int)} className="btn-secondary text-xs mt-2 w-full justify-center"><Settings size={12} /> Configure</button>
                  )}
                  {int.note && <p className="text-[10px] text-gray-400 mt-2">{int.note}</p>}
                </div>
              )
            })}
          </div>

          {/* Coming Soon */}
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {INTEGRATIONS.filter(i => i.comingSoon).map(int => {
              const I = int.icon
              return (
                <div key={int.key} className="card p-5 opacity-60">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><I size={18} strokeWidth={1.5} className="text-gray-400" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-700">{int.name}</h3>
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Coming Soon</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{int.desc}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
