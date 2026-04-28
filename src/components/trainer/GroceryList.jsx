"use client"
import { useState } from 'react'
import { ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react'
// Cal-AI tokens
const T = '#5aa0ff'
const BLK = '#0a0a0a'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — GroceryList.
//
// Renders a grocery_list object (organized_by_aisle + estimated_total_usd +
// bulk_prep_notes).  Each aisle is a collapsible section; each item is
// checkable (local-only state — not persisted).  Hovering an item shows
// which recipes use it.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'
const BRD_LT = '#f1f1f6'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

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
          <div style={{ color: GRY5, fontSize: 12, marginTop: 4 }}>
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
              color: GRY7,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {notesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Bulk prep notes
          </button>
          {notesOpen && (
            <p style={{ margin: '10px 0 0', padding: '10px 14px', background: '#f0fbfc', borderRadius: 8, color: GRY7, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
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
                  <span style={{ color: BLK, fontSize: 13, fontWeight: 800 }}>{aisleName}</span>
                </div>
                <span style={{ color: GRY5, fontSize: 11 }}>{items.length} items</span>
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
                              color: BLK,
                              fontSize: 13,
                              fontWeight: 600,
                              textDecoration: isChecked ? 'line-through' : 'none',
                              flex: 1,
                            }}
                          >
                            {it.item}
                          </span>
                          <span style={{ color: GRY7, fontSize: 12 }}>
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
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }
