"use client"
import { useState, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import { R, T, BLK, GRY, W, FH, FB } from '../lib/theme'
import { ShoppingCart, Package, Coffee, UtensilsCrossed, Droplets, Box, Truck, Check, ChevronDown } from 'lucide-react'

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
  mediumBox: { name: 'Medium Shipping Box', dims: '18" x 14" x 12"', weight_empty_lbs: 1.5, capacity: 12 },
  pallet: { name: 'Standard Pallet', dims: '48" x 40" x 6"', maxBoxes: 48, maxLunches: 576 },
}

/* ── Styles ───────────────────────────────────────────────────────────────── */

const card = {
  background: W, border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, marginBottom: 16,
}
const sectionTitle = {
  fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK,
  margin: '0 0 12px', letterSpacing: '-.02em',
}
const label = {
  fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4,
  display: 'block', fontFamily: FH,
}
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB,
  outline: 'none', transition: 'border-color .15s',
}
const btnPrimary = {
  background: R, color: W, border: 'none', borderRadius: 10,
  padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: FH, letterSpacing: '-.01em', transition: 'opacity .15s',
  width: '100%',
}

function fmt(n) { return '$' + n.toFixed(2) }
function fmtLbs(oz) { return (oz / 16).toFixed(1) + ' lbs' }

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function KotoOrderPage() {
  // Selections
  const [container, setContainer] = useState('paper-box')
  const [sandwich, setSandwich] = useState(null)
  const [sides, setSides] = useState([])
  const [drink, setDrink] = useState(null)
  const [extras, setExtras] = useState([])
  const [qty, setQty] = useState(1)

  // Order details
  const [customerName, setCustomerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [address, setAddress] = useState('')
  const [instructions, setInstructions] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Toggle side (max 2)
  function toggleSide(id) {
    setSides(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (prev.length >= 2) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  function toggleExtra(id) {
    setExtras(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  // Compute totals
  const totals = useMemo(() => {
    const sel = {
      container: CONTAINERS.find(c => c.id === container),
      sandwich: SANDWICHES.find(s => s.id === sandwich),
      sides: SIDES.filter(s => sides.includes(s.id)),
      drink: DRINKS.find(d => d.id === drink),
      extras: EXTRAS.filter(e => extras.includes(e.id)),
    }

    let perBoxPrice = 0
    let perBoxCogs = 0
    let perBoxWeight = 0
    const items = []

    if (sel.container) {
      perBoxPrice += sel.container.listPrice
      perBoxCogs += sel.container.cogs
      perBoxWeight += sel.container.weight_oz
      items.push({ name: sel.container.name, price: sel.container.listPrice })
    }
    if (sel.sandwich) {
      perBoxPrice += sel.sandwich.listPrice
      perBoxCogs += sel.sandwich.cogs
      perBoxWeight += sel.sandwich.weight_oz
      items.push({ name: sel.sandwich.name, price: sel.sandwich.listPrice })
    }
    sel.sides.forEach(s => {
      perBoxPrice += s.listPrice
      perBoxCogs += s.cogs
      perBoxWeight += s.weight_oz
      items.push({ name: s.name, price: s.listPrice })
    })
    if (sel.drink) {
      perBoxPrice += sel.drink.listPrice
      perBoxCogs += sel.drink.cogs
      perBoxWeight += sel.drink.weight_oz
      items.push({ name: sel.drink.name, price: sel.drink.listPrice })
    }
    sel.extras.forEach(e => {
      perBoxPrice += e.listPrice
      perBoxCogs += e.cogs
      perBoxWeight += e.weight_oz
      items.push({ name: e.name, price: e.listPrice })
    })

    const totalPrice = perBoxPrice * qty
    const totalCogs = perBoxCogs * qty
    const margin = totalPrice > 0 ? ((totalPrice - totalCogs) / totalPrice * 100) : 0
    const totalWeightOz = perBoxWeight * qty

    // Shipping calc
    const shippingBoxes = Math.ceil(qty / SHIPPING.mediumBox.capacity)
    const shippingBoxWeightOz = SHIPPING.mediumBox.weight_empty_lbs * 16
    const totalShipWeightOz = totalWeightOz + (shippingBoxes * shippingBoxWeightOz)
    const pallets = qty > SHIPPING.pallet.maxLunches ? Math.ceil(qty / SHIPPING.pallet.maxLunches) : (qty > 48 ? 1 : 0)

    return {
      items, perBoxPrice, perBoxCogs, perBoxWeight,
      totalPrice, totalCogs, margin, totalWeightOz,
      shippingBoxes, totalShipWeightOz, pallets,
      containerDims: sel.container?.dims || '',
    }
  }, [container, sandwich, sides, drink, extras, qty])

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
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
                Configure boxed lunches, review pricing, and place catering orders
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px 48px' }}>
          <div style={{ display: 'flex', gap: 24, maxWidth: 1200, alignItems: 'flex-start' }}>

            {/* ── Left Column: Order Builder (60%) ── */}
            <div style={{ flex: '0 0 60%', minWidth: 0 }}>

              {/* Container Selection */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Box size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Container</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {CONTAINERS.map(c => (
                    <button key={c.id} onClick={() => setContainer(c.id)} style={{
                      border: container === c.id ? `2px solid ${R}` : '2px solid #e5e7eb',
                      borderRadius: 10, padding: 16, background: container === c.id ? R + '06' : W,
                      cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Package size={18} style={{ color: container === c.id ? R : '#6b7280' }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{c.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 6 }}>{c.desc}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: R }}>{fmt(c.listPrice)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sandwich Selection */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <UtensilsCrossed size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Sandwich</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SANDWICHES.map(s => (
                    <button key={s.id} onClick={() => setSandwich(s.id)} style={{
                      border: sandwich === s.id ? `2px solid ${R}` : '2px solid #e5e7eb',
                      borderRadius: 10, padding: 14, background: sandwich === s.id ? R + '06' : W,
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

              {/* Side Selection */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Coffee size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Sides</h2>
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', fontFamily: FH }}>Pick up to 2</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {SIDES.map(s => {
                    const sel = sides.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => toggleSide(s.id)} style={{
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

              {/* Drink Selection */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Droplets size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Drink</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {DRINKS.map(d => {
                    const sel = drink === d.id
                    return (
                      <button key={d.id} onClick={() => setDrink(d.id)} style={{
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
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Package size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Extras</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {EXTRAS.map(e => {
                    const sel = extras.includes(e.id)
                    return (
                      <label key={e.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        borderRadius: 8, cursor: 'pointer', transition: 'background .1s',
                        background: sel ? R + '06' : 'transparent',
                        border: sel ? `1px solid ${R}30` : '1px solid transparent',
                      }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleExtra(e.id)} style={{ accentColor: R }} />
                        <span style={{ fontSize: 12, color: BLK, fontFamily: FH, flex: 1 }}>{e.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{fmt(e.listPrice)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* ── Order Details ── */}
              <div style={card}>
                <h2 style={{ ...sectionTitle, marginBottom: 16 }}>Order Details</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={label}>Customer Name *</label>
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} style={inputStyle} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label style={label}>Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="jane@company.com" />
                  </div>
                  <div>
                    <label style={label}>Phone</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="(555) 123-4567" />
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
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Delivery Address *</label>
                    <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="123 Main St, Suite 200, City, ST 12345" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Special Instructions</label>
                    <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Allergies, dietary needs, delivery instructions..." />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column: Order Summary (40%) ── */}
            <div style={{ flex: '0 0 calc(40% - 24px)', position: 'sticky', top: 24 }}>

              {/* Order Summary Card */}
              <div style={{ ...card, border: `1px solid ${R}20`, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <ShoppingCart size={16} style={{ color: R }} />
                  <h2 style={sectionTitle}>Order Summary</h2>
                </div>

                {/* Selected items */}
                {totals.items.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0', fontFamily: FH }}>
                    Select items to build your boxed lunch
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    {totals.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: 12, color: '#374151' }}>{item.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{fmt(item.price)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quantity */}
                <div style={{ marginBottom: 16 }}>
                  <label style={label}>Quantity (identical boxes)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setQty(Math.max(1, qty - 1))} style={{
                      width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                      background: W, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#374151',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>-</button>
                    <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ ...inputStyle, width: 70, textAlign: 'center', fontWeight: 700 }} />
                    <button onClick={() => setQty(qty + 1)} style={{
                      width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                      background: W, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#374151',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>+</button>
                  </div>
                </div>

                {/* Pricing breakdown */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Per-box subtotal</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{fmt(totals.perBoxPrice)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Quantity</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{qty}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #111', marginTop: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: BLK, fontFamily: FH }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: R, fontFamily: FH }}>{fmt(totals.totalPrice)}</span>
                  </div>
                </div>

                {/* COGS & Margin */}
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                    Cost Analysis
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total COGS</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{fmt(totals.totalCogs)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Gross Profit</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{fmt(totals.totalPrice - totals.totalCogs)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Margin</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: totals.margin >= 50 ? '#16a34a' : '#f59e0b' }}>
                      {totals.margin.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Place Order Button */}
                {submitted ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Check size={24} style={{ color: '#16a34a', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', fontFamily: FH }}>Order Submitted</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Confirmation sent to {email || 'customer'}</div>
                  </div>
                ) : (
                  <button
                    onClick={() => { if (customerName && email && deliveryDate && address && sandwich) setSubmitted(true) }}
                    style={{
                      ...btnPrimary,
                      opacity: (customerName && email && deliveryDate && address && sandwich) ? 1 : 0.5,
                      cursor: (customerName && email && deliveryDate && address && sandwich) ? 'pointer' : 'not-allowed',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={e => e.currentTarget.style.opacity = (customerName && email && deliveryDate && address && sandwich) ? '1' : '0.5'}
                  >
                    Place Order — {fmt(totals.totalPrice)}
                  </button>
                )}
              </div>

              {/* Shipping Calculator Card */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Truck size={16} style={{ color: T }} />
                  <h2 style={sectionTitle}>Shipping Calculator</h2>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Boxed lunches</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{qty}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Shipping boxes needed</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>
                      {totals.shippingBoxes} ({SHIPPING.mediumBox.capacity}/box)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Shipping box dims</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{SHIPPING.mediumBox.dims}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Container dims</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{totals.containerDims || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total weight (lunches)</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{fmtLbs(totals.totalWeightOz)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total ship weight</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{fmtLbs(totals.totalShipWeightOz)}</span>
                  </div>
                  {totals.pallets > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: T + '10', borderRadius: 8, border: `1px solid ${T}30` }}>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Pallets required</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T }}>
                        {totals.pallets} ({SHIPPING.pallet.dims})
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
