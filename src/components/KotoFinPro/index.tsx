'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useKotoFinStore } from './KotoFin.store'
import { TAB_LIST } from './KotoFin.constants'
import { supabase as _sb } from '@/lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _sb as any
import { loadTransactions, loadFiles, saveTransactions, saveFiles } from '@/lib/KotoFin/db'
import { useAuth } from '@/hooks/useAuth'
import {
  Upload, List, BookOpen, Search, SlidersHorizontal, Calendar,
  BarChart3, FileText, Download, Building2, ClipboardList,
} from 'lucide-react'
import UploadTab from './UploadTab'
import TransactionsTab from './TransactionsTab'
import AccountsTab from './AccountsTab'
import DeductionsTab from './DeductionsTab'
import ScenariosTab from './ScenariosTab'
import QuarterlyTab from './QuarterlyTab'
import AnalyticsTab from './AnalyticsTab'
import ReportsTab from './ReportsTab'
import ExportTab from './ExportTab'
import TaxProfileTab from './TaxProfileTab'
import styles from './KotoFinPro.module.css'
import { ClientInfo, TaxProfile } from './KotoFin.types'

const TAB_ICONS: Record<string, typeof Upload> = {
  'Upload': Upload,
  'Transactions': List,
  'Chart of Accounts': BookOpen,
  'Deduction Finder': Search,
  'Tax Profile': ClipboardList,
  'Tax Scenarios': SlidersHorizontal,
  'Quarterly Tax': Calendar,
  'Analytics': BarChart3,
  'Reports': FileText,
  'Export': Download,
}

const TABS = [...TAB_LIST.slice(0, 4), 'Tax Profile' as const, ...TAB_LIST.slice(4)]

export default function KotoFinPro() {
  const [state, dispatch] = useKotoFinStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { agencyId } = useAuth() as any
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load clients
  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .order('name')
      setClients((data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name || 'Unnamed' })))
      setLoadingClients(false)
    }
    if (agencyId) fetchClients()
  }, [agencyId])

  // Load data when client changes
  useEffect(() => {
    if (!state.clientId) return
    async function loadData() {
      const [txns, files] = await Promise.all([
        loadTransactions(state.clientId),
        loadFiles(state.clientId),
      ])
      // Load tax profile from supabase
      const { data: profileData } = await supabase
        .from('kotofin_tax_profiles')
        .select('profile')
        .eq('client_id', state.clientId)
        .single()
      dispatch({
        type: 'LOAD_CLIENT_DATA',
        payload: {
          transactions: txns,
          files,
          taxProfile: profileData?.profile as TaxProfile | undefined,
        },
      })
    }
    loadData()
  }, [state.clientId, dispatch])

  // Auto-save with debounce
  const autoSave = useCallback(() => {
    if (!state.clientId || !agencyId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      dispatch({ type: 'SET_SAVING', payload: true })
      await Promise.all([
        saveTransactions(state.clientId, agencyId, state.transactions),
        saveFiles(state.clientId, agencyId, state.files),
        supabase.from('kotofin_tax_profiles').upsert({
          client_id: state.clientId,
          agency_id: agencyId,
          profile: state.taxProfile,
        }, { onConflict: 'client_id' }),
      ])
      dispatch({ type: 'SET_SAVING', payload: false })
    }, 1500)
  }, [state.clientId, state.transactions, state.files, state.taxProfile, agencyId, dispatch])

  useEffect(() => {
    if (state.clientId && state.transactions.length > 0) {
      autoSave()
    }
  }, [state.transactions, state.files, state.taxProfile, autoSave])

  function handleClientChange(clientId: string) {
    const client = clients.find(c => c.id === clientId)
    if (client) {
      dispatch({ type: 'SET_CLIENT', payload: { id: client.id, name: client.name } })
    }
  }

  const renderTab = () => {
    switch (state.activeTab) {
      case 'Upload':
        return <UploadTab files={state.files} transactions={state.transactions} dispatch={dispatch} />
      case 'Transactions':
        return <TransactionsTab transactions={state.transactions} accounts={state.accounts} files={state.files} activeFile={state.activeFile} activeType={state.activeType} dispatch={dispatch} />
      case 'Chart of Accounts':
        return <AccountsTab transactions={state.transactions} accounts={state.accounts} />
      case 'Deduction Finder':
        return <DeductionsTab transactions={state.transactions} taxProfile={state.taxProfile} />
      case 'Tax Profile':
        return <TaxProfileTab taxProfile={state.taxProfile} dispatch={dispatch} transactions={state.transactions} />
      case 'Tax Scenarios':
        return <ScenariosTab transactions={state.transactions} taxProfile={state.taxProfile} />
      case 'Quarterly Tax':
        return <QuarterlyTab transactions={state.transactions} taxProfile={state.taxProfile} />
      case 'Analytics':
        return <AnalyticsTab transactions={state.transactions} />
      case 'Reports':
        return <ReportsTab transactions={state.transactions} accounts={state.accounts} taxProfile={state.taxProfile} />
      case 'Export':
        return <ExportTab transactions={state.transactions} accounts={state.accounts} />
      default:
        return null
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <span className={styles.logo}>KotoFin</span>
          <span className={styles.logoPro}>PRO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-dim)' }}>
          {state.saving && <span>Saving...</span>}
          {state.clientId && (
            <span>{state.transactions.length} transactions &middot; {state.files.length} files</span>
          )}
        </div>
      </div>

      <div className={styles.companyPicker}>
        <span className={styles.companyLabel}>
          <Building2 size={14} />
          Company
        </span>
        <select
          className={styles.companySelect}
          value={state.clientId}
          onChange={e => handleClientChange(e.target.value)}
          disabled={loadingClients}
        >
          <option value="">{loadingClients ? 'Loading...' : 'Select a company'}</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {!state.clientId ? (
        <div className={styles.noCompany}>
          <Building2 size={48} className={styles.noCompanyIcon} />
          <div className={styles.noCompanyTitle}>Select a Company</div>
          <div className={styles.noCompanyHint}>
            Choose a company above to view or upload financial data. Each company&apos;s data is fully isolated.
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tabBar}>
            {TABS.map(tab => {
              const Icon = TAB_ICONS[tab]
              return (
                <button
                  key={tab}
                  className={`${styles.tab} ${state.activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
                >
                  {Icon && <Icon size={15} className={styles.tabIcon} />}
                  {tab}
                </button>
              )
            })}
          </div>

          <div className={styles.content}>
            {renderTab()}
          </div>
        </>
      )}
    </div>
  )
}
