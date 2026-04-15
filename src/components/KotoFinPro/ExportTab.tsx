'use client'

import { useState, useMemo } from 'react'
import { Transaction, COAAccount } from './KotoFin.types'
import { downloadBlob } from './KotoFin.utils'
import {
  buildQBOIIF,
  buildQBOCSV,
  buildXeroCSV,
  buildWaveCSV,
  buildFullCSV,
  buildScheduleC,
} from '@/lib/KotoFin/exporters'
import styles from './KotoFinPro.module.css'

interface ExportTabProps {
  transactions: Transaction[]
  accounts: COAAccount[]
}

interface ExportFormat {
  key: string
  name: string
  desc: string
  ext: string
  mime: string
}

const FORMATS: ExportFormat[] = [
  { key: 'qbo-iif', name: 'QuickBooks IIF', desc: 'Import directly into QuickBooks Desktop', ext: 'iif', mime: 'text/plain' },
  { key: 'qbo-csv', name: 'QuickBooks CSV', desc: 'Bank import format for QuickBooks Online', ext: 'csv', mime: 'text/csv' },
  { key: 'xero', name: 'Xero CSV', desc: 'Import into Xero accounting software', ext: 'csv', mime: 'text/csv' },
  { key: 'wave', name: 'Wave CSV', desc: 'Import into Wave free accounting', ext: 'csv', mime: 'text/csv' },
  { key: 'schedule-c', name: 'Schedule C', desc: 'IRS Schedule C line-by-line totals for your CPA', ext: 'txt', mime: 'text/plain' },
  { key: 'full-csv', name: 'Full Export CSV', desc: 'All 14 fields — complete data dump', ext: 'csv', mime: 'text/csv' },
]

export default function ExportTab({ transactions, accounts }: ExportTabProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLabel, setPreviewLabel] = useState('')

  const iifPreview = useMemo(() => {
    if (transactions.length === 0) return ''
    const full = buildQBOIIF(transactions)
    const lines = full.split('\n')
    return lines.slice(0, 20).join('\n') + (lines.length > 20 ? '\n...' : '')
  }, [transactions])

  function handleExport(format: ExportFormat) {
    let content = ''
    switch (format.key) {
      case 'qbo-iif':
        content = buildQBOIIF(transactions)
        break
      case 'qbo-csv':
        content = buildQBOCSV(transactions)
        break
      case 'xero':
        content = buildXeroCSV(transactions)
        break
      case 'wave':
        content = buildWaveCSV(transactions)
        break
      case 'schedule-c':
        content = buildScheduleC(transactions, accounts)
        break
      case 'full-csv':
        content = buildFullCSV(transactions)
        break
    }
    downloadBlob(content, `KotoFin_${format.key.replace(/-/g, '_')}.${format.ext}`, format.mime)
  }

  function handlePreview(format: ExportFormat) {
    let content = ''
    switch (format.key) {
      case 'qbo-iif':
        content = buildQBOIIF(transactions)
        break
      case 'qbo-csv':
        content = buildQBOCSV(transactions)
        break
      case 'xero':
        content = buildXeroCSV(transactions)
        break
      case 'wave':
        content = buildWaveCSV(transactions)
        break
      case 'schedule-c':
        content = buildScheduleC(transactions, accounts)
        break
      case 'full-csv':
        content = buildFullCSV(transactions)
        break
    }
    const lines = content.split('\n')
    setPreview(lines.slice(0, 30).join('\n') + (lines.length > 30 ? '\n...' : ''))
    setPreviewLabel(format.name)
  }

  if (transactions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#128230;</div>
        <div className={styles.emptyText}>No transactions to export</div>
        <div className={styles.emptyHint}>Upload bank statements first</div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Transactions to Export</div>
          <div className={`${styles.metricValue} ${styles.metricBlue}`}>{transactions.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Export Formats</div>
          <div className={`${styles.metricValue} ${styles.metricPurple}`}>{FORMATS.length}</div>
        </div>
      </div>

      <div className={styles.exportGrid}>
        {FORMATS.map(f => (
          <div key={f.key} className={styles.exportCard}>
            <div className={styles.exportName}>{f.name}</div>
            <div className={styles.exportDesc}>{f.desc}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} onClick={() => handleExport(f)}>
                Download .{f.ext}
              </button>
              <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => handlePreview(f)}>
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>

      {iifPreview && !preview && (
        <div className={styles.previewPanel}>
          <div className={styles.cardHeader}>QuickBooks IIF Preview</div>
          <pre className={styles.previewCode}>{iifPreview}</pre>
        </div>
      )}

      {preview && (
        <div className={styles.previewPanel}>
          <div className={styles.cardHeader}>
            {previewLabel} Preview
            <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setPreview(null)}>Close</button>
          </div>
          <pre className={styles.previewCode}>{preview}</pre>
        </div>
      )}
    </div>
  )
}
