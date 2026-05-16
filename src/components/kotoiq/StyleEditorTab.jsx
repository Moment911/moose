"use client"
// ─────────────────────────────────────────────────────────────────────────
// Style Editor Tab — realtime control surface for KotoIQ design tokens.
//
// What it does:
//   • Reads the current CSS variables from :root
//   • Lets you tune colors, fonts, sizes, letter-spacing, padding
//   • Writes back to :root in realtime — every tab updates instantly
//   • Persists overrides to localStorage so refreshes keep them
//   • Exports the result as a paste-ready `:root { ... }` block AND
//     as a paste-ready `theme.ts` patch so you can commit changes
//
// What it controls:
//   • Brand palette (navy, pink, warm, off, line, muted, dim)
//   • Typography (display, body, accent serif, mono)
//   • KotoTabHeader sizing (padding, eyebrow/title size, tracking)
//
// Everything reads from globals.css via var(--name). The 30+ legacy
// tabs that use KotoTabHeader pick up changes automatically. Tabs
// with bespoke headers (today, aeo_visibility, etc.) still hardcode
// some values inline — those need per-file edits to fully respond.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { Sliders, RefreshCw, Download, Copy, Check, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

const LS_KEY = 'kotoiq:style-editor:overrides'

// ── Token registry — what we expose in the UI ──────────────────────────
// Each entry: { var, label, type ('color' | 'text'), group }
const TOKEN_GROUPS = [
  {
    label: 'Brand palette',
    tokens: [
      { var: '--koto-navy',       label: 'Navy (primary text)',  type: 'color' },
      { var: '--koto-navy-deep',  label: 'Navy deep (dark bg)',  type: 'color' },
      { var: '--koto-pink',       label: 'Pink (accent)',        type: 'color' },
      { var: '--koto-pink-deep',  label: 'Pink hover',           type: 'color' },
      { var: '--koto-warm',       label: 'Warm cream (page bg)', type: 'color' },
      { var: '--koto-off',        label: 'Off-white (surface)',  type: 'color' },
      { var: '--koto-muted',      label: 'Muted text',           type: 'color' },
      { var: '--koto-dim',        label: 'Dim text',             type: 'color' },
    ],
  },
  {
    label: 'Status colors',
    tokens: [
      { var: '--koto-success',   label: 'Success green',  type: 'color' },
      { var: '--koto-warning',   label: 'Warning amber',  type: 'color' },
      { var: '--koto-danger',    label: 'Danger red',     type: 'color' },
    ],
  },
  {
    label: 'Typography stacks',
    tokens: [
      { var: '--font-display',  label: 'Display (Bebas Neue)',    type: 'text' },
      { var: '--font-body',     label: 'Body (DM Sans)',          type: 'text' },
      { var: '--font-accent',   label: 'Accent serif (DM Serif)', type: 'text' },
      { var: '--font-mono',     label: 'Mono (JetBrains Mono)',   type: 'text' },
    ],
  },
  {
    label: 'Tab header treatment',
    tokens: [
      { var: '--tabhead-pad-x',          label: 'Header padding X',       type: 'text' },
      { var: '--tabhead-pad-y',          label: 'Header padding top',     type: 'text' },
      { var: '--tabhead-pad-bottom',     label: 'Header padding bottom',  type: 'text' },
      { var: '--tabhead-eyebrow-size',   label: 'Eyebrow size',           type: 'text' },
      { var: '--tabhead-eyebrow-track',  label: 'Eyebrow tracking',       type: 'text' },
      { var: '--tabhead-title-size',     label: 'Title size',             type: 'text' },
      { var: '--tabhead-title-track',    label: 'Title tracking',         type: 'text' },
      { var: '--tabhead-rationale-size', label: 'Rationale size',         type: 'text' },
    ],
  },
]

const ALL_TOKEN_VARS = TOKEN_GROUPS.flatMap(g => g.tokens.map(t => t.var))

// ── Helpers ──────────────────────────────────────────────────────────────
function readRootValue(varName) {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}
function writeRootValue(varName, value) {
  if (typeof window === 'undefined') return
  if (value === '' || value == null) {
    document.documentElement.style.removeProperty(varName)
  } else {
    document.documentElement.style.setProperty(varName, value)
  }
}
function loadOverrides() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveOverrides(obj) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(obj))
}

