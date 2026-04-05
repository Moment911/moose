"use client";
"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Send, Eye, Wand2, Check, AlertTriangle, X, Plus, Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon, MousePointer, Minus, Columns, FileText, Layout, Square, Palette, Copy, Quote, List, Star, Search, Loader2, Sparkles, Code2, Tag } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ColorPicker from '../components/ColorPicker'
import ImageFinder from '../components/email-editor/ImageFinder'
import AIEmailAssistant from '../components/email-editor/AIEmailAssistant'
import PersonalizationPanel, { replaceTokens } from '../components/email-editor/PersonalizationPanel'
import { TagAutocomplete } from '../components/contacts/TagManager'
import { supabase, sendEmailSummary } from '../lib/supabase'
import { generateSubjectLines } from '../lib/ai'
import toast from 'react-hot-toast'

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: Layout, cat: 'Structure', defaults: { logoText: 'Koto', tagline: '', bgColor: '#231f20', textColor: '#ffffff' } },
  { type: 'footer', label: 'Footer', icon: FileText, cat: 'Structure', defaults: { text: '\u00a9 2026 Koto', links: 'Unsubscribe | View in browser', bgColor: '#f5f5f5', textColor: '#999999', padding: 24 } },
  { type: 'text', label: 'Text', icon: Type, cat: 'Content', defaults: { content: 'Write your content here...', fontSize: 16, textColor: '#333333', bgColor: '#ffffff', align: 'left', padding: 24 } },
  { type: 'heading', label: 'Heading', icon: Type, cat: 'Content', defaults: { content: 'Your Headline Here', fontSize: 32, textColor: '#1a1a1a', bgColor: '#ffffff', align: 'center', padding: 32, fontWeight: 700 } },
  { type: 'image', label: 'Image', icon: ImageIcon, cat: 'Content', defaults: { src: '', alt: '', bgColor: '#ffffff', padding: 16 } },
  { type: 'button', label: 'Button', icon: MousePointer, cat: 'Content', defaults: { text: 'Click Here', url: '#', btnColor: '#ea2729', textColor: '#ffffff', bgColor: '#ffffff', align: 'center', padding: 24, borderRadius: 8 } },
  { type: 'divider', label: 'Divider', icon: Minus, cat: 'Content', defaults: { color: '#e5e7eb', thickness: 1, bgColor: '#ffffff', padding: 16 } },
  { type: 'spacer', label: 'Spacer', icon: Square, cat: 'Content', defaults: { height: 32, bgColor: '#ffffff' } },
  { type: 'quote', label: 'Quote', icon: Quote, cat: 'Content', defaults: { text: '"This is a great testimonial from a happy client."', author: 'Jane Doe, CEO', bgColor: '#f9fafb', textColor: '#374151', padding: 32 } },
  { type: 'list', label: 'List', icon: List, cat: 'Content', defaults: { items: ['First item', 'Second item', 'Third item'], bgColor: '#ffffff', textColor: '#333333', padding: 24 } },
  { type: 'hero', label: 'Hero', icon: Star, cat: 'Layout', defaults: { heading: 'Big Bold Headline', subtext: 'Supporting text that explains the value proposition', btnText: 'Get Started', btnUrl: '#', bgColor: '#231f20', textColor: '#ffffff', btnColor: '#ea2729' } },
  { type: 'twocol', label: '2 Columns', icon: Columns, cat: 'Layout', defaults: { leftContent: 'Left column', rightContent: 'Right column', bgColor: '#ffffff', textColor: '#333333', padding: 24 } },
]

