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

export interface TaxProfile {
  entityType: 'sole_prop' | 'llc_single' | 'llc_multi' | 'llc_s_elect' | 's_corp' | 'c_corp' | 'partnership'
  filingStatus: 'single' | 'mfj' | 'mfs' | 'hoh'
  state: string
  hasHomeOffice: boolean
  homeOfficeSqft: number
  homeTotalSqft: number
  hasVehicle: boolean
  vehicleOwnership: 'owned' | 'leased' | 'personal'
  vehicleMilesTotal: number
  vehicleMilesBusiness: number
  leasePaymentMonthly: number
  hasRetirementPlan: boolean
  retirementType: 'sep_ira' | 'solo_401k' | 'simple_ira' | 'none'
  hasHealthInsurance: boolean
  healthInsuranceAnnual: number
  numDependents: number
  hasChildcare: boolean
  childcareAnnual: number
  priorYearTax: number
  estimatedOtherIncome: number
  hasStudentLoans: boolean
  studentLoanInterest: number
}

export interface ClientInfo {
  id: string
  name: string
}

export interface KotoFinState {
  transactions: Transaction[]
  accounts: COAAccount[]
  files: StatementFile[]
  activeFile: string
  activeType: string
  activeTab: string
  clientId: string
  clientName: string
  taxProfile: TaxProfile
  saving: boolean
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
  | { type: 'SET_CLIENT'; payload: { id: string; name: string } }
  | { type: 'SET_TAX_PROFILE'; payload: Partial<TaxProfile> }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'LOAD_CLIENT_DATA'; payload: { transactions: Transaction[]; files: StatementFile[]; taxProfile?: TaxProfile } }
  | { type: 'RESET'; payload?: undefined }
