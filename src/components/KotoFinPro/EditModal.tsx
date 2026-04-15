'use client'

import { useState, useEffect } from 'react'
import { Transaction, COAAccount } from './KotoFin.types'
import styles from './KotoFinPro.module.css'

interface EditModalProps {
  transaction: Transaction | null
  accounts: COAAccount[]
  onSave: (t: Transaction) => void
  onClose: () => void
  nextId?: number
}

export default function EditModal({ transaction, accounts, onSave, onClose, nextId }: EditModalProps) {
  const isNew = !transaction
  const [form, setForm] = useState<Transaction>({
    id: transaction?.id ?? nextId ?? 0,
    file: transaction?.file ?? '',
    bank: transaction?.bank ?? '',
    account: transaction?.account ?? '',
    range: transaction?.range ?? '',
    date: transaction?.date ?? new Date().toISOString().split('T')[0],
    desc: transaction?.desc ?? '',
    amount: transaction?.amount ?? 0,
    co: transaction?.co ?? '',
    cat: transaction?.cat ?? '',
    code: transaction?.code ?? '',
    type: transaction?.type ?? 'uncategorized',
    aiTagged: transaction?.aiTagged ?? false,
    notes: transaction?.notes ?? '',
  })

  useEffect(() => {
    if (transaction) {
      setForm(transaction)
    }
  }, [transaction])

  function handleCategoryChange(code: string) {
    const acct = accounts.find(a => a.code === code)
    if (acct) {
      setForm(f => ({
        ...f,
        code: acct.code,
        cat: acct.name,
        type: acct.type === 'personal' ? 'personal' : acct.type === 'income' ? 'income' : acct.type === 'expense' ? 'business' : f.type,
      }))
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>{isNew ? 'Add Transaction' : 'Edit Transaction'}</div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Date</label>
            <input
              type="date"
              className={`${styles.input} ${styles.inputMono}`}
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Amount</label>
            <input
              type="number"
              step="0.01"
              className={`${styles.input} ${styles.inputMono}`}
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Description</label>
          <input
            type="text"
            className={styles.input}
            value={form.desc}
            onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Company / Merchant</label>
            <input
              type="text"
              className={styles.input}
              value={form.co}
              onChange={e => setForm(f => ({ ...f, co: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Account Number</label>
            <input
              type="text"
              className={styles.input}
              value={form.account}
              onChange={e => setForm(f => ({ ...f, account: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Statement File</label>
            <input
              type="text"
              className={styles.input}
              value={form.file}
              onChange={e => setForm(f => ({ ...f, file: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Statement Date Range</label>
            <input
              type="text"
              className={styles.input}
              value={form.range}
              onChange={e => setForm(f => ({ ...f, range: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Category</label>
            <select
              className={styles.select}
              value={form.code}
              onChange={e => handleCategoryChange(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">— Select —</option>
              {accounts.map(a => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Type</label>
            <select
              className={styles.select}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as Transaction['type'] }))}
              style={{ width: '100%' }}
            >
              <option value="business">Business</option>
              <option value="personal">Personal</option>
              <option value="income">Income</option>
              <option value="uncategorized">Uncategorized</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Notes</label>
          <textarea
            className={styles.textarea}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>

        <div className={styles.formActions}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onSave(form)}>
            {isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
