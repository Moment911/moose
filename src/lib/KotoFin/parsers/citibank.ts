import { ParsedTransaction, ParseMeta } from './index'

export function parseCitibank(text: string, _meta: ParseMeta): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Citibank multi-line: date on one line, description may wrap, amount on same or next
    // Format: MM/DD  DESCRIPTION  AMOUNT or MM/DD/YY  DESCRIPTION  AMOUNT
    const match = line.match(
      /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
    )
    if (match) {
      const [, dateStr, desc, amountStr] = match
      const parts = dateStr.split('/')
      let date: string
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
        date = `${year}-${parts[0]}-${parts[1]}`
      } else {
        const year = new Date().getFullYear()
        date = `${year}-${parts[0]}-${parts[1]}`
      }
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''))
      transactions.push({ date, desc: desc.trim(), amount: -Math.abs(amount) })
      continue
    }

    // Multi-line: date line, then description+amount on next line
    const dateOnly = line.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*$/)
    if (dateOnly && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      const nextMatch = nextLine.match(/^(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/)
      if (nextMatch) {
        const dateStr = dateOnly[1]
        const parts = dateStr.split('/')
        let date: string
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
          date = `${year}-${parts[0]}-${parts[1]}`
        } else {
          const year = new Date().getFullYear()
          date = `${year}-${parts[0]}-${parts[1]}`
        }
        const amount = parseFloat(nextMatch[2].replace(/[$,]/g, ''))
        transactions.push({ date, desc: nextMatch[1].trim(), amount: -Math.abs(amount) })
        i++
      }
    }
  }

  return transactions
}
