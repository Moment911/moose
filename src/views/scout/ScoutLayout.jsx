"use client"
// ScoutLayout now just uses the main Sidebar — no custom nav rail
import Sidebar from '../../components/Sidebar'

export default function ScoutLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f4f5' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  )
}
