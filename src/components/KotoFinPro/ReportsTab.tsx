'use client'

import { useMemo, useState } from 'react'
import { Transaction, COAAccount } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import styles from './KotoFinPro.module.css'

interface ReportsTabProps {
  transactions: Transaction[]
  accounts: COAAccount[]
}

type ReportView = 'pnl' | 'schedule-c' | 'merchant' | 'monthly'

export default function ReportsTab({ transactions, accounts }: ReportsTabProps) {
  const [view, setView] = useState<ReportView>('pnl')

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const bizExpenses = transactions.filter(t => t.type === 'business').reduce((s, t) => s + Math.abs(t.amount), 0)

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions.filter(t => t.type === 'business')) {
      map[t.cat] = (map[t.cat] || 0) + Math.abs(t.amount)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [transactions])

  const scheduleCLines = useMemo(() => {
    const expAccts = accounts.filter(a => a.type === 'expense' && a.scLine)
    const lines: Array<{ line: string; name: string; total: number }> = []

    for (const acct of expAccts) {
      const total = transactions
        .filter(t => t.code === acct.code && t.type === 'business')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      if (total > 0) {
        const existing = lines.find(l => l.line === acct.scLine)
        if (existing) {
          existing.total += total
        } else {
          lines.push({ line: acct.scLine!, name: acct.name, total })
        }
      }
    }

    return lines.sort((a, b) => {
      const numA = parseInt(a.line.replace(/\D/g, ''))
      const numB = parseInt(b.line.replace(/\D/g, ''))
      return numA - numB
    })
  }, [transactions, accounts])

  const byMerchant = useMemo(() => {
    const map: Record<string, { total: number; count: number; type: string }> = {}
    for (const t of transactions) {
      if (!t.co) continue
      if (!map[t.co]) map[t.co] = { total: 0, count: 0, type: t.type }
      map[t.co].total += t.amount
      map[t.co].count++
    }
    return Object.entries(map).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
  }, [transactions])

  const byMonth = useMemo(() => {
    const map: Record<string, { income: number; expenses: number; personal: number; net: number }> = {}
    for (const t of transactions) {
      const month = t.date.substring(0, 7)
      if (!map[month]) map[month] = { income: 0, expenses: 0, personal: 0, net: 0 }
      if (t.type === 'income') map[month].income += t.amount
      else if (t.type === 'business') map[month].expenses += Math.abs(t.amount)
      else if (t.type === 'personal') map[month].personal += Math.abs(t.amount)
    }
    for (const m of Object.values(map)) {
      m.net = m.income - m.expenses
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [transactions])

  const totalScC = scheduleCLines.reduce((s, l) => s + l.total, 0)

  return (
    <div>
      <div className={styles.filterBar}>
        {(['pnl', 'schedule-c', 'merchant', 'monthly'] as ReportView[]).map(v => (
          <button
            key={v}
            className={`${styles.btn} ${view === v ? styles.btnPrimary : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'pnl' ? 'P&L' : v === 'schedule-c' ? 'Schedule C' : v === 'merchant' ? 'By Merchant' : 'Monthly'}
          </button>
        ))}
      </div>

      {view === 'pnl' && (
        <div className={styles.card}>
          <div className={styles.reportTitle}>Profit & Loss Statement</div>

          <div className={styles.reportSection}>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel} style={{ fontWeight: 600 }}>Revenue</span>
              <span className={styles.reportLineValue}></span>
            </div>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>&nbsp;&nbsp;Gross Receipts / Sales</span>
              <span className={styles.reportLineValue}>{fmtCurrency(income)}</span>
            </div>
            <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
              <span className={styles.reportLineLabel}>Total Revenue</span>
              <span className={styles.reportLineValue} style={{ color: 'var(--green)' }}>{fmtCurrency(income)}</span>
            </div>
          </div>

          <div className={styles.reportSection}>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel} style={{ fontWeight: 600 }}>Expenses</span>
              <span className={styles.reportLineValue}></span>
            </div>
            {expensesByCategory.map(([cat, total]) => (
              <div key={cat} className={styles.reportLine}>
                <span className={styles.reportLineLabel}>&nbsp;&nbsp;{cat}</span>
                <span className={styles.reportLineValue}>{fmtCurrency(total)}</span>
              </div>
            ))}
            <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
              <span className={styles.reportLineLabel}>Total Expenses</span>
              <span className={styles.reportLineValue} style={{ color: 'var(--red)' }}>{fmtCurrency(bizExpenses)}</span>
            </div>
          </div>

          <div className={styles.reportSection}>
            <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
              <span className={styles.reportLineLabel} style={{ fontSize: 16 }}>Net Profit</span>
              <span className={styles.reportLineValue} style={{ fontSize: 18, color: income - bizExpenses >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmtCurrency(income - bizExpenses)}
              </span>
            </div>
          </div>
        </div>
      )}

      {view === 'schedule-c' && (
        <div className={styles.card}>
          <div className={styles.reportTitle}>Schedule C — Profit or Loss From Business</div>

          <div className={styles.reportSection}>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>Line 1 — Gross receipts or sales</span>
              <span className={styles.reportLineValue}>{fmtCurrency(income)}</span>
            </div>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel}>Line 7 — Gross income</span>
              <span className={styles.reportLineValue}>{fmtCurrency(income)}</span>
            </div>
          </div>

          <div className={styles.reportSection}>
            <div className={styles.reportLine}>
              <span className={styles.reportLineLabel} style={{ fontWeight: 600 }}>Expenses</span>
              <span className={styles.reportLineValue}></span>
            </div>
            {scheduleCLines.map(l => (
              <div key={l.line} className={styles.reportLine}>
                <span className={styles.reportLineLabel}>
                  Line {l.line.replace('L', '')} — {l.name}
                </span>
                <span className={styles.reportLineValue}>{fmtCurrency(l.total)}</span>
              </div>
            ))}
            <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
              <span className={styles.reportLineLabel}>Line 28 — Total expenses</span>
              <span className={styles.reportLineValue}>{fmtCurrency(totalScC)}</span>
            </div>
          </div>

          <div className={styles.reportSection}>
            <div className={`${styles.reportLine} ${styles.reportLineTotal}`}>
              <span className={styles.reportLineLabel} style={{ fontSize: 16 }}>Line 31 — Net profit (or loss)</span>
              <span className={styles.reportLineValue} style={{ fontSize: 18, color: income - totalScC >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmtCurrency(income - totalScC)}
              </span>
            </div>
          </div>
        </div>
      )}

      {view === 'merchant' && (
        <div className={styles.card}>
          <div className={styles.reportTitle}>Spending by Merchant</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Transactions</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {byMerchant.map(([name, data]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        data.type === 'business' ? styles.badgeBusiness
                        : data.type === 'personal' ? styles.badgePersonal
                        : data.type === 'income' ? styles.badgeIncome
                        : styles.badgeUncategorized
                      }`}>
                        {data.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className={styles.mono}>{data.count}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={data.total >= 0 ? styles.amountPos : styles.amountNeg}>
                        {fmtCurrency(data.total)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'monthly' && (
        <div className={styles.card}>
          <div className={styles.reportTitle}>Monthly Breakdown</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'right' }}>Income</th>
                  <th style={{ textAlign: 'right' }}>Biz Expenses</th>
                  <th style={{ textAlign: 'right' }}>Personal</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map(([month, data]) => (
                  <tr key={month}>
                    <td className={styles.mono}>{month}</td>
                    <td style={{ textAlign: 'right' }} className={styles.amountPos}>{fmtCurrency(data.income)}</td>
                    <td style={{ textAlign: 'right' }} className={styles.amountNeg}>{fmtCurrency(data.expenses)}</td>
                    <td style={{ textAlign: 'right' }} className={styles.mono}>{fmtCurrency(data.personal)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={data.net >= 0 ? styles.amountPos : styles.amountNeg}>
                        {fmtCurrency(data.net)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