const TEMPLATES = [
  { name: 'Welcome Email', desc: 'Warm welcome for new clients', blocks: [
    { type: 'header', data: { logoText: 'Koto', tagline: 'Welcome aboard!', bgColor: '#231f20', textColor: '#ffffff' } },
    { type: 'hero', data: { heading: 'Welcome to Koto!', subtext: "We're thrilled to have you as a client. Here's what happens next.", btnText: 'View Your Project', btnUrl: '#', bgColor: '#ea2729', textColor: '#ffffff', btnColor: '#ffffff' } },
    { type: 'text', data: { content: "Hi {{first_name}},\n\nThank you for choosing Koto. We can't wait to bring your vision to life.\n\nHere's what to expect:\n\n1. We'll send you a design review link\n2. Leave your feedback directly on the designs\n3. We'll implement your changes\n\nSimple as that!", fontSize: 16, textColor: '#333333', bgColor: '#ffffff', align: 'left', padding: 24 } },
    { type: 'button', data: { text: 'View Your Dashboard', url: '#', btnColor: '#ea2729', textColor: '#ffffff', bgColor: '#ffffff', align: 'center', padding: 24, borderRadius: 8 } },
    { type: 'footer', data: { text: '\u00a9 2026 Koto', links: 'Unsubscribe | View in browser', bgColor: '#f5f5f5', textColor: '#999999', padding: 24 } },
  ]},
  { name: 'Design Ready', desc: 'Notify client designs are ready', blocks: [
    { type: 'header', data: { logoText: 'Koto', tagline: '', bgColor: '#231f20', textColor: '#ffffff' } },
    { type: 'heading', data: { content: 'Your Designs Are Ready! \ud83c\udfa8', fontSize: 28, textColor: '#1a1a1a', bgColor: '#ffffff', align: 'center', padding: 32, fontWeight: 700 } },
    { type: 'text', data: { content: 'Hi {{first_name}},\n\nGreat news! Your latest designs are ready for review. Click below to view them and leave your feedback.\n\nRemember, you can:\n\u2022 Click anywhere to leave a comment\n\u2022 Use the pin tool for specific feedback\n\u2022 Submit when you\'re done', fontSize: 16, textColor: '#555', bgColor: '#ffffff', align: 'left', padding: 24 } },
    { type: 'button', data: { text: 'Review Designs Now', url: '#', btnColor: '#ea2729', textColor: '#ffffff', bgColor: '#ffffff', align: 'center', padding: 32, borderRadius: 8 } },
    { type: 'footer', data: { text: '\u00a9 2026 Koto', links: 'Unsubscribe', bgColor: '#f5f5f5', textColor: '#999999', padding: 24 } },
  ]},
  { name: 'Monthly Newsletter', desc: 'Multi-section newsletter', blocks: [
    { type: 'header', data: { logoText: 'Koto', tagline: 'Monthly Newsletter', bgColor: '#231f20', textColor: '#ffffff' } },
    { type: 'hero', data: { heading: 'What We\'ve Been Working On', subtext: 'A look at our latest projects, tips, and updates', btnText: 'Read More', btnUrl: '#', bgColor: '#1a1a2e', textColor: '#ffffff', btnColor: '#ea2729' } },
    { type: 'text', data: { content: 'Featured Project\n\nThis month we completed a full website redesign for Acme Corp, transforming their online presence with a modern, conversion-focused design.', fontSize: 16, textColor: '#333', bgColor: '#fff', align: 'left', padding: 24 } },
    { type: 'divider', data: { color: '#e5e7eb', thickness: 1, bgColor: '#ffffff', padding: 16 } },
    { type: 'twocol', data: { leftContent: 'Design Tip\n\nWhite space isn\'t empty space \u2014 it\'s breathing room for your content.', rightContent: 'Quick Stat\n\n73% of users judge a company by their website design.', bgColor: '#f9fafb', textColor: '#555', padding: 24 } },
    { type: 'button', data: { text: 'Visit Our Portfolio', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 24, borderRadius: 8 } },
    { type: 'footer', data: { text: '\u00a9 2026 Koto', links: 'Unsubscribe | View in browser', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
  ]},
  { name: 'Feedback Request', desc: 'Simple feedback ask', blocks: [
    { type: 'text', data: { content: 'Hi {{first_name}},\n\nI hope you\'re doing well! I wanted to check in on the project.\n\nDo you have any additional feedback on the designs we sent over? We want to make sure everything is perfect before we finalize.\n\nLet me know if you have any questions.\n\nBest,\nThe Koto Team', fontSize: 16, textColor: '#333', bgColor: '#fff', align: 'left', padding: 32 } },
    { type: 'button', data: { text: 'Leave Feedback', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 24, borderRadius: 8 } },
    { type: 'footer', data: { text: 'Koto', links: 'Unsubscribe', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
  ]},
  { name: 'Blank', desc: 'Start from scratch', blocks: [] },
]

function generateHtml(blocks) {
  const rows = blocks.map(b => {
    const d = b.data
    if (b.type === 'header') return `<tr><td style="background:${d.bgColor};padding:32px 40px;text-align:center;"><h1 style="margin:0;color:${d.textColor};font-size:28px;font-weight:700;font-family:Arial,sans-serif;">${d.logoText}</h1>${d.tagline ? `<p style="margin:8px 0 0;color:${d.textColor};opacity:0.7;font-size:14px;">${d.tagline}</p>` : ''}</td></tr>`
    if (b.type === 'text') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:${d.align};"><p style="margin:0;color:${d.textColor};font-size:${d.fontSize}px;line-height:1.6;font-family:Arial,sans-serif;">${(d.content || '').replace(/\n/g, '<br>')}</p></td></tr>`
    if (b.type === 'image') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:center;">${d.src ? `<img src="${d.src}" alt="${d.alt}" style="max-width:100%;height:auto;border-radius:4px;">` : '<div style="background:#f3f4f6;height:200px;border-radius:4px;"></div>'}</td></tr>`
    if (b.type === 'button') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:${d.align};"><a href="${d.url}" style="display:inline-block;background:${d.btnColor};color:${d.textColor};padding:14px 32px;border-radius:${d.borderRadius}px;text-decoration:none;font-weight:600;font-size:16px;font-family:Arial,sans-serif;">${d.text}</a></td></tr>`
    if (b.type === 'divider') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;"><hr style="border:none;border-top:${d.thickness}px solid ${d.color};margin:0;"></td></tr>`
    if (b.type === 'spacer') return `<tr><td style="background:${d.bgColor};height:${d.height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    if (b.type === 'twocol') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="top" style="padding-right:12px;color:${d.textColor};font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">${(d.leftContent || '').replace(/\n/g, '<br>')}</td><td width="50%" valign="top" style="padding-left:12px;color:${d.textColor};font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">${(d.rightContent || '').replace(/\n/g, '<br>')}</td></tr></table></td></tr>`
    if (b.type === 'heading') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:${d.align};"><h2 style="margin:0;color:${d.textColor};font-size:${d.fontSize}px;font-weight:${d.fontWeight || 700};line-height:1.2;font-family:Arial,sans-serif;">${d.content}</h2></td></tr>`
    if (b.type === 'quote') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-left:4px solid #ea2729;padding-left:20px;"><p style="margin:0;color:${d.textColor};font-size:18px;font-style:italic;line-height:1.6;font-family:Georgia,serif;">${d.text}</p>${d.author ? `<p style="margin:12px 0 0;color:${d.textColor};opacity:0.6;font-size:14px;font-family:Arial,sans-serif;">\u2014 ${d.author}</p>` : ''}</td></tr></table></td></tr>`
    if (b.type === 'list') { const items = (d.items || []).map(i => `<li style="margin-bottom:8px;color:${d.textColor};font-size:15px;line-height:1.6;font-family:Arial,sans-serif;">${i}</li>`).join(''); return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;"><ul style="margin:0;padding-left:20px;">${items}</ul></td></tr>` }
    if (b.type === 'hero') return `<tr><td style="background:${d.bgColor};padding:56px 40px;text-align:center;"><h1 style="margin:0;color:${d.textColor};font-size:36px;font-weight:800;line-height:1.2;font-family:Arial,sans-serif;">${d.heading}</h1>${d.subtext ? `<p style="margin:16px auto 0;color:${d.textColor};opacity:0.8;font-size:16px;line-height:1.6;max-width:480px;font-family:Arial,sans-serif;">${d.subtext}</p>` : ''}${d.btnText ? `<div style="margin-top:28px;"><a href="${d.btnUrl || '#'}" style="display:inline-block;background:${d.btnColor};color:${d.bgColor === '#ffffff' ? '#ffffff' : d.textColor};padding:16px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;font-family:Arial,sans-serif;">${d.btnText}</a></div>` : ''}</td></tr>`
    if (b.type === 'footer') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:center;"><p style="margin:0;color:${d.textColor};font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">${d.text}</p>${d.links ? `<p style="margin:8px 0 0;color:${d.textColor};font-size:11px;">${d.links}</p>` : ''}</td></tr>`
    return ''
  }).join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:24px 0;"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">\n${rows}\n</table></td></tr></table></body></html>`
}

export default function CampaignBuilderPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [lists, setLists] = useState([])
  const [contacts, setContacts] = useState([])
  const [campaign, setCampaign] = useState({ name: '', subject: '', preview_text: '', from_name: 'Koto', from_email: '', list_id: '', status: 'draft' })
  const [blocks, setBlocks] = useState([
    { id: 'b1', type: 'header', data: { ...BLOCK_TYPES.find(t => t.type === 'header').defaults } },
    { id: 'b2', type: 'text', data: { ...BLOCK_TYPES.find(t => t.type === 'text').defaults, content: 'Hi {{first_name}},\n\nWe have exciting news to share with you!' } },
    { id: 'b3', type: 'button', data: { ...BLOCK_TYPES.find(t => t.type === 'button').defaults } },
    { id: 'b4', type: 'footer', data: { ...BLOCK_TYPES.find(t => t.type === 'footer').defaults } },
  ])
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState('desktop')
  const [sending, setSending] = useState(false)
  const [aiSubjects, setAiSubjects] = useState([])
  const [showAiSubjects, setShowAiSubjects] = useState(false)
  const [brandAssets, setBrandAssets] = useState([])
  const [showBrandPanel, setShowBrandPanel] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [showImageFinder, setShowImageFinder] = useState(false)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [showPersonalization, setShowPersonalization] = useState(false)
  const [generatingSubjects, setGeneratingSubjects] = useState(false)
  const [campaignTags, setCampaignTags] = useState([])
  const [filterTagMode, setFilterTagMode] = useState('all') // all, with, without
  const [filterTags, setFilterTags] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadData()
    // Check if a template was selected from TemplatesPage
    const tplJson = sessionStorage.getItem('emailTemplate')
    if (tplJson) {
      try {
        const tplBlocks = JSON.parse(tplJson)
        if (Array.isArray(tplBlocks) && tplBlocks.length > 0) {
          setBlocks(tplBlocks.map((b, i) => ({ id: 'tpl' + Date.now() + i, type: b.type, data: { ...b.data } })))
        }
      } catch {}
      sessionStorage.removeItem('emailTemplate')
    }
  }, [])

  async function loadData() {
    const [{ data: l }, { data: c }] = await Promise.all([supabase.from('contact_lists').select('*'), supabase.from('contacts').select('*').eq('status', 'subscribed')])
    setLists(l || []); setContacts(c || [])
    if (campaignId) {
      const { data } = await supabase.from('email_campaigns').select('*').eq('id', campaignId).single()
      if (data) { setCampaign(data); if (data.json_content?.blocks) setBlocks(data.json_content.blocks) }
    }
    // Load brand guidelines from all clients
    try {
      const { data: brands } = await supabase.from('brand_guidelines').select('*, clients(name)')
      setBrandAssets((brands || []).filter(b => (b.primary_colors?.length || b.fonts?.length || b.logo_files?.length)))
    } catch {}
  }

  function addBlock(type) {
    const bt = BLOCK_TYPES.find(t => t.type === type); if (!bt) return
    const b = { id: 'b' + Date.now(), type, data: { ...bt.defaults } }
    const idx = selectedBlockId ? blocks.findIndex(x => x.id === selectedBlockId) + 1 : blocks.length
    const next = [...blocks]; next.splice(idx, 0, b); setBlocks(next); setSelectedBlockId(b.id)
  }

  function updateBlock(id, data) { setBlocks(prev => prev.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b)) }
  function deleteBlock(id) { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedBlockId === id) setSelectedBlockId(null) }
  function moveBlock(id, dir) { const idx = blocks.findIndex(b => b.id === id); if (idx < 0) return; const next = [...blocks]; const [item] = next.splice(idx, 1); next.splice(idx + dir, 0, item); setBlocks(next) }

  async function saveDraft() {
    const html = generateHtml(blocks)
    const payload = { ...campaign, html_content: html, json_content: { blocks } }
    if (campaignId) { await supabase.from('email_campaigns').update(payload).eq('id', campaignId) }
    else { const { data } = await supabase.from('email_campaigns').insert(payload).select().single(); if (data) { navigate(`/marketing/campaigns/${data.id}`, { replace: true }); setCampaign(data) } }
    toast.success('Draft saved')
  }

  async function generateSubjects() {
    setShowAiSubjects(true)
    setGeneratingSubjects(true)
    setAiSubjects([])
    try {
      const emailPreview = blocks.map(b => b.data?.content || b.data?.heading || b.data?.text || '').join(' ')
      const result = await generateSubjectLines(campaign.name || 'Email Campaign', emailPreview)
      const lines = result.split('\n').map(s => s.replace(/^[-\d.•*]+\s*/, '').replace(/^["']|["']$/g, '').trim()).filter(s => s.length > 3)
      setAiSubjects(lines.length > 0 ? lines : ['Could not generate subject lines'])
    } catch (e) {
      console.error('Subject generation error:', e)
      setAiSubjects(['Error: ' + (e.message.includes('API key') ? 'Set NEXT_PUBLIC_ANTHROPIC_API_KEY in .env' : e.message)])
      toast.error('AI subject generation failed')
    }
    setGeneratingSubjects(false)
  }

  async function handleSend() {
    if (!campaign.subject) { toast.error('Add a subject line'); return }
    setSending(true)
    const html = generateHtml(blocks)
    let recipients = contacts
    if (campaign.list_id) {
      const { data: members } = await supabase.from('contact_list_members').select('contact_id').eq('list_id', campaign.list_id)
      const ids = (members || []).map(m => m.contact_id)
      recipients = contacts.filter(c => ids.includes(c.id))
    }
    // Filter by tags
    if (filterTags.length > 0) {
      if (filterTagMode === 'with') recipients = recipients.filter(c => filterTags.some(t => (c.tags || []).includes(t)))
      else if (filterTagMode === 'without') recipients = recipients.filter(c => !filterTags.some(t => (c.tags || []).includes(t)))
      else if (filterTagMode === 'all_tags') recipients = recipients.filter(c => filterTags.every(t => (c.tags || []).includes(t)))
    }
    // Build send tags
    const sendTags = [...campaignTags]
    if (campaign.name) sendTags.push(`Email: ${campaign.name}`)
    const monthYear = new Date().toLocaleDateString('en', { month: 'short', year: 'numeric' })
    sendTags.push(`Sent: ${monthYear}`)

    let sent = 0
    const campId = campaignId || campaign.id
    for (const contact of recipients) {
      try {
        const personalizedSubject = replaceTokens(campaign.subject, contact, campaign)
        const personalizedHtml = replaceTokens(html, contact, campaign)
        await sendEmailSummary({ type: 'campaign', to: contact.email, subject: personalizedSubject, message: personalizedHtml, from_name: campaign.from_name })
        sent++
        // Tag contact + update stats
        const mergedTags = [...new Set([...(contact.tags || []), ...sendTags])]
        await supabase.from('contacts').update({
          tags: mergedTags,
          email_count: (contact.email_count || 0) + 1,
          last_email_sent_at: new Date().toISOString()
        }).eq('id', contact.id).catch(() => {})
        // Log tracking event
        await supabase.from('email_tracking_events').insert({
          contact_id: contact.id, campaign_id: campId, event_type: 'sent',
          metadata: { subject: personalizedSubject }
        }).catch(() => {})
      } catch {}
    }
    await supabase.from('email_campaigns').update({ status: 'sent', sent_at: new Date().toISOString(), total_sent: sent, html_content: html, json_content: { blocks } }).eq('id', campId)
    toast.success(`Sent to ${sent} contacts!`); navigate('/marketing')
    setSending(false)
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]; if (!file || !selectedBlockId) return
    const reader = new FileReader()
    reader.onload = ev => updateBlock(selectedBlockId, { src: ev.target.result })
    reader.readAsDataURL(file); e.target.value = ''
  }

  function applyTemplate(tpl) {
    const newBlocks = tpl.blocks.map((b, i) => ({ id: 'bt' + Date.now() + i, type: b.type, data: { ...b.data } }))
    setBlocks(newBlocks); setSelectedBlockId(null); setShowTemplates(false)
    if (newBlocks.length > 0) toast.success(`"${tpl.name}" template applied`)
  }

  function handleImageFromFinder(url, alt, credit) {
    if (selectedBlockId) {
      const block = blocks.find(b => b.id === selectedBlockId)
      if (block?.type === 'image') {
        updateBlock(selectedBlockId, { src: url, alt: alt || credit || '' })
        return
      }
    }
    // Insert a new image block
    const b = { id: 'img' + Date.now(), type: 'image', data: { ...BLOCK_TYPES.find(t => t.type === 'image').defaults, src: url, alt: alt || credit || '' } }
    const idx = selectedBlockId ? blocks.findIndex(x => x.id === selectedBlockId) + 1 : blocks.length
    const next = [...blocks]; next.splice(idx, 0, b); setBlocks(next); setSelectedBlockId(b.id)
  }

  function handleAIApply(aiBlocks, subject, preview) {
    setBlocks(aiBlocks)
    setSelectedBlockId(null)
    if (subject) setCampaign(c => ({ ...c, subject, preview_text: preview || c.preview_text }))
  }

  const sel = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) : null
  const recipientCount = campaign.list_id ? 'list contacts' : `${contacts.length} contacts`
  const checks = [
    { ok: !!campaign.subject, label: 'Subject line set' },
    { ok: !!campaign.from_name, label: 'From name set' },
    { ok: blocks.length > 0, label: 'Email has content' },
    { ok: contacts.length > 0, label: `Recipients (${contacts.length})` },
  ]

  function renderBlock(b) {
    const d = b.data; const isSel = b.id === selectedBlockId
    return (
      <div key={b.id} className={`relative group cursor-pointer transition-all ${isSel ? 'ring-2 ring-brand-500 ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'}`}
        onClick={() => setSelectedBlockId(b.id)}>
        {/* Block controls */}
        <div className={`absolute -top-3 right-2 flex gap-0.5 ${isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity z-10`}>
          <button onClick={e => { e.stopPropagation(); moveBlock(b.id, -1) }} className="w-5 h-5 bg-white shadow rounded text-gray-700 hover:text-gray-800 flex items-center justify-center"><ArrowUp size={10} /></button>
          <button onClick={e => { e.stopPropagation(); moveBlock(b.id, 1) }} className="w-5 h-5 bg-white shadow rounded text-gray-700 hover:text-gray-800 flex items-center justify-center"><ArrowDown size={10} /></button>
          <button onClick={e => { e.stopPropagation(); deleteBlock(b.id) }} className="w-5 h-5 bg-white shadow rounded text-red-400 hover:text-red-600 flex items-center justify-center"><Trash2 size={10} /></button>
        </div>
        {/* Render */}
        {b.type === 'header' && <div style={{ background: d.bgColor, padding: '32px 40px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 28, fontWeight: 700 }}>{d.logoText}</h1>{d.tagline && <p style={{ margin: '8px 0 0', color: d.textColor, opacity: 0.7, fontSize: 15 }}>{d.tagline}</p>}</div>}
        {b.type === 'text' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: d.align }}><p style={{ margin: 0, color: d.textColor, fontSize: d.fontSize, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.content}</p></div>}
        {b.type === 'heading' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: d.align }}><h2 style={{ margin: 0, color: d.textColor, fontSize: d.fontSize, fontWeight: d.fontWeight || 700, lineHeight: 1.2 }}>{d.content}</h2></div>}
        {b.type === 'image' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: 'center' }}>{d.src ? <img src={d.src} alt={d.alt} style={{ maxWidth: '100%', borderRadius: 4 }} /> : <div style={{ background: '#f3f4f6', height: 200, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: 15 }}>Click to add image</div>}</div>}
        {b.type === 'button' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: d.align }}><a style={{ display: 'inline-block', background: d.btnColor, color: d.textColor, padding: '14px 32px', borderRadius: d.borderRadius, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>{d.text}</a></div>}
        {b.type === 'divider' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px` }}><hr style={{ border: 'none', borderTop: `${d.thickness}px solid ${d.color}`, margin: 0 }} /></div>}
        {b.type === 'spacer' && <div style={{ background: d.bgColor, height: d.height }} />}
        {b.type === 'quote' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px` }}><div style={{ borderLeft: '4px solid #ea2729', paddingLeft: 20 }}><p style={{ margin: 0, color: d.textColor, fontSize: 18, fontStyle: 'italic', lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>{d.text}</p>{d.author && <p style={{ margin: '12px 0 0', color: d.textColor, opacity: 0.6, fontSize: 15 }}>&mdash; {d.author}</p>}</div></div>}
        {b.type === 'list' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px` }}><ul style={{ margin: 0, paddingLeft: 20 }}>{(d.items || []).map((item, i) => <li key={i} style={{ marginBottom: 8, color: d.textColor, fontSize: 15, lineHeight: 1.6 }}>{item}</li>)}</ul></div>}
        {b.type === 'hero' && <div style={{ background: d.bgColor, padding: '56px 40px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 36, fontWeight: 800, lineHeight: 1.2 }}>{d.heading}</h1>{d.subtext && <p style={{ margin: '16px auto 0', color: d.textColor, opacity: 0.8, fontSize: 16, lineHeight: 1.6, maxWidth: 480 }}>{d.subtext}</p>}{d.btnText && <div style={{ marginTop: 28 }}><a style={{ display: 'inline-block', background: d.btnColor, color: '#ffffff', padding: '16px 36px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>{d.btnText}</a></div>}</div>}
        {b.type === 'twocol' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, display: 'flex', gap: 24 }}><div style={{ flex: 1, color: d.textColor, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.leftContent}</div><div style={{ flex: 1, color: d.textColor, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.rightContent}</div></div>}
        {b.type === 'footer' && <div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: 'center' }}><p style={{ margin: 0, color: d.textColor, fontSize: 14, lineHeight: 1.6 }}>{d.text}</p>{d.links && <p style={{ margin: '8px 0 0', color: d.textColor, fontSize: 13 }}>{d.links}</p>}</div>}
      </div>
    )
  }

  return (
    <div className="page-shell flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#F8F9FC' }}>
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => navigate('/marketing')} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></button>
          <h1 className="text-base font-bold text-gray-900">{campaignId ? 'Edit Campaign' : 'New Campaign'}</h1>
          <div className="flex items-center gap-2 ml-4">
            {[{ n: 1, l: 'Setup' }, { n: 2, l: 'Design' }, { n: 3, l: 'Send' }].map(s => (
              <button key={s.n} onClick={() => setStep(s.n)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${step === s.n ? 'bg-brand-500 text-white' : step > s.n ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {step > s.n && <Check size={11} />}{s.l}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={saveDraft} className="btn-secondary text-sm">Save Draft</button>
            {step < 3 ? <button onClick={() => setStep(step + 1)} className="btn-primary text-sm">Next</button> : null}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Details</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm text-gray-700 block mb-1">Campaign Name</label><input className="input text-sm" placeholder="Monthly Newsletter" value={campaign.name} onChange={e => setCampaign(c => ({ ...c, name: e.target.value }))} /></div>
                    <div>
                      <div className="flex items-center justify-between mb-1"><label className="text-sm text-gray-700">Subject Line</label><button onClick={generateSubjects} disabled={generatingSubjects} className="text-[13px] text-brand-500 hover:text-brand-700 flex items-center gap-1 disabled:opacity-50">{generatingSubjects ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />} {generatingSubjects ? 'Generating...' : 'AI Suggest'}</button></div>
                      <input className="input text-sm" placeholder="Enter subject line or click AI Suggest" value={campaign.subject} onChange={e => setCampaign(c => ({ ...c, subject: e.target.value }))} />
                      {showAiSubjects && <div className="mt-2 bg-gray-50 rounded-lg p-2 space-y-1">
                        {generatingSubjects && <div className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700"><Loader2 size={12} className="animate-spin" /> Generating subject lines...</div>}
                        {aiSubjects.map((s, i) => <button key={i} onClick={() => { setCampaign(c => ({ ...c, subject: s })); setShowAiSubjects(false) }} className="w-full text-left text-sm text-gray-700 hover:bg-white rounded px-2 py-1.5">{s}</button>)}
                        {!generatingSubjects && aiSubjects.length > 0 && <button onClick={() => setShowAiSubjects(false)} className="w-full text-center text-[13px] text-gray-700 hover:text-gray-600 pt-1">Close</button>}
                      </div>}
                    </div>
                    <div><label className="text-sm text-gray-700 block mb-1">Preview Text</label><input className="input text-sm" value={campaign.preview_text} onChange={e => setCampaign(c => ({ ...c, preview_text: e.target.value }))} /></div>
                    <div><label className="text-sm text-gray-700 block mb-1">From Name</label><input className="input text-sm" value={campaign.from_name} onChange={e => setCampaign(c => ({ ...c, from_name: e.target.value }))} /></div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Recipients</h3>
                  <select className="input text-sm" value={campaign.list_id || ''} onChange={e => setCampaign(c => ({ ...c, list_id: e.target.value || null }))}>
                    <option value="">All contacts ({contacts.length})</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <div className="bg-gray-50 rounded-xl p-3 mt-3"><p className="text-sm text-gray-700">Sending to: <strong>{recipientCount}</strong></p></div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — VISUAL EMAIL BUILDER */}
          {step === 2 && (
            <>
              {/* Block palette */}
              <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 p-3">
                <button onClick={() => setShowAIAssistant(true)} className="w-full flex items-center gap-2 px-3 py-2.5 mb-1.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"><Sparkles size={13} /> Design with AI</button>
                <button onClick={() => setShowTemplates(true)} className="w-full flex items-center gap-2 px-3 py-2 mb-1.5 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors"><Layout size={13} /> Templates</button>
                <button onClick={() => setShowImageFinder(true)} className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"><Search size={13} /> Find Images</button>
                <p className="text-[13px] font-semibold text-gray-700 uppercase tracking-wider mb-2">Add Block</p>
                {BLOCK_TYPES.map(bt => { const I = bt.icon; return (
                  <button key={bt.type} onClick={() => addBlock(bt.type)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <I size={13} className="text-gray-700" /> {bt.label}
                  </button>
                )})}
                {/* Brand Assets */}
                {brandAssets.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[13px] font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Palette size={9} /> Brand Assets</p>
                    {brandAssets.map((ba, bi) => (
                      <div key={bi} className="mb-3">
                        <p className="text-[13px] font-medium text-gray-600 mb-1.5">{ba.clients?.name || 'Client'}</p>
                        {/* Colors */}
                        {(ba.primary_colors || []).length > 0 && (
                          <div className="mb-2">
                            <p className="text-[13px] text-gray-700 mb-1">Colors</p>
                            <div className="flex flex-wrap gap-1">
                              {(ba.primary_colors || []).map((c, ci) => (
                                <button key={ci} onClick={() => { navigator.clipboard.writeText(c.hex); toast.success(`${c.hex} copied`) }} title={`${c.name}: ${c.hex} — click to copy`}
                                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform cursor-pointer" style={{ background: c.hex }} />
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Fonts */}
                        {(ba.fonts || []).length > 0 && (
                          <div className="mb-2">
                            <p className="text-[13px] text-gray-700 mb-1">Fonts</p>
                            {(ba.fonts || []).map((f, fi) => (
                              <p key={fi} className="text-[13px] text-gray-600 cursor-pointer hover:text-brand-600" onClick={() => { navigator.clipboard.writeText(f.name); toast.success(`${f.name} copied`) }} title="Click to copy font name">{f.name} <span className="text-gray-600">({f.category})</span></p>
                            ))}
                          </div>
                        )}
                        {/* Logos */}
                        {(ba.logo_files || []).length > 0 && (
                          <div>
                            <p className="text-[13px] text-gray-700 mb-1">Logos</p>
                            <div className="flex flex-wrap gap-1">
                              {(ba.logo_files || []).slice(0, 4).map((logo, li) => (
                                <button key={li} onClick={() => { if (selectedBlockId) { updateBlock(selectedBlockId, { src: logo.url }); toast.success('Logo inserted') } else { navigator.clipboard.writeText(logo.url); toast.success('Logo URL copied') } }} title={`${logo.name} — click to insert into selected image block`}
                                  className="w-10 h-10 rounded border border-gray-200 bg-white p-0.5 hover:border-brand-400 transition-colors cursor-pointer">
                                  <img src={logo.url} alt="" className="w-full h-full object-contain" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[13px] text-gray-700">Click a block to add it. Click any block in the email to edit its properties.</p>
                </div>
              </div>

              {/* Canvas */}
              <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
                <div style={{ width: 600, minHeight: 400 }}>
                  <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}>
                    {blocks.map(b => renderBlock(b))}
                  </div>
                  {blocks.length === 0 && <div className="text-center py-20 text-sm text-gray-700">Click a block type on the left to start building your email</div>}
                </div>
              </div>

              {/* Properties panel */}
              {sel ? (
                <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-gray-700 uppercase">{BLOCK_TYPES.find(t => t.type === sel.type)?.label}</p>
                    <button onClick={() => setSelectedBlockId(null)} className="text-gray-700"><X size={14} /></button>
                  </div>
                  <div className="space-y-3">
                    {sel.type === 'header' && (<>
                      <Field label="Logo Text" value={sel.data.logoText} onChange={v => updateBlock(sel.id, { logoText: v })} />
                      <Field label="Tagline" value={sel.data.tagline} onChange={v => updateBlock(sel.id, { tagline: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                      <ColorPicker label="Text" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                    </>)}
                    {sel.type === 'text' && (<>
                      <div><label className="text-[13px] text-gray-700 mb-1 block">Content</label><textarea className="input text-sm py-1 resize-none" rows={5} value={sel.data.content} onChange={e => updateBlock(sel.id, { content: e.target.value })} /></div>
                      <NumField label="Font Size" value={sel.data.fontSize} onChange={v => updateBlock(sel.id, { fontSize: v })} min={10} max={36} />
                      <SelField label="Align" value={sel.data.align} options={['left', 'center', 'right']} onChange={v => updateBlock(sel.id, { align: v })} />
                      <ColorPicker label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                    </>)}
                    {sel.type === 'image' && (<>
                      <button onClick={() => fileInputRef.current?.click()} className="w-full btn-secondary text-sm justify-center"><ImageIcon size={12} /> {sel.data.src ? 'Replace' : 'Upload'}</button>
                      <button onClick={() => setShowImageFinder(true)} className="w-full btn-secondary text-sm justify-center"><Search size={12} /> Find Stock Image</button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      {sel.data.src && <div className="rounded-lg overflow-hidden border border-gray-200"><img src={sel.data.src} alt="" className="w-full h-24 object-cover" /></div>}
                      <Field label="Image URL" value={sel.data.src} onChange={v => updateBlock(sel.id, { src: v })} />
                      <Field label="Alt Text" value={sel.data.alt} onChange={v => updateBlock(sel.id, { alt: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                    </>)}
                    {sel.type === 'button' && (<>
                      <Field label="Text" value={sel.data.text} onChange={v => updateBlock(sel.id, { text: v })} />
                      <Field label="URL" value={sel.data.url} onChange={v => updateBlock(sel.id, { url: v })} />
                      <ColorPicker label="Button Color" value={sel.data.btnColor} onChange={v => updateBlock(sel.id, { btnColor: v })} />
                      <ColorPicker label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                      <SelField label="Align" value={sel.data.align} options={['left', 'center', 'right']} onChange={v => updateBlock(sel.id, { align: v })} />
                      <NumField label="Radius" value={sel.data.borderRadius} onChange={v => updateBlock(sel.id, { borderRadius: v })} min={0} max={32} />
                    </>)}
                    {sel.type === 'divider' && <ColorPicker label="Color" value={sel.data.color} onChange={v => updateBlock(sel.id, { color: v })} />}
                    {sel.type === 'spacer' && <NumField label="Height" value={sel.data.height} onChange={v => updateBlock(sel.id, { height: v })} min={8} max={96} />}
                    {sel.type === 'twocol' && (<>
                      <div><label className="text-[13px] text-gray-700 mb-1 block">Left</label><textarea className="input text-sm py-1 resize-none" rows={3} value={sel.data.leftContent} onChange={e => updateBlock(sel.id, { leftContent: e.target.value })} /></div>
                      <div><label className="text-[13px] text-gray-700 mb-1 block">Right</label><textarea className="input text-sm py-1 resize-none" rows={3} value={sel.data.rightContent} onChange={e => updateBlock(sel.id, { rightContent: e.target.value })} /></div>
                      <ColorPicker label="Text" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                    </>)}
                    {sel.type === 'heading' && (<>
                      <Field label="Heading Text" value={sel.data.content} onChange={v => updateBlock(sel.id, { content: v })} />
                      <NumField label="Font Size" value={sel.data.fontSize} onChange={v => updateBlock(sel.id, { fontSize: v })} min={18} max={64} />
                      <SelField label="Weight" value={String(sel.data.fontWeight || 700)} options={['400', '600', '700', '800', '900']} onChange={v => updateBlock(sel.id, { fontWeight: +v })} />
                      <SelField label="Align" value={sel.data.align} options={['left', 'center', 'right']} onChange={v => updateBlock(sel.id, { align: v })} />
                      <ColorPicker label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                    </>)}
                    {sel.type === 'quote' && (<>
                      <div><label className="text-[13px] text-gray-700 mb-1 block">Quote</label><textarea className="input text-sm py-1 resize-none" rows={3} value={sel.data.text} onChange={e => updateBlock(sel.id, { text: e.target.value })} /></div>
                      <Field label="Author" value={sel.data.author} onChange={v => updateBlock(sel.id, { author: v })} />
                      <ColorPicker label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                    </>)}
                    {sel.type === 'list' && (<>
                      <div>
                        <label className="text-[13px] text-gray-700 mb-1 block">Items (one per line)</label>
                        <textarea className="input text-sm py-1 resize-none" rows={5} value={(sel.data.items || []).join('\n')} onChange={e => updateBlock(sel.id, { items: e.target.value.split('\n') })} />
                      </div>
                      <ColorPicker label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                    </>)}
                    {sel.type === 'hero' && (<>
                      <Field label="Heading" value={sel.data.heading} onChange={v => updateBlock(sel.id, { heading: v })} />
                      <div><label className="text-[13px] text-gray-700 mb-1 block">Subtext</label><textarea className="input text-sm py-1 resize-none" rows={3} value={sel.data.subtext} onChange={e => updateBlock(sel.id, { subtext: e.target.value })} /></div>
                      <Field label="Button Text" value={sel.data.btnText} onChange={v => updateBlock(sel.id, { btnText: v })} />
                      <Field label="Button URL" value={sel.data.btnUrl} onChange={v => updateBlock(sel.id, { btnUrl: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                      <ColorPicker label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                      <ColorPicker label="Button Color" value={sel.data.btnColor} onChange={v => updateBlock(sel.id, { btnColor: v })} />
                    </>)}
                    {sel.type === 'footer' && (<>
                      <Field label="Text" value={sel.data.text} onChange={v => updateBlock(sel.id, { text: v })} />
                      <Field label="Links" value={sel.data.links} onChange={v => updateBlock(sel.id, { links: v })} />
                      <ColorPicker label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                    </>)}
                    {/* Brand quick colors */}
                    {brandAssets.some(ba => ba.primary_colors?.length) && (
                      <div className="border-t border-gray-100 pt-2 mt-1">
                        <p className="text-[13px] text-gray-700 mb-1.5">Brand Colors</p>
                        <div className="flex flex-wrap gap-1">
                          {brandAssets.flatMap(ba => ba.primary_colors || []).map((c, i) => (
                            <button key={i} onClick={() => {
                              // Apply to the most relevant color field on the selected block
                              if (sel.type === 'text' || sel.type === 'twocol') updateBlock(sel.id, { textColor: c.hex })
                              else if (sel.type === 'button') updateBlock(sel.id, { btnColor: c.hex })
                              else if (sel.type === 'header') updateBlock(sel.id, { bgColor: c.hex })
                              else updateBlock(sel.id, { bgColor: c.hex })
                              toast.success(`Applied ${c.name}`)
                            }} title={`${c.name}: ${c.hex}`}
                              className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform" style={{ background: c.hex }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => deleteBlock(sel.id)} className="w-full text-sm text-brand-500 hover:bg-brand-50 py-2 rounded-lg flex items-center justify-center gap-1"><Trash2 size={11} /> Delete</button>
                  </div>
                </div>
              ) : showPersonalization ? (
                <PersonalizationPanel open={true} onClose={() => setShowPersonalization(false)} contacts={contacts} campaign={campaign}
                  onInsert={token => {
                    // Insert token into the last selected text block or copy to clipboard
                    if (selectedBlockId) {
                      const b = blocks.find(x => x.id === selectedBlockId)
                      if (b && b.data?.content !== undefined) { updateBlock(selectedBlockId, { content: (b.data.content || '') + token }); return }
                    }
                    navigator.clipboard.writeText(token); toast.success('Token copied - paste into a text block')
                  }} />
              ) : (
                <div className="w-64 bg-white border-l border-gray-200 p-4 flex-shrink-0">
                  <p className="text-[13px] font-semibold text-gray-700 uppercase mb-2">Email Builder</p>
                  <p className="text-sm text-gray-700 mb-3">Click any block to edit. Use the left panel to add new blocks.</p>
                  <button onClick={() => setShowPreview(true)} className="btn-secondary text-sm w-full justify-center mb-2"><Eye size={12} /> Preview</button>
                  <button onClick={() => setShowPersonalization(true)} className="btn-secondary text-sm w-full justify-center mb-2"><Code2 size={12} /> Personalization</button>
                  {/* Campaign tags */}
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <p className="text-[13px] font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><Tag size={10} /> Campaign Tags</p>
                    <p className="text-[13px] text-gray-700 mb-2">Applied to all recipients on send</p>
                    <TagAutocomplete value={campaignTags} onChange={setCampaignTags} contacts={contacts} placeholder="Add send tag..." />
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-white rounded-2xl p-6 border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Pre-Send Checklist</h3>
                  {checks.map((c, i) => <div key={i} className="flex items-center gap-2 mb-2">{c.ok ? <Check size={14} strokeWidth={2} className="text-green-500" /> : <AlertTriangle size={14} className="text-amber-500" />}<span className={`text-sm ${c.ok ? 'text-gray-700' : 'text-amber-600'}`}>{c.label}</span></div>)}
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-sm text-gray-600">Subject: <strong>{campaign.subject || '(not set)'}</strong></p>
                  <p className="text-sm text-gray-600 mt-1">From: <strong>{campaign.from_name}</strong></p>
                  <p className="text-sm text-gray-600 mt-1">To: <strong>{recipientCount}</strong></p>
                  <p className="text-sm text-gray-600 mt-1">Blocks: <strong>{blocks.length}</strong></p>
                </div>
                <button onClick={() => setShowPreview(true)} className="w-full btn-secondary text-sm justify-center"><Eye size={14} /> Preview Email</button>
                <button onClick={handleSend} disabled={sending || !checks.every(c => c.ok)} className="w-full bg-brand-500 text-white font-semibold py-4 rounded-2xl text-base hover:bg-brand-600 disabled:opacity-40 flex items-center justify-center gap-2">
                  {sending ? 'Sending...' : <><Send size={18} /> Send Campaign</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Template Gallery */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplates(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div><h3 className="font-semibold text-gray-900">Email Templates</h3><p className="text-sm text-gray-700 mt-0.5">Choose a starting point for your email</p></div>
                <button onClick={() => setShowTemplates(false)} className="text-gray-700 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-auto p-5">
                <div className="grid grid-cols-2 gap-4">
                  {TEMPLATES.map((tpl, i) => (
                    <button key={i} onClick={() => applyTemplate(tpl)} className="text-left border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-md transition-all group">
                      <div className="h-32 bg-gray-50 rounded-lg mb-3 overflow-hidden border border-gray-100">
                        {tpl.blocks.length > 0 ? (
                          <div className="transform scale-[0.25] origin-top-left" style={{ width: 600, pointerEvents: 'none' }}>
                            {tpl.blocks.map((b, bi) => {
                              const d = b.data
                              if (b.type === 'header') return <div key={bi} style={{ background: d.bgColor, padding: '32px 40px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 28, fontWeight: 700 }}>{d.logoText}</h1></div>
                              if (b.type === 'hero') return <div key={bi} style={{ background: d.bgColor, padding: '40px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 28, fontWeight: 800 }}>{d.heading}</h1></div>
                              if (b.type === 'text') return <div key={bi} style={{ background: d.bgColor, padding: '16px 40px' }}><p style={{ margin: 0, color: d.textColor, fontSize: 15, lineHeight: 1.4 }}>{(d.content || '').slice(0, 60)}...</p></div>
                              if (b.type === 'button') return <div key={bi} style={{ background: d.bgColor, padding: '12px 40px', textAlign: d.align }}><span style={{ display: 'inline-block', background: d.btnColor, color: d.textColor, padding: '10px 24px', borderRadius: d.borderRadius, fontSize: 15, fontWeight: 700 }}>{d.text}</span></div>
                              if (b.type === 'heading') return <div key={bi} style={{ background: d.bgColor, padding: '16px 40px', textAlign: d.align }}><h2 style={{ margin: 0, color: d.textColor, fontSize: 22, fontWeight: 700 }}>{d.content}</h2></div>
                              return null
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-600 text-sm">Blank Canvas</div>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600">{tpl.name}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{tpl.desc}</p>
                      <p className="text-[13px] text-gray-700 mt-1">{tpl.blocks.length} blocks</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Preview</h3>
                <div className="flex items-center gap-2">
                  {['desktop', 'mobile'].map(m => <button key={m} onClick={() => setPreviewMode(m)} className={`text-sm px-3 py-1 rounded-lg capitalize ${previewMode === m ? 'bg-gray-200 text-gray-800' : 'text-gray-700'}`}>{m}</button>)}
                  <button onClick={() => setShowPreview(false)} className="text-gray-700 ml-2"><X size={18} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-gray-100">
                <div className="mx-auto" style={{ maxWidth: previewMode === 'mobile' ? 375 : 600 }}>
                  <iframe srcDoc={generateHtml(blocks).replace(/\{\{first_name\}\}/g, 'John')} className="w-full border-none bg-white rounded-lg" style={{ height: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} title="Preview" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Finder */}
        <ImageFinder open={showImageFinder} onClose={() => setShowImageFinder(false)} onSelect={handleImageFromFinder} suggestedQuery={campaign.name || ''} />

        {/* AI Email Assistant */}
        <AIEmailAssistant open={showAIAssistant} onClose={() => setShowAIAssistant(false)} onApply={handleAIApply} />
      </main>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return <div><label className="text-[13px] text-gray-700 mb-1 block">{label}</label><input className="input text-sm py-1" value={value || ''} onChange={e => onChange(e.target.value)} /></div>
}
function NumField({ label, value, onChange, min = 0, max = 999 }) {
  return <div><label className="text-[13px] text-gray-700 mb-1 block">{label}</label><input className="input text-sm py-1" type="number" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} /></div>
}
function SelField({ label, value, options, onChange }) {
  return <div><label className="text-[13px] text-gray-700 mb-1 block">{label}</label><select className="input text-sm py-1" value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select></div>
}
