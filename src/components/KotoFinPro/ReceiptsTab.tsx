'use client'

import { useState, useRef, Dispatch } from 'react'
import { Transaction, KotoFinAction } from './KotoFin.types'
import { fmtCurrency } from './KotoFin.utils'
import { Camera, CheckCircle2, AlertCircle, Loader2, Plus, Link2 } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface ReceiptsTabProps {
  transactions: Transaction[]
  dispatch: Dispatch<KotoFinAction>
}

interface ScannedReceipt {
  merchant: string
  date: string
  amount: number
  items: string[]
  category_suggestion: string
  tax: number
  payment_method: string
  confidence: string
  matchedTxnId?: number
  fileName: string
}

const CAT_TO_CODE: Record<string, { code: string; type: 'business' | 'personal' }> = {
  'Office Expense': { code: '5210', type: 'business' },
  'Meals': { code: '5280', type: 'business' },
  'Travel': { code: '5270', type: 'business' },
  'Software & Subscriptions': { code: '5320', type: 'business' },
  'Supplies': { code: '5250', type: 'business' },
  'Advertising': { code: '5100', type: 'business' },
  'Utilities': { code: '5290', type: 'business' },
  'Insurance': { code: '5170', type: 'business' },
  'Car & Truck Expenses': { code: '5110', type: 'business' },
  'Shipping & Postage': { code: '5340', type: 'business' },
  'Personal Expense': { code: '5900', type: 'personal' },
}

export default function ReceiptsTab({ transactions, dispatch }: ReceiptsTabProps) {
  const [scanning, setScanning] = useState(false)
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function findMatch(receipt: ScannedReceipt): Transaction | undefined {
    const amt = Math.abs(receipt.amount)
    return transactions.find(t => {
      const tAmt = Math.abs(t.amount)
      const amtClose = Math.abs(tAmt - amt) < 0.02
      const dateMatch = t.date === receipt.date
      const merchantMatch = t.desc.toLowerCase().includes(receipt.merchant.toLowerCase().substring(0, 6)) ||
        t.co.toLowerCase().includes(receipt.merchant.toLowerCase().substring(0, 6))
      return (amtClose && dateMatch) || (amtClose && merchantMatch) || (dateMatch && merchantMatch)
    })
  }

  async function handleScan(fileList: FileList) {
    setScanning(true)
    setError('')

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image`)
        continue
      }

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/KotoFin/scan-receipt', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error || 'Scan failed')
          continue
        }

        const receipt: ScannedReceipt = { ...data.receipt, fileName: file.name }
        const match = findMatch(receipt)
        if (match) receipt.matchedTxnId = match.id

        setReceipts(prev => [...prev, receipt])
      } catch (err) {
        setError(`Failed to scan ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    setScanning(false)
  }

  function createTransaction(receipt: ScannedReceipt) {
    const catInfo = CAT_TO_CODE[receipt.category_suggestion] || { code: '5210', type: 'business' as const }
    const newId = Math.max(0, ...transactions.map(t => t.id)) + 1
    dispatch({
      type: 'ADD_TRANSACTIONS',
      payload: [{
        id: newId,
        file: `Receipt: ${receipt.fileName}`,
        bank: 'Receipt',
        account: receipt.payment_method || '••0000',
        range: '',
        date: receipt.date,
        desc: receipt.items.length > 0 ? receipt.items.join(', ') : receipt.merchant,
        amount: receipt.amount,
        co: receipt.merchant,
        cat: receipt.category_suggestion,
        code: catInfo.code,
        type: catInfo.type,
        aiTagged: true,
        notes: `Scanned from receipt. Tax: ${fmtCurrency(receipt.tax)}. Confidence: ${receipt.confidence}`,
      }],
    })
    setReceipts(prev => prev.map(r => r === receipt ? { ...r, matchedTxnId: newId } : r))
  }

  function linkToTransaction(receipt: ScannedReceipt, txnId: number) {
    const txn = transactions.find(t => t.id === txnId)
    if (txn) {
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: {
          ...txn,
          co: receipt.merchant || txn.co,
          notes: `${txn.notes} | Receipt: ${receipt.fileName}, Items: ${receipt.items.join(', ')}`.trim(),
        },
      })
      setReceipts(prev => prev.map(r => r === receipt ? { ...r, matchedTxnId: txnId } : r))
    }
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Receipts Scanned</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>{receipts.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Matched to Transactions</div>
          <div className={`${styles.metricValue} ${styles.metricGreen}`}>{receipts.filter(r => r.matchedTxnId).length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Unmatched</div>
          <div className={`${styles.metricValue} ${styles.metricAmber}`}>{receipts.filter(r => !r.matchedTxnId).length}</div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple={true} style={{ display: 'none' }}
        onChange={e => { if (e.target.files) handleScan(e.target.files); e.target.value = '' }} />

      <div className={styles.dropzone} onClick={() => !scanning && fileRef.current?.click()}
        style={scanning ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
        <div className={styles.dropzoneIcon}>
          {scanning ? <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={36} />}
        </div>
        <div className={styles.dropzoneText}>
          {scanning ? 'Scanning receipt...' : 'Upload receipt photos to scan'}
        </div>
        <div className={`${styles.textSmall} ${styles.textDim}`} style={{ marginTop: 8 }}>
          JPEG, PNG, HEIC, WebP. AI extracts merchant, date, amount, and line items. Auto-matches to existing transactions.
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <AlertCircle size={14} color="#ef4444" /> {error}
        </div>
      )}

      {receipts.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {receipts.map((r, i) => {
            const matched = !!r.matchedTxnId
            const matchedTxn = r.matchedTxnId ? transactions.find(t => t.id === r.matchedTxnId) : undefined
            return (
              <div key={i} className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{r.merchant}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                      {r.date} &middot; {r.payment_method || 'Unknown payment'} &middot;
                      <span className={`${styles.badge} ${r.confidence === 'high' ? styles.badgeBusiness : r.confidence === 'medium' ? styles.badgeUncategorized : styles.badgePersonal}`} style={{ marginLeft: 6 }}>
                        {r.confidence} confidence
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 600, color: 'var(--red)' }}>
                    {fmtCurrency(r.amount)}
                  </div>
                </div>

                {r.items.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6 }}>
                    {r.items.map((item, j) => <div key={j}>&bull; {item}</div>)}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span className={`${styles.badge} ${styles.badgeBusiness}`}>{r.category_suggestion}</span>
                  {r.tax > 0 && <span className={styles.textDim}>Tax: {fmtCurrency(r.tax)}</span>}
                </div>

                {matched ? (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <CheckCircle2 size={14} color="#22c55e" />
                    <span>Matched to: <strong>{matchedTxn?.co || matchedTxn?.desc.substring(0, 40)}</strong> ({fmtCurrency(matchedTxn?.amount || 0)})</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} onClick={() => createTransaction(r)}>
                      <Plus size={12} /> Create Transaction
                    </button>
                    {transactions.length > 0 && (
                      <select className={styles.select} style={{ fontSize: 11, padding: '4px 8px' }}
                        defaultValue=""
                        onChange={e => { if (e.target.value) linkToTransaction(r, parseInt(e.target.value)) }}>
                        <option value="">Link to existing...</option>
                        {transactions
                          .filter(t => Math.abs(Math.abs(t.amount) - Math.abs(r.amount)) < 5)
                          .slice(0, 20)
                          .map(t => <option key={t.id} value={t.id}>{t.date} {t.co || t.desc.substring(0, 30)} {fmtCurrency(t.amount)}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
