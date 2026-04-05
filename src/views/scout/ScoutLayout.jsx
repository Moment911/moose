"use client"
// ScoutLayout now just uses the main Sidebar — no custom nav rail
import Sidebar from '../../components/Sidebar'

export default function ScoutLayout({ children }) {
  return (
    <div className="flex" style={{ background: '#f4f4f5', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>{children}</main>
    </div>
  )
}
