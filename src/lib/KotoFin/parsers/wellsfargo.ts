import { ParsedTransaction, ParseMeta } from './index'

export function parseWellsFargo(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Format 1: MM/DD/YYYY  DESCRIPTION  -AMOUNT or AMOUNT
    const fmt1 = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (fmt1) {
      const [, dateStr, desc, amountStr] = fmt1
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      transactions.push({ date, desc: desc.trim(), amount: parseFloat(amountStr.replace(/,/g, '')) })
      continue
    }

    // Format 2: MM/DD  DESCRIPTION  AMOUNT (no year — Wells Fargo often omits year)
    const fmt2 = line.match(
      /^(\d{1,2}\/\d{1,2})\s+(.{3,}?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (fmt2) {
      const [, dateStr, desc, amountStr] = fmt2
      const year = new Date().getFullYear()
      const [month, day] = dateStr.split('/')
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      transactions.push({ date, desc: desc.trim(), amount: parseFloat(amountStr.replace(/,/g, '')) })
      continue
    }

    // Format 3: Withdrawals/Deposits with debit/credit columns
    // MM/DD  Description  Debit  Credit  Balance  or  MM/DD/YYYY  Description  Debit  Credit  Balance
    const fmt3 = line.match(
      /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+[\d,]+\.\d{2}\s*$/
    )
    if (fmt3) {
      const [, dateStr, desc, debit, credit] = fmt3
      const parts = dateStr.split('/')
      let date: string
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
        date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      } else {
        date = `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
      let amount = 0
      if (credit && parseFloat(credit.replace(/,/g, '')) > 0) {
        amount = parseFloat(credit.replace(/,/g, ''))
      } else if (debit && parseFloat(debit.replace(/,/g, '')) > 0) {
        amount = -parseFloat(debit.replace(/,/g, ''))
      }
      if (amount !== 0) {
        transactions.push({ date, desc: desc.trim(), amount })
      }
      continue
    }

    // Format 4: Wells Fargo PDF text often comes as separate tokens on one line
    // Look for date followed by amount somewhere on same line
    const fmt4 = line.match(
      /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+\$?([\d,]+\.\d{2})/
    )
    if (fmt4 && !line.match(/balance|opening|closing|total|page|statement|account/i)) {
      const [, dateStr, desc, amountStr] = fmt4
      const parts = dateStr.split('/')
      let date: string
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
        date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      } else {
        date = `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      if (!isNaN(amount) && desc.trim().length > 2) {
        // Determine sign: Wells Fargo uses negative for debits in some formats
        // If no sign, assume debit (negative) unless it looks like a deposit
        const isDeposit = /deposit|credit|transfer\s+from|incoming|refund/i.test(desc)
        transactions.push({
          date,
          desc: desc.trim(),
          amount: isDeposit ? amount : -amount,
        })
      }
    }
  }

  return transactions
}
