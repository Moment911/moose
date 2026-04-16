'use client'

import { useMemo } from 'react'
import { Transaction } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface RecurringTabProps {
  transactions: Transaction[]
}

interface RecurringGroup {
  merchant: string
  category: string
  type: string
  occurrences: Array<{ date: string; amount: number }>
  avgAmount: number
  frequency: string
  totalSpend: number
  priceChange: { from: number; to: number; pctChange: number } | null
  isNew: boolean
}

function detectFrequency(dates: string[]): string {
  if (dates.length < 2) return 'one-time'
  const sorted = dates.sort()
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const d1 = new Date(sorted[i - 1]).getTime()
    const d2 = new Date(sorted[i]).getTime()
    gaps.push((d2 - d1) / (1000 * 60 * 60 * 24))
  }
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
  if (avgGap < 2) return 'daily'
  if (avgGap >= 5 && avgGap <= 9) return 'weekly'
  if (avgGap >= 12 && avgGap <= 18) return 'bi-weekly'
  if (avgGap >= 25 && avgGap <= 35) return 'monthly'
  if (avgGap >= 80 && avgGap <= 100) return 'quarterly'
  if (avgGap >= 350 && avgGap <= 380) return 'annual'
  return `~${Math.round(avgGap)} days`
}

export default function RecurringTab({ transactions }: RecurringTabProps) {
  const recurring = useMemo(() => {
    // Group by cleaned merchant name
    const groups: Record<string, Transaction[]> = {}
    for (const t of transactions) {
      const key = (t.co || t.desc.substring(0, 20)).toLowerCase().trim()
      if (!key) continue
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }

    const results: RecurringGroup[] = []

    for (const [, txns] of Object.entries(groups)) {
      if (txns.length < 2) continue

      const amounts = txns.map(t => Math.abs(t.amount))
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
      const dates = txns.map(t => t.date)
      const frequency = detectFrequency(dates)

      // Detect price changes
      const sorted = txns.sort((a, b) => a.date.localeCompare(b.date))
      let priceChange: RecurringGroup['priceChange'] = null

      if (sorted.length >= 2) {
        const firstAmt = Math.abs(sorted[0].amount)
        const lastAmt = Math.abs(sorted[sorted.length - 1].amount)
        if (firstAmt > 0 && Math.abs(lastAmt - firstAmt) > 0.01) {
          const pctChange = ((lastAmt - firstAmt) / firstAmt) * 100
          if (Math.abs(pctChange) > 1) {
            priceChange = { from: firstAmt, to: lastAmt, pctChange }
          }
        }
      }

      // Detect if this is new (first appeared recently)
      const allDates = transactions.map(t => t.date).sort()
      const midDate = allDates[Math.floor(allDates.length / 2)]
      const isNew = sorted[0].date > midDate

      results.push({
        merchant: txns[0].co || txns[0].desc.substring(0, 30),
        category: txns[0].cat,
        type: txns[0].type,
        occurrences: sorted.map(t => ({ date: t.date, amount: t.amount })),
        avgAmount,
        frequency,
        totalSpend: amounts.reduce((s, a) => s + a, 0),
        priceChange,
        isNew,
      })
    }

    return results.sort((a, b) => b.totalSpend - a.totalSpend)
  }, [transactions])

  const subscriptions = recurring.filter(r => r.frequency === 'monthly' || r.frequency === 'weekly' || r.frequency === 'bi-weekly' || r.frequency === 'annual' || r.frequency === 'quarterly')
  const priceChanges = recurring.filter(r => r.priceChange && Math.abs(r.priceChange.pctChange) > 5)
  const newRecurring = recurring.filter(r => r.isNew && r.occurrences.length >= 2)
  const monthlyTotal = subscriptions.filter(r => r.type === 'business').reduce((s, r) => s + r.avgAmount, 0)

  if (transactions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}><RefreshCw size={48} /></div>
        <div className={styles.emptyText}>No transactions to analyze</div>
        <div className={styles.emptyHint}>Upload statements to detect recurring charges</div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Recurring Vendors</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>{recurring.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Subscriptions</div>
          <div className={`${styles.metricValue} ${styles.metricPurple}`}>{subscriptions.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Est. Monthly Recurring (Biz)</div>
          <div className={`${styles.metricValue} ${styles.metricRed}`}>{fmtCurrency(monthlyTotal)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Price Changes Detected</div>
          <div className={`${styles.metricValue} ${styles.metricAmber}`}>{priceChanges.length}</div>
        </div>
      </div>

      {/* Price changes alert */}
      {priceChanges.length > 0 && (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <div className={styles.cardHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#f59e0b" /> Price Changes Detected
            </span>
          </div>
          {priceChanges.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < priceChanges.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.merchant}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.category} &middot; {r.frequency}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={styles.mono} style={{ color: 'var(--text-dim)' }}>{fmtCurrency(r.priceChange!.from)}</span>
                <span style={{ color: 'var(--text-dim)' }}>&rarr;</span>
                <span className={styles.mono} style={{ fontWeight: 600 }}>{fmtCurrency(r.priceChange!.to)}</span>
                <span className={`${styles.badge} ${r.priceChange!.pctChange > 0 ? styles.badgeUncategorized : styles.badgeBusiness}`}>
                  {r.priceChange!.pctChange > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {r.priceChange!.pctChange > 0 ? '+' : ''}{r.priceChange!.pctChange.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subscriptions */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={16} /> Subscriptions & Recurring Charges
          </span>
          <span className={styles.textDim} style={{ fontSize: 12 }}>{subscriptions.length} detected</span>
        </div>
        <div className={styles.tableWrap} style={{ maxHeight: 400 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Type</th>
                <th>Frequency</th>
                <th style={{ textAlign: 'right' }}>Avg Amount</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>
                    {r.merchant}
                    {r.isNew && <span className={`${styles.badge} ${styles.badgeAI}`} style={{ marginLeft: 6 }}>NEW</span>}
                  </td>
                  <td className={styles.textDim}>{r.category}</td>
                  <td>
                    <span className={`${styles.badge} ${r.type === 'business' ? styles.badgeBusiness : r.type === 'personal' ? styles.badgePersonal : styles.badgeIncome}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className={styles.textDim}>{r.frequency}</td>
                  <td style={{ textAlign: 'right' }} className={styles.amountNeg}>{fmtCurrency(r.avgAmount)}</td>
                  <td style={{ textAlign: 'right' }} className={styles.mono}>{fmtCurrency(r.totalSpend)}</td>
                  <td style={{ textAlign: 'right' }} className={styles.mono}>{r.occurrences.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All recurring vendors */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span>All Recurring Vendors ({recurring.length})</span>
        </div>
        <div className={styles.tableWrap} style={{ maxHeight: 400 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Frequency</th>
                <th style={{ textAlign: 'right' }}>Avg</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>#</th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{r.merchant}</td>
                  <td className={styles.textDim}>{r.category}</td>
                  <td className={styles.textDim}>{r.frequency}</td>
                  <td style={{ textAlign: 'right' }} className={styles.mono}>{fmtCurrency(r.avgAmount)}</td>
                  <td style={{ textAlign: 'right' }} className={styles.mono}>{fmtCurrency(r.totalSpend)}</td>
                  <td style={{ textAlign: 'right' }} className={styles.mono}>{r.occurrences.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
