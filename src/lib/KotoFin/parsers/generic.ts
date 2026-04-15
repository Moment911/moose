import { ParsedTransaction, ParseMeta } from './index'

export function parseGeneric(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Try CSV format: Date,Description,Amount
    const csvMatch = trimmed.match(
      /^"?(\d{1,2}\/\d{1,2}\/\d{2,4})"?\s*,\s*"?([^",]+)"?\s*,\s*"?(-?\$?[\d,]+\.?\d*)"?/
    )
    if (csvMatch) {
      const [, dateStr, desc, amountStr] = csvMatch
      const parts = dateStr.split('/')
      let date: string
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
        date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      } else {
        date = `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      if (!isNaN(amount)) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
      continue
    }

    // Try generic line format: DATE  DESCRIPTION  AMOUNT
    const genericMatch = trimmed.match(
      /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
    )
    if (genericMatch) {
      const [, dateStr, desc, amountStr] = genericMatch
      const parts = dateStr.split('/')
      let date: string
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
        date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      } else {
        date = `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      if (!isNaN(amount)) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
      continue
    }

    // Try ISO date format: YYYY-MM-DD  DESCRIPTION  AMOUNT
    const isoMatch = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
    )
    if (isoMatch) {
      const [, date, desc, amountStr] = isoMatch
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      if (!isNaN(amount)) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
    }
  }

  return transactions
}
