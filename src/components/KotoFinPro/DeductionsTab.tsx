'use client'

import { useMemo } from 'react'
import { Transaction } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import styles from './KotoFinPro.module.css'

interface DeductionsTabProps {
  transactions: Transaction[]
}

interface Deduction {
  title: string
  amount: number
  description: string
  category: string
  applicable: boolean
}

export default function DeductionsTab({ transactions }: DeductionsTabProps) {
  const deductions = useMemo(() => {
    const bizTxns = transactions.filter(t => t.type === 'business')
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalBizExp = bizTxns.reduce((s, t) => s + Math.abs(t.amount), 0)

    const byCategory: Record<string, number> = {}
    for (const t of bizTxns) {
      byCategory[t.cat] = (byCategory[t.cat] || 0) + Math.abs(t.amount)
    }

    const results: Deduction[] = []

    // Software & Subscriptions
    const software = byCategory['Software & Subscriptions'] || 0
    if (software > 0) {
      results.push({
        title: 'Software & Subscriptions',
        amount: software,
        description: `You spent ${fmtCurrency(software)} on business software. All business software subscriptions are 100% deductible. Ensure personal software (Netflix, Spotify) is excluded.`,
        category: 'Line 27a',
        applicable: true,
      })
    }

    // Advertising
    const advertising = byCategory['Advertising'] || 0
    if (advertising > 0) {
      results.push({
        title: 'Advertising & Marketing',
        amount: advertising,
        description: `${fmtCurrency(advertising)} in advertising spend detected. Digital ads (Google, Meta, LinkedIn) are fully deductible as business expenses.`,
        category: 'Line 8',
        applicable: true,
      })
    }

    // Meals
    const meals = byCategory['Meals (50% deductible)'] || 0
    if (meals > 0) {
      results.push({
        title: 'Business Meals (50%)',
        amount: meals * 0.5,
        description: `${fmtCurrency(meals)} in meal expenses found. Business meals are 50% deductible. Save receipts noting who you met and the business purpose.`,
        category: 'Line 24b',
        applicable: true,
      })
    }

    // Travel
    const travel = byCategory['Travel'] || 0
    if (travel > 0) {
      results.push({
        title: 'Business Travel',
        amount: travel,
        description: `${fmtCurrency(travel)} in travel costs (flights, hotels). Fully deductible when the primary purpose is business. Keep documentation of business purpose.`,
        category: 'Line 24a',
        applicable: true,
      })
    }

    // Home Office
    results.push({
      title: 'Home Office Deduction',
      amount: income > 0 ? income * 0.15 : 0,
      description: `If you use a dedicated space at home for business, you can deduct a percentage of rent/mortgage, utilities, and insurance. Simplified method: $5/sq ft up to 300 sq ft ($1,500 max). Estimated at 15% of gross income.`,
      category: 'Line 30',
      applicable: income > 0,
    })

    // Vehicle Mileage
    const carExp = byCategory['Car & Truck Expenses'] || 0
    results.push({
      title: 'Vehicle / Mileage Deduction',
      amount: carExp > 0 ? carExp : 5000 * 0.67,
      description: `${carExp > 0 ? `${fmtCurrency(carExp)} in ride expenses detected.` : 'No vehicle expenses detected yet.'} Track business miles at $0.67/mile (2024 rate). A log of 5,000 business miles = ${fmtCurrency(5000 * 0.67)} deduction.`,
      category: 'Line 9',
      applicable: true,
    })

    // SEP-IRA
    const netProfit = income - totalBizExp
    if (netProfit > 0) {
      const sepMax = Math.min(netProfit * 0.25, 69000)
      results.push({
        title: 'SEP-IRA Contribution',
        amount: sepMax,
        description: `With ${fmtCurrency(netProfit)} net profit, you can contribute up to ${fmtCurrency(sepMax)} to a SEP-IRA (25% of net SE income, max $69,000). This directly reduces your AGI.`,
        category: 'Above the line',
        applicable: netProfit > 0,
      })
    }

    // Health Insurance
    results.push({
      title: 'Self-Employed Health Insurance',
      amount: 6000,
      description: 'If you pay your own health insurance premiums, you can deduct 100% of premiums for yourself, spouse, and dependents. Average annual premium ~$6,000. This is an above-the-line deduction.',
      category: 'Above the line',
      applicable: true,
    })

    // SE Tax Deduction
    if (netProfit > 0) {
      const seTax = netProfit * 0.9235 * 0.153
      results.push({
        title: 'Self-Employment Tax Deduction',
        amount: seTax / 2,
        description: `You can deduct 50% of your SE tax (${fmtCurrency(seTax / 2)}) as an above-the-line deduction. This is automatic — just make sure you file Schedule SE.`,
        category: 'Above the line',
        applicable: true,
      })
    }

    // Contract Labor
    const contractLabor = byCategory['Contract Labor'] || 0
    if (contractLabor > 0) {
      results.push({
        title: 'Contract Labor / Freelancers',
        amount: contractLabor,
        description: `${fmtCurrency(contractLabor)} paid to contractors. Fully deductible. Remember to issue 1099-NEC forms for contractors paid $600+.`,
        category: 'Line 11',
        applicable: true,
      })
    }

    // Shipping
    const shipping = (byCategory['Shipping & Postage'] || 0)
    if (shipping > 0) {
      results.push({
        title: 'Shipping & Postage',
        amount: shipping,
        description: `${fmtCurrency(shipping)} in shipping costs. Business shipping is fully deductible.`,
        category: 'Line 27a',
        applicable: true,
      })
    }

    return results.filter(d => d.applicable)
  }, [transactions])

  const totalSavings = deductions.reduce((s, d) => s + d.amount, 0)
  const estimatedTaxSavings = totalSavings * 0.30

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Potential Deductions Found</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{deductions.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Deductible Amount</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(totalSavings)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Est. Tax Savings (~30%)</div>
          <div className={`${styles.metricValue} ${styles.metricTeal}`}>{fmtCurrency(estimatedTaxSavings)}</div>
        </div>
      </div>

      {deductions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#128269;</div>
          <div className={styles.emptyText}>No deductions found yet</div>
          <div className={styles.emptyHint}>Upload bank statements to scan for deduction opportunities</div>
        </div>
      ) : (
        <div className={styles.deductionGrid}>
          {deductions.map((d, i) => (
            <div key={i} className={styles.deductionCard}>
              <div className={styles.deductionTitle}>{d.title}</div>
              <div className={styles.deductionAmount}>{fmtCurrency(d.amount)}</div>
              <div style={{ marginBottom: 8 }}>
                <span className={`${styles.badge} ${styles.badgeBusiness}`}>{d.category}</span>
              </div>
              <div className={styles.deductionDesc}>{d.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
