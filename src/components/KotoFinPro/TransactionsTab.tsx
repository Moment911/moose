'use client'

import { useState, useMemo, Dispatch } from 'react'
import { Transaction, COAAccount, StatementFile, KotoFinAction } from './KotoFin.types'
import { fmtCurrency, getTransactionTotals } from './KotoFin.utils'
import { BANK_COLORS } from './KotoFin.constants'
import EditModal from './EditModal'
import styles from './KotoFinPro.module.css'

interface TransactionsTabProps {
  transactions: Transaction[]
  accounts: COAAccount[]
  files: StatementFile[]
  activeFile: string
  activeType: string
  dispatch: Dispatch<KotoFinAction>
}

export default function TransactionsTab({
  transactions,
  accounts,
  files,
  activeFile,
  activeType,
  dispatch,
}: TransactionsTabProps) {
  const [search, setSearch] = useState('')
  const [editTxn, setEditTxn] = useState<Transaction | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [categorizing, setCategorizing] = useState(false)

  const filtered = useMemo(() => {
    let list = transactions
    if (activeFile !== 'all') {
      list = list.filter(t => t.file === activeFile)
    }
    if (activeType !== 'all') {
      list = list.filter(t => t.type === activeType)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        t =>
          t.desc.toLowerCase().includes(q) ||
          t.co.toLowerCase().includes(q) ||
          t.cat.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, activeFile, activeType, search])

  const totals = getTransactionTotals(transactions)

  function handleSave(t: Transaction) {
    if (isNew) {
      dispatch({ type: 'ADD_TRANSACTIONS', payload: [t] })
    } else {
      dispatch({ type: 'UPDATE_TRANSACTION', payload: t })
    }
    setShowModal(false)
    setEditTxn(null)
  }

  function handleDelete(id: number) {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
  }

  function handleAdd() {
    setIsNew(true)
    setEditTxn(null)
    setShowModal(true)
  }

  function handleEdit(t: Transaction) {
    setIsNew(false)
    setEditTxn(t)
    setShowModal(true)
  }

  async function handleAICategorize() {
    const uncategorized = transactions.filter(t => t.type === 'uncategorized')
    if (uncategorized.length === 0) return

    setCategorizing(true)
    try {
      const res = await fetch('/api/KotoFin/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: uncategorized.map(t => ({
            id: t.id,
            desc: t.desc,
            amount: t.amount,
          })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const results: Array<{ id: number; co: string; cat: string; type: Transaction['type']; code: string }> = data.results
        for (const r of results) {
          const txn = transactions.find(t => t.id === r.id)
          if (txn) {
            dispatch({
              type: 'UPDATE_TRANSACTION',
              payload: {
                ...txn,
                co: r.co || txn.co,
                cat: r.cat || txn.cat,
                type: r.type || txn.type,
                code: r.code || txn.code,
                aiTagged: !data.fallback,
              },
            })
          }
        }
      }
    } catch (err) {
      console.error('AI categorize failed:', err)
    }
    setCategorizing(false)
  }

  const typeBadge = (type: string) => {
    const cls = type === 'business' ? styles.badgeBusiness
      : type === 'personal' ? styles.badgePersonal
      : type === 'income' ? styles.badgeIncome
      : styles.badgeUncategorized
    return <span className={`${styles.badge} ${cls}`}>{type}</span>
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Income</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(totals.income)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Business Expenses</div>
          <div className={`${styles.metricValue} ${styles.metricRed}`}>{fmtCurrency(totals.bizExp)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Personal</div>
          <div className={`${styles.metricValue} ${styles.metricPurple}`}>{fmtCurrency(totals.personalExp)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Uncategorized</div>
          <div className={`${styles.metricValue} ${styles.metricAmber}`}>{totals.uncategorized}</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.input}
          placeholder="Search transactions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className={styles.select}
          value={activeFile}
          onChange={e => dispatch({ type: 'SET_ACTIVE_FILE', payload: e.target.value })}
        >
          <option value="all">All Files</option>
          {files.map(f => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={activeType}
          onChange={e => dispatch({ type: 'SET_ACTIVE_TYPE', payload: e.target.value })}
        >
          <option value="all">All Types</option>
          <option value="business">Business</option>
          <option value="personal">Personal</option>
          <option value="income">Income</option>
          <option value="uncategorized">Uncategorized</option>
        </select>
        <button className={`${styles.btn} ${styles.btnGreen}`} onClick={handleAdd}>+ Add</button>
        {totals.uncategorized > 0 && (
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleAICategorize}
            disabled={categorizing}
          >
            {categorizing ? 'Categorizing...' : `AI Categorize (${totals.uncategorized})`}
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Company</th>
              <th>Category</th>
              <th>Type</th>
              <th>Source</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td className={styles.mono}>{t.date}</td>
                <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.desc}
                </td>
                <td>{t.co}</td>
                <td>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.code}</span>{' '}
                  {t.cat}
                </td>
                <td>
                  {typeBadge(t.type)}
                  {t.aiTagged && <span className={`${styles.badge} ${styles.badgeAI}`}>AI</span>}
                </td>
                <td>
                  <span className={styles.sourceChip}>
                    <span
                      className={styles.sourceDot}
                      style={{ background: BANK_COLORS[t.bank] || '#888' }}
                    />
                    {t.bank} {t.account}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={t.amount >= 0 ? styles.amountPos : styles.amountNeg}>
                    {fmtCurrency(t.amount)}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => handleEdit(t)}>Edit</button>
                    <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnRed}`} onClick={() => handleDelete(t.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.textCenter} style={{ padding: 40, color: 'var(--text-dim)' }}>
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.textDim} style={{ marginTop: 8, fontSize: 12 }}>
        Showing {filtered.length} of {transactions.length} transactions
      </div>

      {showModal && (
        <EditModal
          transaction={editTxn}
          accounts={accounts}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTxn(null) }}
          nextId={Math.max(0, ...transactions.map(t => t.id)) + 1}
        />
      )}
    </div>
  )
}
