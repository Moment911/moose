export interface Transaction {
  id: number
  file: string
  bank: string
  account: string
  range: string
  date: string
  desc: string
  amount: number
  co: string
  cat: string
  code: string
  type: 'business' | 'personal' | 'income' | 'uncategorized'
  aiTagged: boolean
  notes: string
}

export interface COAAccount {
  code: string
  name: string
  type: 'asset' | 'liability' | 'income' | 'expense' | 'personal'
  scLine: string | null
}

export interface StatementFile {
  name: string
  bank: string
  account: string
  range: string
  color: string
  txnCount: number
}

export interface TaxScenario {
  label: string
  income: number
  bizExp: number
  extraDeductions: number
  homeOffice: number
  mileage: number
  sepIRA: number
  healthInsurance: number
  seDeduction: number
  agi: number
  federalTax: number
  seTax: number
  effectiveRate: number
  takeHome: number
}

export interface KotoFinState {
  transactions: Transaction[]
  accounts: COAAccount[]
  files: StatementFile[]
  activeFile: string
  activeType: string
  activeTab: string
}

export type KotoFinAction =
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: number }
  | { type: 'SET_ACCOUNTS'; payload: COAAccount[] }
  | { type: 'ADD_FILE'; payload: StatementFile }
  | { type: 'SET_FILES'; payload: StatementFile[] }
  | { type: 'SET_ACTIVE_FILE'; payload: string }
  | { type: 'SET_ACTIVE_TYPE'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'RESET'; payload?: undefined }