// ── Main component ─────────────────────────────────────────────────────
export default function StyleEditorTab() {
  // Current applied values per token
  const [values, setValues] = useState({})
  // Default (CSS-defined) values per token, captured on mount BEFORE we apply overrides
  const defaultsRef = useRef({})
  const [copyState, setCopyState] = useState({ root: false, ts: false })

  // On mount: capture defaults, then re-apply any saved overrides
  useEffect(() => {
    const defaults = {}
    for (const v of ALL_TOKEN_VARS) defaults[v] = readRootValue(v)
    defaultsRef.current = defaults

    const saved = loadOverrides()
    const initial = { ...defaults, ...saved }
    for (const [k, val] of Object.entries(saved)) writeRootValue(k, val)
    setValues(initial)
  }, [])

  const updateToken = (varName, newValue) => {
    setValues(prev => {
      const next = { ...prev, [varName]: newValue }
      writeRootValue(varName, newValue)
      // Persist only the diff from defaults
      const diffs = {}
      for (const [k, v] of Object.entries(next)) {
        if (v !== defaultsRef.current[k]) diffs[k] = v
      }
      saveOverrides(diffs)
      return next
    })
  }

  const resetToken = (varName) => updateToken(varName, defaultsRef.current[varName] || '')
  const resetAll = () => {
    for (const v of ALL_TOKEN_VARS) writeRootValue(v, defaultsRef.current[v])
    saveOverrides({})
    setValues({ ...defaultsRef.current })
    toast.success('Reset to defaults')
  }

  const diffsFromDefault = Object.entries(values).filter(([k, v]) => v !== defaultsRef.current[k])
  const diffCount = diffsFromDefault.length

  // Build paste-ready exports
  const cssExport = `:root {\n${diffsFromDefault.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
  const tsExport  = buildThemeTsPatch(diffsFromDefault)

  const copy = async (kind, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState(s => ({ ...s, [kind]: true }))
      setTimeout(() => setCopyState(s => ({ ...s, [kind]: false })), 1400)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Toolbar — sticky action bar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sliders size={16} color="var(--koto-pink)" />
          <span style={S.toolbarTitle}>Live Style Editor</span>
          <span style={S.diffBadge}>{diffCount} {diffCount === 1 ? 'override' : 'overrides'} active</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={resetAll} style={S.ghostBtn} disabled={diffCount === 0} title="Reset all overrides">
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={() => copy('root', cssExport)} style={S.ghostBtn} disabled={diffCount === 0} title="Copy CSS :root block">
            {copyState.root ? <Check size={13} /> : <Copy size={13} />}
            {copyState.root ? 'Copied' : 'Copy CSS'}
          </button>
          <button onClick={() => copy('ts', tsExport)} style={S.primaryBtn} disabled={diffCount === 0} title="Copy theme.ts patch">
            {copyState.ts ? <Check size={13} /> : <Download size={13} />}
            {copyState.ts ? 'Copied' : 'Copy theme.ts patch'}
          </button>
        </div>
      </div>

      <div style={S.intro}>
        Every input writes to a CSS variable on <code>:root</code> instantly. Changes persist to your browser
        only — to ship them, hit <strong>Copy theme.ts patch</strong> and paste it into <code>src/lib/theme.ts</code>
        + the <code>:root</code> block in <code>src/app/globals.css</code>.
      </div>

      {TOKEN_GROUPS.map(group => (
        <section key={group.label} style={S.section}>
          <div style={S.sectionLabel}>{group.label}</div>
          <div style={S.grid}>
            {group.tokens.map(tk => (
              <TokenRow
                key={tk.var}
                token={tk}
                value={values[tk.var] || ''}
                defaultValue={defaultsRef.current[tk.var] || ''}
                onChange={(v) => updateToken(tk.var, v)}
                onReset={() => resetToken(tk.var)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Live preview — renders a fake tab header with current tokens */}
      <section style={S.section}>
        <div style={S.sectionLabel}>Live preview</div>
        <PreviewPane />
      </section>

      {/* Export blocks */}
      {diffCount > 0 && (
        <section style={S.section}>
          <div style={S.sectionLabel}>Paste-ready overrides ({diffCount})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12 }}>
            <CodeBlock title="globals.css :root block" code={cssExport} onCopy={() => copy('root', cssExport)} copied={copyState.root} />
            <CodeBlock title="theme.ts patch"          code={tsExport}  onCopy={() => copy('ts', tsExport)}    copied={copyState.ts} />
          </div>
        </section>
      )}
    </div>
  )
}

// ── Token row — color picker OR text input ──────────────────────────────
function TokenRow({ token, value, defaultValue, onChange, onReset }) {
  const isOverridden = value !== defaultValue && value !== ''
  return (
    <label style={{ ...S.row, ...(isOverridden ? S.rowOverridden : null) }}>
      <span style={S.rowLabel}>{token.label}</span>
      <span style={S.rowControl}>
        {token.type === 'color' ? (
          <ColorControl value={value} onChange={onChange} />
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            spellCheck={false}
            style={S.textInput}
          />
        )}
        {isOverridden && (
          <button onClick={onReset} title="Reset to default" style={S.resetBtn} type="button">
            <RefreshCw size={11} />
          </button>
        )}
      </span>
      <span style={S.rowVarName}>{token.var}</span>
    </label>
  )
}

function ColorControl({ value, onChange }) {
  // Normalize to hex if the value is a 6-digit hex; otherwise keep as-is.
  const hexNorm = /^#?[0-9a-fA-F]{6}$/.test(value.replace('#', '')) ? (value.startsWith('#') ? value : `#${value}`) : '#000000'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={hexNorm}
        onChange={e => onChange(e.target.value)}
        style={S.colorSwatch}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        style={{ ...S.textInput, width: 180 }}
      />
    </span>
  )
}

