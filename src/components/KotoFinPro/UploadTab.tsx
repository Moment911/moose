'use client'

import { useCallback, useRef, useState, Dispatch } from 'react'
import { Transaction, StatementFile, KotoFinAction } from './KotoFin.types'
import { loadDemoData, BANK_COLORS } from './KotoFin.constants'
import { categorize } from './KotoFin.utils'
import styles from './KotoFinPro.module.css'

interface UploadTabProps {
  files: StatementFile[]
  transactions: Transaction[]
  dispatch: Dispatch<KotoFinAction>
}

export default function UploadTab({ files, transactions, dispatch }: UploadTabProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const ext = file.name.toLowerCase().split('.').pop()

      if (ext === 'csv') {
        const text = await file.text()
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length <= 1) continue

        const startId = transactions.length + 1
        const newTxns: Transaction[] = []

        for (let j = 1; j < lines.length; j++) {
          const cols = lines[j].split(',').map(c => c.replace(/"/g, '').trim())
          if (cols.length < 3) continue

          const date = cols[0]
          const desc = cols[1]
          const amount = parseFloat(cols[2])
          if (isNaN(amount)) continue

          const cat = categorize(desc)
          newTxns.push({
            id: startId + j - 1,
            file: file.name,
            bank: 'CSV Import',
            account: '••0000',
            range: '',
            date,
            desc,
            amount,
            co: cat.co,
            cat: cat.cat,
            code: cat.code,
            type: cat.type,
            aiTagged: false,
            notes: '',
          })
        }

        if (newTxns.length > 0) {
          dispatch({ type: 'ADD_TRANSACTIONS', payload: newTxns })
          dispatch({
            type: 'ADD_FILE',
            payload: {
              name: file.name,
              bank: 'CSV Import',
              account: '••0000',
              range: '',
              color: '#888888',
              txnCount: newTxns.length,
            },
          })
        }
      } else if (ext === 'pdf') {
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('accountNumber', '••0000')
          formData.append('statementRange', '')
          formData.append('startId', String(transactions.length + 1))

          const res = await fetch('/api/KotoFin/parse-statement', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const data = await res.json()
            if (data.transactions?.length) {
              dispatch({ type: 'ADD_TRANSACTIONS', payload: data.transactions })
              dispatch({ type: 'ADD_FILE', payload: data.meta })
            }
          }
        } catch (err) {
          console.error('PDF parse failed:', err)
        }
      }
    }
    setUploading(false)
  }, [transactions.length, dispatch])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  function handleLoadDemo() {
    const demo = loadDemoData()
    dispatch({ type: 'SET_TRANSACTIONS', payload: demo.transactions })
    dispatch({ type: 'SET_FILES', payload: demo.files })
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'Transactions' })
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Files Imported</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>{files.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total Transactions</div>
          <div className={`${styles.metricValue} ${styles.metricPurple}`}>{transactions.length}</div>
        </div>
      </div>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className={styles.dropzoneIcon}>&#8593;</div>
        <div className={styles.dropzoneText}>
          {uploading ? 'Processing...' : 'Drop PDF or CSV bank statements here'}
        </div>
        <div className={`${styles.textSmall} ${styles.textDim}`} style={{ marginTop: 8 }}>
          Supports Chase, Capital One, Navy Federal, Bank of America, Citibank, and CSV files
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.csv"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files) handleFiles(e.target.files)
          }}
        />
      </div>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleLoadDemo}>
          Load Demo Data (42 transactions)
        </button>
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.cardHeader}>Imported Statements</div>
          {files.map(f => (
            <div key={f.name} className={styles.fileItem}>
              <div className={styles.fileDot} style={{ background: f.color || BANK_COLORS[f.bank] || '#888' }} />
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{f.name}</div>
                <div className={styles.fileMeta}>
                  {f.bank} {f.account} &middot; {f.range} &middot; {f.txnCount} transactions
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
