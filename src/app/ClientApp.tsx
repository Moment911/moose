"use client"
import { Component, type ReactNode, type ErrorInfo, lazy, Suspense } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>App Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#666' }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const App = lazy(() => import('./App'))

export default function ClientApp() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f2f2f0' }}>
          <div style={{ width:32, height:32, border:'3px solid #e5e7eb', borderTopColor:'#ea2729', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      }>
        <App />
      </Suspense>
    </ErrorBoundary>
  )
}
