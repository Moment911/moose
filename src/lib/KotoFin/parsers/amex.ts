import { ParsedTransaction, ParseMeta } from './index'

export function parseAmex(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Amex format 1: MM/DD/YY  Reference  Description  Amount
    const match = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+\S+\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    )
    if (match) {
      const [, dateStr, desc, amountStr] = match
      const parts = dateStr.split('/')
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      const date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Amex format 2: MM/DD/YY*  Description  Amount (asterisk for pending)
    const pendingMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{2,4})\*?\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    )
    if (pendingMatch) {
      const [, dateStr, desc, amountStr] = pendingMatch
      const parts = dateStr.split('/')
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      const date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      const amount = -Math.abs(parseFloat(amountStr.replace(/,/g, '')))
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Amex CSV export: Date,Description,Amount
    const csvMatch = line.match(
      /^"?(\d{1,2}\/\d{1,2}\/\d{2,4})"?\s*,\s*"?([^"]+)"?\s*,\s*"?\$?(-?[\d,]+\.?\d*)"?/
    )
    if (csvMatch) {
      const [, dateStr, desc, amountStr] = csvMatch
      const parts = dateStr.split('/')
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      const date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      if (!isNaN(amount)) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
    }
  }

  return transactions
}
