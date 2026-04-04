import { useState } from 'react'
import { Bug, X, Check, AlertTriangle, Loader2 } from 'lucide-react'

const keys = {
  'Anthropic (Claude AI)': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  'Unsplash': process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY,
  'Pexels': process.env.NEXT_PUBLIC_PEXELS_API_KEY,
  'Pixabay': process.env.NEXT_PUBLIC_PIXABAY_API_KEY,
}

// Log on load in dev
if (import.meta.env.DEV) {
  console.log('[DevApiDebug] API Key Status:')
  Object.entries(keys).forEach(([name, key]) => {
    console.log(`  ${name}: ${key ? 'SET (' + key.slice(0, 8) + '...)' : 'MISSING'}`)
  })
}

export default function DevApiDebug() {
  const [open, setOpen] = useState(false)
  const [tests, setTests] = useState({})
  const [testing, setTesting] = useState({})

  if (!import.meta.env.DEV) return null

  async function testUnsplash() {
    setTesting(t => ({ ...t, unsplash: true }))
    try {
      const res = await fetch('https://api.unsplash.com/search/photos?query=office&per_page=1', {
        headers: { 'Authorization': `Client-ID ${keys['Unsplash']}`, 'Accept-Version': 'v1' }
      })
      const data = await res.json()
      setTests(t => ({ ...t, unsplash: res.ok ? `OK - ${data.total} results for "office"` : `Error ${res.status}: ${data.errors?.[0] || 'Unknown'}` }))
    } catch (e) { setTests(t => ({ ...t, unsplash: `Network error: ${e.message}` })) }
    setTesting(t => ({ ...t, unsplash: false }))
  }

  async function testPexels() {
    setTesting(t => ({ ...t, pexels: true }))
    try {
      const res = await fetch('https://api.pexels.com/v1/search?query=office&per_page=1', {
        headers: { 'Authorization': keys['Pexels'] }
      })
      const data = await res.json()
      setTests(t => ({ ...t, pexels: res.ok ? `OK - ${data.total_results} results` : `Error ${res.status}` }))
    } catch (e) { setTests(t => ({ ...t, pexels: `Network error: ${e.message}` })) }
    setTesting(t => ({ ...t, pexels: false }))
  }

  async function testPixabay() {
    setTesting(t => ({ ...t, pixabay: true }))
    try {
      const res = await fetch(`https://pixabay.com/api/?key=${keys['Pixabay']}&q=office&per_page=1`)
      const data = await res.json()
      setTests(t => ({ ...t, pixabay: data.totalHits !== undefined ? `OK - ${data.totalHits} results` : `Error: ${JSON.stringify(data).slice(0, 100)}` }))
    } catch (e) { setTests(t => ({ ...t, pixabay: `Network error: ${e.message}` })) }
    setTesting(t => ({ ...t, pixabay: false }))
  }

  async function testClaude() {
    setTesting(t => ({ ...t, claude: true }))
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': keys['Anthropic (Claude AI)'],
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 50, messages: [{ role: 'user', content: 'Say hello in 5 words' }] })
      })
      const data = await res.json()
      setTests(t => ({ ...t, claude: res.ok ? `OK - "${data.content?.[0]?.text}"` : `Error ${res.status}: ${data.error?.message || 'Unknown'}` }))
    } catch (e) { setTests(t => ({ ...t, claude: `Network error: ${e.message}` })) }
    setTesting(t => ({ ...t, claude: false }))
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60]">
      <button onClick={() => setOpen(!open)} className={`w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-xs ${open ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`} title="API Debug">
        <Bug size={14} />
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 w-80 bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden text-xs">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="font-semibold">API Debug Panel</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X size={12} /></button>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">API Keys</p>
            {Object.entries(keys).map(([name, key]) => (
              <div key={name} className="flex items-center gap-2">
                {key ? <Check size={10} className="text-green-400 flex-shrink-0" /> : <AlertTriangle size={10} className="text-amber-400 flex-shrink-0" />}
                <span className="flex-1">{name}</span>
                <span className={key ? 'text-green-400' : 'text-amber-400'}>{key ? `...${key.slice(-6)}` : 'MISSING'}</span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/10 space-y-2">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Test Connections</p>
            {[
              { name: 'Claude API', fn: testClaude, key: 'claude', hasKey: !!keys['Anthropic (Claude AI)'] },
              { name: 'Unsplash', fn: testUnsplash, key: 'unsplash', hasKey: !!keys['Unsplash'] },
              { name: 'Pexels', fn: testPexels, key: 'pexels', hasKey: !!keys['Pexels'] },
              { name: 'Pixabay', fn: testPixabay, key: 'pixabay', hasKey: !!keys['Pixabay'] },
            ].map(t => (
              <div key={t.key}>
                <div className="flex items-center gap-2">
                  <button onClick={t.fn} disabled={!t.hasKey || testing[t.key]}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-[10px]">
                    {testing[t.key] ? <Loader2 size={10} className="animate-spin inline" /> : 'Test'} {t.name}
                  </button>
                </div>
                {tests[t.key] && <p className={`text-[10px] mt-0.5 ml-1 ${tests[t.key].startsWith('OK') ? 'text-green-400' : 'text-red-400'}`}>{tests[t.key]}</p>}
              </div>
            ))}
          </div>
          <div className="px-3 py-2 bg-white/5 text-[9px] text-gray-500">
            Add keys to .env: VITE_ANTHROPIC_API_KEY, VITE_UNSPLASH_ACCESS_KEY, etc.
          </div>
        </div>
      )}
    </div>
  )
}
