"use client"

export default function StatCard({ label, value, sub, delta, accent }) {
  const accentColor = accent === 'red' ? '#E6007E' : accent === 'cyan' ? '#00C2CB' : accent === 'green' ? '#16a34a' : accent === 'amber' ? '#d97706' : '#111111'
  return (
    <div style={{
      flex: 1, minWidth: 140, padding: '16px 18px', background: '#FFFFFF',
      borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#AAAAAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: '#111111', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#999999', marginTop: 2 }}>{sub}</div>}
      {delta && (
        <div style={{ fontSize: 11, fontWeight: 500, color: delta > 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
          {delta > 0 ? '+' : ''}{delta}%
        </div>
      )}
      {accent && <div style={{ width: '100%', height: 2, background: accentColor, borderRadius: 1, marginTop: 10, opacity: 0.4 }} />}
    </div>
  )
}
