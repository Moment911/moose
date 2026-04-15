'use client'

import { useCallback, useRef, useState, Dispatch } from 'react'
import { Transaction, StatementFile, KotoFinAction } from './KotoFin.types'
import { BANK_COLORS } from './KotoFin.constants'
import { categorize, fmtCurrency } from './KotoFin.utils'
import { Upload, AlertCircle, CheckCircle2, Loader2, Trash2, ChevronDown, ChevronUp, Brain } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface UploadTabProps {
  files: StatementFile[]
  transactions: Transaction[]
  dispatch: Dispatch<KotoFinAction>
}

interface ParseInfo {
  bank: string
  textLength: number
  totalLines: number
  linesWithAmounts: number
  transactionsMatched: number
  debitCount: number
  creditCount: number
  totalDebits: number
  totalCredits: number
  beginningBalance: number | null
  endingBalance: number | null
  unmatchedSample: string[]
  rawTextPreview: string
}

interface UploadStatus {
  id: string
  file: string
  status: 'uploading' | 'success' | 'error' | 'duplicate'
  message: string
  parseInfo?: ParseInfo
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
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number; status: string } | null>(null)
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const processedHashes = useRef<Set<string>>(new Set())

  // Sync globalNextId with current transactions
  if (transactions.length > 0) {
    globalNextId = Math.max(globalNextId, Math.max(...transactions.map(t => t.id)) + 1)
  }

  function updateStatus(id: string, update: Partial<UploadStatus>) {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...update } : s))
  }

  async function aiCategorize(txns: Transaction[]) {
    const BATCH_SIZE = 50
    const batches: Transaction[][] = []
    for (let i = 0; i < txns.length; i += BATCH_SIZE) {
      batches.push(txns.slice(i, i + BATCH_SIZE))
    }

    setAiProgress({ current: 0, total: txns.length, status: 'AI categorizing...' })

    let processed = 0
    for (const batch of batches) {
      try {
        const res = await fetch('/api/KotoFin/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactions: batch.map(t => ({ id: t.id, desc: t.desc, amount: t.amount })),
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const results: Array<{ id: number; co: string; cat: string; type: Transaction['type']; code: string }> = data.results
          for (const r of results) {
            dispatch({
              type: 'UPDATE_TRANSACTION',
              payload: {
                ...batch.find(t => t.id === r.id)!,
                co: r.co || '',
                cat: r.cat || 'Uncategorized',
                type: r.type || 'uncategorized',
                code: r.code || '',
                aiTagged: !data.fallback,
              },
            })
          }
        }
      } catch (err) {
        console.error('AI batch failed:', err)
      }

      processed += batch.length
      setAiProgress({ current: processed, total: txns.length, status: `AI categorized ${processed} of ${txns.length}` })
    }

    setAiProgress({ current: txns.length, total: txns.length, status: `AI categorization complete — ${txns.length} transactions` })
    setTimeout(() => setAiProgress(null), 3000)
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

    // Phase 2: process files ONE AT A TIME to avoid overwhelming serverless
    const allNewTxns: Transaction[] = []

    for (let fi = 0; fi < filesToProcess.length; fi++) {
      const { file, id, hash } = filesToProcess[fi]
      const ext = file.name.toLowerCase().split('.').pop()

      updateStatus(id, { status: 'uploading', message: `Processing file ${fi + 1} of ${filesToProcess.length}...` })

      try {
        let result: { txns: Transaction[]; fileMeta: StatementFile; id: string; hash: string } | null = null

        if (ext === 'csv') {
          result = await processCSV(file, id, hash)
        } else if (ext === 'pdf') {
          result = await processPDF(file, id, hash)
        } else {
          updateStatus(id, { status: 'error', message: `Unsupported file type: .${ext}` })
        }

        if (result && result.txns.length > 0) {
          processedHashes.current.add(hash)
          dispatch({ type: 'ADD_TRANSACTIONS', payload: result.txns })
          dispatch({ type: 'ADD_FILE', payload: result.fileMeta })
          allNewTxns.push(...result.txns)
        }
      } catch (err) {
        updateStatus(id, { status: 'error', message: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
      }
    }

    // Phase 3: Auto-run AI categorization on all imported transactions
    if (allNewTxns.length > 0) {
      await aiCategorize(allNewTxns)
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

      const info = data.parseInfo
      const coverage = info ? `${info.transactionsMatched} of ${info.linesWithAmounts} lines matched (${info.totalLines} total lines, ${info.textLength} chars)` : ''

      if (!data.transactions?.length) {
        updateStatus(id, { status: 'error', message: `0 transactions matched. Bank: ${info?.bank || 'Unknown'}. ${coverage}.`, parseInfo: info })
        return null
      }

      // Reassign IDs to avoid collisions
      const txns = data.transactions.map((t: Transaction, i: number) => ({
        ...t,
        id: globalNextId + i,
      }))
      globalNextId += txns.length

      const successMsg = `${txns.length} transactions imported`

      updateStatus(id, { status: 'success', message: successMsg, parseInfo: info })

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

      {aiProgress && (
        <div style={{
          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, padding: 14, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Brain size={16} color="#3b82f6" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{aiProgress.status}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, transition: 'width 0.3s',
              background: aiProgress.current === aiProgress.total ? '#22c55e' : '#3b82f6',
              width: `${aiProgress.total > 0 ? (aiProgress.current / aiProgress.total) * 100 : 0}%`,
            }} />
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.csv"
        multiple={true}
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={e => {
          e.stopPropagation()
          if (!processing) fileRef.current?.click()
        }}
        style={processing ? { opacity: 0.5, pointerEvents: 'none' } : {}}
      >
        <div className={styles.dropzoneIcon}>
          {processing ? <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={36} />}
        </div>
        <div className={styles.dropzoneText}>
          {processing ? 'Processing files...' : 'Drop PDF or CSV bank statements here'}
        </div>
        <div className={`${styles.textSmall} ${styles.textDim}`} style={{ marginTop: 8 }}>
          Select multiple files at once. Supports Chase, Capital One, Navy Federal, BofA, Citibank, Wells Fargo, Amex, US Bank, PNC, TD Bank, Discover, and CSV.
        </div>
      </div>

      {statuses.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {statuses.map(s => {
            const isExpanded = expandedStatus === s.id
            const hasDetail = !!s.parseInfo
            return (
              <div key={s.id} style={{
                borderRadius: 8, fontSize: 13, overflow: 'hidden',
                background: s.status === 'success' ? 'rgba(34,197,94,0.06)' : s.status === 'error' ? 'rgba(239,68,68,0.06)' : s.status === 'duplicate' ? 'rgba(245,158,11,0.06)' : 'var(--surface2)',
                border: `1px solid ${s.status === 'success' ? 'rgba(34,197,94,0.2)' : s.status === 'error' ? 'rgba(239,68,68,0.2)' : s.status === 'duplicate' ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: hasDetail ? 'pointer' : 'default' }}
                  onClick={() => hasDetail && setExpandedStatus(isExpanded ? null : s.id)}>
                  {s.status === 'uploading' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                  {s.status === 'success' && <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0 }} />}
                  {s.status === 'error' && <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />}
                  {s.status === 'duplicate' && <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{s.file}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{s.message}</span>
                  </div>
                  {hasDetail && (isExpanded ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />)}
                </div>

                {isExpanded && s.parseInfo && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                    {/* Import summary grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, margin: '12px 0' }}>
                      <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Bank</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.parseInfo.bank}</div>
                      </div>
                      <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Transactions</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.parseInfo.transactionsMatched}</div>
                      </div>
                      <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Debits</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
                          {s.parseInfo.debitCount} ({fmtCurrency(s.parseInfo.totalDebits)})
                        </div>
                      </div>
                      <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Credits</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
                          {s.parseInfo.creditCount} ({fmtCurrency(s.parseInfo.totalCredits)})
                        </div>
                      </div>
                      {s.parseInfo.beginningBalance !== null && (
                        <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Beginning Balance</div>
                          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>{fmtCurrency(s.parseInfo.beginningBalance)}</div>
                        </div>
                      )}
                      {s.parseInfo.endingBalance !== null && (
                        <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Ending Balance</div>
                          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>{fmtCurrency(s.parseInfo.endingBalance)}</div>
                        </div>
                      )}
                      {s.parseInfo.beginningBalance !== null && s.parseInfo.endingBalance !== null && (
                        <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Reconciliation</div>
                          {(() => {
                            const expected = s.parseInfo.beginningBalance! + s.parseInfo.totalCredits - s.parseInfo.totalDebits
                            const diff = Math.abs(expected - s.parseInfo.endingBalance!)
                            return diff < 0.02
                              ? <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>Balanced</div>
                              : <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>Off by {fmtCurrency(diff)}</div>
                          })()}
                        </div>
                      )}
                    </div>

                    {s.parseInfo.unmatchedSample.length > 0 && (
                      <details style={{ fontSize: 11, marginBottom: 8 }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--amber)', fontWeight: 500, marginBottom: 6 }}>
                          {s.parseInfo.linesWithAmounts - s.parseInfo.transactionsMatched} lines with amounts not matched
                        </summary>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--surface2)', padding: 10, borderRadius: 6, maxHeight: 200, overflowY: 'auto', lineHeight: 1.8 }}>
                          {s.parseInfo.unmatchedSample.map((line, idx) => (
                            <div key={idx} style={{ borderBottom: '1px solid var(--border)', padding: '2px 0' }}>{line}</div>
                          ))}
                        </div>
                      </details>
                    )}

                    <details style={{ fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 500 }}>
                        Raw text ({s.parseInfo.textLength.toLocaleString()} chars)
                      </summary>
                      <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--surface2)', padding: 10, borderRadius: 6, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6, marginTop: 6 }}>
                        {s.parseInfo.rawTextPreview}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            )
          })}
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
