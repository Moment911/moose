'use client'

import { useState, useRef, useEffect } from 'react'
import { Transaction, TaxProfile, CompanyProfile } from './KotoFin.types'
import { fmtCurrency, getTransactionTotals } from './KotoFin.utils'
import { Send, Brain, User, Loader2 } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface AdvisorTabProps {
  transactions: Transaction[]
  taxProfile: TaxProfile
  companyProfile: CompanyProfile
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ENTITY_LABELS: Record<string, string> = {
  sole_prop: 'Sole Proprietorship', llc_single: 'Single-Member LLC', llc_multi: 'Multi-Member LLC',
  llc_s_elect: 'LLC w/ S-Corp Election', s_corp: 'S Corporation', c_corp: 'C Corporation', partnership: 'Partnership',
}

const SUGGESTED_QUESTIONS = [
  "What's my biggest deductible expense and how can I maximize it?",
  "Should I switch from sole prop to S-Corp based on my income?",
  "Am I at risk of an IRS audit based on my deduction ratios?",
  "What deductions am I likely missing based on my business type?",
  "How much should my quarterly estimated payments be?",
  "What's the tax impact of hiring a W-2 employee vs contractor?",
  "Should I set up a SEP-IRA or Solo 401(k) based on my profit?",
  "How can I optimize my vehicle deduction with a leased car?",
]

export default function AdvisorTab({ transactions, taxProfile, companyProfile }: AdvisorTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function buildContext(): string {
    const totals = getTransactionTotals(transactions)
    const netProfit = totals.income - totals.bizExp

    // Category breakdown
    const byCat: Record<string, number> = {}
    for (const t of transactions.filter(t => t.type === 'business')) {
      byCat[t.cat] = (byCat[t.cat] || 0) + Math.abs(t.amount)
    }
    const topCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 15)

    // Top merchants
    const byMerchant: Record<string, number> = {}
    for (const t of transactions) {
      if (t.co) byMerchant[t.co] = (byMerchant[t.co] || 0) + Math.abs(t.amount)
    }
    const topMerchants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 10)

    return `
BUSINESS: ${companyProfile.businessName || 'Not specified'}
ENTITY TYPE: ${ENTITY_LABELS[taxProfile.entityType] || taxProfile.entityType}
FILING STATUS: ${taxProfile.filingStatus}
STATE: ${taxProfile.state || 'Not specified'}
INDUSTRY: ${companyProfile.industry || 'Not specified'}
ACCOUNTING METHOD: ${companyProfile.accountingMethod}
TAX YEAR: ${companyProfile.taxYear}

FINANCIAL SUMMARY:
- Gross Income: ${fmtCurrency(totals.income)}
- Business Expenses: ${fmtCurrency(totals.bizExp)}
- Personal Expenses: ${fmtCurrency(totals.personalExp)}
- Net Profit: ${fmtCurrency(netProfit)}
- Total Transactions: ${transactions.length}
- Uncategorized: ${totals.uncategorized}

TOP EXPENSE CATEGORIES:
${topCategories.map(([cat, amt]) => `- ${cat}: ${fmtCurrency(amt)}`).join('\n')}

TOP MERCHANTS:
${topMerchants.map(([m, amt]) => `- ${m}: ${fmtCurrency(amt)}`).join('\n')}

TAX PROFILE:
- Home Office: ${taxProfile.hasHomeOffice ? `Yes, ${taxProfile.homeOfficeSqft} sq ft of ${taxProfile.homeTotalSqft} sq ft` : 'No'}
- Vehicle: ${taxProfile.hasVehicle ? `${taxProfile.vehicleOwnership}, ${taxProfile.vehicleMilesBusiness} business miles` : 'No'}
${taxProfile.vehicleOwnership === 'leased' ? `- Lease Payment: ${fmtCurrency(taxProfile.leasePaymentMonthly)}/mo` : ''}
- Retirement Plan: ${taxProfile.hasRetirementPlan ? taxProfile.retirementType : 'None'}
- Health Insurance: ${taxProfile.hasHealthInsurance ? fmtCurrency(taxProfile.healthInsuranceAnnual) + '/yr' : 'No'}
- Dependents: ${taxProfile.numDependents}
- Prior Year Tax: ${taxProfile.priorYearTax > 0 ? fmtCurrency(taxProfile.priorYearTax) : 'Not provided'}
- Other Income (W-2, etc): ${taxProfile.estimatedOtherIncome > 0 ? fmtCurrency(taxProfile.estimatedOtherIncome) : 'None'}
`.trim()
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/KotoFin/tax-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), context: buildContext() }),
      })

      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process that request. Please try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please check your connection and try again.' }])
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)' }}>
      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Brain size={48} color="var(--blue)" style={{ opacity: 0.3, marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>AI Tax Advisor</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Ask questions about your financial data, tax strategy, entity structure, deductions, and more. The advisor has access to your actual transaction data, tax profile, and company information.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, maxWidth: 700, margin: '0 auto' }}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <div key={i} className={styles.card}
                  style={{ cursor: 'pointer', fontSize: 12, padding: 12, textAlign: 'left', transition: 'border-color 0.15s' }}
                  onClick={() => sendMessage(q)}
                  onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
                  onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  {q}
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, padding: '12px 16px',
            background: msg.role === 'assistant' ? 'var(--surface)' : 'transparent',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'assistant' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)',
            }}>
              {msg.role === 'assistant' ? <Brain size={14} color="#3b82f6" /> : <User size={14} color="#8b5cf6" />}
            </div>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.1)' }}>
              <Loader2 size={14} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Analyzing your financial data...</div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 0 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          placeholder="Ask about your taxes, deductions, entity structure..."
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
