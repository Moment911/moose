import { ParsedTransaction, ParseMeta } from './index'

export function parseNavyFederal(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Navy Federal format: MM/DD/YYYY  DESCRIPTION  DEBIT  CREDIT  BALANCE
    const match = line.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d[\d,]*\.\d{2})?\s+(\d[\d,]*\.\d{2})?\s+\d[\d,]*\.\d{2}\s*$/
    )
    if (match) {
      const [, dateStr, desc, debitStr, creditStr] = match
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month}-${day}`
      let amount = 0
      if (creditStr) {
        amount = parseFloat(creditStr.replace(/,/g, ''))
      } else if (debitStr) {
        amount = -parseFloat(debitStr.replace(/,/g, ''))
      }
      transactions.push({ date, desc: desc.trim(), amount })
      continue
    }

    // Simpler format: MM/DD/YYYY  DESCRIPTION  AMOUNT
    const simpleMatch = line.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/
    )
    if (simpleMatch) {
      const [, dateStr, desc, amountStr] = simpleMatch
      const [month, day, year] = dateStr.split('/')
      const date = `${year}-${month}-${day}`
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      transactions.push({ date, desc: desc.trim(), amount })
    }
  }

  return transactions
}
