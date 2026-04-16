'use client'

import { useMemo } from 'react'
import { Transaction, TaxProfile } from './KotoFin.types'
import { fmtCurrency, calcQuarterly, calcSETax } from './KotoFin.utils'
import { QUARTERLY_DUE_DATES, STANDARD_DEDUCTION_SINGLE, STANDARD_DEDUCTION_MFJ } from './KotoFin.constants'
import { Calendar, AlertTriangle, Info } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface QuarterlyTabProps {
  transactions: Transaction[]
  taxProfile: TaxProfile
}

export default function QuarterlyTab({ transactions, taxProfile }: QuarterlyTabProps) {
  const isScorp = taxProfile.entityType === 's_corp' || taxProfile.entityType === 'llc_s_elect'
  const stdDeduction = taxProfile.filingStatus === 'mfj' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE

  const data = useMemo(() => calcQuarterly(transactions), [transactions])

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)
  const netProfit = income - expenses
  const seInfo = calcSETax(Math.max(0, isScorp ? 0 : netProfit))

  const safeHarbor100 = taxProfile.priorYearTax > 0 ? taxProfile.priorYearTax / 4 : data.safeHarbor100
  const safeHarbor110 = taxProfile.priorYearTax > 0 ? (taxProfile.priorYearTax * 1.1) / 4 : data.safeHarbor110
  const incomeOver150k = income > 150000

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Net Profit</div>
          <div className={`${styles.metricValue} ${netProfit >= 0 ? styles.metricGreen : styles.metricRed}`}>
            {fmtCurrency(netProfit)}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Estimated Tax</div>
          <div className={`${styles.metricValue} ${styles.metricRed}`}>
            {fmtCurrency(data.federalTax + seInfo.seTax)}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Quarterly Payment</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>
            {fmtCurrency(data.quarterlyPayment)}
          </div>
        </div>
      </div>

      {isScorp && (
        <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--blue)' }} />
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <strong>S-Corp:</strong> SE tax shown as $0. As an S-Corp, payroll taxes are withheld from your W-2 salary. Estimated payments cover only federal income tax on pass-through distributions. Ensure your salary withholding is adequate.
          </div>
        </div>
      )}

      <div className={styles.cardHeader}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} /> 2024 Estimated Tax Payments (Form 1040-ES)
        </span>
      </div>

      <div className={styles.quarterGrid}>
        {QUARTERLY_DUE_DATES.map(q => (
          <div key={q.quarter} className={styles.quarterCard}>
            <div className={styles.quarterLabel}>{q.quarter}</div>
            <div className={styles.quarterDue}>{q.period}<br />Due: {q.due}</div>
            <div className={styles.quarterAmount}>{fmtCurrency(data.quarterlyPayment)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>Tax Computation</div>
          <div className={styles.reportLine}><span className={styles.reportLineLabel}>Gross Income</span><span className={styles.reportLineValue}>{fmtCurrency(income)}</span></div>
          {taxProfile.estimatedOtherIncome > 0 && (
            <div className={styles.reportLine}><span className={styles.reportLineLabel}>Other Income (W-2, etc.)</span><span className={styles.reportLineValue}>{fmtCurrency(taxProfile.estimatedOtherIncome)}</span></div>
          )}
          <div className={styles.reportLine}><span className={styles.reportLineLabel}>Business Expenses</span><span className={styles.reportLineValue}>{fmtCurrency(expenses)}</span></div>
          <div className={styles.reportLine}><span className={styles.reportLineLabel}>Net Profit</span><span className={styles.reportLineValue}>{fmtCurrency(netProfit)}</span></div>
          {!isScorp && <div className={styles.reportLine}><span className={styles.reportLineLabel}>SE Tax</span><span className={styles.reportLineValue}>{fmtCurrency(seInfo.seTax)}</span></div>}
          {!isScorp && <div className={styles.reportLine}><span className={styles.reportLineLabel}>½ SE Deduction</span><span className={styles.reportLineValue}>{fmtCurrency(seInfo.seDeduction)}</span></div>}
          <div className={styles.reportLine}><span className={styles.reportLineLabel}>AGI</span><span className={styles.reportLineValue}>{fmtCurrency(data.agi)}</span></div>
          <div className={styles.reportLine}><span className={styles.reportLineLabel}>Standard Deduction ({taxProfile.filingStatus.toUpperCase()})</span><span className={styles.reportLineValue}>{fmtCurrency(stdDeduction)}</span></div>
          <div className={styles.reportLine}><span className={styles.reportLineLabel}>Federal Tax</span><span className={styles.reportLineValue}>{fmtCurrency(data.federalTax)}</span></div>
          <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
            <span className={styles.reportLineLabel}>Total Annual Tax</span>
            <span className={styles.reportLineValue} style={{ color: 'var(--red)' }}>{fmtCurrency(data.federalTax + seInfo.seTax)}</span>
          </div>
        </div>

        <div className={styles.card}>
          {!isScorp ? (
            <>
              <div className={styles.cardHeader}>SE Tax Breakdown</div>
              <div className={styles.reportLine}><span className={styles.reportLineLabel}>Net SE Income</span><span className={styles.reportLineValue}>{fmtCurrency(Math.max(0, netProfit))}</span></div>
              <div className={styles.reportLine}><span className={styles.reportLineLabel}>Taxable Base (92.35%)</span><span className={styles.reportLineValue}>{fmtCurrency(seInfo.taxableBase)}</span></div>
              <div className={styles.reportLine}><span className={styles.reportLineLabel}>Social Security (12.4%)</span><span className={styles.reportLineValue}>{fmtCurrency(seInfo.ssAmount)}</span></div>
              <div className={styles.reportLine}><span className={styles.reportLineLabel}>Medicare (2.9%)</span><span className={styles.reportLineValue}>{fmtCurrency(seInfo.medicareAmount)}</span></div>
              <div className={styles.reportLine}><span className={styles.reportLineLabel}>Additional Medicare (0.9%)</span><span className={styles.reportLineValue}>{fmtCurrency(seInfo.additionalMedicare)}</span></div>
              <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
                <span className={styles.reportLineLabel}>Total SE Tax</span>
                <span className={styles.reportLineValue} style={{ color: 'var(--amber)' }}>{fmtCurrency(seInfo.seTax)}</span>
              </div>
              <div className={styles.reportLine}>
                <span className={styles.reportLineLabel}>½ SE Deduction</span>
                <span className={styles.reportLineValue} style={{ color: 'var(--green)' }}>{fmtCurrency(seInfo.seDeduction)}</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.cardHeader}>S-Corp Payroll Note</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, padding: '8px 0' }}>
                As an S-Corp, you do not pay self-employment tax. Instead, you pay yourself a reasonable W-2 salary subject to FICA (7.65% employee + 7.65% employer = 15.3% total on salary only). Remaining profit passes through as distributions on your K-1 — not subject to payroll taxes. Ensure your payroll provider withholds adequate federal income tax.
              </div>
            </>
          )}

          <div style={{ marginTop: 20 }}>
            <div className={styles.cardHeader}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} /> Safe Harbor
              </span>
            </div>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>100% current year / 4</span>
              <span className={styles.reportLineValue}>{fmtCurrency(data.safeHarbor100)}</span>
            </div>
            {taxProfile.priorYearTax > 0 && (
              <div className={styles.reportLine}>
                <span className={styles.reportLineLabel}>100% prior year / 4</span>
                <span className={styles.reportLineValue}>{fmtCurrency(safeHarbor100)}</span>
              </div>
            )}
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>110% (AGI &gt;$150k) / 4</span>
              <span className={styles.reportLineValue}>{fmtCurrency(incomeOver150k ? safeHarbor110 : data.safeHarbor110)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
              Pay the <strong>lesser</strong> of 100% current year or {incomeOver150k ? '110%' : '100%'} prior year to avoid underpayment penalty (IRC §6654).
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