function PreviewPane() {
  return (
    <div style={{
      background: 'var(--koto-warm)',
      border: '1px solid var(--koto-line)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <header style={{
        padding: 'var(--tabhead-pad-y) var(--tabhead-pad-x) var(--tabhead-pad-bottom)',
        background: 'transparent',
        fontFamily: 'var(--font-body)',
      }}>
        <div style={{
          fontSize: 'var(--tabhead-eyebrow-size)',
          fontWeight: 600,
          color: 'var(--koto-pink)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tabhead-eyebrow-track)',
          fontFamily: 'var(--font-body)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 10 }}>◆</span>
          <span>PREVIEW · LIVE TUNING</span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--tabhead-title-size)',
          fontWeight: 400,
          color: 'var(--text-primary)',
          letterSpacing: 'var(--tabhead-title-track)',
          lineHeight: 1.02,
          margin: 0,
          display: 'inline',
        }}>
          Every input writes a {' '}
          <em style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--koto-pink)',
            fontWeight: 400,
          }}>
            CSS variable
          </em>
          {' '} on :root
        </h1>

        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--tabhead-rationale-size)',
          color: 'var(--text-muted)',
          maxWidth: 720,
          lineHeight: 1.55,
          marginTop: 14,
        }}>
          This is what every tab header in the product looks like with your current overrides. Tweak the
          tokens above and watch this preview (and the real tabs) update instantly.
        </div>

        <div style={{
          marginTop: 22,
          height: 1,
          background: 'var(--tabhead-rule)',
        }} />
      </header>
    </div>
  )
}

function CodeBlock({ title, code, onCopy, copied }) {
  return (
    <div style={{
      background: '#0f0d1a',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--koto-line)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(255,255,255,.03)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#bdb8d6', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-body)' }}>
          {title}
        </span>
        <button onClick={onCopy} style={S.codeCopyBtn}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 14, fontSize: 12, lineHeight: 1.55,
        fontFamily: 'var(--font-mono)',
        color: '#e6e3f5',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 320, overflow: 'auto',
      }}>{code}</pre>
    </div>
  )
}

