"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Users, Zap, Plus, Send, TrendingUp, BarChart3, ArrowUpRight, Layout, ListFilter, Sparkles, BookOpen } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'

export default function MarketingPage() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [lists, setLists] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: c }, { data: camp }, { data: l }] = await Promise.all([
      supabase.from('contacts').select('*'),
      supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('contact_lists').select('*'),
    ])
    setContacts(c || []); setCampaigns(camp || []); setLists(l || [])
  }

  const subscribed = contacts.filter(c => c.status === 'subscribed').length
  const sent = campaigns.filter(c => c.status === 'sent')
  const totalSent = sent.reduce((a, c) => a + (c.total_sent || 0), 0)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Email Marketing</h1>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            {[
              { label: 'Total Contacts', value: contacts.length, sub: `${subscribed} subscribed`, icon: Users, gradient: 'from-blue-500 to-blue-600' },
              { label: 'Campaigns Sent', value: sent.length, sub: `${totalSent} emails total`, icon: Send, gradient: 'from-purple-500 to-purple-600' },
              { label: 'Contact Lists', value: lists.length, sub: 'organized audiences', icon: BarChart3, gradient: 'from-green-500 to-green-600' },
              { label: 'Avg Engagement', value: contacts.length ? Math.round(contacts.reduce((a, c) => a + (c.engagement_score || 50), 0) / contacts.length) + '%' : '0%', sub: 'engagement score', icon: TrendingUp, gradient: 'from-brand-500 to-brand-600' },
            ].map(s => { const I = s.icon; return (
              <div key={s.label} className={`rounded-2xl p-5 bg-gradient-to-br ${s.gradient} text-white`} style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                <I size={20} strokeWidth={1.5} className="text-white/70 mb-3" />
                <p className="text-3xl font-bold">{s.value}</p>
                <p className="text-sm text-white/70 mt-1">{s.label}</p>
                <p className="text-sm text-white/50 mt-0.5">{s.sub}</p>
              </div>
            )})}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
            {[
              { label: 'Create Campaign', desc: 'Send an email to your contacts', icon: Mail, color: '#ea2729', link: '/marketing/campaigns/new' },
              { label: 'Add Contacts', desc: 'Import or add contacts manually', icon: Users, color: '#3b82f6', link: '/marketing/contacts' },
              { label: 'Email Templates', desc: 'Pre-built templates to get started', icon: Layout, color: '#8b5cf6', link: '/marketing/templates' },
            ].map(a => { const I = a.icon; return (
              <div key={a.label} onClick={() => navigate(a.link)} className="bg-white rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-100 group" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: a.color + '15' }}><I size={18} strokeWidth={1.5} style={{ color: a.color }} /></div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">{a.label} <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                <p className="text-sm text-gray-700 mt-0.5">{a.desc}</p>
              </div>
            )})}
          </div>

          {/* Recent campaigns */}
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Campaigns</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-4 px-5 py-3 bg-gray-50/50 text-[13px] font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-100">
              <div>Campaign</div><div>Status</div><div>Sent</div><div>Opens</div><div>Date</div>
            </div>
            {campaigns.length === 0 && <div className="py-12 text-center text-sm text-gray-700">No campaigns yet. Create your first one!</div>}
            {campaigns.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-4 px-5 py-3.5 items-center border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/marketing/campaigns/${c.id}`)}>
                <div><p className="text-sm font-medium text-gray-900">{c.name}</p><p className="text-sm text-gray-700">{c.subject}</p></div>
                <span className={`text-[13px] px-2 py-0.5 rounded-full font-medium ${c.status === 'sent' ? 'bg-green-50 text-green-700' : c.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>{c.status}</span>
                <span className="text-sm text-gray-700">{c.total_sent || 0}</span>
                <span className="text-sm text-gray-700">{c.total_opened || 0}</span>
                <span className="text-sm text-gray-700">{c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}</span>
              </div>
            ))}
          </div>
          {/* Sub-pages */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 md:mb-6">
            {[
              { label: 'Campaigns', icon: Send, link: '/marketing/campaigns', desc: `${sent.length} sent` },
              { label: 'Contacts', icon: Users, link: '/marketing/contacts', desc: `${contacts.length} contacts` },
              { label: 'Lists', icon: ListFilter, link: '/marketing/lists', desc: `${lists.length} lists` },
              { label: 'Automations', icon: Zap, link: '/marketing/automations', desc: 'Workflows' },
            ].map(a => { const I = a.icon; return (
              <button key={a.label} onClick={() => navigate(a.link)} className="bg-white rounded-xl border border-gray-100 p-3 text-left hover:shadow-md transition-all group" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <I size={15} strokeWidth={1.5} className="text-gray-700 mb-1.5" />
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1">{a.label} <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100" /></p>
                <p className="text-[13px] text-gray-700">{a.desc}</p>
              </button>
            )})}
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/marketing/templates')} className="btn-secondary text-sm"><Layout size={14} strokeWidth={1.5} /> Email Templates</button>
            <button onClick={() => navigate('/marketing/campaigns/new')} className="btn-primary text-sm"><Plus size={14} /> New Campaign</button>
          </div>
        </div>
      </main>
    </div>
  )
}
