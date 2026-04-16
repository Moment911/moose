"use client"
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import PublicNav from '../components/public/PublicNav'
import { R, T, BLK, GRY, W, FH, FB } from '../lib/theme'
import { ShoppingCart, Package, Coffee, UtensilsCrossed, Droplets, Box, Truck, Check, Plus, Minus, Trash2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react'

/* ── Product Catalog ──────────────────────────────────────────────────────── */

const SANDWICHES = [
  { id: 'turkey-swiss', name: 'Turkey & Swiss', desc: 'Oven-roasted turkey, Swiss cheese, lettuce, tomato on multigrain', cogs: 3.25, listPrice: 8.95, weight_oz: 10, calories: 420 },
  { id: 'ham-cheddar', name: 'Ham & Cheddar', desc: 'Black forest ham, sharp cheddar, mustard, lettuce on sourdough', cogs: 3.10, listPrice: 8.95, weight_oz: 10, calories: 450 },
  { id: 'roast-beef', name: 'Roast Beef & Provolone', desc: 'Premium roast beef, provolone, horseradish aioli, arugula on ciabatta', cogs: 4.15, listPrice: 10.95, weight_oz: 12, calories: 520 },
  { id: 'italian-sub', name: 'Italian Sub', desc: 'Salami, capicola, ham, provolone, oil & vinegar, peppers on Italian roll', cogs: 3.85, listPrice: 10.95, weight_oz: 13, calories: 580 },
  { id: 'chicken-wrap', name: 'Grilled Chicken Wrap', desc: 'Grilled chicken, romaine, parmesan, Caesar dressing in flour tortilla', cogs: 3.50, listPrice: 9.95, weight_oz: 11, calories: 460 },
  { id: 'veggie', name: 'Garden Veggie', desc: 'Hummus, avocado, cucumber, sprouts, tomato, red onion on wheat', cogs: 2.45, listPrice: 8.45, weight_oz: 9, calories: 340 },
  { id: 'blt', name: 'Classic BLT', desc: 'Thick-cut bacon, lettuce, tomato, mayo on toasted white', cogs: 3.00, listPrice: 8.95, weight_oz: 9, calories: 480 },
  { id: 'club', name: 'Turkey Club', desc: 'Turkey, bacon, lettuce, tomato, mayo, triple-decker on white', cogs: 4.00, listPrice: 10.95, weight_oz: 13, calories: 550 },
]

const SIDES = [
  { id: 'chips-regular', name: 'Kettle Chips', cogs: 0.45, listPrice: 1.50, weight_oz: 1.5 },
  { id: 'chips-bbq', name: 'BBQ Chips', cogs: 0.45, listPrice: 1.50, weight_oz: 1.5 },
  { id: 'apple', name: 'Fresh Apple', cogs: 0.60, listPrice: 1.75, weight_oz: 6 },
  { id: 'fruit-cup', name: 'Mixed Fruit Cup', cogs: 1.10, listPrice: 2.95, weight_oz: 6 },
  { id: 'cookie-choc', name: 'Chocolate Chip Cookie', cogs: 0.55, listPrice: 1.95, weight_oz: 2 },
  { id: 'brownie', name: 'Fudge Brownie', cogs: 0.65, listPrice: 2.25, weight_oz: 3 },
  { id: 'pasta-salad', name: 'Pasta Salad', cogs: 0.85, listPrice: 2.50, weight_oz: 5 },
  { id: 'coleslaw', name: 'Coleslaw Cup', cogs: 0.55, listPrice: 1.75, weight_oz: 4 },
]

const DRINKS = [
  { id: 'water', name: 'Bottled Water', cogs: 0.20, listPrice: 1.50, weight_oz: 17 },
  { id: 'soda-coke', name: 'Coca-Cola', cogs: 0.35, listPrice: 1.95, weight_oz: 12 },
  { id: 'soda-diet', name: 'Diet Coke', cogs: 0.35, listPrice: 1.95, weight_oz: 12 },
  { id: 'juice-apple', name: 'Apple Juice', cogs: 0.50, listPrice: 2.25, weight_oz: 10 },
  { id: 'juice-orange', name: 'Orange Juice', cogs: 0.50, listPrice: 2.25, weight_oz: 10 },
  { id: 'lemonade', name: 'Lemonade', cogs: 0.40, listPrice: 1.95, weight_oz: 12 },
]

const EXTRAS = [
  { id: 'silverware-plastic', name: 'Plastic Silverware Set', desc: 'Fork, knife, spoon', cogs: 0.08, listPrice: 0.25, weight_oz: 0.5 },
  { id: 'napkins-2', name: 'Napkins (2-pack)', cogs: 0.03, listPrice: 0.10, weight_oz: 0.2 },
  { id: 'napkins-4', name: 'Napkins (4-pack)', cogs: 0.05, listPrice: 0.15, weight_oz: 0.4 },
  { id: 'condiment-mayo', name: 'Mayo Packet', cogs: 0.04, listPrice: 0.15, weight_oz: 0.3 },
  { id: 'condiment-mustard', name: 'Mustard Packet', cogs: 0.04, listPrice: 0.15, weight_oz: 0.3 },
  { id: 'condiment-ketchup', name: 'Ketchup Packet', cogs: 0.04, listPrice: 0.15, weight_oz: 0.3 },
  { id: 'condiment-ranch', name: 'Ranch Packet', cogs: 0.06, listPrice: 0.20, weight_oz: 0.5 },
  { id: 'condiment-italian', name: 'Italian Dressing Packet', cogs: 0.06, listPrice: 0.20, weight_oz: 0.5 },
  { id: 'salt-pepper', name: 'Salt & Pepper Packets', cogs: 0.03, listPrice: 0.10, weight_oz: 0.2 },
  { id: 'wet-wipe', name: 'Wet Wipe', cogs: 0.05, listPrice: 0.15, weight_oz: 0.3 },
  { id: 'mint', name: 'Mint', cogs: 0.03, listPrice: 0.10, weight_oz: 0.1 },
]

const CONTAINERS = [
  { id: 'paper-box', name: 'Kraft Paper Box', desc: '9" x 6" x 3.5" — eco-friendly, compostable', cogs: 0.45, listPrice: 0.75, weight_oz: 2, dims: '9" x 6" x 3.5"' },
  { id: 'plastic-clamshell', name: 'Clear Plastic Clamshell', desc: '9" x 6" x 3" — see-through, recyclable', cogs: 0.35, listPrice: 0.65, weight_oz: 1.5, dims: '9" x 6" x 3"' },
]

const SHIPPING = {
  mediumBox: { name: 'Medium Shipping Box', dims: '18" x 14" x 12"', weight_empty_lbs: 1.5, capacity: 12, l: 18, w: 14, h: 12 },
  pallet: { name: 'Standard Pallet', dims: '48" x 40" x 6"', maxBoxes: 48, maxLunches: 576, l: 48, w: 40, h: 6 },
}

const VEHICLES = [
  { id: 'cargo-van', name: 'Cargo Van', dims: '6\' x 4\' x 4.5\'', l: 72, w: 48, h: 54, pallets: 1, maxBoxes: 24, maxMeals: 288 },
  { id: 'sprinter', name: 'Sprinter Van', dims: '12\' x 6\' x 6\'', l: 144, w: 72, h: 72, pallets: 2, maxBoxes: 72, maxMeals: 864 },
  { id: 'box-12', name: 'Box Truck 12\'', dims: '12\' x 7\' x 6\'', l: 144, w: 84, h: 72, pallets: 3, maxBoxes: 96, maxMeals: 1152 },
  { id: 'box-16', name: 'Box Truck 16\'', dims: '16\' x 7\' x 7\'', l: 192, w: 84, h: 84, pallets: 4, maxBoxes: 144, maxMeals: 1728 },
  { id: 'box-26', name: 'Box Truck 26\'', dims: '26\' x 8\' x 8\'', l: 312, w: 96, h: 96, pallets: 8, maxBoxes: 288, maxMeals: 3456 },
]

/* All ad-hoc-able items flattened into one list */
const ALL_ADHOC_ITEMS = [
  ...SIDES.map(s => ({ ...s, category: 'Side' })),
  ...DRINKS.map(d => ({ ...d, category: 'Drink' })),
  ...EXTRAS.map(e => ({ ...e, category: 'Extra' })),
]

/* ── Styles ───────────────────────────────────────────────────────────────── */

const card = {
  background: W, border: '1px solid #e5e7eb', borderRadius: 16,
  padding: 24, marginBottom: 20,
}
const sectionTitle = {
  fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK,
  margin: 0, letterSpacing: '-.02em',
}
const label = {
  fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4,
  display: 'block', fontFamily: FH,
}
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB,
  outline: 'none', transition: 'border-color .15s', boxSizing: 'border-box',
}
const btnPrimary = {
  background: R, color: W, border: 'none', borderRadius: 10,
  padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: FH, letterSpacing: '-.01em', transition: 'opacity .15s',
  width: '100%',
}
const btnSecondary = {
  background: W, color: R, border: `1px solid ${R}`, borderRadius: 10,
  padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  fontFamily: FH, letterSpacing: '-.01em', transition: 'all .15s',
}
const thStyle = {
  fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
  letterSpacing: '.06em', padding: '8px 10px', textAlign: 'left', fontFamily: FH,
  borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
}
const tdStyle = {
  fontSize: 12, color: '#374151', padding: '10px 10px', borderBottom: '1px solid #f3f4f6',
  fontFamily: FB, verticalAlign: 'middle',
}

