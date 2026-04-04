"use client";
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Check, MapPin, ChevronRight, Building2, Navigation, Loader2, Users } from 'lucide-react'
import { US_STATES, fetchCounties, fetchCities, formatPop, METRO_AREAS, REGIONS, loadStateGeo, lookupZips } from '../../data/usGeoData'
import toast from 'react-hot-toast'

export default function GeoDrillDown({ onChange, className }) {
  const [activeTab, setActiveTab] = useState('states')
  const [selectedStates, setSelectedStates] = useState([])
  const [counties, setCounties] = useState([])
  const [selectedCounties, setSelectedCounties] = useState([])
  const [cities, setCities] = useState([])
  const [selectedCities, setSelectedCities] = useState([])
  const [zipInput, setZipInput] = useState('')
  const [zipCodes, setZipCodes] = useState([])
  const [radiusCenter, setRadiusCenter] = useState('')
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [loadingCounties, setLoadingCounties] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [stateSearch, setStateSearch] = useState('')
  const [countySearch, setCountySearch] = useState('')
  const [citySearch, setCitySearch] = useState('')

  // Load counties when states change
  useEffect(() => {
    if (selectedStates.length === 0) { setCounties([]); setSelectedCounties([]); return }
    setLoadingCounties(true)
    Promise.all(selectedStates.map(sc =>
      fetchCounties(sc)
    )).then(results => {
      setCounties(results.flat())
      setLoadingCounties(false)
    })
  }, [selectedStates])

  // Load cities when counties change
  useEffect(() => {
    if (selectedStates.length === 0) { setCities([]); return }
    setLoadingCities(true)
    Promise.all(selectedStates.map(sc =>
      fetchCities(sc)
    )).then(results => {
      setCities(results.flat())
      setLoadingCities(false)
    })
  }, [selectedStates])

  // Emit changes
  useEffect(() => {
    onChange?.({
      states: selectedStates,
      counties: selectedCounties.map(c => c.name),
      cities: selectedCities.map(c => c.name),
      zipCodes,
      radius: radiusCenter ? { center: radiusCenter, miles: radiusMiles } : null,
      summary: {
        states: selectedStates.length,
        counties: selectedCounties.length,
        cities: selectedCities.length,
        zipCodes: zipCodes.length,
      }
    })
  }, [selectedStates, selectedCounties, selectedCities, zipCodes, radiusCenter, radiusMiles])

  function toggleState(code) {
    setSelectedStates(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
  }

  function toggleCounty(county) {
    setSelectedCounties(prev => prev.some(c => c.name === county.name && c.stateCode === county.stateCode)
      ? prev.filter(c => !(c.name === county.name && c.stateCode === county.stateCode))
      : [...prev, county])
  }

  function toggleCity(city) {
    setSelectedCities(prev => prev.some(c => c.name === city.name && c.stateCode === city.stateCode)
      ? prev.filter(c => !(c.name === city.name && c.stateCode === city.stateCode))
      : [...prev, city])
  }

  function selectMetro(metro) {
    metro.states.forEach(st => { if (!selectedStates.includes(st)) setSelectedStates(prev => [...prev, st]) })
    // Select counties matching the metro
    setTimeout(() => {
      setSelectedCounties(prev => {
        const existing = new Set(prev.map(c => c.name))
        const newCounties = counties.filter(c => metro.counties.includes(c.name) && !existing.has(c.name))
        return [...prev, ...newCounties]
      })
    }, 1500) // wait for counties to load
    toast.success(`${metro.name} selected`)
  }

  async function addZipsFromInput() {
    const parsed = zipInput.replace(/[^0-9,\s\n]/g, '').split(/[,\s\n]+/).map(z => z.trim()).filter(z => z.length === 5)
    if (!parsed.length) return
    const unique = [...new Set([...zipCodes, ...parsed])]
    setZipCodes(unique)
    setZipInput('')
    toast.success(`Added ${parsed.length} ZIP code${parsed.length > 1 ? 's' : ''}`)
  }

  function selectAllCities() { setSelectedCities([...filteredCitiesResult]) }
  function deselectAllCities() { setSelectedCities([]) }
  function selectAllCounties() { setSelectedCounties([...filteredCounties]) }
  function deselectAllCounties() { setSelectedCounties([]) }
  function copyAllZips() { navigator.clipboard.writeText(zipCodes.join(', ')); toast.success(`${zipCodes.length} zips copied`) }

  // REGIONS is now imported from usGeoData

  function selectRegion(regionStates) {
    setSelectedStates(prev => [...new Set([...prev, ...regionStates])])
  }

  function clearAll() {
    setSelectedStates([]); setSelectedCounties([]); setSelectedCities([]); setZipCodes([])
    setRadiusCenter(''); setRadiusMiles(10)
  }

  const filteredStates = US_STATES.filter(s => !stateSearch || s.name.toLowerCase().includes(stateSearch.toLowerCase()) || s.code.toLowerCase().includes(stateSearch.toLowerCase()))
  const filteredCounties = counties.filter(c => !countySearch || c.name.toLowerCase().includes(countySearch.toLowerCase()))
  const filteredCitiesResult = (selectedCounties.length > 0
    ? cities.filter(c => selectedCounties.some(sc => sc.name === c.county && sc.stateCode === c.stateCode))
    : cities
  ).filter(c => !citySearch || c.name.toLowerCase().includes(citySearch.toLowerCase()))

  const totalSelections = selectedStates.length + selectedCounties.length + selectedCities.length + zipCodes.length + (radiusCenter ? 1 : 0)

  return (
    <div className={`bg-white rounded-2xl border border-zinc-200 overflow-hidden ${className || ''}`} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 overflow-x-auto">
        {[
          { key: 'states', label: '🗺️ States', badge: selectedStates.length },
          { key: 'counties', label: '📋 Counties', badge: selectedCounties.length },
          { key: 'cities', label: '🏙️ Cities', badge: selectedCities.length },
          { key: 'zips', label: '📍 ZIP / Radius', badge: zipCodes.length },
          { key: 'metros', label: '🌆 Metros' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
            {t.label}
            {t.badge > 0 && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{t.badge}</span>}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-auto">
        {/* STATES TAB */}
        {activeTab === 'states' && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-1.5">
                <Search size={13} className="text-zinc-400" />
                <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search states..." value={stateSearch} onChange={e => setStateSearch(e.target.value)} />
              </div>
              <button onClick={() => setSelectedStates(US_STATES.map(s => s.code))} className="text-[10px] text-zinc-500 hover:text-orange-600 whitespace-nowrap">All</button>
              <button onClick={() => setSelectedStates([])} className="text-[10px] text-zinc-500 hover:text-orange-600 whitespace-nowrap">None</button>
            </div>
            {/* Region quick selects */}
            <div className="flex flex-wrap gap-1 mb-3">
              {Object.entries(REGIONS).map(([name, codes]) => (
                <button key={name} onClick={() => selectRegion(codes)} className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">{name}</button>
              ))}
              <button onClick={() => setSelectedStates(US_STATES.map(s => s.code))} className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">All US</button>
            </div>
            {/* Selected pills */}
            {selectedStates.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {selectedStates.map(code => (
                  <span key={code} className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                    {code} <button onClick={() => toggleState(code)} className="hover:text-orange-900"><X size={9} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {filteredStates.map(s => (
                <button key={s.code} onClick={() => toggleState(s.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${selectedStates.includes(s.code) ? 'bg-orange-50 text-orange-700 font-medium' : 'text-zinc-600 hover:bg-zinc-50'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedStates.includes(s.code) ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                    {selectedStates.includes(s.code) && <Check size={10} className="text-white" />}
                  </div>
                  {s.name} <span className="text-zinc-400 ml-auto">{s.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* COUNTIES TAB */}
        {activeTab === 'counties' && (
          <div className="p-4">
            {selectedStates.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400"><MapPin size={24} className="mx-auto mb-2 text-zinc-300" />Select state(s) first</div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-1.5">
                    <Search size={13} className="text-zinc-400" />
                    <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search counties..." value={countySearch} onChange={e => setCountySearch(e.target.value)} />
                  </div>
                  <button onClick={selectAllCounties} className={`text-[10px] whitespace-nowrap px-2 py-0.5 rounded ${selectedCounties.length === filteredCounties.length && filteredCounties.length > 0 ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-orange-600'}`}>
                    {selectedCounties.length === filteredCounties.length && filteredCounties.length > 0 ? `✅ All ${filteredCounties.length}` : `Select All ${filteredCounties.length}`}
                  </button>
                  <button onClick={deselectAllCounties} className="text-[10px] text-zinc-500 hover:text-orange-600 whitespace-nowrap">Clear</button>
                </div>
                {loadingCounties ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-zinc-400"><Loader2 size={16} className="animate-spin" /> Loading counties...</div>
                ) : (
                  <div className="space-y-0.5 max-h-[280px] overflow-auto">
                    {filteredCounties.map(c => (
                      <button key={`${c.stateCode}-${c.name}`} onClick={() => toggleCounty(c)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${selectedCounties.some(sc => sc.name === c.name && sc.stateCode === c.stateCode) ? 'bg-orange-50 text-orange-700 font-medium' : 'text-zinc-600 hover:bg-zinc-50'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedCounties.some(sc => sc.name === c.name && sc.stateCode === c.stateCode) ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                          {selectedCounties.some(sc => sc.name === c.name && sc.stateCode === c.stateCode) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="flex-1">{c.name}</span>
                        <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{c.stateCode}</span>
                      </button>
                    ))}
                    {filteredCounties.length === 0 && <p className="text-center py-4 text-sm text-zinc-400">No counties found</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* CITIES TAB */}
        {activeTab === 'cities' && (
          <div className="p-4">
            {selectedStates.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400"><Building2 size={24} className="mx-auto mb-2 text-zinc-300" />Select state(s) first</div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-1.5">
                    <Search size={13} className="text-zinc-400" />
                    <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search cities..." value={citySearch} onChange={e => setCitySearch(e.target.value)} />
                  </div>
                  <button onClick={selectAllCities} className={`text-[10px] whitespace-nowrap px-2 py-0.5 rounded ${selectedCities.length === filteredCitiesResult.length && filteredCitiesResult.length > 0 ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-orange-600'}`}>
                    {selectedCities.length === filteredCitiesResult.length && filteredCitiesResult.length > 0 ? `✅ All ${filteredCitiesResult.length}` : `Select All ${filteredCitiesResult.length}`}
                  </button>
                  <button onClick={deselectAllCities} className="text-[10px] text-zinc-500 hover:text-orange-600 whitespace-nowrap">Clear</button>
                </div>
                {loadingCities ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-zinc-400"><Loader2 size={16} className="animate-spin" /> Loading cities...</div>
                ) : (
                  <div className="space-y-0.5 max-h-[280px] overflow-auto">
                    {filteredCitiesResult.map(c => (
                      <button key={`${c.stateCode}-${c.name}`} onClick={() => toggleCity(c)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${selectedCities.some(sc => sc.name === c.name && sc.stateCode === c.stateCode) ? 'bg-orange-50 text-orange-700 font-medium' : 'text-zinc-600 hover:bg-zinc-50'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedCities.some(sc => sc.name === c.name && sc.stateCode === c.stateCode) ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                          {selectedCities.some(sc => sc.name === c.name && sc.stateCode === c.stateCode) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="flex-1">{c.name}</span>
                        
                        <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{c.stateCode}</span>
                      </button>
                    ))}
                    {filteredCitiesResult.length === 0 && <p className="text-center py-4 text-sm text-zinc-400">No cities found</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ZIPS / RADIUS TAB */}
        {activeTab === 'zips' && (
          <div className="p-4 space-y-4">
            {/* Manual ZIP entry */}
            <div>
              <p className="text-xs font-semibold text-zinc-700 mb-2">Add ZIP Codes</p>
              <div className="flex gap-2">
                <textarea className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 resize-none" rows={2}
                  placeholder="Paste zips: 33101, 33102, 33103..." value={zipInput} onChange={e => setZipInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addZipsFromInput() } }} />
                <button onClick={addZipsFromInput} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 rounded-lg transition-colors self-end">Add</button>
              </div>
              {zipCodes.length > 0 && (
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <span className="text-[10px] text-zinc-500 font-medium">{zipCodes.length} zip codes</span>
                  <button onClick={copyAllZips} className="text-[10px] text-orange-500 hover:text-orange-700">📋 Copy All</button>
                  <button onClick={() => setZipCodes([])} className="text-[10px] text-zinc-400 hover:text-red-500">Clear</button>
                </div>
              )}
              {zipCodes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {zipCodes.slice(0, 30).map(z => (
                    <span key={z} className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 text-[10px] px-2 py-0.5 rounded-full">
                      {z} <button onClick={() => setZipCodes(prev => prev.filter(x => x !== z))} className="hover:text-red-500"><X size={8} /></button>
                    </span>
                  ))}
                  {zipCodes.length > 30 && <span className="text-[10px] text-zinc-400">+{zipCodes.length - 30} more</span>}
                </div>
              )}
            </div>

            {/* Radius */}
            <div>
              <p className="text-xs font-semibold text-zinc-700 mb-2">Radius Search</p>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2">
                  <Navigation size={13} className="text-zinc-400" />
                  <input className="text-sm bg-transparent outline-none flex-1" placeholder="Center: city, address, or zip code"
                    value={radiusCenter} onChange={e => setRadiusCenter(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">Radius: <strong>{radiusMiles} miles</strong></span>
                </div>
                <input type="range" min={1} max={100} value={radiusMiles} onChange={e => setRadiusMiles(+e.target.value)} className="w-full accent-orange-500" />
                <div className="flex flex-wrap gap-1 mt-2">
                  {[5, 10, 15, 25, 50, 100].map(r => (
                    <button key={r} onClick={() => setRadiusMiles(r)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors ${radiusMiles === r ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>{r} mi</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* METROS TAB */}
        {activeTab === 'metros' && (
          <div className="p-4">
            <p className="text-xs text-zinc-500 mb-3">Quick-select major metropolitan areas</p>
            <div className="grid grid-cols-2 gap-2">
              {METRO_AREAS.map(m => (
                <button key={m.id} onClick={() => selectMetro(m)}
                  className="text-left p-3 rounded-xl border border-zinc-200 hover:border-orange-300 hover:bg-orange-50 transition-all group">
                  <p className="text-sm font-medium text-zinc-800 group-hover:text-orange-700">{m.name}</p>
                  <p className="text-[10px] text-zinc-400">{m.counties.length} counties &middot; {formatPop(m.pop)} pop</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {totalSelections > 0 && (
        <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center gap-3">
          <MapPin size={14} className="text-orange-500 flex-shrink-0" />
          <div className="flex-1 text-xs text-zinc-600">
            {selectedStates.length > 0 && <span>{selectedStates.length} state{selectedStates.length > 1 ? 's' : ''}</span>}
            {selectedCounties.length > 0 && <span> &middot; {selectedCounties.length} counties</span>}
            {selectedCities.length > 0 && <span> &middot; {selectedCities.length} cities</span>}
            {zipCodes.length > 0 && <span> &middot; {zipCodes.length} zips</span>}
            {radiusCenter && <span> &middot; {radiusMiles}mi radius</span>}
          </div>
          <button onClick={clearAll} className="text-[10px] text-zinc-400 hover:text-red-500">Clear all</button>
        </div>
      )}
    </div>
  )
}
