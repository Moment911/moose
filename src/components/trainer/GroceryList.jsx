"use client"
import { useState } from 'react'
import { ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — GroceryList (Cal-AI restyle).
// ─────────────────────────────────────────────────────────────────────────────

// Cal-AI tokens — warm neutral palette
const INK = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const ACCENT = '#d89a6a'
const BRD = '#ececef'
const BRD_LT = '#f1f1f6'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

export default function GroceryList({ groceryList }) {
  const [openAisles, setOpenAisles] = useState({})
  const [checked, setChecked] = useState({})
  const [notesOpen, setNotesOpen] = useState(false)

  if (!groceryList) return null
  const aisles = Array.isArray(groceryList.organized_by_aisle) ? groceryList.organized_by_aisle : []

  function toggleAisle(name) {
    setOpenAisles((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  function toggleChecked(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalItems = aisles.reduce((a, aisle) => a + (aisle.items?.length || 0), 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={titleStyle}>
            <ShoppingBag size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Grocery list
          </h2>
          <div style={{ color: INK3, fontSize: 12, marginTop: 4 }}>
            {totalItems} items{groceryList.estimated_total_usd ? ` · est. $${Number(groceryList.estimated_total_usd).toFixed(2)}` : ''}
            {totalItems > 0 ? ` · ${checkedCount}/${totalItems} packed` : ''}
          </div>
        </div>
      </header>

      {groceryList.bulk_prep_notes && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: '#f9fafb',
              border: `1px solid ${BRD}`,
              borderRadius: 8,
              color: INK2,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {notesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Bulk prep notes
          </button>
          {notesOpen && (
            <p style={{ margin: '10px 0 0', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, color: INK2, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {groceryList.bulk_prep_notes}
            </p>
          )}
        </div>
      )}

      <div>
        {aisles.map((aisle) => {
          const aisleName = aisle.aisle || aisle.name || 'Other'
          const open = openAisles[aisleName] !== false // default open
          const items = Array.isArray(aisle.items) ? aisle.items : []
          return (
            <div
              key={aisleName}
              style={{
                border: `1px solid ${BRD}`,
                borderRadius: 10,
                marginBottom: 8,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <button
                type="button"
                onClick={() => toggleAisle(aisleName)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  background: open ? '#f9fafb' : '#fff',
                  border: 'none',
                  borderBottom: open ? `1px solid ${BRD}` : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {open ? <ChevronDown size={14} color={GRY7} /> : <ChevronRight size={14} color={GRY7} />}
                  <span style={{ color: INK, fontSize: 13, fontWeight: 800 }}>{aisleName}</span>
                </div>
                <span style={{ color: INK3, fontSize: 11 }}>{items.length} items</span>
              </button>

              {open && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {items.map((it, i) => {
                    const itemKey = `${aisleName}|${it.item || i}`
                    const isChecked = !!checked[itemKey]
                    const usedIn = Array.isArray(it.used_in) ? it.used_in.join(', ') : it.used_in || ''
                    return (
                      <li
                        key={itemKey}
                        style={{
                          borderTop: i === 0 ? 'none' : `1px solid ${BRD_LT}`,
                        }}
                      >
                        <label
                          title={usedIn ? `Used in: ${usedIn}` : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '9px 14px',
                            cursor: 'pointer',
                            opacity: isChecked ? 0.55 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChecked(itemKey)}
                            style={{ margin: 0 }}
                          />
                          <span
                            style={{
                              color: INK,
                              fontSize: 13,
                              fontWeight: 600,
                              textDecoration: isChecked ? 'line-through' : 'none',
                              flex: 1,
                            }}
                          >
                            {it.item}
                          </span>
                          <span style={{ color: INK2, fontSize: 12 }}>
                            {it.total_amount ?? ''}
                            {it.unit ? ` ${it.unit}` : ''}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 16,
  padding: 22,
  marginBottom: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  fontFamily: FONT,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '.03em', textTransform: 'uppercase', fontFamily: FONT }