function fmt(n) { return '$' + n.toFixed(2) }
function fmtLbs(oz) { return (oz / 16).toFixed(1) + ' lbs' }

/* ── Helpers: compute per-meal totals ─────────────────────────────────────── */

function computeMealLine(line) {
  const sw = SANDWICHES.find(s => s.id === line.sandwich)
  const ct = CONTAINERS.find(c => c.id === line.container)
  const sd = SIDES.filter(s => line.sides.includes(s.id))
  const dk = DRINKS.find(d => d.id === line.drink)
  const ex = EXTRAS.filter(e => line.extras.includes(e.id))

  let price = 0, cogs = 0, weight = 0
  if (sw) { price += sw.listPrice; cogs += sw.cogs; weight += sw.weight_oz }
  if (ct) { price += ct.listPrice; cogs += ct.cogs; weight += ct.weight_oz }
  sd.forEach(s => { price += s.listPrice; cogs += s.cogs; weight += s.weight_oz })
  if (dk) { price += dk.listPrice; cogs += dk.cogs; weight += dk.weight_oz }
  ex.forEach(e => { price += e.listPrice; cogs += e.cogs; weight += e.weight_oz })

  return { price, cogs, weight, lineTotal: price * line.qty, lineCogs: cogs * line.qty, lineWeight: weight * line.qty }
}

/* ── Demo Banner — shown in public demo mode only ─────────────────────────── */

