"use client"

export default function DataTable({ columns, rows, onRowClick, emptyMessage }) {
  if (!rows?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999999', fontSize: 13 }}>
        {emptyMessage || 'No data'}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '8px 12px', textAlign: col.align || 'left',
                fontSize: 11, fontWeight: 500, color: '#AAAAAA',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                whiteSpace: 'nowrap',
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} onClick={() => onRowClick?.(row)} style={{
              cursor: onRowClick ? 'pointer' : 'default',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
            }}>
              {columns.map(col => (
                <td key={col.key} style={{
                  padding: '10px 12px', fontSize: 13, color: '#333333',
                  textAlign: col.align || 'left',
                }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
