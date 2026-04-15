'use client'

import { Dispatch } from 'react'
import { Transaction, StatementFile, TaxProfile, CompanyProfile, KotoFinAction } from './KotoFin.types'
import { fmtCurrency, getTransactionTotals } from './KotoFin.utils'
import {
  Building2, FileText, CheckCircle2, Circle, ArrowRight,
  DollarSign, TrendingUp, Receipt, AlertTriangle, Briefcase,
} from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface DashboardTabProps {
  transactions: Transaction[]
  files: StatementFile[]
  taxProfile: TaxProfile
  companyProfile: CompanyProfile
  dispatch: Dispatch<KotoFinAction>
  clientName: string
}

const ENTITY_LABELS: Record<string, string> = {
  sole_prop: 'Sole Proprietorship',
  llc_single: 'Single-Member LLC',
  llc_multi: 'Multi-Member LLC',
  llc_s_elect: 'LLC (S-Corp Election)',
  s_corp: 'S Corporation',
  c_corp: 'C Corporation',
  partnership: 'Partnership',
}

export default function DashboardTab({ transactions, files, taxProfile, companyProfile, dispatch, clientName }: DashboardTabProps) {
  const totals = getTransactionTotals(transactions)
  const netProfit = totals.income - totals.bizExp

  const hasCompanyInfo = !!(companyProfile.businessName && companyProfile.ein)
  const hasTaxProfile = taxProfile.entityType !== 'sole_prop' || taxProfile.filingStatus !== 'single' || taxProfile.hasHomeOffice || taxProfile.hasVehicle
  const hasStatements = files.length > 0
  const hasCategorized = totals.uncategorized === 0 && transactions.length > 0
  const completedSteps = [hasCompanyInfo, hasTaxProfile, hasStatements, hasCategorized].filter(Boolean).length

  function goTo(tab: string) {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })
  }

  return (
    <div>
      {/* Company header */}
      <div className={styles.card} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Building2 size={24} color="#3b82f6" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{companyProfile.businessName || clientName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
            {companyProfile.ein && <span>EIN: {companyProfile.ein}</span>}
            {taxProfile.entityType && <span>{ENTITY_LABELS[taxProfile.entityType] || taxProfile.entityType}</span>}
            {companyProfile.industry && <span>{companyProfile.industry}</span>}
            {companyProfile.state && <span>{companyProfile.city ? `${companyProfile.city}, ${companyProfile.state}` : companyProfile.state}</span>}
          </div>
        </div>
        <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => goTo('Company Info')}>
          Edit
        </button>
      </div>

      {/* Key metrics */}
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>
            <TrendingUp size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Income
          </div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(totals.income)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>
            <Receipt size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Business Expenses
          </div>
          <div className={`${styles.metricValue} ${styles.metricRed}`}>{fmtCurrency(totals.bizExp)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>
            <DollarSign size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Net Profit
          </div>
          <div className={`${styles.metricValue} ${netProfit >= 0 ? styles.metricGreen : styles.metricRed}`}>{fmtCurrency(netProfit)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>
            <FileText size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Transactions
          </div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>{transactions.length}</div>
        </div>
      </div>

      {/* Setup checklist */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={16} /> Setup Checklist
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{completedSteps}/4 complete</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ChecklistItem done={hasCompanyInfo} label="Enter company information" hint="Business name, EIN, address, industry" onClick={() => goTo('Company Info')} />
          <ChecklistItem done={hasTaxProfile} label="Complete tax profile" hint="Entity type, filing status, deductions, vehicle, home office" onClick={() => goTo('Tax Profile')} />
          <ChecklistItem done={hasStatements} label="Upload bank statements" hint={hasStatements ? `${files.length} files, ${transactions.length} transactions` : 'PDF or CSV from any major bank'} onClick={() => goTo('Upload')} />
          <ChecklistItem done={hasCategorized} label="Categorize all transactions" hint={hasCategorized ? 'All categorized' : `${totals.uncategorized} uncategorized remaining`} onClick={() => goTo('Transactions')} />
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Upload Statements', tab: 'Upload', icon: FileText, color: '#3b82f6' },
          { label: 'View Transactions', tab: 'Transactions', icon: Receipt, color: '#22c55e' },
          { label: 'Find Deductions', tab: 'Deduction Finder', icon: DollarSign, color: '#14b8a6' },
          { label: 'Tax Scenarios', tab: 'Tax Scenarios', icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Quarterly Estimates', tab: 'Quarterly Tax', icon: AlertTriangle, color: '#f59e0b' },
          { label: 'Export Data', tab: 'Export', icon: FileText, color: '#ef4444' },
        ].map(a => {
          const Icon = a.icon
          return (
            <div
              key={a.tab}
              className={styles.card}
              style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onClick={() => goTo(a.tab)}
              onMouseOver={e => (e.currentTarget.style.borderColor = a.color)}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${a.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={a.color} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</div>
                <ArrowRight size={14} color="var(--text-dim)" style={{ marginLeft: 'auto' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Uncategorized warning */}
      {totals.uncategorized > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => goTo('Transactions')}>
          <AlertTriangle size={16} color="#f59e0b" />
          <div style={{ fontSize: 13 }}>
            <strong>{totals.uncategorized} uncategorized transaction{totals.uncategorized !== 1 ? 's' : ''}</strong>
            <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>Click to review and categorize</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ChecklistItem({ done, label, hint, onClick }: { done: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--surface2)')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
    >
      {done ? <CheckCircle2 size={18} color="#22c55e" /> : <Circle size={18} color="var(--border)" />}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</div>
      </div>
      <ArrowRight size={14} color="var(--text-dim)" />
    </div>
  )
}
