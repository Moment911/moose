'use client'

import { useCallback, useRef, useState, Dispatch } from 'react'
import { Transaction, StatementFile, KotoFinAction } from './KotoFin.types'
import { BANK_COLORS } from './KotoFin.constants'
import { categorize } from './KotoFin.utils'
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface UploadTabProps {
  files: StatementFile[]
  transactions: Transaction[]
  dispatch: Dispatch<KotoFinAction>
}

interface UploadStatus {
  file: string
  status: 'uploading' | 'success' | 'error' | 'duplicate'
  message: string
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function UploadTab({ files, transactions, dispatch }: UploadTabProps) {
  const [dragging, setDragging] = useState(false)
  const [statuses, setStatuses] = useState<UploadStatus[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const processedHashes = useRef<Set<string>>(new Set())

  // Build hash set from existing files on first render
  if (processedHashes.current.size === 0 && files.length > 0) {
    files.forEach(f => processedHashes.current.add(f.name))
  }

  const addStatus = (s: UploadStatus) => {
    setStatuses(prev => [...prev, s])
  }

  const handleFiles = useCallback(async (fileList: FileList) => {
    setStatuses([])

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const ext = file.name.toLowerCase().split('.').pop()

      // Duplicate detection: hash the file content
      let fileHash: string
      try {
        fileHash = await hashFile(file)
      } catch {
        fileHash = `${file.name}-${file.size}-${file.lastModified}`
      }

      // Check if we already have this exact file content
      if (processedHashes.current.has(fileHash)) {
        addStatus({
          file: file.name,
          status: 'duplicate',
          message: `Already uploaded — this file's content matches a previously imported statement. Same filename with different content (e.g. different year) will still import.`,
        })
        continue
      }

      addStatus({ file: file.name, status: 'uploading', message: 'Processing...' })

      if (ext === 'csv') {
        try {
          const text = await file.text()
          const lines = text.split('\n').filter(l => l.trim())
          if (lines.length <= 1) {
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: 'CSV file is empty or has only headers' } : s))
            continue
          }

          const startId = Math.max(0, ...transactions.map(t => t.id)) + 1
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
              id: startId + newTxns.length,
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
            processedHashes.current.add(fileHash)
            dispatch({ type: 'ADD_TRANSACTIONS', payload: newTxns })
            dispatch({
              type: 'ADD_FILE',
              payload: { name: file.name, bank: 'CSV Import', account: '••0000', range: '', color: '#888888', txnCount: newTxns.length },
            })
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'success', message: `${newTxns.length} transactions imported` } : s))
          } else {
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: 'No transactions found in CSV. Expected format: Date, Description, Amount' } : s))
          }
        } catch (err) {
          setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: `CSV parse error: ${err instanceof Error ? err.message : 'Unknown error'}` } : s))
        }
      } else if (ext === 'pdf') {
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('accountNumber', '••0000')
          formData.append('statementRange', '')
          formData.append('startId', String(Math.max(0, ...transactions.map(t => t.id)) + 1))

          const res = await fetch('/api/KotoFin/parse-statement', {
            method: 'POST',
            body: formData,
          })

          const data = await res.json()

          if (!res.ok) {
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: data.error || 'Server error parsing PDF' } : s))
            continue
          }

          if (data.error) {
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: data.error } : s))
            continue
          }

          if (data.transactions?.length > 0) {
            processedHashes.current.add(fileHash)
            dispatch({ type: 'ADD_TRANSACTIONS', payload: data.transactions })
            dispatch({ type: 'ADD_FILE', payload: data.meta })
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'success', message: `${data.transactions.length} transactions from ${data.meta?.bank || 'Unknown'} (${data.meta?.account || ''})` } : s))
          } else {
            setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: `PDF parsed but 0 transactions found. The bank format may not be recognized, or the PDF may be image-based (scanned).` } : s))
          }
        } catch (err) {
          setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: `Upload failed: ${err instanceof Error ? err.message : 'Network error'}` } : s))
        }
      } else {
        setStatuses(prev => prev.map(s => s.file === file.name ? { ...s, status: 'error', message: `Unsupported file type: .${ext}. Use PDF or CSV.` } : s))
      }
    }
  }, [transactions, dispatch])

  function handleDeleteStatement(fileName: string) {
    // Remove all transactions tied to this statement
    const remaining = transactions.filter(t => t.file !== fileName)
    dispatch({ type: 'SET_TRANSACTIONS', payload: remaining })
    // Remove the file from the file list
    const remainingFiles = files.filter(f => f.name !== fileName)
    dispatch({ type: 'SET_FILES', payload: remainingFiles })
    // Remove from processed hashes so it can be re-uploaded if needed
    processedHashes.current.delete(fileName)
    setStatuses(prev => [...prev, { file: fileName, status: 'success', message: 'Statement and all associated transactions deleted' }])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
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
        <div className={styles.dropzoneIcon}><Upload size={36} /></div>
        <div className={styles.dropzoneText}>
          Drop PDF or CSV bank statements here
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

      {/* Upload status messages */}
      {statuses.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {statuses.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 8, fontSize: 13,
              background: s.status === 'success' ? 'rgba(34,197,94,0.06)' : s.status === 'error' ? 'rgba(239,68,68,0.06)' : s.status === 'duplicate' ? 'rgba(245,158,11,0.06)' : 'var(--surface2)',
              border: `1px solid ${s.status === 'success' ? 'rgba(34,197,94,0.2)' : s.status === 'error' ? 'rgba(239,68,68,0.2)' : s.status === 'duplicate' ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
            }}>
              {s.status === 'uploading' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {s.status === 'success' && <CheckCircle2 size={14} color="#22c55e" />}
              {s.status === 'error' && <AlertCircle size={14} color="#ef4444" />}
              {s.status === 'duplicate' && <AlertCircle size={14} color="#f59e0b" />}
              <div>
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
