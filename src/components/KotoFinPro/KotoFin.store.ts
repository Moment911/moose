import { useReducer, Dispatch } from 'react'
import { KotoFinState, KotoFinAction, COAAccount, TaxProfile } from './KotoFin.types'
import { DEFAULT_COA } from './KotoFin.constants'

export const DEFAULT_TAX_PROFILE: TaxProfile = {
  entityType: 'sole_prop',
  filingStatus: 'single',
  state: '',
  hasHomeOffice: false,
  homeOfficeSqft: 0,
  homeTotalSqft: 0,
  hasVehicle: false,
  vehicleOwnership: 'owned',
  vehicleMilesTotal: 0,
  vehicleMilesBusiness: 0,
  leasePaymentMonthly: 0,
  hasRetirementPlan: false,
  retirementType: 'none',
  hasHealthInsurance: false,
  healthInsuranceAnnual: 0,
  numDependents: 0,
  hasChildcare: false,
  childcareAnnual: 0,
  priorYearTax: 0,
  estimatedOtherIncome: 0,
  hasStudentLoans: false,
  studentLoanInterest: 0,
}

const initialState: KotoFinState = {
  transactions: [],
  accounts: DEFAULT_COA,
  files: [],
  activeFile: 'all',
  activeType: 'all',
  activeTab: 'Upload',
  clientId: '',
  clientName: '',
  taxProfile: DEFAULT_TAX_PROFILE,
  saving: false,
}

function reducer(state: KotoFinState, action: KotoFinAction): KotoFinState {
  switch (action.type) {
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload }
    case 'ADD_TRANSACTIONS':
      return { ...state, transactions: [...state.transactions, ...action.payload] }
    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === action.payload.id ? action.payload : t
        ),
      }
    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload),
      }
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload as COAAccount[] }
    case 'ADD_FILE':
      return { ...state, files: [...state.files, action.payload] }
    case 'SET_FILES':
      return { ...state, files: action.payload }
    case 'SET_ACTIVE_FILE':
      return { ...state, activeFile: action.payload as string }
    case 'SET_ACTIVE_TYPE':
      return { ...state, activeType: action.payload as string }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload as string }
    case 'SET_CLIENT':
      return { ...state, clientId: action.payload.id, clientName: action.payload.name }
    case 'SET_TAX_PROFILE':
      return { ...state, taxProfile: { ...state.taxProfile, ...action.payload } }
    case 'SET_SAVING':
      return { ...state, saving: action.payload as boolean }
    case 'LOAD_CLIENT_DATA':
      return {
        ...state,
        transactions: action.payload.transactions,
        files: action.payload.files,
        taxProfile: action.payload.taxProfile || DEFAULT_TAX_PROFILE,
        activeFile: 'all',
        activeType: 'all',
      }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function useKotoFinStore(): [KotoFinState, Dispatch<KotoFinAction>] {
  return useReducer(reducer, initialState)
}
