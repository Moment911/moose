'use client'

import { useState, useMemo, Dispatch } from 'react'
import { Transaction, COAAccount, StatementFile, KotoFinAction } from './KotoFin.types'
import { fmtCurrency, getTransactionTotals } from './KotoFin.utils'
import { BANK_COLORS } from './KotoFin.constants'
import { Check, X, Pencil, Trash2, Plus, Brain } from 'lucide-react'
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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Transaction | null>(null)
  const [categorizing, setCategorizing] = useState(false)

  const filtered = useMemo(() => {
    let list = transactions
    if (activeFile !== 'all') list = list.filter(t => t.file === activeFile)
    if (activeType !== 'all') list = list.filter(t => t.type === activeType)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.desc.toLowerCase().includes(q) ||
        t.co.toLowerCase().includes(q) ||
        t.cat.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, activeFile, activeType, search])

  const totals = getTransactionTotals(transactions)

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditDraft({ ...t })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  function saveEdit() {
    if (editDraft) {
      dispatch({ type: 'UPDATE_TRANSACTION', payload: editDraft })
    }
    setEditingId(null)
    setEditDraft(null)
  }

  function handleDelete(id: number) {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
    if (editingId === id) cancelEdit()
  }

  function handleAdd() {
    const newId = Math.max(0, ...transactions.map(t => t.id)) + 1
    const newTxn: Transaction = {
      id: newId, file: '', bank: '', account: '', range: '',
      date: new Date().toISOString().split('T')[0], desc: '', amount: 0,
      co: '', cat: '', code: '', type: 'uncategorized', aiTagged: false, notes: '',
    }
    dispatch({ type: 'ADD_TRANSACTIONS', payload: [newTxn] })
    startEdit(newTxn)
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
          transactions: uncategorized.map(t => ({ id: t.id, desc: t.desc, amount: t.amount })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        for (const r of data.results) {
          const txn = transactions.find(t => t.id === r.id)
          if (txn) {
            dispatch({
              type: 'UPDATE_TRANSACTION',
              payload: { ...txn, co: r.co || txn.co, cat: r.cat || txn.cat, type: r.type || txn.type, code: r.code || txn.code, aiTagged: !data.fallback },
            })
          }
        }
      }
    } catch (err) {
      console.error('AI categorize failed:', err)
    }
    setCategorizing(false)
  }

  function updateDraft(field: keyof Transaction, value: string | number) {
    if (!editDraft) return
    if (field === 'cat') {
      // When category changes, also update code and type
      const acct = accounts.find(a => a.name === value)
      if (acct) {
        setEditDraft({
          ...editDraft,
          cat: acct.name,
          code: acct.code,
          type: acct.type === 'personal' ? 'personal' : acct.type === 'income' ? 'income' : acct.type === 'expense' ? 'business' : editDraft.type,
        })
        return
      }
    }
    setEditDraft({ ...editDraft, [field]: value })
  }

  const typeBadge = (type: string) => {
    const cls = type === 'business' ? styles.badgeBusiness
      : type === 'personal' ? styles.badgePersonal
      : type === 'income' ? styles.badgeIncome
      : styles.badgeUncategorized
    return <span className={`${styles.badge} ${cls}`}>{type}</span>
  }

  const isEditing = (id: number) => editingId === id

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
        <select className={styles.select} value={activeFile} onChange={e => dispatch({ type: 'SET_ACTIVE_FILE', payload: e.target.value })}>
          <option value="all">All Files</option>
          {files.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
        </select>
        <select className={styles.select} value={activeType} onChange={e => dispatch({ type: 'SET_ACTIVE_TYPE', payload: e.target.value })}>
          <option value="all">All Types</option>
          <option value="business">Business</option>
          <option value="personal">Personal</option>
          <option value="income">Income</option>
          <option value="uncategorized">Uncategorized</option>
        </select>
        <button className={`${styles.btn} ${styles.btnGreen}`} onClick={handleAdd}><Plus size={14} /> Add</button>
        {totals.uncategorized > 0 && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAICategorize} disabled={categorizing}>
            <Brain size={14} /> {categorizing ? 'Categorizing...' : `AI Categorize (${totals.uncategorized})`}
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Date</th>
              <th>Description</th>
              <th style={{ width: 140 }}>Company</th>
              <th style={{ width: 170 }}>Category</th>
              <th style={{ width: 100 }}>Type</th>
              <th style={{ width: 130 }}>Source</th>
              <th style={{ textAlign: 'right', width: 100 }}>Amount</th>
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const editing = isEditing(t.id)
              const d = editing ? editDraft! : t

              return (
                <tr key={t.id} style={editing ? { background: 'rgba(59,130,246,0.04)' } : undefined}>
                  <td>
                    {editing ? (
                      <input type="date" className={`${styles.input} ${styles.inputMono}`} value={d.date}
                        onChange={e => updateDraft('date', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12 }} />
                    ) : (
                      <span className={styles.mono}>{t.date}</span>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input className={styles.input} value={d.desc}
                        onChange={e => updateDraft('desc', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12 }} />
                    ) : (
                      <span style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{t.desc}</span>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input className={styles.input} value={d.co}
                        onChange={e => updateDraft('co', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12 }} />
                    ) : (
                      t.co
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <select className={styles.select} value={d.cat}
                        onChange={e => updateDraft('cat', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 11 }}>
                        <option value="">— Select —</option>
                        {accounts.map(a => <option key={a.code} value={a.name}>{a.code} {a.name}</option>)}
                      </select>
                    ) : (
                      <><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.code}</span> {t.cat}</>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <select className={styles.select} value={d.type}
                        onChange={e => updateDraft('type', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 11 }}>
                        <option value="business">Business</option>
                        <option value="personal">Personal</option>
                        <option value="income">Income</option>
                        <option value="uncategorized">Uncategorized</option>
                      </select>
                    ) : (
                      <>
                        {typeBadge(t.type)}
                        {t.aiTagged && <span className={`${styles.badge} ${styles.badgeAI}`}>AI</span>}
                      </>
                    )}
                  </td>
                  <td>
                    <span className={styles.sourceChip}>
                      <span className={styles.sourceDot} style={{ background: BANK_COLORS[t.bank] || '#888' }} />
                      {t.bank} {t.account}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editing ? (
                      <input type="number" step="0.01" className={`${styles.input} ${styles.inputMono}`}
                        value={d.amount}
                        onChange={e => updateDraft('amount', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, textAlign: 'right' }} />
                    ) : (
                      <span className={t.amount >= 0 ? styles.amountPos : styles.amountNeg}>{fmtCurrency(t.amount)}</span>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnGreen}`} onClick={saveEdit} title="Save">
                          <Check size={12} />
                        </button>
                        <button className={`${styles.btn} ${styles.btnSmall}`} onClick={cancelEdit} title="Cancel">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => startEdit(t)} title="Edit">
                          <Pencil size={12} />
                        </button>
                        <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnRed}`} onClick={() => handleDelete(t.id)} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
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
    </div>
  )
}
