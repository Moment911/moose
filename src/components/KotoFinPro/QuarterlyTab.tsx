'use client'

import { useMemo } from 'react'
import { Transaction } from './KotoFin.types'
import { fmtCurrency, calcQuarterly, calcSETax } from './KotoFin.utils'
import { QUARTERLY_DUE_DATES } from './KotoFin.constants'
import styles from './KotoFinPro.module.css'

interface QuarterlyTabProps {
  transactions: Transaction[]
}

export default function QuarterlyTab({ transactions }: QuarterlyTabProps) {
  const data = useMemo(() => calcQuarterly(transactions), [transactions])

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)
  const netProfit = income - expenses
  const seInfo = calcSETax(Math.max(0, netProfit))

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

      <div className={styles.cardHeader}>2024 Estimated Tax Payment Schedule (Form 1040-ES)</div>

      <div className={styles.quarterGrid}>
        {QUARTERLY_DUE_DATES.map(q => (
          <div key={q.quarter} className={styles.quarterCard}>
            <div className={styles.quarterLabel}>{q.quarter}</div>
            <div className={styles.quarterDue}>
              {q.period}<br />Due: {q.due}
            </div>
            <div className={styles.quarterAmount}>{fmtCurrency(data.quarterlyPayment)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>Tax Computation</div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Gross Income</span>
            <span className={styles.reportLineValue}>{fmtCurrency(income)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Business Expenses</span>
            <span className={styles.reportLineValue}>{fmtCurrency(expenses)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Net Profit</span>
            <span className={styles.reportLineValue}>{fmtCurrency(netProfit)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>SE Tax</span>
            <span className={styles.reportLineValue}>{fmtCurrency(seInfo.seTax)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>½ SE Deduction</span>
            <span className={styles.reportLineValue}>{fmtCurrency(seInfo.seDeduction)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>AGI</span>
            <span className={styles.reportLineValue}>{fmtCurrency(data.agi)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Standard Deduction</span>
            <span className={styles.reportLineValue}>{fmtCurrency(14600)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Federal Tax</span>
            <span className={styles.reportLineValue}>{fmtCurrency(data.federalTax)}</span>
          </div>
          <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
            <span className={styles.reportLineLabel}>Total Annual Tax</span>
            <span className={styles.reportLineValue} style={{ color: 'var(--red)' }}>
              {fmtCurrency(data.federalTax + seInfo.seTax)}
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Self-Employment Tax Breakdown</div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Net SE Income</span>
            <span className={styles.reportLineValue}>{fmtCurrency(Math.max(0, netProfit))}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Taxable Base (92.35%)</span>
            <span className={styles.reportLineValue}>{fmtCurrency(seInfo.taxableBase)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Social Security (12.4%)</span>
            <span className={styles.reportLineValue}>{fmtCurrency(seInfo.ssAmount)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Medicare (2.9%)</span>
            <span className={styles.reportLineValue}>{fmtCurrency(seInfo.medicareAmount)}</span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>Additional Medicare (0.9%)</span>
            <span className={styles.reportLineValue}>{fmtCurrency(seInfo.additionalMedicare)}</span>
          </div>
          <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
            <span className={styles.reportLineLabel}>Total SE Tax</span>
            <span className={styles.reportLineValue} style={{ color: 'var(--amber)' }}>
              {fmtCurrency(seInfo.seTax)}
            </span>
          </div>
          <div className={styles.reportLine}>
            <span className={styles.reportLineLabel}>½ SE Tax Deduction</span>
            <span className={styles.reportLineValue} style={{ color: 'var(--green)' }}>
              {fmtCurrency(seInfo.seDeduction)}
            </span>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className={styles.cardHeader}>Safe Harbor Amounts</div>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>100% of current year / 4</span>
              <span className={styles.reportLineValue}>{fmtCurrency(data.safeHarbor100)}</span>
            </div>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>110% (income &gt;$150k) / 4</span>
              <span className={styles.reportLineValue}>{fmtCurrency(data.safeHarbor110)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