// ── theme.ts patch builder ───────────────────────────────────────────────
// Maps CSS variables back to their theme.ts equivalents so the patch
// is directly pasteable.
const VAR_TO_THEME = {
  '--koto-navy':      'BLK',
  '--koto-pink':      'R',
  '--koto-pink-deep': 'PINK_HOVER (koto map)',
  '--koto-warm':      'GRY',
  '--koto-off':       "koto.off",
  '--koto-muted':     "koto.muted",
  '--koto-dim':       "koto.dim",
  '--koto-navy-deep': "koto.navyDeep",
  '--koto-success':   'GRN',
  '--koto-warning':   'AMB',
  '--koto-danger':    'DST',
  '--font-display':   'FD',
  '--font-body':      'FB',
  '--font-accent':    'FA',
  '--font-mono':      'FM',
}
function buildThemeTsPatch(diffs) {
  if (diffs.length === 0) return '// No overrides yet — tweak any token above to see the patch here.'
  const colorLines = []
  const fontLines  = []
  const cssOnlyLines = []
  for (const [v, val] of diffs) {
    const themeName = VAR_TO_THEME[v]
    if (!themeName) {
      cssOnlyLines.push(`  ${v}: ${val};   // tab header sizing — globals.css only`)
      continue
    }
    if (v.startsWith('--font')) fontLines.push(`export const ${themeName} = ${JSON.stringify(val)}`)
    else if (themeName.includes('.'))
      colorLines.push(`  ${themeName.replace('koto.', '')}: ${JSON.stringify(val)},   // inside koto = { ... }`)
    else colorLines.push(`export const ${themeName} = ${JSON.stringify(val)}`)
  }
  return [
    '// ─── Paste into src/lib/theme.ts ──────────────────────────',
    ...colorLines,
    ...fontLines,
    '',
    '// ─── Paste into :root in src/app/globals.css ──────────────',
    ...cssOnlyLines,
  ].join('\n')
}

// ── Styles ─────────────────────────────────────────────────────────────
const S = {
  toolbar: {
    position: 'sticky', top: 0, zIndex: 5,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
    gap: 12, padding: '12px 18px', marginBottom: 14,
    background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)',
    border: '1px solid var(--koto-line)', borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
  },
  toolbarTitle: { fontSize: 14, fontWeight: 600, color: 'var(--koto-navy)', fontFamily: 'var(--font-body)' },
  diffBadge: {
    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
    background: 'rgba(203,28,107,.08)', color: 'var(--koto-pink)',
    letterSpacing: '.04em', fontFamily: 'var(--font-body)',
  },
  intro: {
    padding: '14px 16px', marginBottom: 18,
    background: 'var(--koto-off)', borderRadius: 10,
    border: '1px solid var(--koto-line)',
    fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55,
    fontFamily: 'var(--font-body)',
  },
  section: { marginBottom: 26 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '.14em',
    marginBottom: 10, fontFamily: 'var(--font-body)',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 8,
  },
  row: {
    display: 'grid', gridTemplateColumns: '140px 1fr auto', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: '#fff',
    border: '1px solid var(--koto-line)', borderRadius: 10,
    fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
    cursor: 'pointer',
  },
  rowOverridden: {
    background: 'rgba(203,28,107,.04)',
    borderColor: 'rgba(203,28,107,.25)',
  },
  rowLabel: { fontWeight: 500, color: 'var(--text-primary)' },
  rowControl: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  rowVarName: {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
    background: 'rgba(32,27,81,.04)', padding: '3px 7px', borderRadius: 6,
  },
  colorSwatch: {
    width: 36, height: 32, padding: 0, border: '1px solid var(--koto-line)',
    borderRadius: 6, background: '#fff', cursor: 'pointer',
  },
  textInput: {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--koto-line)',
    fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
    background: '#fff', outline: 'none', minWidth: 100,
  },
  resetBtn: {
    width: 24, height: 24, borderRadius: 6, border: '1px solid var(--koto-line)',
    background: '#fff', cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
  },
  ghostBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', background: '#fff',
    border: '1px solid var(--koto-line)', borderRadius: 8,
    fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)', cursor: 'pointer',
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', background: 'var(--koto-pink)',
    border: 'none', borderRadius: 8, color: '#fff',
    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(203,28,107,.25)',
  },
  codeCopyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.06)', color: '#e6e3f5',
    fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer',
  },
}
