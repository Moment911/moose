import { COAAccount } from './KotoFin.types'

export const DEFAULT_COA: COAAccount[] = [
  { code: '1000', name: 'Checking Account', type: 'asset', scLine: null },
  { code: '1010', name: 'Savings Account', type: 'asset', scLine: null },
  { code: '1020', name: 'Credit Card Payable', type: 'liability', scLine: null },
  { code: '4000', name: 'Gross Receipts / Sales', type: 'income', scLine: 'L1' },
  { code: '4010', name: 'Other Income', type: 'income', scLine: 'L6' },
  { code: '5100', name: 'Advertising', type: 'expense', scLine: 'L8' },
  { code: '5110', name: 'Car & Truck Expenses', type: 'expense', scLine: 'L9' },
  { code: '5120', name: 'Commissions & Fees', type: 'expense', scLine: 'L10' },
  { code: '5130', name: 'Contract Labor', type: 'expense', scLine: 'L11' },
  { code: '5150', name: 'Depreciation', type: 'expense', scLine: 'L13' },
  { code: '5160', name: 'Employee Benefits', type: 'expense', scLine: 'L14' },
  { code: '5170', name: 'Insurance', type: 'expense', scLine: 'L15' },
  { code: '5180', name: 'Mortgage Interest', type: 'expense', scLine: 'L16a' },
  { code: '5190', name: 'Other Interest', type: 'expense', scLine: 'L16b' },
  { code: '5200', name: 'Legal & Professional', type: 'expense', scLine: 'L17' },
  { code: '5210', name: 'Office Expense', type: 'expense', scLine: 'L18' },
  { code: '5220', name: 'Rent - Vehicles', type: 'expense', scLine: 'L20a' },
  { code: '5230', name: 'Rent - Other', type: 'expense', scLine: 'L20b' },
  { code: '5240', name: 'Repairs & Maintenance', type: 'expense', scLine: 'L21' },
  { code: '5250', name: 'Supplies', type: 'expense', scLine: 'L22' },
  { code: '5260', name: 'Taxes & Licenses', type: 'expense', scLine: 'L23' },
  { code: '5270', name: 'Travel', type: 'expense', scLine: 'L24a' },
  { code: '5280', name: 'Meals (50% deductible)', type: 'expense', scLine: 'L24b' },
  { code: '5290', name: 'Utilities', type: 'expense', scLine: 'L25' },
  { code: '5300', name: 'Wages', type: 'expense', scLine: 'L26' },
  { code: '5310', name: 'Home Office', type: 'expense', scLine: 'L30' },
  { code: '5320', name: 'Software & Subscriptions', type: 'expense', scLine: 'L27a' },
  { code: '5330', name: 'Bank & Processing Fees', type: 'expense', scLine: 'L27a' },
  { code: '5340', name: 'Shipping & Postage', type: 'expense', scLine: 'L27a' },
  { code: '5350', name: 'Vehicle Mileage', type: 'expense', scLine: 'L9' },
  { code: '5900', name: 'Personal Expense', type: 'personal', scLine: null },
]

export interface CatRule {
  pattern: RegExp
  co: string
  cat: string
  type: 'business' | 'personal' | 'income'
  code: string
}

export const CATEGORIZATION_RULES: CatRule[] = [
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

export const TAX_BRACKETS_2024 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
]

export const STANDARD_DEDUCTION_SINGLE = 14600
export const STANDARD_DEDUCTION_MFJ = 29200
export const SS_WAGE_BASE = 168600
export const SE_TAX_RATE = 0.153
export const SS_RATE = 0.124
export const MEDICARE_RATE = 0.029
export const ADDITIONAL_MEDICARE_RATE = 0.009
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000
export const IRS_MILEAGE_RATE = 0.67

export const QUARTERLY_DUE_DATES = [
  { quarter: 'Q1', period: 'Jan 1 – Mar 31', due: 'Apr 15, 2024' },
  { quarter: 'Q2', period: 'Apr 1 – May 31', due: 'Jun 17, 2024' },
  { quarter: 'Q3', period: 'Jun 1 – Aug 31', due: 'Sep 16, 2024' },
  { quarter: 'Q4', period: 'Sep 1 – Dec 31', due: 'Jan 15, 2025' },
]

export const BANK_COLORS: Record<string, string> = {
  Chase: '#0060f0',
  'Capital One': '#d03027',
  'Navy Federal': '#003366',
  'Bank of America': '#e31837',
  Citibank: '#003b70',
  'Wells Fargo': '#d71e28',
  Amex: '#006fcf',
  'US Bank': '#0c2074',
  PNC: '#f58025',
  'TD Bank': '#34a853',
  Discover: '#ff6000',
  'CSV Import': '#888888',
  Unknown: '#888888',
}

export const TAB_LIST = [
  'Dashboard',
  'Company Info',
  'Upload',
  'Transactions',
  'Chart of Accounts',
  'Deduction Finder',
  'Tax Profile',
  'Tax Scenarios',
  'Quarterly Tax',
  'Receipts',
  'Recurring',
  'Analytics',
  'Reports',
  'Export',
  'AI Advisor',
  'Help',
] as const
