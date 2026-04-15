import { supabase as _supabase } from '@/lib/supabase'

// supabase is a Proxy with lazy init — cast to any for .from() calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any

export interface DBTransaction {
  id?: number
  client_id: string
  agency_id: string
  file: string
  bank: string
  account: string
  range: string
  date: string
  description: string
  amount: number
  company: string
  category: string
  code: string
  type: string
  ai_tagged: boolean
  notes: string
}

export interface DBFile {
  id?: number
  client_id: string
  agency_id: string
  name: string
  bank: string
  account: string
  range: string
  color: string
  txn_count: number
}

export async function loadTransactions(clientId: string) {
  const { data, error } = await supabase
    .from('kotofin_transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: true })

  if (error) {
    console.error('Failed to load transactions:', error)
    return []
  }

  return (data || []).map((row: DBTransaction) => ({
    id: row.id!,
    file: row.file,
    bank: row.bank,
    account: row.account,
    range: row.range,
    date: row.date,
    desc: row.description,
    amount: Number(row.amount),
    co: row.company,
    cat: row.category,
    code: row.code,
    type: row.type as 'business' | 'personal' | 'income' | 'uncategorized',
    aiTagged: row.ai_tagged,
    notes: row.notes,
  }))
}

export async function saveTransactions(clientId: string, agencyId: string, transactions: Array<{
  id?: number; file: string; bank: string; account: string; range: string;
  date: string; desc: string; amount: number; co: string; cat: string;
  code: string; type: string; aiTagged: boolean; notes: string;
}>) {
  // Delete existing transactions for this client, then insert fresh
  await supabase
    .from('kotofin_transactions')
    .delete()
    .eq('client_id', clientId)

  if (transactions.length === 0) return

  const rows = transactions.map(t => ({
    client_id: clientId,
    agency_id: agencyId,
    file: t.file,
    bank: t.bank,
    account: t.account,
    range: t.range,
    date: t.date,
    description: t.desc,
    amount: t.amount,
    company: t.co,
    category: t.cat,
    code: t.code,
    type: t.type,
    ai_tagged: t.aiTagged,
    notes: t.notes,
  }))

  const { error } = await supabase
    .from('kotofin_transactions')
    .insert(rows)

  if (error) console.error('Failed to save transactions:', error)
}

export async function loadFiles(clientId: string) {
  const { data, error } = await supabase
    .from('kotofin_files')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load files:', error)
    return []
  }

  return (data || []).map((row: DBFile) => ({
    name: row.name,
    bank: row.bank,
    account: row.account,
    range: row.range,
    color: row.color,
    txnCount: row.txn_count,
  }))
}

export async function saveFiles(clientId: string, agencyId: string, files: Array<{
  name: string; bank: string; account: string; range: string; color: string; txnCount: number;
}>) {
  await supabase
    .from('kotofin_files')
    .delete()
    .eq('client_id', clientId)

  if (files.length === 0) return

  const rows = files.map(f => ({
    client_id: clientId,
    agency_id: agencyId,
    name: f.name,
    bank: f.bank,
    account: f.account,
    range: f.range,
    color: f.color,
    txn_count: f.txnCount,
  }))

  const { error } = await supabase
    .from('kotofin_files')
    .insert(rows)

  if (error) console.error('Failed to save files:', error)
}
