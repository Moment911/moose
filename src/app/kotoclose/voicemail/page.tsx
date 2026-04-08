'use client'
import { useState, useEffect, useRef } from 'react'

const KC = { acc:'#E6007E',accTint:'#FFF0F7',blue:'#4A4EFF',blueTint:'#EEF0FF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',secondary:'#555',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif" }

export default function VoicemailPage() {
  const [vms, setVms] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [timer, setTimer] = useState(0)
  const [hasRecording, setHasRecording] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string|null>(null)
  const timerRef = useRef<any>(null)
  const waveRef = useRef<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{ loadVMs() },[])

  async function loadVMs() {
    const res = await fetch('/api/kotoclose?action=vm_library').then(r=>r.json()).catch(()=>({data:[]}))
    setVms(res?.data || [])
  }

  function toggleRecord() {
    if (isRecording) {
      clearInterval(timerRef.current); clearInterval(waveRef.current)
      setIsRecording(false); setHasRecording(true)
    } else {
      setTimer(0); setHasRecording(false); setUploadedFile(null); setIsRecording(true)
      timerRef.current = setInterval(()=>setTimer(t=>t+1), 1000)
    }
  }

  function handleUpload(e:React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setUploadedFile(f.name); setHasRecording(true); setIsRecording(false) }
  }

  async function deleteVM(id:string) {
    await fetch('/api/kotoclose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete_voicemail',id})})
    loadVMs()
  }

  const fmtTime = (s:number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:14 }}>
      {/* Left — Studio */}
      <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
        <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:12 }}>Record or Upload Voicemail</div>

        {/* Preview area */}
        <div style={{ background:KC.bg, borderRadius:8, padding:16, textAlign:'center', border:`0.5px solid ${KC.border}`, marginBottom:12 }}>
          <div style={{ fontSize:12, color:isRecording?'#991b1b':hasRecording?'#16a34a':'#999', fontWeight:500, marginBottom:8 }}>
            {isRecording?'Recording...':hasRecording?(uploadedFile||'Recording saved'):'Click Record to begin'}
          </div>
          {/* Waveform */}
          {isRecording && (
            <div style={{ display:'flex', gap:2, justifyContent:'center', alignItems:'end', height:24, marginBottom:8 }}>
              {Array.from({length:20}).map((_,i)=>(
                <div key={i} style={{ width:3, borderRadius:1, background:'#4A4EFF', height:4+Math.random()*16, transition:'height 0.2s', animation:`kcwave 0.5s ease-in-out ${i*0.05}s infinite alternate` }} />
              ))}
            </div>
          )}
          <div style={{ fontSize:22, fontWeight:700, fontFamily:KC.fd, color:KC.text }}>{fmtTime(timer)}</div>
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button onClick={toggleRecord} style={{
            flex:1, padding:9, borderRadius:8, fontWeight:600, fontSize:12, cursor:'pointer',
            background:isRecording?'rgba(153,27,27,0.15)':'#fef2f2',
            border:'1px solid #991b1b', color:'#991b1b',
          }}>
            {isRecording?'■ Stop Recording':'● Record'}
          </button>
          <button onClick={()=>fileRef.current?.click()} style={{
            flex:1, padding:9, borderRadius:8, fontWeight:600, fontSize:12, cursor:'pointer',
            background:KC.blueTint, border:'1px solid rgba(74,78,255,0.4)', color:KC.blue,
          }}>
            ↑ Upload MP3
          </button>
          <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.webm" style={{ display:'none' }} onChange={handleUpload} />
        </div>

        {/* Playback */}
        {hasRecording && (
          <div style={{ display:'flex', gap:10, alignItems:'center', background:KC.white, borderRadius:8, padding:10, border:`0.5px solid ${KC.border}`, marginBottom:12 }}>
            <button style={{ background:KC.greenTint, border:'0.5px solid rgba(22,163,74,0.3)', color:KC.green, borderRadius:5, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>&#9654; Preview</button>
            <span style={{ fontSize:11, color:KC.secondary }}>{uploadedFile || `recording_${fmtTime(timer)}`}</span>
            <span style={{ fontSize:10, color:'#999', marginLeft:'auto' }}>{fmtTime(timer)}</span>
          </div>
        )}

        {/* Deploy */}
        {hasRecording && (
          <div style={{ background:KC.bg, borderRadius:8, padding:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:KC.text, marginBottom:8 }}>Deploy To</div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <button style={{ flex:1, padding:8, borderRadius:6, fontWeight:600, fontSize:11, cursor:'pointer', background:KC.accTint, border:'0.5px solid rgba(230,0,126,0.3)', color:KC.acc }}>Send as RVM</button>
              <button style={{ flex:1, padding:8, borderRadius:6, fontWeight:600, fontSize:11, cursor:'pointer', background:KC.blueTint, border:'0.5px solid rgba(74,78,255,0.3)', color:KC.blue }}>Push to GHL</button>
            </div>
            <select style={{ width:'100%', background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:6, padding:'7px 10px', fontSize:12, cursor:'pointer' }}>
              <option>HVAC Nurture Sequence</option><option>Spring Promo Follow-up</option><option>Opportunity Re-engage</option><option>5-Touch VM Sequence</option>
            </select>
          </div>
        )}
      </div>

      {/* Right — Library */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:14, fontWeight:600, color:KC.text, fontFamily:KC.fd }}>VM Library</span>
        </div>
        {vms.length===0?(
          <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:30, textAlign:'center', fontSize:12, color:'#999' }}>No voicemails saved yet</div>
        ):vms.map((vm:any)=>(
          <div key={vm.id} style={{ background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:8, padding:12, marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:12, fontWeight:600, color:KC.text }}>{vm.name||'Untitled'}</span>
              <span style={{ fontSize:9, fontWeight:600, background:vm.status==='active'?KC.greenTint:'#f5f5f4', color:vm.status==='active'?KC.green:'#999', padding:'2px 6px', borderRadius:4 }}>{vm.status||'active'}</span>
            </div>
            <div style={{ fontSize:10, color:'#999', marginBottom:6 }}>{vm.duration_sec?`${vm.duration_sec}s`:'--'} &middot; {vm.created_at?new Date(vm.created_at).toLocaleDateString():''}</div>
            <div style={{ display:'flex', gap:4 }}>
              <button style={{ background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>Play</button>
              <button style={{ background:KC.accTint, border:'0.5px solid rgba(230,0,126,0.3)', color:KC.acc, borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>RVM</button>
              <button style={{ background:KC.blueTint, border:'0.5px solid rgba(74,78,255,0.3)', color:KC.blue, borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>GHL</button>
              <button onClick={()=>deleteVM(vm.id)} style={{ background:'none', border:'none', color:'#991b1b', fontSize:10, cursor:'pointer', marginLeft:'auto' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes kcwave{0%{height:4px}100%{height:20px}}`}</style>
    </div>
  )
}
