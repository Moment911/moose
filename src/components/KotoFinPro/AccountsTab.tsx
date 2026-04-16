'use client'

import { useMemo } from 'react'
import { Transaction, COAAccount } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import styles from './KotoFinPro.module.css'

interface AccountsTabProps {
  transactions: Transaction[]
  accounts: COAAccount[]
}

export default function AccountsTab({ transactions, accounts }: AccountsTabProps) {
  const groups = useMemo(() => {
    const typeOrder: COAAccount['type'][] = ['asset', 'liability', 'income', 'expense', 'personal']
    const typeLabels: Record<COAAccount['type'], string> = {
      asset: 'Assets',
      liability: 'Liabilities',
      income: 'Income',
      expense: 'Expenses',
      personal: 'Personal',
    }

    return typeOrder.map(type => {
      const accts = accounts.filter(a => a.type === type)
      const items = accts.map(a => {
        const txns = transactions.filter(t => t.code === a.code)
        const total = txns.reduce((s, t) => s + (type === 'expense' || type === 'personal' ? Math.abs(t.amount) : t.amount), 0)
        return { ...a, total, count: txns.length }
      })
      const groupTotal = items.reduce((s, i) => s + i.total, 0)
      return { type, label: typeLabels[type], items, total: groupTotal }
    })
  }, [transactions, accounts])

  const totalIncome = groups.find(g => g.type === 'income')?.total ?? 0
  const totalExpenses = groups.find(g => g.type === 'expense')?.total ?? 0
  const netProfit = totalIncome - totalExpenses

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Income</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(totalIncome)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Expenses</div>
          <div className={`${styles.metricValue} ${styles.metricRed}`}>{fmtCurrency(totalExpenses)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Net Profit</div>
          <div className={`${styles.metricValue} ${netProfit >= 0 ? styles.metricGreen : styles.metricRed}`}>
            {fmtCurrency(netProfit)}
          </div>
        </div>
      </div>

      {groups.map(group => (
        <div key={group.type} className={styles.coaGroup}>
          <div className={styles.coaGroupTitle}>
            {group.label}
            <span style={{ float: 'right', fontFamily: 'var(--mono)' }}>{fmtCurrency(group.total)}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Schedule C Line</th>
                  <th style={{ textAlign: 'right' }}>Transactions</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map(item => (
                  <tr key={item.code}>
                    <td className={styles.mono}>{item.code}</td>
                    <td>{item.name}</td>
                    <td className={styles.textDim}>{item.scLine || '—'}</td>
                    <td style={{ textAlign: 'right' }} className={styles.mono}>{item.count}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={item.total > 0 ? styles.amountPos : item.total < 0 ? styles.amountNeg : styles.mono}>
                        {fmtCurrency(item.total)}
                      </span>
                    </td>
                  </tr>
                ))}
                {group.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.textCenter} style={{ padding: 20, color: 'var(--text-dim)' }}>
                      No accounts in this category
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
