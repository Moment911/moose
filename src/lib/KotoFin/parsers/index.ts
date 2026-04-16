import { parseChase } from './chase'
import { parseBankOfAmerica } from './bankofamerica'
import { parseCapitalOne } from './capitalOne'
import { parseNavyFederal } from './navyfederal'
import { parseCitibank } from './citibank'
import { parseWellsFargo } from './wellsfargo'
import { parseAmex } from './amex'
import { parseUSBank } from './usbank'
import { parsePNC } from './pnc'
import { parseTD } from './td'
import { parseDiscover } from './discover'
import { parseGeneric } from './generic'
import { categorize } from '../categorizer'

export interface ParsedTransaction {
  date: string
  desc: string
  amount: number
}

export interface ParseMeta {
  file: string
  account: string
  range: string
}

export interface FullTransaction {
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

type Parser = (text: string, meta: ParseMeta) => ParsedTransaction[]

export function detectBank(text: string): { bank: string; parser: Parser } {
  const header = text.substring(0, 500).toUpperCase()

  if (header.includes('NAVY FEDERAL')) {
    return { bank: 'Navy Federal', parser: parseNavyFederal }
  }
  if (header.includes('CAPITAL ONE')) {
    return { bank: 'Capital One', parser: parseCapitalOne }
  }
  if (header.includes('CITIBANK') || header.includes('CITI BANK')) {
    return { bank: 'Citibank', parser: parseCitibank }
  }
  if (header.includes('CHASE') || header.includes('JPMORGAN')) {
    return { bank: 'Chase', parser: parseChase }
  }
  if (header.includes('BANK OF AMERICA') || header.includes('BOFA')) {
    return { bank: 'Bank of America', parser: parseBankOfAmerica }
  }
  if (header.includes('WELLS FARGO')) {
    return { bank: 'Wells Fargo', parser: parseWellsFargo }
  }
  if (header.includes('AMERICAN EXPRESS') || header.includes('AMEX')) {
    return { bank: 'Amex', parser: parseAmex }
  }
  if (header.includes('U.S. BANK') || header.includes('US BANK') || header.includes('USBANK')) {
    return { bank: 'US Bank', parser: parseUSBank }
  }
  if (header.includes('PNC BANK') || header.includes('PNC ')) {
    return { bank: 'PNC', parser: parsePNC }
  }
  if (header.includes('TD BANK') || header.includes('TD AMERITRADE')) {
    return { bank: 'TD Bank', parser: parseTD }
  }
  if (header.includes('DISCOVER')) {
    return { bank: 'Discover', parser: parseDiscover }
  }

  return { bank: 'Unknown', parser: parseGeneric }
}

export function parseStatement(text: string, meta: ParseMeta, startId: number = 1): FullTransaction[] {
  const { bank, parser } = detectBank(text)
  const raw = parser(text, meta)

  return raw.map((t, i) => {
    const cat = categorize(t.desc)
    return {
      id: startId + i,
      file: meta.file,
      bank,
      account: meta.account,
      range: meta.range,
      date: t.date,
      desc: t.desc,
      amount: t.amount,
      co: cat.co,
      cat: cat.cat,
      code: cat.code,
      type: cat.type,
      aiTagged: false,
      notes: '',
    }
  })
}
