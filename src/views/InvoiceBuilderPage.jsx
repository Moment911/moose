"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import {
  FileText, Plus, Trash2, DollarSign, Send, Download, Eye,
  Loader2, Brain, Check, X, Copy, Calendar, Building, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

const R   = '#E6007E', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"
const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }
const lbl = { fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }

export default function InvoiceBuilderPage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const [searchParams] = useSearchParams()
  const preselectedClient = searchParams.get('client')

  // ALL hooks at top
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [agency, setAgency] = useState(null)

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString(36).toUpperCase()}`)
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [lineItems, setLineItems] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }])
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [footer, setFooter] = useState('Thank you for your business!')
  const [customSection, setCustomSection] = useState('')
  const [customSectionTitle, setCustomSectionTitle] = useState('Notes')
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState('fixed')

  useEffect(() => { loadData() }, [aid])

  async function loadData() {
    setLoading(true)
    const [{ data: cl }, { data: ag }] = await Promise.all([
      supabase.from('clients').select('id, name, email, phone, address, city, state, zip, industry, monthly_value')
        .eq('agency_id', aid).is('deleted_at', null).order('name'),
      supabase.from('agencies').select('name, brand_name, owner_email').eq('id', aid).single(),
    ])
    setClients(cl || [])
    setAgency(ag)
    if (preselectedClient && cl) {
      const c = cl.find(x => x.id === preselectedClient)
      if (c) selectClient(c)
    }
    setLoading(false)
  }

  function selectClient(c) {
    setSelectedClient(c)
    // Auto-add retainer line item if client has monthly_value
    if (c.monthly_value) {
      setLineItems([{ description: `Monthly marketing retainer — ${c.name}`, quantity: 1, rate: Number(c.monthly_value), amount: Number(c.monthly_value) }])
    }
  }

  function updateLineItem(idx, field, value) {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'rate') {
        updated.amount = Number(updated.quantity || 0) * Number(updated.rate || 0)
      }
      return updated
    }))
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { description: '', quantity: 1, rate: 0, amount: 0 }])
  }

  function removeLineItem(idx) {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal = lineItems.reduce((s, i) => s + Number(i.amount || 0), 0)
  const discountAmount = discountType === 'percent' ? subtotal * (discount / 100) : Number(discount)
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
  const total = subtotal - discountAmount + taxAmount

  async function aiSuggest(field) {
    setAiSuggesting(true)
    try {
      const context = `Client: ${selectedClient?.name || 'Unknown'}, Industry: ${selectedClient?.industry || 'General'}, Invoice total: $${Number(total||0).toFixed(2)}, Services: ${lineItems.map(i => i.description).filter(Boolean).join(', ')}`

      const prompts = {
        notes: `Write a brief, professional invoice note for a marketing agency sending an invoice to a ${selectedClient?.industry || 'general'} business client. Include a thank you and mention next steps. Keep under 3 sentences.`,
        footer: `Write a professional invoice footer for a marketing agency. Include payment instructions and a thank you. Keep to 2 lines.`,
        custom: `Write a "Project Summary" section for a marketing agency invoice. Briefly describe the value delivered this billing period for a ${selectedClient?.industry || 'general'} business. Reference services: ${lineItems.map(i => i.description).filter(Boolean).join(', ')}. Keep under 4 sentences.`,
        lineItems: `Suggest 5 common marketing service line items for a ${selectedClient?.industry || 'general'} business with typical monthly rates. Return as JSON array: [{"description":"...", "rate": number}]. Only return the JSON, no explanation.`,
      }

      const res = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompts[field], context, agency_id: aid }),
      })
      const data = await res.json()
      const suggestion = data.response || data.message || ''

      if (field === 'notes') setNotes(suggestion)
      else if (field === 'footer') setFooter(suggestion)
      else if (field === 'custom') setCustomSection(suggestion)
      else if (field === 'lineItems') {
        try {
          const items = JSON.parse(suggestion.match(/\[[\s\S]*\]/)?.[0] || '[]')
          if (items.length > 0) {
            setLineItems(items.map(i => ({ description: i.description, quantity: 1, rate: Number(i.rate || 0), amount: Number(i.rate || 0) })))
            toast.success(`${items.length} line items suggested`)
          }
        } catch { toast.error('Could not parse AI suggestions') }
      }
      if (field !== 'lineItems') toast.success(`AI suggestion applied to ${field}`)
    } catch { toast.error('AI suggestion failed') }
    setAiSuggesting(false)
  }

  async function saveInvoice(status = 'draft') {
    if (!selectedClient) { toast.error('Select a client first'); return }
    setSaving(true)
    try {
      await fetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_client_invoice', agency_id: aid, client_id: selectedClient.id,
          line_items: lineItems.filter(i => i.description), tax_rate: taxRate,
          notes: `${notes}\n\n${customSectionTitle}: ${customSection}\n\nFooter: ${footer}`,
          due_date: dueDate,
        }),
      })
      toast.success(status === 'draft' ? 'Invoice saved as draft' : 'Invoice created')
      navigate('/billing')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function sendInvoice() {
    if (!selectedClient?.email) { toast.error('Client has no email address'); return }
    setSending(true)
    try {
      // Save first, then send
      const saveRes = await fetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_client_invoice', agency_id: aid, client_id: selectedClient.id,
          line_items: lineItems.filter(i => i.description), tax_rate: taxRate, notes, due_date: dueDate,
        }),
      })
      const saved = await saveRes.json()
      if (saved.id) {
        await fetch('/api/billing', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_client_invoice', invoice_id: saved.id, to_email: selectedClient.email }),
        })
        toast.success(`Invoice sent to ${selectedClient.email}`)
        navigate('/billing')
      }
    } catch { toast.error('Failed to send') }
    setSending(false)
  }

  function copyInvoiceLink() {
    navigator.clipboard.writeText(`${window.location.origin}/invoice/${invoiceNumber}`)
    toast.success('Invoice link copied')
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: BLK, padding: '16px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={20} color={R} />
            <h1 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>Invoice Builder</h1>
            <span style={{ fontSize: 12, color: '#999999', fontFamily: 'monospace' }}>{invoiceNumber}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowPreview(!showPreview)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.14)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
              <Eye size={13} /> Preview
            </button>
            <button onClick={() => saveInvoice('draft')} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} Save Draft
            </button>
            <button onClick={sendInvoice} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
              {sending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />} Send Invoice
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>

            {/* Client Selection + Invoice Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Bill To */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20 }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building size={16} color={R} /> Bill To
                </div>
                <label style={lbl}>Client</label>
                <select value={selectedClient?.id || ''} onChange={e => { const c = clients.find(x => x.id === e.target.value); if (c) selectClient(c) }}
                  style={{ ...inp, marginBottom: 12 }}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedClient && (
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700 }}>{selectedClient.name}</div>
                    {selectedClient.email && <div>{selectedClient.email}</div>}
                    {selectedClient.phone && <div>{selectedClient.phone}</div>}
                    {selectedClient.address && <div>{[selectedClient.address, selectedClient.city, selectedClient.state, selectedClient.zip].filter(Boolean).join(', ')}</div>}
                  </div>
                )}
              </div>

              {/* Invoice Details */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20 }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color={R} /> Invoice Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={lbl}>Invoice #</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Payment Terms</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={inp}>
                      {['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Issue Date</label><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} /></div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={16} color={R} /> Line Items
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => aiSuggest('lineItems')} disabled={aiSuggesting || !selectedClient} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#7c3aed15', color: '#7c3aed', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    {aiSuggesting ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={11} />} AI Suggest Items
                  </button>
                  <button onClick={addLineItem} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: T + '15', color: T, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    <Plus size={11} /> Add Item
                  </button>
                </div>
              </div>

              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 120px 120px 40px', gap: 8, marginBottom: 8 }}>
                <div style={lbl}>Description</div>
                <div style={lbl}>Qty</div>
                <div style={lbl}>Rate ($)</div>
                <div style={lbl}>Amount</div>
                <div />
              </div>

              {lineItems.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 80px 120px 120px 40px', gap: 8, marginBottom: 8 }}>
                  <input value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="Service description..." style={inp} />
                  <input type="number" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} style={{ ...inp, textAlign: 'center' }} />
                  <input type="number" value={item.rate} onChange={e => updateLineItem(idx, 'rate', e.target.value)} style={inp} />
                  <div style={{ ...inp, background: '#f9fafb', display: 'flex', alignItems: 'center', fontWeight: 700, fontFamily: FH, color: BLK, border: '1px solid #f3f4f6' }}>
                    ${Number(item.amount || 0).toFixed(2)}
                  </div>
                  <button onClick={() => removeLineItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Totals */}
              <div style={{ borderTop: '2px solid #f2f2f0', paddingTop: 14, marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: BLK, width: 100, textAlign: 'right' }}>${Number(subtotal||0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Discount</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} style={{ ...inp, width: 70, textAlign: 'center' }} />
                    <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={{ ...inp, width: 60 }}>
                      <option value="fixed">$</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                  <span style={{ fontSize: 13, color: R, fontWeight: 700, width: 100, textAlign: 'right' }}>-${Number(discountAmount||0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Tax Rate</span>
                  <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={{ ...inp, width: 70, textAlign: 'center' }} placeholder="0" />
                  <span style={{ fontSize: 13, color: '#6b7280', width: 100, textAlign: 'right' }}>+${Number(taxAmount||0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', borderTop: '2px solid #0a0a0a', paddingTop: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Total Due</span>
                  <span style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: R }}>${Number(total||0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Custom Sections + Notes + Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Notes */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Notes to Client</label>
                  <button onClick={() => aiSuggest('notes')} disabled={aiSuggesting} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed15', color: '#7c3aed', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    <Brain size={10} /> AI Write
                  </button>
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Payment instructions, thank you note, next steps..."
                  style={{ ...inp, resize: 'vertical' }} />
              </div>

              {/* Custom Section */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Custom Section</label>
                    <input value={customSectionTitle} onChange={e => setCustomSectionTitle(e.target.value)} placeholder="Section title..." style={{ ...inp, width: 140, padding: '4px 8px', fontSize: 11 }} />
                  </div>
                  <button onClick={() => aiSuggest('custom')} disabled={aiSuggesting} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed15', color: '#7c3aed', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    <Brain size={10} /> AI Write
                  </button>
                </div>
                <textarea value={customSection} onChange={e => setCustomSection(e.target.value)} rows={4} placeholder="Project summary, scope of work, deliverables..."
                  style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Invoice Footer</label>
                <button onClick={() => aiSuggest('footer')} disabled={aiSuggesting} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed15', color: '#7c3aed', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                  <Brain size={10} /> AI Write
                </button>
              </div>
              <textarea value={footer} onChange={e => setFooter(e.target.value)} rows={2} placeholder="Thank you for your business!"
                style={{ ...inp, resize: 'vertical' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowPreview(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 700, maxHeight: '90vh', overflowY: 'auto', padding: 48 }}>
            {/* Invoice Preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
              <div>
                <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK }}>INVOICE</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{invoiceNumber}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK }}>{agency?.brand_name || agency?.name || 'Your Agency'}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{agency?.owner_email}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: BLK }}>{selectedClient?.name || '—'}</div>
                {selectedClient?.email && <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedClient.email}</div>}
                {selectedClient?.address && <div style={{ fontSize: 12, color: '#6b7280' }}>{[selectedClient.address, selectedClient.city, selectedClient.state, selectedClient.zip].filter(Boolean).join(', ')}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Issue Date: {issueDate}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Due Date: {dueDate}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Terms: {paymentTerms}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#9ca3af' }}>Qty</th>
                  <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#9ca3af' }}>Rate</th>
                  <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#9ca3af' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.filter(i => i.description).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0', fontSize: 13, color: BLK }}>{item.description}</td>
                    <td style={{ padding: '10px 0', textAlign: 'center', fontSize: 13 }}>{item.quantity}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 13 }}>${Number(item.rate).toFixed(2)}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>${Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
              <div style={{ width: 250 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</span><span style={{ fontSize: 13, fontWeight: 700 }}>${Number(subtotal||0).toFixed(2)}</span></div>
                {discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: R }}>Discount</span><span style={{ fontSize: 13, color: R }}>-${Number(discountAmount||0).toFixed(2)}</span></div>}
                {taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: '#6b7280' }}>Tax ({taxRate}%)</span><span style={{ fontSize: 13 }}>${Number(taxAmount||0).toFixed(2)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0a0a0a', paddingTop: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: R }}>${Number(total||0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {customSection && (
              <div style={{ marginBottom: 20, padding: 16, background: '#f9fafb', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>{customSectionTitle}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{customSection}</div>
              </div>
            )}
            {notes && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notes}</div>
              </div>
            )}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
              {footer}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