function DemoBanner({ onBookCall }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #fde7f1, #cff8fa)',
      borderBottom: '1px solid #e5e7eb',
      padding: '14px 32px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      fontFamily: FH,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em',
        textTransform: 'uppercase',
        background: W, border: '1px solid #e5e7eb', borderRadius: 100,
        padding: '4px 10px',
      }}>
        <Sparkles size={11} /> Live demo
      </span>
      <span style={{ fontSize: 14, color: BLK, fontWeight: 600, flex: 1, minWidth: 240 }}>
        <strong>Koto AI is auto-filling this order in real time.</strong>
        <span style={{ color: '#6b7280', fontWeight: 500 }}> Watch the summary on the right update as meals, extras, shipping, and pricing populate — no humans touching the keyboard.</span>
      </span>
      <button onClick={onBookCall} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '9px 18px', borderRadius: 8, border: 'none',
        background: BLK, color: W, fontSize: 13, fontWeight: 700, fontFamily: FH,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        Build one for your business <ArrowRight size={13} />
      </button>
    </div>
  )
}

/* ── Toast Component ──────────────────────────────────────────────────────── */

function Toast({ message, type, onClose }) {
  if (!message) return null
  const bg = type === 'error' ? '#fef2f2' : '#f0fdf4'
  const border = type === 'error' ? '#fca5a5' : '#86efac'
  const color = type === 'error' ? '#991b1b' : '#166534'
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      background: bg, border: `1px solid ${border}`, borderRadius: 12,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 400, animation: 'fadeIn .2s',
    }}>
      {type === 'error' ? <AlertCircle size={16} style={{ color, flexShrink: 0 }} /> : <Check size={16} style={{ color, flexShrink: 0 }} />}
      <span style={{ fontSize: 13, color, fontFamily: FH, fontWeight: 600 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', marginLeft: 8 }}>x</button>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function KotoOrderPage({ demoMode = false }) {
  const navigate = useNavigate()

  /* ── Meal Builder State ── */
  const [mealContainer, setMealContainer] = useState('paper-box')
  const [mealSandwich, setMealSandwich] = useState(null)
  const [mealSides, setMealSides] = useState([])
  const [mealDrink, setMealDrink] = useState(null)
  const [mealExtras, setMealExtras] = useState([])
  const [mealQty, setMealQty] = useState(1)

  /* ── Order Lines (array of meal configs) ── */
  const [orderLines, setOrderLines] = useState([])

  /* ── Ad-Hoc Items ── */
  const [adhocItemId, setAdhocItemId] = useState('')
  const [adhocQty, setAdhocQty] = useState(1)
  const [adhocLines, setAdhocLines] = useState([])

  /* ── Order Details ── */
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [company, setCompany] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('invoice')
  const [creditAccount, setCreditAccount] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [paid, setPaid] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState('box-12')
  const [showPricing, setShowPricing] = useState(false)
  const [priceOverrides, setPriceOverrides] = useState({}) // { itemId: { cogs, listPrice } }

  /* ── Toast ── */
  const [toast, setToast] = useState({ message: '', type: 'success' })

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 4000)
  }

  /* ── Autofill demo — runs when demoMode prop is true ──────────────────
     Staged sequence fills customer, delivery, 3 meals, ad-hoc items, and
     payment over ~11s so prospects can watch every field populate and the
     summary rebuild live. Pure client-side; writes no data. */
  useEffect(() => {
    if (!demoMode) return

    // Next-Friday delivery date in ISO (yyyy-mm-dd)
    const d = new Date()
    const offset = ((5 - d.getDay() + 7) % 7) || 7  // at least 1 week out, on a Friday
    d.setDate(d.getDate() + offset + 7)
    const deliveryIso = d.toISOString().slice(0, 10)

    const steps = [
      // Contact + company
      [700,   () => { setContactName('Sarah Chen');           showToast('AI: pulling contact from invitation…') }],
      [1050,  () => setCompany('Apex Dental Group')],
      [1350,  () => setContactEmail('sarah.chen@apexdental.example')],
      [1650,  () => setContactPhone('(305) 555-0184')],
      [1950,  () => setPoNumber('APX-2026-04')],

      // Delivery
      [2300,  () => { setDeliveryDate(deliveryIso);           showToast('AI: scheduling for next open Friday') }],
      [2550,  () => setDeliveryTime('11:30')],
      [2900,  () => setDeliveryAddress('1441 Brickell Ave, Suite 1420, Miami FL 33131')],

      // Meal 1 — Turkey & Swiss × 12
      [3400,  () => { setMealSandwich('turkey-swiss');        showToast('AI: building Meal 1 — Turkey & Swiss') }],
      [3700,  () => setMealSides(['chips-regular', 'fruit-cup'])],
      [4000,  () => setMealDrink('water')],
      [4300,  () => setMealExtras(['silverware-plastic', 'napkins-2', 'salt-pepper'])],
      [4600,  () => setMealQty(12)],
      [5200,  () => {
        setOrderLines(prev => [...prev, {
          id: Date.now() + 1,
          sandwich: 'turkey-swiss', container: 'paper-box',
          sides: ['chips-regular', 'fruit-cup'], drink: 'water',
          extras: ['silverware-plastic', 'napkins-2', 'salt-pepper'], qty: 12,
        }])
        setMealSandwich(null); setMealSides([]); setMealDrink(null); setMealExtras([]); setMealQty(1)
      }],

      // Meal 2 — Chicken Wrap × 8
      [5800,  () => { setMealSandwich('chicken-wrap');        showToast('AI: building Meal 2 — Grilled Chicken Wrap') }],
      [6100,  () => setMealSides(['chips-bbq', 'brownie'])],
      [6400,  () => setMealDrink('lemonade')],
      [6700,  () => setMealExtras(['silverware-plastic', 'napkins-2', 'condiment-ranch'])],
      [7000,  () => setMealQty(8)],
      [7600,  () => {
        setOrderLines(prev => [...prev, {
          id: Date.now() + 2,
          sandwich: 'chicken-wrap', container: 'paper-box',
          sides: ['chips-bbq', 'brownie'], drink: 'lemonade',
          extras: ['silverware-plastic', 'napkins-2', 'condiment-ranch'], qty: 8,
        }])
        setMealSandwich(null); setMealSides([]); setMealDrink(null); setMealExtras([]); setMealQty(1)
      }],

      // Meal 3 — Veggie × 5
      [8200,  () => { setMealSandwich('veggie');              showToast('AI: building Meal 3 — Garden Veggie') }],
      [8500,  () => setMealSides(['fruit-cup', 'apple'])],
      [8800,  () => setMealDrink('juice-apple')],
      [9100,  () => setMealExtras(['silverware-plastic', 'napkins-2'])],
      [9400,  () => setMealQty(5)],
      [10000, () => {
        setOrderLines(prev => [...prev, {
          id: Date.now() + 3,
          sandwich: 'veggie', container: 'paper-box',
          sides: ['fruit-cup', 'apple'], drink: 'juice-apple',
          extras: ['silverware-plastic', 'napkins-2'], qty: 5,
        }])
        setMealSandwich(null); setMealSides([]); setMealDrink(null); setMealExtras([]); setMealQty(1)
      }],

      // Ad-hoc + final details
      [10500, () => {
        setAdhocLines(prev => [...prev, { id: Date.now() + 4, itemId: 'napkins-4', name: 'Napkins (4-pack)', category: 'Extra', listPrice: 0.15, cogs: 0.05, weight_oz: 0.4, qty: 5 }])
        showToast('AI: added napkin + wet-wipe spares')
      }],
      [10700, () => {
        setAdhocLines(prev => [...prev, { id: Date.now() + 5, itemId: 'wet-wipe', name: 'Wet Wipe', category: 'Extra', listPrice: 0.15, cogs: 0.05, weight_oz: 0.3, qty: 25 }])
      }],
      [11000, () => setSpecialInstructions('Deliver to concierge desk in lobby. Building requires 30-min advance notice for catering carts.')],
      [11300, () => setSelectedVehicle('sprinter')],
      [11700, () => { setShowPricing(true); showToast('AI: order ready — review and place when you\'re satisfied') }],
    ]

    const timers = steps.map(([ms, fn]) => setTimeout(fn, ms))
    return () => timers.forEach(clearTimeout)
  }, [demoMode])

  /* ── Meal Builder Toggles ── */
  function toggleMealSide(id) {
    setMealSides(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (prev.length >= 2) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }
  function toggleMealExtra(id) {
    setMealExtras(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  /* ── Add Meal to Order ── */
  function addMealToOrder() {
    if (!mealSandwich) { showToast('Please select a sandwich', 'error'); return }
    if (!mealDrink) { showToast('Please select a drink', 'error'); return }
    const line = {
      id: Date.now(),
      sandwich: mealSandwich,
      container: mealContainer,
      sides: [...mealSides],
      drink: mealDrink,
      extras: [...mealExtras],
      qty: mealQty,
    }
    setOrderLines(prev => [...prev, line])
    // Reset builder
    setMealSandwich(null)
    setMealSides([])
    setMealDrink(null)
    setMealExtras([])
    setMealQty(1)
    showToast('Meal added to order')
  }

  function removeMealLine(id) {
    setOrderLines(prev => prev.filter(l => l.id !== id))
  }

  function updateMealLineQty(id, newQty) {
    setOrderLines(prev => prev.map(l => l.id === id ? { ...l, qty: Math.max(1, newQty) } : l))
  }

  /* ── Ad-Hoc Items ── */
  function addAdhocItem() {
    if (!adhocItemId) { showToast('Select an item', 'error'); return }
    const item = ALL_ADHOC_ITEMS.find(i => i.id === adhocItemId)
    if (!item) return
    setAdhocLines(prev => [...prev, { id: Date.now(), itemId: item.id, name: item.name, category: item.category, listPrice: item.listPrice, cogs: item.cogs, weight_oz: item.weight_oz, qty: adhocQty }])
    setAdhocItemId('')
    setAdhocQty(1)
    showToast('Item added')
  }

  function removeAdhocLine(id) {
    setAdhocLines(prev => prev.filter(l => l.id !== id))
  }

  /* ── Order Summary Computation ── */
  const summary = useMemo(() => {
    let totalMeals = 0, subtotalPrice = 0, subtotalCogs = 0, totalWeightOz = 0

    const mealDetails = orderLines.map(line => {
      const c = computeMealLine(line)
      totalMeals += line.qty
      subtotalPrice += c.lineTotal
      subtotalCogs += c.lineCogs
      totalWeightOz += c.lineWeight
      return { ...line, ...c }
    })

    let adhocTotalItems = 0, adhocSubtotal = 0, adhocCogs = 0, adhocWeightOz = 0
    adhocLines.forEach(a => {
      adhocTotalItems += a.qty
      adhocSubtotal += a.listPrice * a.qty
      adhocCogs += a.cogs * a.qty
      adhocWeightOz += a.weight_oz * a.qty
    })

    subtotalPrice += adhocSubtotal
    subtotalCogs += adhocCogs
    totalWeightOz += adhocWeightOz

    const grossMargin = subtotalPrice - subtotalCogs
    const marginPct = subtotalPrice > 0 ? (grossMargin / subtotalPrice * 100) : 0

    const shippingBoxes = Math.ceil(totalMeals / SHIPPING.mediumBox.capacity)
    const shippingBoxWeightOz = SHIPPING.mediumBox.weight_empty_lbs * 16
    const totalShipWeightOz = totalWeightOz + (shippingBoxes * shippingBoxWeightOz)
    const pallets = shippingBoxes > SHIPPING.pallet.maxBoxes ? Math.ceil(shippingBoxes / SHIPPING.pallet.maxBoxes) : (shippingBoxes > 0 && totalMeals > SHIPPING.pallet.maxLunches ? Math.ceil(totalMeals / SHIPPING.pallet.maxLunches) : 0)

    const containerDims = orderLines.length > 0
      ? CONTAINERS.find(c => c.id === orderLines[0].container)?.dims || ''
      : ''

    return {
      mealDetails, totalMeals, adhocTotalItems,
      subtotalPrice, subtotalCogs, grossMargin, marginPct,
      totalWeightOz, shippingBoxes, totalShipWeightOz, pallets,
      containerDims,
    }
  }, [orderLines, adhocLines])

  /* ── Place Order ── */
  function placeOrder() {
    if (!contactName) { showToast('Contact name is required', 'error'); return }
    if (!contactEmail) { showToast('Contact email is required', 'error'); return }
    if (!deliveryDate) { showToast('Delivery date is required', 'error'); return }
    if (!deliveryAddress) { showToast('Delivery address is required', 'error'); return }
    if (orderLines.length === 0) { showToast('Add at least one meal to the order', 'error'); return }
    showToast('Order placed successfully! Confirmation sent to ' + contactEmail)
  }

  /* ── Current meal builder preview ── */
  const builderPreview = useMemo(() => {
    if (!mealSandwich) return null
    const preview = computeMealLine({
      sandwich: mealSandwich, container: mealContainer,
      sides: mealSides, drink: mealDrink, extras: mealExtras, qty: mealQty,
    })
    return preview
  }, [mealSandwich, mealContainer, mealSides, mealDrink, mealExtras, mealQty])

  return (
    <div className="page-shell" style={{
      display: demoMode ? 'block' : 'flex',
      height: demoMode ? 'auto' : '100vh',
      minHeight: demoMode ? '100vh' : undefined,
      overflow: demoMode ? 'visible' : 'hidden',
      background: GRY, fontFamily: FB,
    }}>
      {demoMode ? (
        <>
          <PublicNav />
          <div style={{ height: 64 }} />
          <DemoBanner onBookCall={() => navigate('/contact')} />
        </>
      ) : (
        <Sidebar />
      )}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div style={{
        flex: demoMode ? 'none' : 1,
        display: 'flex', flexDirection: 'column',
        overflow: demoMode ? 'visible' : 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{ background: W, borderBottom: '1px solid #e5e7eb', padding: '20px 32px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: R + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={18} style={{ color: R }} />
            </div>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em' }}>
                KotoOrder — Boxed Lunch Catering
              </h1>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0', fontFamily: FH }}>
                Build meal lines, add ad-hoc items, and place catering orders
              </p>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{
          flex: demoMode ? 'none' : 1,
          overflow: demoMode ? 'visible' : 'auto',
          padding: '24px 32px 48px',
        }}>
          <div style={{ display: 'flex', gap: 24, maxWidth: 1400, alignItems: 'flex-start' }}>

            {/* ══════════ Left Column: Builder + Lines + Ad-Hoc + Order Details (60%) ══════════ */}
            <div style={{ flex: '0 0 60%', minWidth: 0 }}>

              {/* ── Meal Builder Card ── */}
              <div style={{ ...card, border: `1px solid ${R}20` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <UtensilsCrossed size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Build a Meal</h2>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH, marginLeft: 'auto' }}>
                    Each meal = sandwich + container + up to 2 sides + drink + extras
                  </span>
                </div>

                {/* Sandwich Selection */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>Sandwich</span>
                    <span style={{ fontSize: 10, color: R, fontWeight: 600 }}>required</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {SANDWICHES.map(s => (
                      <button key={s.id} onClick={() => setMealSandwich(s.id)} style={{
                        border: mealSandwich === s.id ? `2px solid ${R}` : '2px solid #e5e7eb',
                        borderRadius: 10, padding: 14, background: mealSandwich === s.id ? R + '06' : W,
                        cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH, marginBottom: 4 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.35, marginBottom: 6 }}>{s.desc}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: R }}>{fmt(s.listPrice)}</span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{s.calories} cal</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Container Selection */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Box size={14} style={{ color: R }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>Container</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {CONTAINERS.map(c => (
                      <button key={c.id} onClick={() => setMealContainer(c.id)} style={{
                        border: mealContainer === c.id ? `2px solid ${R}` : '2px solid #e5e7eb',
                        borderRadius: 10, padding: 16, background: mealContainer === c.id ? R + '06' : W,
                        cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Package size={18} style={{ color: mealContainer === c.id ? R : '#6b7280' }} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{c.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 6 }}>{c.desc}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: R }}>{fmt(c.listPrice)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sides */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Coffee size={14} style={{ color: R }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>Sides</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 10px', fontFamily: FH }}>Pick up to 2</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {SIDES.map(s => {
                      const sel = mealSides.includes(s.id)
                      return (
                        <button key={s.id} onClick={() => toggleMealSide(s.id)} style={{
                          border: sel ? `2px solid ${R}` : '1px solid #e5e7eb',
                          borderRadius: 8, padding: '10px 12px', background: sel ? R + '06' : W,
                          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: BLK, marginBottom: 4, fontFamily: FH }}>{s.name}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: R }}>{fmt(s.listPrice)}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Drink */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Droplets size={14} style={{ color: R }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>Drink</span>
                    <span style={{ fontSize: 10, color: R, fontWeight: 600 }}>required</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {DRINKS.map(d => {
                      const sel = mealDrink === d.id
                      return (
                        <button key={d.id} onClick={() => setMealDrink(d.id)} style={{
                          border: sel ? `2px solid ${R}` : '1px solid #e5e7eb',
                          borderRadius: 8, padding: '10px 12px', background: sel ? R + '06' : W,
                          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: BLK, marginBottom: 4, fontFamily: FH }}>{d.name}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: R }}>{fmt(d.listPrice)}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Extras */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Package size={14} style={{ color: R }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>Extras</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {EXTRAS.map(e => {
                      const sel = mealExtras.includes(e.id)
                      return (
                        <label key={e.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 8, cursor: 'pointer', transition: 'background .1s',
                          background: sel ? R + '06' : 'transparent',
                          border: sel ? `1px solid ${R}30` : '1px solid transparent',
                        }}>
                          <input type="checkbox" checked={sel} onChange={() => toggleMealExtra(e.id)} style={{ accentColor: R }} />
                          <span style={{ fontSize: 12, color: BLK, fontFamily: FH, flex: 1 }}>{e.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{fmt(e.listPrice)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Quantity + Add to Order */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                  <div>
                    <label style={label}>Quantity</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => setMealQty(Math.max(1, mealQty - 1))} style={{
                        width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                        background: W, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><Minus size={14} color="#374151" /></button>
                      <input type="number" min={1} value={mealQty}
                        onChange={e => setMealQty(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...inputStyle, width: 60, textAlign: 'center', fontWeight: 700 }} />
                      <button onClick={() => setMealQty(mealQty + 1)} style={{
                        width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                        background: W, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><Plus size={14} color="#374151" /></button>
                    </div>
                  </div>
                  {builderPreview && (
                    <div style={{ flex: 1, fontSize: 12, color: '#6b7280', fontFamily: FH, textAlign: 'right' }}>
                      Per meal: {fmt(builderPreview.price)} | Line total: {fmt(builderPreview.lineTotal)}
                    </div>
                  )}
                  <button onClick={addMealToOrder} style={{ ...btnPrimary, width: 'auto', padding: '12px 32px' }}>
                    Add to Order
                  </button>
                </div>
              </div>

              {/* ── Order Lines Table ── */}
              {orderLines.length > 0 && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <ShoppingCart size={16} style={{ color: R }} />
                    <h2 style={sectionTitle}>Order Lines</h2>
                    <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH, marginLeft: 'auto' }}>
                      {orderLines.length} meal line{orderLines.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Sandwich</th>
                          <th style={thStyle}>Container</th>
                          <th style={thStyle}>Sides</th>
                          <th style={thStyle}>Drink</th>
                          <th style={thStyle}>Extras</th>
                          <th style={thStyle}>Qty</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Per Meal</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Line Total</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderLines.map((line, idx) => {
                          const c = computeMealLine(line)
                          const sw = SANDWICHES.find(s => s.id === line.sandwich)
                          const ct = CONTAINERS.find(x => x.id === line.container)
                          const sd = SIDES.filter(s => line.sides.includes(s.id))
                          const dk = DRINKS.find(d => d.id === line.drink)
                          const ex = EXTRAS.filter(e => line.extras.includes(e.id))
                          return (
                            <tr key={line.id} style={{ transition: 'background .1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ ...tdStyle, fontWeight: 700, color: '#9ca3af', fontSize: 11 }}>{idx + 1}</td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{sw?.name || '—'}</td>
                              <td style={tdStyle}>{ct?.name || '—'}</td>
                              <td style={tdStyle}>{sd.length > 0 ? sd.map(s => s.name).join(', ') : '—'}</td>
                              <td style={tdStyle}>{dk?.name || '—'}</td>
                              <td style={{ ...tdStyle, fontSize: 11, maxWidth: 120 }}>
                                {ex.length > 0 ? ex.map(e => e.name).join(', ') : '—'}
                              </td>
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <button onClick={() => updateMealLineQty(line.id, line.qty - 1)} style={{
                                    width: 22, height: 22, borderRadius: 4, border: '1px solid #e5e7eb',
                                    background: W, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}><Minus size={10} color="#374151" /></button>
                                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{line.qty}</span>
                                  <button onClick={() => updateMealLineQty(line.id, line.qty + 1)} style={{
                                    width: 22, height: 22, borderRadius: 4, border: '1px solid #e5e7eb',
                                    background: W, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}><Plus size={10} color="#374151" /></button>
                                </div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(c.price)}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: R }}>{fmt(c.lineTotal)}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <button onClick={() => removeMealLine(line.id)} style={{
                                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
                                  padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}>
                                  <Trash2 size={12} color="#dc2626" />
                                  <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Remove</span>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Ad-Hoc Items Section ── */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Plus size={16} style={{ color: T }} />
                  <h2 style={sectionTitle}>Ad-Hoc Items</h2>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH, marginLeft: 'auto' }}>
                    Extra items not part of a meal
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Select Item</label>
                    <select value={adhocItemId} onChange={e => setAdhocItemId(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}>
                      <option value="">-- Choose an item --</option>
                      <optgroup label="Sides">
                        {SIDES.map(s => <option key={s.id} value={s.id}>{s.name} ({fmt(s.listPrice)})</option>)}
                      </optgroup>
                      <optgroup label="Drinks">
                        {DRINKS.map(d => <option key={d.id} value={d.id}>{d.name} ({fmt(d.listPrice)})</option>)}
                      </optgroup>
                      <optgroup label="Extras">
                        {EXTRAS.map(e => <option key={e.id} value={e.id}>{e.name} ({fmt(e.listPrice)})</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <div style={{ width: 100 }}>
                    <label style={label}>Qty</label>
                    <input type="number" min={1} value={adhocQty}
                      onChange={e => setAdhocQty(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }} />
                  </div>
                  <button onClick={addAdhocItem} style={{ ...btnSecondary, whiteSpace: 'nowrap', height: 38 }}>
                    Add Item
                  </button>
                </div>

                {adhocLines.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Item</th>
                        <th style={thStyle}>Category</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Unit Price</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Qty</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adhocLines.map(a => (
                        <tr key={a.id}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{a.name}</td>
                          <td style={tdStyle}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                              background: a.category === 'Side' ? '#f0fdf4' : a.category === 'Drink' ? '#eff6ff' : '#fefce8',
                              color: a.category === 'Side' ? '#166534' : a.category === 'Drink' ? '#1e40af' : '#854d0e',
                            }}>{a.category}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(a.listPrice)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{a.qty}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: R }}>{fmt(a.listPrice * a.qty)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button onClick={() => removeAdhocLine(a.id)} style={{
                              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
                              padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                              <Trash2 size={12} color="#dc2626" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ── Order Details ── */}
              <div style={card}>
                <h2 style={{ ...sectionTitle, marginBottom: 20 }}>Order Details</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={label}>Contact Person *</label>
                    <input value={contactName} onChange={e => setContactName(e.target.value)} style={inputStyle} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label style={label}>Contact Email *</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={inputStyle} placeholder="jane@company.com" />
                  </div>
                  <div>
                    <label style={label}>Contact Phone</label>
                    <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} style={inputStyle} placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label style={label}>Company / Organization</label>
                    <input value={company} onChange={e => setCompany(e.target.value)} style={inputStyle} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label style={label}>PO Number</label>
                    <input value={poNumber} onChange={e => setPoNumber(e.target.value)} style={inputStyle} placeholder="PO-12345" />
                  </div>
                  <div>
                    <label style={label}>Delivery Date *</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={label}>Delivery Time</label>
                    <input type="time" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={label}>Delivery Address *</label>
                    <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="123 Main St, Suite 200, City, ST 12345" />
                  </div>

                  {/* Payment Method */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Payment Method</label>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                      {[
                        { value: 'credit-card', label: 'Credit Card' },
                        { value: 'invoice', label: 'Invoice' },
                        { value: 'credit-account', label: 'Credit Account' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'check', label: 'Check' },
                      ].map(pm => (
                        <label key={pm.value} style={{
                          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          padding: '6px 12px', borderRadius: 8,
                          border: paymentMethod === pm.value ? `2px solid ${R}` : '1px solid #e5e7eb',
                          background: paymentMethod === pm.value ? R + '06' : W,
                          transition: 'all .15s',
                        }}>
                          <input type="radio" name="paymentMethod" value={pm.value}
                            checked={paymentMethod === pm.value}
                            onChange={e => setPaymentMethod(e.target.value)}
                            style={{ accentColor: R }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: BLK, fontFamily: FH }}>{pm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Conditional payment fields */}
                  {paymentMethod === 'credit-account' && (
                    <div>
                      <label style={label}>Credit Account #</label>
                      <input value={creditAccount} onChange={e => setCreditAccount(e.target.value)} style={inputStyle} placeholder="ACCT-00001" />
                    </div>
                  )}
                  {paymentMethod === 'credit-card' && (
                    <div>
                      <label style={label}>Card Last 4</label>
                      <input value={cardLast4} onChange={e => setCardLast4(e.target.value)} style={inputStyle} placeholder="4242" maxLength={4} />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ ...label, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} style={{ accentColor: R, width: 16, height: 16 }} />
                      <span>Paid</span>
                    </label>
                  </div>
                  <div>
                    <label style={label}>Deposit Amount</label>
                    <input type="number" min={0} step="0.01" value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      style={inputStyle} placeholder="0.00" />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Special Instructions</label>
                    <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Allergies, dietary needs, delivery instructions..." />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Internal Notes (agency use only)</label>
                    <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2}
                      style={{ ...inputStyle, resize: 'vertical', background: '#fffbeb', border: '1px solid #fde68a' }}
                      placeholder="Internal notes not visible to customer..." />
                  </div>
                </div>

                {/* Place Order Button */}
                <div style={{ marginTop: 20 }}>
                  <button onClick={placeOrder} style={{
                    ...btnPrimary,
                    opacity: (contactName && contactEmail && deliveryDate && deliveryAddress && orderLines.length > 0) ? 1 : 0.5,
                  }}>
                    Place Order — {fmt(summary.subtotalPrice)}
                  </button>
                </div>
              </div>
            </div>

            {/* ══════════ Right Column: Order Summary + Shipping (40%) ══════════ */}
            <div style={{ flex: '0 0 calc(40% - 24px)', position: 'sticky', top: 24 }}>

              {/* ── Order Summary Card ── */}
              <div style={{ ...card, border: `1px solid ${R}20`, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <ShoppingCart size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Order Summary</h2>
                </div>

                {orderLines.length === 0 && adhocLines.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0', fontFamily: FH }}>
                    Add meals to see the order summary
                  </div>
                ) : (
                  <>
                    {/* Counts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: BLK, fontFamily: FH }}>{summary.totalMeals}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Total Meals</div>
                      </div>
                      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: BLK, fontFamily: FH }}>{summary.adhocTotalItems}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Ad-Hoc Items</div>
                      </div>
                    </div>

                    {/* Pricing Breakdown */}
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Subtotal (list price)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{fmt(summary.subtotalPrice)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #111', marginTop: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: BLK, fontFamily: FH }}>Total</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: R, fontFamily: FH }}>{fmt(summary.subtotalPrice)}</span>
                      </div>
                    </div>

                    {/* COGS & Margin */}
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                        Cost Analysis
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Total COGS</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{fmt(summary.subtotalCogs)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Gross Margin ($)</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{fmt(summary.grossMargin)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Margin %</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: summary.marginPct >= 50 ? '#16a34a' : '#f59e0b' }}>
                          {summary.marginPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Weight */}
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                        Weight
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Total weight</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>
                          {summary.totalWeightOz.toFixed(1)} oz ({fmtLbs(summary.totalWeightOz)})
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── Shipping Calculator Card ── */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Truck size={16} style={{ color: T }} />
                  <h2 style={sectionTitle}>Shipping Calculator</h2>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total meals</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{summary.totalMeals}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Shipping boxes needed</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>
                      {summary.shippingBoxes} ({SHIPPING.mediumBox.capacity} meals/box)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Box dimensions</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{SHIPPING.mediumBox.dims}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Container dims (per meal)</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{summary.containerDims || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total order weight</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{fmtLbs(summary.totalWeightOz)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total shipping weight</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{fmtLbs(summary.totalShipWeightOz)}</span>
                  </div>
                  {summary.pallets > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: T + '10', borderRadius: 8, border: `1px solid ${T}30` }}>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Pallets required</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T }}>
                        {summary.pallets} ({SHIPPING.pallet.dims})
                      </span>
                    </div>
                  )}
                </div>

                {/* Vehicle selector */}
                <div style={{ marginTop: 16, padding: '14px 0 0', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 8 }}>Delivery Vehicle</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {VEHICLES.map(v => {
                      const isActive = selectedVehicle === v.id
                      const fits = summary.shippingBoxes <= v.maxBoxes
                      return (
                        <button key={v.id} onClick={() => setSelectedVehicle(v.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: 8, border: isActive ? `2px solid ${T}` : '1px solid #e5e7eb',
                            background: isActive ? T + '08' : '#fff', cursor: 'pointer', textAlign: 'left',
                          }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{v.name}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{v.dims} · {v.maxBoxes} boxes · {v.maxMeals} meals max</div>
                          </div>
                          {fits ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a' }}>Fits</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#fef2f2', color: '#dc2626' }}>Too small</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {(() => {
                    const v = VEHICLES.find(x => x.id === selectedVehicle)
                    if (!v) return null
                    const palletsNeeded = Math.ceil(summary.shippingBoxes / SHIPPING.pallet.maxBoxes)
                    const fitsPallets = palletsNeeded <= v.pallets
                    return (
                      <div style={{ marginTop: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#6b7280' }}>Boxes in this order</span>
                          <span style={{ fontWeight: 700, color: BLK }}>{summary.shippingBoxes}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#6b7280' }}>Vehicle capacity</span>
                          <span style={{ fontWeight: 700, color: BLK }}>{v.maxBoxes} boxes / {v.pallets} pallets</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#6b7280' }}>Pallets needed</span>
                          <span style={{ fontWeight: 700, color: fitsPallets ? '#16a34a' : '#dc2626' }}>{palletsNeeded}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#6b7280' }}>Utilization</span>
                          <span style={{ fontWeight: 700, color: BLK }}>{Math.round((summary.shippingBoxes / v.maxBoxes) * 100)}%</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* ── Pricing Editor Card ── */}
              <div style={card}>
                <button onClick={() => setShowPricing(!showPricing)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UtensilsCrossed size={16} style={{ color: R }} />
                    <h2 style={sectionTitle}>Item Pricing (COGS & List)</h2>
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{showPricing ? 'Hide' : 'Show'}</span>
                </button>
                {showPricing && (
                  <div style={{ marginTop: 14 }}>
                    {[
                      { label: 'Sandwiches', items: SANDWICHES },
                      { label: 'Sides', items: SIDES },
                      { label: 'Drinks', items: DRINKS },
                      { label: 'Extras', items: EXTRAS },
                      { label: 'Containers', items: CONTAINERS },
                    ].map(group => (
                      <div key={group.label} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{group.label}</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Item</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, width: 80 }}>COGS</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, width: 80 }}>Price</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, width: 60 }}>Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(item => {
                              const ov = priceOverrides[item.id] || {}
                              const cogs = ov.cogs ?? item.cogs
                              const price = ov.listPrice ?? item.listPrice
                              const margin = price > 0 ? Math.round(((price - cogs) / price) * 100) : 0
                              return (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '6px 8px', color: BLK, fontWeight: 500 }}>{item.name}</td>
                                  <td style={{ padding: '4px 4px', textAlign: 'right' }}>
                                    <input type="number" step="0.01" value={cogs} onChange={e => setPriceOverrides(p => ({ ...p, [item.id]: { ...p[item.id], cogs: parseFloat(e.target.value) || 0 } }))}
                                      style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, textAlign: 'right', color: BLK }} />
                                  </td>
                                  <td style={{ padding: '4px 4px', textAlign: 'right' }}>
                                    <input type="number" step="0.01" value={price} onChange={e => setPriceOverrides(p => ({ ...p, [item.id]: { ...p[item.id], listPrice: parseFloat(e.target.value) || 0 } }))}
                                      style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, textAlign: 'right', color: BLK }} />
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: margin > 50 ? '#16a34a' : margin > 30 ? '#f59e0b' : '#dc2626' }}>
                                    {margin}%
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
