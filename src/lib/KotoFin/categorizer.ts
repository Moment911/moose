interface CatResult {
  co: string
  cat: string
  type: 'business' | 'personal' | 'income' | 'uncategorized'
  code: string
}

const rules: Array<{ pattern: RegExp; co: string; cat: string; type: 'business' | 'personal' | 'income'; code: string }> = [
  { pattern: /amazon/i, co: 'Amazon', cat: 'Office Expense', type: 'business', code: '5210' },
  { pattern: /google\s*ads|adwords/i, co: 'Google Ads', cat: 'Advertising', type: 'business', code: '5100' },
  { pattern: /google|gsuite|google\s*workspace/i, co: 'Google', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /meta\s*ads|facebook\s*ads|fb\s*ads/i, co: 'Meta Ads', cat: 'Advertising', type: 'business', code: '5100' },
  { pattern: /microsoft|msft|office\s*365/i, co: 'Microsoft', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /adobe/i, co: 'Adobe', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /notion/i, co: 'Notion', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /slack/i, co: 'Slack', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /zoom/i, co: 'Zoom', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /dropbox/i, co: 'Dropbox', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /github/i, co: 'GitHub', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /openai/i, co: 'OpenAI', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /quickbooks|intuit/i, co: 'Intuit', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /shopify/i, co: 'Shopify', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /aws|amazon\s*web/i, co: 'AWS', cat: 'Software & Subscriptions', type: 'business', code: '5320' },
  { pattern: /uber\s*eats|doordash|grubhub/i, co: 'Food Delivery', cat: 'Meals (50% deductible)', type: 'business', code: '5280' },
  { pattern: /starbucks|dunkin/i, co: 'Coffee', cat: 'Meals (50% deductible)', type: 'business', code: '5280' },
  { pattern: /mcdonald|chipotle|panera|subway/i, co: 'Restaurant', cat: 'Meals (50% deductible)', type: 'business', code: '5280' },
  { pattern: /\buber\b(?!\s*eats)|lyft/i, co: 'Rideshare', cat: 'Car & Truck Expenses', type: 'business', code: '5110' },
  { pattern: /delta\s*air|united\s*air|american\s*air|southwest|jetblue/i, co: 'Airline', cat: 'Travel', type: 'business', code: '5270' },
  { pattern: /marriott|hilton|hyatt|airbnb/i, co: 'Lodging', cat: 'Travel', type: 'business', code: '5270' },
  { pattern: /fedex|ups\b|usps|dhl/i, co: 'Shipping', cat: 'Shipping & Postage', type: 'business', code: '5340' },
  { pattern: /staples|office\s*depot/i, co: 'Office Supply Store', cat: 'Office Expense', type: 'business', code: '5210' },
  { pattern: /comcast|at&t|xfinity|verizon|t-mobile/i, co: 'Telecom', cat: 'Utilities', type: 'business', code: '5290' },
  { pattern: /electric|gas\s*co|water\s*co|pge|pg&e/i, co: 'Utility', cat: 'Utilities', type: 'business', code: '5290' },
  { pattern: /geico|progressive|allstate|state\s*farm|insurance/i, co: 'Insurance', cat: 'Insurance', type: 'business', code: '5170' },
  { pattern: /fiverr|upwork/i, co: 'Freelancer Platform', cat: 'Contract Labor', type: 'business', code: '5130' },
  { pattern: /payroll|adp|gusto/i, co: 'Payroll', cat: 'Wages', type: 'business', code: '5300' },
  { pattern: /attorney|lawyer|legal/i, co: 'Legal', cat: 'Legal & Professional', type: 'business', code: '5200' },
  { pattern: /cpa|accountant|bookkeep/i, co: 'Accounting', cat: 'Legal & Professional', type: 'business', code: '5200' },
  { pattern: /bank\s*fee|service\s*charge|wire\s*fee|maintenance\s*fee/i, co: 'Bank', cat: 'Bank & Processing Fees', type: 'business', code: '5330' },
  { pattern: /stripe|square|paypal\s*fee/i, co: 'Payment Processor', cat: 'Bank & Processing Fees', type: 'business', code: '5330' },
  { pattern: /netflix|hulu|disney|hbo/i, co: 'Streaming', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /spotify|apple\s*music/i, co: 'Music', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /walmart|target|costco/i, co: 'Retail', cat: 'Supplies', type: 'business', code: '5250' },
  { pattern: /cvs|walgreens/i, co: 'Pharmacy', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /gym|planet\s*fitness|equinox/i, co: 'Gym', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /grocery|whole\s*foods|kroger|safeway|publix|trader\s*joe/i, co: 'Grocery', cat: 'Personal Expense', type: 'personal', code: '5900' },
  { pattern: /direct\s*deposit|ach\s*credit|payment\s*received|deposit/i, co: 'Client Payment', cat: 'Gross Receipts / Sales', type: 'income', code: '4000' },
  { pattern: /refund|return\s*credit/i, co: 'Refund', cat: 'Other Income', type: 'income', code: '4010' },
  { pattern: /venmo|zelle|cashapp/i, co: 'P2P Payment', cat: 'Other Income', type: 'income', code: '4010' },
]

export function categorize(desc: string): CatResult {
  for (const rule of rules) {
    if (rule.pattern.test(desc)) {
      return { co: rule.co, cat: rule.cat, type: rule.type, code: rule.code }
    }
  }
  return { co: '', cat: 'Uncategorized', type: 'uncategorized', code: '' }
}

export function categorizeAll(descriptions: Array<{ id: number; desc: string }>): Array<{ id: number } & CatResult> {
  return descriptions.map(d => ({ id: d.id, ...categorize(d.desc) }))
}
