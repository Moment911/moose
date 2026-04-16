// Live-demo configs. Each one drives DemoMockPage + feeds an InlineSystemMock
// animation. The scenarios are illustrative — fabricated for demo purposes
// but structurally identical to the real systems we ship for clients.
//
// Each config has:
//   id, title, industry, scenario (long-form intro)
//   description      (used for <meta description>)
//   underTheHood[]   (ordered 4–5 step explanation under the mock)
//   mockConfig       (passed straight to InlineSystemMock)

import {
  Camera, FileText, Scale, ClipboardList, Wrench, Truck,
  DollarSign, Calculator,
} from 'lucide-react'

// Color palette — keep in sync with /lib/theme.ts
const R   = '#E6007E'
const T   = '#00C2CB'
const BLK = '#111111'
const AMB = '#f59e0b'
const GRN = '#16a34a'

export const DEMO_CONFIGS = {
  // ─────────────────────────────────────────────────────────────────
  // 1. Collision photo estimator — auto body
  // ─────────────────────────────────────────────────────────────────
  estimate: {
    id: 'estimate',
    industry: 'Auto body',
    title: 'Collision Photo Estimator — live.',
    scenario: 'A customer texts four damage photos. The AI identifies the vehicle, parses the affected panels, pulls OEM parts + labor rates, and writes an insurance-ready estimate in under 90 seconds.',
    description: 'Watch Koto\'s collision estimator build an insurance-ready repair estimate from four damage photos in under 90 seconds. Live auto-playing demo.',
    underTheHood: [
      'Vision model identifies the vehicle make/model/year from the license plate + VIN plate, cross-referenced against the DMV API.',
      'Damage classification segments each affected panel (bumper, trunk lid, quarter panels) and grades severity against a training set of 40k historical claims.',
      'Parts lookup hits the OEM parts catalog (Mitchell/CCC) and the aftermarket equivalents, defaulting to OEM when the insurer requires it.',
      'Labor pricing pulls your shop\'s current door rate and paint schedule, plus blending hours based on the panel map.',
      'Output drops as an insurance-ready PDF into the claim file + texts the customer a scheduling link — all before a human touches it.',
    ],
    mockConfig: {
      browserUrl: 'coastal-bodyshop.com / estimate',
      leftIcon: Camera, leftEyebrow: 'Customer submission',
      source: { icon: Camera, label: 'Photos uploaded · 4 of 4', sub: '2019 Honda Accord EX-L · rear-end collision', status: 'ANALYZING' },
      fields: [
        { step: 1, label: 'Vehicle',       value: '2019 Honda Accord EX-L Sedan' },
        { step: 2, label: 'VIN',           value: '1HGCV1F34KA012347' },
        { step: 3, label: 'Mileage',       value: '47,820 mi' },
        { step: 4, label: 'Impact area',   value: 'Rear bumper · trunk lid · both quarter panels' },
        { step: 5, label: 'Severity',      value: 'Moderate · structural check needed' },
        { step: 6, label: 'Paint match',   value: 'Modern Steel Metallic (NH-797M)' },
      ],
      rightIcon: FileText, rightEyebrow: 'Auto-generated estimate',
      calculatingText: 'Pricing OEM parts, labor hours, paint + blending...',
      outputTitle: 'Estimate #RE-2471',
      outputSub: 'Insurance-ready',
      lines: [
        { step: 10, label: 'Rear bumper cover (OEM)',     amount: 624 },
        { step: 11, label: 'Trunk lid replacement',       amount: 1280 },
        { step: 12, label: 'Quarter panel repair (both)', amount: 1440 },
        { step: 13, label: 'Paint + blending (4 panels)', amount: 1150 },
        { step: 14, label: 'Labor · 18 hrs @ $62/hr',     amount: 1116 },
      ],
      subtotal: 5610, tax: 0, total: 5610,
      totalLabel: 'Estimate total',
      confirmText: 'Estimate PDF sent to customer + Allstate claim #4427891',
      confirmHint: '94s end-to-end',
      footerLabel: 'Coastal Body Shop · illustrative demo',
      footerStats: [
        { label: 'Typical throughput', value: '14 / day' },
        { label: 'Avg generate time',  value: '92s' },
        { label: 'Close rate lift',    value: '+24%' },
      ],
      accent: T,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // 2. Law firm intake qualifier
  // ─────────────────────────────────────────────────────────────────
  intake: {
    id: 'intake',
    industry: 'Law firm',
    title: 'Matter Intake Qualifier — live.',
    scenario: 'A prospect submits the web form. The AI matches the matter type, runs a conflict check across the firm\'s case management system, scores urgency and value, and books the consult on the right attorney\'s calendar — with a drafted intake memo ready before the meeting.',
    description: 'Watch Koto\'s law-firm intake agent qualify a new matter, run conflicts, score severity, and schedule the consult — all in under 30 seconds. Live auto-playing demo.',
    underTheHood: [
      'Matter classifier maps the description to the firm\'s practice areas — here, a motor-vehicle personal-injury case with potential third-party liability.',
      'Conflict check queries the existing case management system on both the prospect and the at-fault driver against the firm\'s entire client base.',
      'Severity + value model scores urgency (statute of limitations pressure, injury type) and estimated engagement value from 8 years of historical outcomes.',
      'Routing picks the attorney whose calendar fits and whose expertise matches (auto-injury specialist) — the consult drops into their calendar with zero human touch.',
      'Intake memo drafted from the conversation + verified data sources; attorney reads it in 90 seconds before the consult instead of starting cold.',
    ],
    mockConfig: {
      browserUrl: 'morales-law.com / intake',
      leftIcon: ClipboardList, leftEyebrow: 'Web form submission',
      source: { icon: Scale, label: 'New matter · submitted 00:02 ago', sub: 'Personal injury · motor vehicle', status: 'QUALIFYING' },
      fields: [
        { step: 1, label: 'Prospect',           value: 'Michael Alvarez' },
        { step: 2, label: 'Matter type',        value: 'Personal injury — rear-end collision' },
        { step: 3, label: 'Injury',             value: 'Whiplash + disc herniation (confirmed MRI)' },
        { step: 4, label: 'At-fault driver',    value: 'Jamie Weston · insured Geico' },
        { step: 5, label: 'Statute clock',      value: '22 months remaining (FL 4-year)' },
        { step: 6, label: 'Conflict check',     value: 'CLEAR — no prior representation either party' },
      ],
      rightIcon: FileText, rightEyebrow: 'Case intake assessment',
      calculatingText: 'Scoring severity, value, attorney fit, calendar...',
      outputTitle: 'Intake #PI-2026-0419',
      outputSub: 'Routed to Dr. Morales',
      lines: [
        { step: 10, label: 'Severity score',             amount: '8.4 / 10', prefix: '' },
        { step: 11, label: 'Urgency rating',             amount: 'High',     prefix: '' },
        { step: 12, label: 'Est. engagement value',      amount: 185000 },
        { step: 13, label: 'Contingency (33⅓%)',          amount: 61605 },
        { step: 14, label: 'Consult scheduled',          amount: 'Thu 10:30 AM', prefix: '' },
      ],
      subtotal: null, tax: null, total: null,
      currency: '$',
      totalLabel: 'Expected fee',
      confirmText: 'Consult booked · intake memo drafted · Dr. Morales notified',
      confirmHint: '28s end-to-end',
      footerLabel: 'Morales & Associates · illustrative demo',
      footerStats: [
        { label: 'Typical intakes / day', value: '11' },
        { label: 'Time saved per intake', value: '18 min' },
        { label: 'Qualified-to-consult',  value: '64%' },
      ],
      accent: BLK,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. HVAC dispatch
  // ─────────────────────────────────────────────────────────────────
  dispatch: {
    id: 'dispatch',
    industry: 'HVAC',
    title: 'Dispatch Assistant — live.',
    scenario: 'A dead-AC service call comes in at 2 PM on the hottest day of the year. The AI triages urgency, checks parts across the warehouse and every truck, matches tech certifications, routes the nearest qualified technician, and texts the customer an ETA — all in under 5 seconds.',
    description: 'Watch Koto\'s HVAC dispatch assistant triage an emergency service call, check parts, match tech skills, and route the nearest qualified technician — all in under 5 seconds.',
    underTheHood: [
      'Triage model classifies the incoming call by urgency (life-safety > no-AC-in-heatwave > routine maintenance) and estimates job complexity.',
      'Parts lookup queries your warehouse inventory + every truck\'s live stock for the specific compressor + capacitor combination needed.',
      'Technician matching pulls certifications (EPA 608 Universal required here), current job status, and real-time drive-time via Google Maps.',
      'Dispatch writes the work order, texts the technician with context + customer address + access notes, and shares a live-tracked ETA link with the customer.',
      'The whole sequence is auditable — every routing decision is logged so you can tune the triage model against actual outcomes.',
    ],
    mockConfig: {
      browserUrl: 'coastal-hvac.com / dispatch',
      leftIcon: Wrench, leftEyebrow: 'Incoming service call',
      source: { icon: Wrench, label: 'Inbound · 00:04 ago', sub: 'Dead AC · residential · no power to outdoor unit', status: 'TRIAGING' },
      fields: [
        { step: 1, label: 'Caller',            value: 'Janet Moreno · (561) 555-0192' },
        { step: 2, label: 'Address',           value: '8412 Winding Oaks Dr, Lake Worth FL 33467' },
        { step: 3, label: 'System',            value: 'Carrier 24ABC6 · installed 2019' },
        { step: 4, label: 'Symptom',           value: 'Outdoor unit silent · thermostat set 72°F · ambient 94°F' },
        { step: 5, label: 'Triage',            value: 'NO-COOL emergency · 4.2 urgency score' },
        { step: 6, label: 'Likely cause',      value: '70% capacitor · 20% contactor · 10% compressor' },
      ],
      rightIcon: Truck, rightEyebrow: 'Dispatch decision',
      calculatingText: 'Matching parts inventory, tech skills, live drive-time...',
      outputTitle: 'Work Order #WO-7814',
      outputSub: 'Dispatched',
      lines: [
        { step: 10, label: 'Tech assigned',             amount: 'Marco R. · Truck 07', prefix: '' },
        { step: 11, label: 'Drive time',                amount: '11 min',             prefix: '' },
        { step: 12, label: 'Parts on truck',            amount: 'Capacitor + contactor ✓', prefix: '' },
        { step: 13, label: 'Cert required',             amount: 'EPA 608 Universal ✓', prefix: '' },
        { step: 14, label: 'Customer ETA text sent',    amount: '2:17 PM',            prefix: '' },
      ],
      subtotal: null, tax: null, total: null,
      totalLabel: 'Dispatch time',
      confirmText: 'Marco R. dispatched · customer notified · live tracking link sent',
      confirmHint: '4.1s end-to-end',
      footerLabel: 'Coastal HVAC · illustrative demo',
      footerStats: [
        { label: 'Avg dispatch time', value: '4 min' },
        { label: 'First-time fix',    value: '92%' },
        { label: 'CSAT',              value: '4.9 / 5' },
      ],
      accent: AMB,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // 4. Mortgage pre-qualification
  // ─────────────────────────────────────────────────────────────────
  preQual: {
    id: 'pre-qual',
    industry: 'Mortgage',
    title: 'Pre-Qualification Agent — live.',
    scenario: 'A prospective buyer wants to know what they qualify for at 10 PM on a Sunday. The AI walks them through the conversation, collects income + assets + debts, runs a soft-pull, and returns a precise loan program + payment schedule.',
    description: 'Watch Koto\'s mortgage pre-qualification agent collect a full borrower profile, run a soft-pull, and return specific loan program + payment options — in under 3 minutes, at 10 PM on a Sunday.',
    underTheHood: [
      'Conversational intake collects 14 data points through a natural dialogue — income sources, assets, debts, employment history, housing goals.',
      'Soft-pull credit (with consent) returns the FICO score + tradelines; DTI calculated in real-time from the debts captured plus the pulled tradelines.',
      'Loan program matching runs against the current rate sheet for conventional, FHA, VA, and jumbo programs — eliminating anything the borrower can\'t qualify for.',
      'Payment schedule generates principal + interest + estimated taxes + insurance at the borrower\'s target price point, with sensitivity on down payment.',
      'Warm hand-off: the loan officer gets a briefed prospect on Monday morning with the profile, program options, and borrower preferences already captured.',
    ],
    mockConfig: {
      browserUrl: 'everstone-lending.com / pre-qual',
      leftIcon: DollarSign, leftEyebrow: 'Borrower profile',
      source: { icon: DollarSign, label: 'Conversational intake · 14 fields', sub: 'Primary residence · FL · first-time buyer', status: 'PROCESSING' },
      fields: [
        { step: 1, label: 'Borrower',           value: 'Kendall Prescott · 34' },
        { step: 2, label: 'Annual income',      value: '$142,000 (W-2) + $18,400 (bonus · 3-yr avg)' },
        { step: 3, label: 'Monthly debts',      value: '$580 auto · $245 credit cards' },
        { step: 4, label: 'Assets',             value: '$68,400 liquid · $44,200 retirement' },
        { step: 5, label: 'Credit (soft-pull)', value: '758 FICO · 14 tradelines · 0 late 24mo' },
        { step: 6, label: 'Target price',       value: '$485,000 · 15% down' },
      ],
      rightIcon: Calculator, rightEyebrow: 'Pre-qualification result',
      calculatingText: 'Running DTI, LTV, rate sheet, payment schedule...',
      outputTitle: 'Pre-Qual #PQ-88421',
      outputSub: 'QUALIFIED',
      lines: [
        { step: 10, label: 'Program',                     amount: '30-yr Conv. 15% down', prefix: '' },
        { step: 11, label: 'Loan amount',                 amount: 412250 },
        { step: 12, label: 'Rate (today)',                amount: '6.625%', prefix: '' },
        { step: 13, label: 'Est. P&I payment / mo',       amount: 2640 },
        { step: 14, label: 'DTI (back-end)',              amount: '32.4%', prefix: '' },
      ],
      subtotal: null, tax: null, total: null,
      totalLabel: 'Max qualified',
      confirmText: 'Pre-qual PDF sent · LO briefed · Monday 9 AM follow-up booked',
      confirmHint: '2m 48s end-to-end',
      footerLabel: 'Everstone Lending · illustrative demo',
      footerStats: [
        { label: 'After-hours captured',   value: '47%' },
        { label: 'Avg pre-qual time',      value: '2.8 min' },
        { label: 'Qualified-to-close',     value: '61%' },
      ],
      accent: GRN,
    },
  },
}
