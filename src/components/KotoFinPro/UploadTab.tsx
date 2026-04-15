'use client'

import { useCallback, useRef, useState, Dispatch } from 'react'
import { Transaction, StatementFile, KotoFinAction } from './KotoFin.types'
import { BANK_COLORS } from './KotoFin.constants'
import { categorize } from './KotoFin.utils'
import { Upload, AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface UploadTabProps {
  files: StatementFile[]
  transactions: Transaction[]
  dispatch: Dispatch<KotoFinAction>
}

interface UploadStatus {
  id: string
  file: string
  status: 'uploading' | 'success' | 'error' | 'duplicate'
  message: string
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

let globalNextId = 1

export default function UploadTab({ files, transactions, dispatch }: UploadTabProps) {
  const [dragging, setDragging] = useState(false)
  const [statuses, setStatuses] = useState<UploadStatus[]>([])
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const processedHashes = useRef<Set<string>>(new Set())

  // Sync globalNextId with current transactions
  if (transactions.length > 0) {
    globalNextId = Math.max(globalNextId, Math.max(...transactions.map(t => t.id)) + 1)
  }

  function updateStatus(id: string, update: Partial<UploadStatus>) {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...update } : s))
  }

  const handleFiles = useCallback(async (fileList: FileList) => {
    setStatuses([])
    setProcessing(true)

    const filesToProcess: Array<{ file: File; id: string; hash: string }> = []

    // Phase 1: hash all files and check duplicates
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const id = `${file.name}-${i}-${Date.now()}`

      let fileHash: string
      try {
        fileHash = await hashFile(file)
      } catch {
        fileHash = `${file.name}-${file.size}-${file.lastModified}`
      }

      if (processedHashes.current.has(fileHash)) {
        setStatuses(prev => [...prev, {
          id, file: file.name, status: 'duplicate',
          message: 'Already uploaded — content matches a previous import',
        }])
        continue
      }

      setStatuses(prev => [...prev, { id, file: file.name, status: 'uploading', message: 'Processing...' }])
      filesToProcess.push({ file, id, hash: fileHash })
    }

    // Phase 2: process all files (parallel for PDFs via Promise.all)
    const results = await Promise.allSettled(
      filesToProcess.map(async ({ file, id, hash }) => {
        const ext = file.name.toLowerCase().split('.').pop()

        if (ext === 'csv') {
          return processCSV(file, id, hash)
        } else if (ext === 'pdf') {
          return processPDF(file, id, hash)
        } else {
          updateStatus(id, { status: 'error', message: `Unsupported file type: .${ext}` })
          return null
        }
      })
    )

    // Phase 3: dispatch all successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { txns, fileMeta, id, hash } = result.value
        if (txns.length > 0) {
          processedHashes.current.add(hash)
          dispatch({ type: 'ADD_TRANSACTIONS', payload: txns })
          dispatch({ type: 'ADD_FILE', payload: fileMeta })
          updateStatus(id, { status: 'success', message: `${txns.length} transactions from ${fileMeta.bank} (${fileMeta.account})` })
        }
      }
    }

    setProcessing(false)
  }, [dispatch])

  async function processCSV(file: File, id: string, hash: string) {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length <= 1) {
        updateStatus(id, { status: 'error', message: 'CSV is empty or has only headers' })
        return null
      }

      const startId = globalNextId
      const newTxns: Transaction[] = []

      for (let j = 1; j < lines.length; j++) {
        const cols = lines[j].split(',').map(c => c.replace(/"/g, '').trim())
        if (cols.length < 3) continue
        const amount = parseFloat(cols[2])
        if (isNaN(amount)) continue

        const cat = categorize(cols[1])
        newTxns.push({
          id: startId + newTxns.length,
          file: file.name, bank: 'CSV Import', account: '••0000', range: '',
          date: cols[0], desc: cols[1], amount,
          co: cat.co, cat: cat.cat, code: cat.code, type: cat.type,
          aiTagged: false, notes: '',
        })
      }

      globalNextId = startId + newTxns.length

      if (newTxns.length === 0) {
        updateStatus(id, { status: 'error', message: 'No transactions found. Expected: Date, Description, Amount' })
        return null
      }

      return {
        txns: newTxns,
        fileMeta: { name: file.name, bank: 'CSV Import', account: '••0000', range: '', color: '#888888', txnCount: newTxns.length },
        id, hash,
      }
    } catch (err) {
      updateStatus(id, { status: 'error', message: `CSV error: ${err instanceof Error ? err.message : 'Unknown'}` })
      return null
    }
  }

  async function processPDF(file: File, id: string, hash: string) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountNumber', '••0000')
      formData.append('statementRange', '')
      formData.append('startId', String(globalNextId))

      const res = await fetch('/api/KotoFin/parse-statement', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || data.error) {
        updateStatus(id, { status: 'error', message: data.error || 'Server error parsing PDF' })
        return null
      }

      if (!data.transactions?.length) {
        updateStatus(id, { status: 'error', message: 'PDF parsed but 0 transactions found. Bank format may not be recognized, or PDF is scanned.' })
        return null
      }

      // Reassign IDs to avoid collisions
      const txns = data.transactions.map((t: Transaction, i: number) => ({
        ...t,
        id: globalNextId + i,
      }))
      globalNextId += txns.length

      return { txns, fileMeta: data.meta, id, hash }
    } catch (err) {
      updateStatus(id, { status: 'error', message: `Upload failed: ${err instanceof Error ? err.message : 'Network error'}` })
      return null
    }
  }

  function handleDeleteStatement(fileName: string) {
    const remaining = transactions.filter(t => t.file !== fileName)
    dispatch({ type: 'SET_TRANSACTIONS', payload: remaining })
    dispatch({ type: 'SET_FILES', payload: files.filter(f => f.name !== fileName) })
    processedHashes.current.delete(fileName)
    setStatuses(prev => [...prev, { id: `del-${fileName}`, file: fileName, status: 'success', message: 'Statement and all linked transactions deleted' }])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
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
        onClick={() => !processing && fileRef.current?.click()}
        style={processing ? { opacity: 0.5, pointerEvents: 'none' } : {}}
      >
        <div className={styles.dropzoneIcon}>
          {processing ? <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={36} />}
        </div>
        <div className={styles.dropzoneText}>
          {processing ? 'Processing files...' : 'Drop PDF or CSV bank statements here'}
        </div>
        <div className={`${styles.textSmall} ${styles.textDim}`} style={{ marginTop: 8 }}>
          Chase, Capital One, Navy Federal, BofA, Citibank, Wells Fargo, Amex, US Bank, PNC, TD Bank, Discover, and CSV
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.csv"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {statuses.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {statuses.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 8, fontSize: 13,
              background: s.status === 'success' ? 'rgba(34,197,94,0.06)' : s.status === 'error' ? 'rgba(239,68,68,0.06)' : s.status === 'duplicate' ? 'rgba(245,158,11,0.06)' : 'var(--surface2)',
              border: `1px solid ${s.status === 'success' ? 'rgba(34,197,94,0.2)' : s.status === 'error' ? 'rgba(239,68,68,0.2)' : s.status === 'duplicate' ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
            }}>
              {s.status === 'uploading' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
              {s.status === 'success' && <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0 }} />}
              {s.status === 'error' && <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />}
              {s.status === 'duplicate' && <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{s.file}</span>
                <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{s.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.cardHeader}>Imported Statements</div>
          {files.map(f => {
            const linkedTxns = transactions.filter(t => t.file === f.name).length
            return (
              <div key={f.name} className={styles.fileItem}>
                <div className={styles.fileDot} style={{ background: f.color || BANK_COLORS[f.bank] || '#888' }} />
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{f.name}</div>
                  <div className={styles.fileMeta}>
                    {f.bank} {f.account} &middot; {f.range} &middot; {linkedTxns} transactions
                  </div>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnSmall} ${styles.btnRed}`}
                  onClick={() => handleDeleteStatement(f.name)}
                  title={`Delete ${f.name} and ${linkedTxns} linked transactions`}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
