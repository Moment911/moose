'use client'

import { useKotoFinStore } from './KotoFin.store'
import { TAB_LIST } from './KotoFin.constants'
import UploadTab from './UploadTab'
import TransactionsTab from './TransactionsTab'
import AccountsTab from './AccountsTab'
import DeductionsTab from './DeductionsTab'
import ScenariosTab from './ScenariosTab'
import QuarterlyTab from './QuarterlyTab'
import AnalyticsTab from './AnalyticsTab'
import ReportsTab from './ReportsTab'
import ExportTab from './ExportTab'
import styles from './KotoFinPro.module.css'

export default function KotoFinPro() {
  const [state, dispatch] = useKotoFinStore()

  const renderTab = () => {
    switch (state.activeTab) {
      case 'Upload':
        return (
          <UploadTab
            files={state.files}
            transactions={state.transactions}
            dispatch={dispatch}
          />
        )
      case 'Transactions':
        return (
          <TransactionsTab
            transactions={state.transactions}
            accounts={state.accounts}
            files={state.files}
            activeFile={state.activeFile}
            activeType={state.activeType}
            dispatch={dispatch}
          />
        )
      case 'Chart of Accounts':
        return (
          <AccountsTab
            transactions={state.transactions}
            accounts={state.accounts}
          />
        )
      case 'Deduction Finder':
        return <DeductionsTab transactions={state.transactions} />
      case 'Tax Scenarios':
        return <ScenariosTab transactions={state.transactions} />
      case 'Quarterly Tax':
        return <QuarterlyTab transactions={state.transactions} />
      case 'Analytics':
        return <AnalyticsTab transactions={state.transactions} />
      case 'Reports':
        return (
          <ReportsTab
            transactions={state.transactions}
            accounts={state.accounts}
          />
        )
      case 'Export':
        return (
          <ExportTab
            transactions={state.transactions}
            accounts={state.accounts}
          />
        )
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
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {state.transactions.length} transactions &middot; {state.files.length} files
        </div>
      </div>

      <div className={styles.tabBar}>
        {TAB_LIST.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${state.activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {renderTab()}
      </div>
    </div>
  )
}
