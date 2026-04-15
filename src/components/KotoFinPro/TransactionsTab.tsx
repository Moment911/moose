'use client'

import { useState, useMemo, Dispatch } from 'react'
import { Transaction, COAAccount, StatementFile, KotoFinAction } from './KotoFin.types'
import { fmtCurrency, getTransactionTotals } from './KotoFin.utils'
import { BANK_COLORS } from './KotoFin.constants'
import { Check, X, Pencil, Trash2, Plus, Brain, Split } from 'lucide-react'
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
  const [splittingId, setSplittingId] = useState<number | null>(null)
  const [splitAmounts, setSplitAmounts] = useState<Array<{ amount: number; cat: string; code: string; type: Transaction['type'] }>>([])

  function startSplit(t: Transaction) {
    setSplittingId(t.id)
    const half = Math.abs(t.amount) / 2
    setSplitAmounts([
      { amount: -half, cat: t.cat, code: t.code, type: t.type },
      { amount: -(Math.abs(t.amount) - half), cat: '', code: '', type: 'uncategorized' },
    ])
  }

  function executeSplit(original: Transaction) {
    const newTxns: Transaction[] = splitAmounts.map((s, i) => ({
      ...original,
      id: Math.max(0, ...transactions.map(t => t.id)) + 1 + i,
      amount: s.amount,
      cat: s.cat || original.cat,
      code: s.code || original.code,
      type: s.type,
      desc: `${original.desc} (split ${i + 1}/${splitAmounts.length})`,
      notes: `Split from txn #${original.id}`,
    }))
    dispatch({ type: 'DELETE_TRANSACTION', payload: original.id })
    dispatch({ type: 'ADD_TRANSACTIONS', payload: newTxns })
    setSplittingId(null)
    setSplitAmounts([])
  }

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

              const splitting = splittingId === t.id

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
                        <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => startSplit(t)} title="Split">
                          <Split size={12} />
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
            {splittingId && filtered.find(t => t.id === splittingId) && (() => {
              const orig = filtered.find(t => t.id === splittingId)!
              const totalSplit = splitAmounts.reduce((s, a) => s + Math.abs(a.amount), 0)
              const remaining = Math.abs(orig.amount) - totalSplit
              return (
                <tr key={`split-${splittingId}`} style={{ background: 'rgba(139,92,246,0.04)' }}>
                  <td colSpan={8} style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Split size={14} color="#8b5cf6" />
                      Split: {orig.co || orig.desc.substring(0, 30)} ({fmtCurrency(orig.amount)})
                    </div>
                    {splitAmounts.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 20 }}>#{i + 1}</span>
                        <input type="number" step="0.01" className={`${styles.input} ${styles.inputMono}`}
                          value={Math.abs(s.amount)} style={{ width: 100, padding: '4px 6px', fontSize: 12 }}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            setSplitAmounts(prev => prev.map((p, j) => j === i ? { ...p, amount: -val } : p))
                          }} />
                        <select className={styles.select} value={s.cat} style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                          onChange={e => {
                            const acct = accounts.find(a => a.name === e.target.value)
                            setSplitAmounts(prev => prev.map((p, j) => j === i ? {
                              ...p, cat: e.target.value,
                              code: acct?.code || '', type: acct?.type === 'personal' ? 'personal' : acct?.type === 'income' ? 'income' : 'business',
                            } : p))
                          }}>
                          <option value="">— Category —</option>
                          {accounts.map(a => <option key={a.code} value={a.name}>{a.code} {a.name}</option>)}
                        </select>
                        {splitAmounts.length > 2 && (
                          <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnRed}`}
                            onClick={() => setSplitAmounts(prev => prev.filter((_, j) => j !== i))}>
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                      <button className={`${styles.btn} ${styles.btnSmall}`}
                        onClick={() => setSplitAmounts(prev => [...prev, { amount: 0, cat: '', code: '', type: 'uncategorized' }])}>
                        <Plus size={10} /> Add Split
                      </button>
                      {Math.abs(remaining) > 0.01 && (
                        <span style={{ fontSize: 11, color: 'var(--amber)' }}>
                          {fmtCurrency(Math.abs(remaining))} unallocated
                        </span>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => { setSplittingId(null); setSplitAmounts([]) }}>Cancel</button>
                        <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
                          onClick={() => executeSplit(orig)}
                          disabled={Math.abs(remaining) > 0.01 || splitAmounts.some(s => !s.cat)}>
                          <Check size={10} /> Apply Split
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })()}
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
