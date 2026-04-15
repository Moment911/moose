import { useReducer, Dispatch } from 'react'
import { KotoFinState, KotoFinAction, COAAccount } from './KotoFin.types'
import { DEFAULT_COA } from './KotoFin.constants'

const initialState: KotoFinState = {
  transactions: [],
  accounts: DEFAULT_COA,
  files: [],
  activeFile: 'all',
  activeType: 'all',
  activeTab: 'Upload',
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
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function useKotoFinStore(): [KotoFinState, Dispatch<KotoFinAction>] {
  return useReducer(reducer, initialState)
}
