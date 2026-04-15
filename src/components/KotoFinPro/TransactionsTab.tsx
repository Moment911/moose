'use client'

import React, { useState, useMemo, Dispatch, useRef, useEffect } from 'react'
import { Transaction, COAAccount, StatementFile, KotoFinAction } from './KotoFin.types'
import { fmtCurrency, getTransactionTotals } from './KotoFin.utils'
import { BANK_COLORS } from './KotoFin.constants'
import { Check, X, Trash2, Plus, Brain, Split } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface TransactionsTabProps {
  transactions: Transaction[]
  accounts: COAAccount[]
  files: StatementFile[]
  activeFile: string
  activeType: string
  dispatch: Dispatch<KotoFinAction>
}

// Click-to-edit cell
function EditableCell({ value, field, txn, dispatch, type = 'text', mono = false, accounts }: {
  value: string | number
  field: keyof Transaction
  txn: Transaction
  dispatch: Dispatch<KotoFinAction>
  type?: 'text' | 'number' | 'date' | 'select-cat' | 'select-type'
  mono?: boolean
  accounts?: COAAccount[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  function save() {
    let updated: Partial<Transaction> = {}

    if (field === 'amount') {
      updated = { amount: parseFloat(draft) || 0 }
    } else if (field === 'cat' && accounts) {
      const acct = accounts.find(a => a.name === draft)
      if (acct) {
        updated = {
          cat: acct.name,
          code: acct.code,
          type: acct.type === 'personal' ? 'personal' : acct.type === 'income' ? 'income' : acct.type === 'expense' ? 'business' : txn.type,
        }
      } else {
        updated = { cat: draft }
      }
    } else if (field === 'type') {
      updated = { type: draft as Transaction['type'] }
    } else {
      updated = { [field]: draft }
    }

    dispatch({ type: 'UPDATE_TRANSACTION', payload: { ...txn, ...updated } })
    setEditing(false)
  }

  function cancel() {
    setDraft(String(value))
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(String(value)); setEditing(true); setSearch('') }}
        style={{
          cursor: 'pointer', borderRadius: 4, padding: '2px 4px', margin: '-2px -4px',
          display: 'block', minHeight: 20,
          fontFamily: mono ? 'var(--mono)' : undefined,
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--surface2)')}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
        title="Click to edit"
      >
        {type === 'number' ? fmtCurrency(value as number) : value || <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>}
      </span>
    )
  }

  if (type === 'select-cat' && accounts) {
    const filtered = search
      ? accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
      : accounts
    return (
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className={`${styles.input}`}
          value={search || draft}
          onChange={e => { setSearch(e.target.value); setDraft(e.target.value) }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(cancel, 200)}
          style={{ width: '100%', padding: '3px 6px', fontSize: 11 }}
          placeholder="Search categories..."
        />
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        }}>
          {filtered.map(a => (
            <div key={a.code}
              style={{ padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              onMouseDown={e => {
                e.preventDefault()
                setDraft(a.name)
                const acct = a
                dispatch({
                  type: 'UPDATE_TRANSACTION',
                  payload: {
                    ...txn,
                    cat: acct.name,
                    code: acct.code,
                    type: acct.type === 'personal' ? 'personal' : acct.type === 'income' ? 'income' : acct.type === 'expense' ? 'business' : txn.type,
                  },
                })
                setEditing(false)
              }}>
              <span style={{ color: 'var(--text-dim)', marginRight: 6 }}>{a.code}</span> {a.name}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'select-type') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        className={styles.select}
        value={draft}
        onChange={e => { setDraft(e.target.value); dispatch({ type: 'UPDATE_TRANSACTION', payload: { ...txn, type: e.target.value as Transaction['type'] } }); setEditing(false) }}
        onBlur={cancel}
        style={{ width: '100%', padding: '3px 6px', fontSize: 11 }}
      >
        <option value="business">Business</option>
        <option value="personal">Personal</option>
        <option value="income">Income</option>
        <option value="uncategorized">Uncategorized</option>
      </select>
    )
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      className={`${styles.input} ${mono ? styles.inputMono : ''}`}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      step={type === 'number' ? '0.01' : undefined}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={save}
      style={{ width: '100%', padding: '3px 6px', fontSize: 12 }}
    />
  )
}

export default function TransactionsTab({ transactions, accounts, files, activeFile, activeType, dispatch }: TransactionsTabProps) {
  const [search, setSearch] = useState('')
  const [categorizing, setCategorizing] = useState(false)
  const [splittingId, setSplittingId] = useState<number | null>(null)
  const [splitAmounts, setSplitAmounts] = useState<Array<{ amount: number; cat: string; code: string; type: Transaction['type'] }>>([])

  const filtered = useMemo(() => {
    let list = transactions
    if (activeFile !== 'all') list = list.filter(t => t.file === activeFile)
    if (activeType !== 'all') list = list.filter(t => t.type === activeType)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.desc.toLowerCase().includes(q) || t.co.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q))
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, activeFile, activeType, search])

  const totals = getTransactionTotals(transactions)

  function handleAdd() {
    const newId = Math.max(0, ...transactions.map(t => t.id)) + 1
    dispatch({ type: 'ADD_TRANSACTIONS', payload: [{
      id: newId, file: '', bank: '', account: '', range: '',
      date: new Date().toISOString().split('T')[0], desc: 'New transaction', amount: 0,
      co: '', cat: '', code: '', type: 'uncategorized', aiTagged: false, notes: '',
    }] })
  }

  function startSplit(t: Transaction) {
    setSplittingId(t.id)
    const half = Math.round(Math.abs(t.amount) * 100 / 2) / 100
    setSplitAmounts([
      { amount: -half, cat: t.cat, code: t.code, type: t.type },
      { amount: -(Math.abs(t.amount) - half), cat: '', code: '', type: 'uncategorized' },
    ])
  }

  function executeSplit(original: Transaction) {
    const baseId = Math.max(0, ...transactions.map(t => t.id)) + 1
    const newTxns = splitAmounts.map((s, i) => ({
      ...original,
      id: baseId + i,
      amount: s.amount,
      cat: s.cat || original.cat,
      code: s.code || original.code,
      type: s.type,
      desc: `${original.desc} (split ${i + 1}/${splitAmounts.length})`,
      notes: `Split from #${original.id}`,
    }))
    dispatch({ type: 'DELETE_TRANSACTION', payload: original.id })
    dispatch({ type: 'ADD_TRANSACTIONS', payload: newTxns })
    setSplittingId(null)
  }

  async function handleAICategorize() {
    const uncategorized = transactions.filter(t => t.type === 'uncategorized')
    if (!uncategorized.length) return
    setCategorizing(true)
    try {
      const res = await fetch('/api/KotoFin/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: uncategorized.map(t => ({ id: t.id, desc: t.desc, amount: t.amount })) }),
      })
      if (res.ok) {
        const data = await res.json()
        for (const r of data.results) {
          const txn = transactions.find(t => t.id === r.id)
          if (txn) dispatch({ type: 'UPDATE_TRANSACTION', payload: { ...txn, co: r.co || txn.co, cat: r.cat || txn.cat, type: r.type || txn.type, code: r.code || txn.code, aiTagged: !data.fallback } })
        }
      }
    } catch (err) { console.error(err) }
    setCategorizing(false)
  }

  const typeBadge = (type: string) => {
    const cls = type === 'business' ? styles.badgeBusiness : type === 'personal' ? styles.badgePersonal : type === 'income' ? styles.badgeIncome : styles.badgeUncategorized
    return <span className={`${styles.badge} ${cls}`}>{type}</span>
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}><div className={styles.metricLabel}>Income</div><div className={`${styles.metricValue} ${styles.metricGreen}`}>{fmtCurrency(totals.income)}</div></div>
        <div className={styles.metric}><div className={styles.metricLabel}>Business Expenses</div><div className={`${styles.metricValue} ${styles.metricRed}`}>{fmtCurrency(totals.bizExp)}</div></div>
        <div className={styles.metric}><div className={styles.metricLabel}>Personal</div><div className={`${styles.metricValue} ${styles.metricPurple}`}>{fmtCurrency(totals.personalExp)}</div></div>
        <div className={styles.metric}><div className={styles.metricLabel}>Uncategorized</div><div className={`${styles.metricValue} ${styles.metricAmber}`}>{totals.uncategorized}</div></div>
      </div>

      <div className={styles.filterBar}>
        <input className={styles.input} placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
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
        <table className={styles.table} style={{ tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 85 }}>Date</th>
              <th style={{ minWidth: 180 }}>Description</th>
              <th style={{ minWidth: 120 }}>Company</th>
              <th style={{ minWidth: 150 }}>Category</th>
              <th style={{ minWidth: 90 }}>Type</th>
              <th style={{ minWidth: 110 }}>Source</th>
              <th style={{ textAlign: 'right', minWidth: 90 }}>Amount</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <React.Fragment key={t.id}>
                <tr>
                  <td><EditableCell value={t.date} field="date" txn={t} dispatch={dispatch} type="date" mono /></td>
                  <td><EditableCell value={t.desc} field="desc" txn={t} dispatch={dispatch} /></td>
                  <td><EditableCell value={t.co} field="co" txn={t} dispatch={dispatch} /></td>
                  <td><EditableCell value={t.cat} field="cat" txn={t} dispatch={dispatch} type="select-cat" accounts={accounts} /></td>
                  <td>
                    <EditableCell value={t.type} field="type" txn={t} dispatch={dispatch} type="select-type" />
                    {t.aiTagged && <span className={`${styles.badge} ${styles.badgeAI}`}>AI</span>}
                  </td>
                  <td>
                    <span className={styles.sourceChip}>
                      <span className={styles.sourceDot} style={{ background: BANK_COLORS[t.bank] || '#888' }} />
                      {t.bank} {t.account}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <EditableCell value={t.amount} field="amount" txn={t} dispatch={dispatch} type="number" mono />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => startSplit(t)} title="Split"><Split size={12} /></button>
                      <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnRed}`} onClick={() => dispatch({ type: 'DELETE_TRANSACTION', payload: t.id })} title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
                {splittingId === t.id && (() => {
                  const totalSplit = splitAmounts.reduce((s, a) => s + Math.abs(a.amount), 0)
                  const remaining = Math.abs(t.amount) - totalSplit
                  return (
                    <tr style={{ background: 'rgba(139,92,246,0.04)' }}>
                      <td colSpan={8} style={{ padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Split size={14} color="#8b5cf6" /> Split: {t.co || t.desc.substring(0, 30)} ({fmtCurrency(t.amount)})
                        </div>
                        {splitAmounts.map((s, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 20 }}>#{i + 1}</span>
                            <input type="number" step="0.01" className={`${styles.input} ${styles.inputMono}`}
                              value={Math.abs(s.amount)} style={{ width: 100, padding: '4px 6px', fontSize: 12 }}
                              onChange={e => setSplitAmounts(prev => prev.map((p, j) => j === i ? { ...p, amount: -parseFloat(e.target.value || '0') } : p))} />
                            <select className={styles.select} value={s.cat} style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                              onChange={e => {
                                const acct = accounts.find(a => a.name === e.target.value)
                                setSplitAmounts(prev => prev.map((p, j) => j === i ? {
                                  ...p, cat: e.target.value, code: acct?.code || '',
                                  type: acct?.type === 'personal' ? 'personal' : acct?.type === 'income' ? 'income' : 'business',
                                } : p))
                              }}>
                              <option value="">— Category —</option>
                              {accounts.map(a => <option key={a.code} value={a.name}>{a.code} {a.name}</option>)}
                            </select>
                            {splitAmounts.length > 2 && (
                              <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnRed}`} onClick={() => setSplitAmounts(prev => prev.filter((_, j) => j !== i))}><X size={10} /></button>
                            )}
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                          <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setSplitAmounts(prev => [...prev, { amount: 0, cat: '', code: '', type: 'uncategorized' }])}><Plus size={10} /> Add</button>
                          {Math.abs(remaining) > 0.01 && <span style={{ fontSize: 11, color: 'var(--amber)' }}>{fmtCurrency(Math.abs(remaining))} unallocated</span>}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setSplittingId(null)}>Cancel</button>
                            <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} onClick={() => executeSplit(t)} disabled={Math.abs(remaining) > 0.01 || splitAmounts.some(sp => !sp.cat)}><Check size={10} /> Apply</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })()}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className={styles.textCenter} style={{ padding: 40, color: 'var(--text-dim)' }}>No transactions found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.textDim} style={{ marginTop: 8, fontSize: 12 }}>
        Showing {filtered.length} of {transactions.length} &middot; Click any cell to edit
      </div>
    </div>
  )
}
