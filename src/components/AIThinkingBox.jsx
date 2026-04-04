"use client";
import { useState, useEffect, useRef } from 'react'
import { Sparkles, StopCircle } from 'lucide-react'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'

// ── Quip sets by task type ────────────────────────────────────────────────────
const QUIPS = {
  default: [
    "Mainlining espresso and reading your data…",
    "Asking the AI oracle for wisdom…",
    "Consulting 47 marketing textbooks simultaneously…",
    "Doing the thinking so you don't have to…",
    "Generating something suspiciously good…",
    "Converting caffeine into insights…",
    "Waking up the neural networks…",
    "Searching for the perfect words (found them, deleting them, starting over)…",
    "Running calculations at the speed of light (ish)…",
    "Pretending this is easy…",
  ],
  seo: [
    "Crawling the web like a caffeinated spider…",
    "Interrogating your keywords for answers…",
    "Reverse-engineering Google's brain…",
    "Checking if your competitors are sleeping…",
    "Computing position improvements with extreme prejudice…",
    "Whispering to the algorithm…",
    "Finding all the low-hanging fruit (there's a lot)…",
    "Consulting the map pack oracle…",
    "Auditing your SEO like a nosy neighbor…",
  ],
  proposal: [
    "Crafting words that print money…",
    "Making your services sound irresistible (they already are)…",
    "Writing copy that closes deals in its sleep…",
    "Channeling every great salesperson who ever lived…",
    "Turning features into feelings…",
    "Building your most compelling pitch yet…",
    "Adding the magic words clients can't resist…",
    "Making $297/mo sound like the steal of the century…",
  ],
  review: [
    "Thinking about the best way to respond without losing your cool…",
    "Crafting a reply that's professional but has a little spice…",
    "Writing the response your client wish they had thought of…",
    "Turning that 2-star into a brand moment…",
    "Finding the diplomatic words for 'we hear you'…",
    "Drafting a response that makes the reviewer feel important…",
    "Constructing the perfect 'thanks for the feedback' (but make it strategic)…",
  ],
  scout: [
    "Scanning the local business landscape like a hawk…",
    "Sniffing out leads that don't know they need you yet…",
    "Cross-referencing zip codes and opportunity scores…",
    "Profiling businesses that are begging for better marketing…",
    "Mining the data goldmine…",
    "Identifying who's spending money on the wrong things…",
    "Finding businesses that answer their phone with 'WHAT'…",
    "Locating the low-hanging fruit in your market…",
  ],
  analysis: [
    "Running the numbers through the prediction engine…",
    "Comparing your data to 10,000 similar businesses…",
    "Building the strategy nobody else will tell you about…",
    "Processing every data point with unnecessary enthusiasm…",
    "Synthesizing insights from the digital ether…",
    "Making sense of the chaos (your data, specifically)…",
    "Turning raw numbers into a roadmap…",
    "Connecting dots you didn't even know were there…",
  ],
  onboarding: [
    "Reading everything your client just told you…",
    "Turning questionnaire answers into actual strategy…",
    "Building a persona your whole team will actually use…",
    "Extracting the gold from those long-form answers…",
    "Analyzing the competition your client is worried about…",
  ],
}

// Pick a quip set based on task context
function pickQuips(task='default') {
  const set = QUIPS[task] || QUIPS.default
  return [...set].sort(()=>Math.random()-.5)
}

// ── Elapsed time formatter ────────────────────────────────────────────────────
function formatTime(ms) {
  const s = Math.floor(ms/1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s/60)}m ${s%60}s`
}

// ── Dot wave animation ────────────────────────────────────────────────────────
function DotWave() {
  return (
    <span style={{ display:'inline-flex', alignItems:'flex-end', gap:3, height:16, marginLeft:2 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width:4, height:4, borderRadius:'50%', background:TEAL, display:'inline-block',
          animation:`dotBounce 1.2s ease-in-out ${i*0.2}s infinite` }}/>
      ))}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// AIThinkingBox — drop this anywhere an AI call is in-progress
//
// Props:
//   active   boolean  — show when true
//   task     string   — 'seo' | 'proposal' | 'review' | 'scout' | 'analysis' | 'onboarding' | 'default'
//   label    string   — optional override headline
//   onStop   fn       — optional cancel callback
//   inline   boolean  — compact single-line mode (for buttons/textareas)
//   dark     boolean  — dark background variant
// ══════════════════════════════════════════════════════════════════════════════
export default function AIThinkingBox({ active, task='default', label, onStop, inline=false, dark=false }) {
  const [quips]   = useState(() => pickQuips(task))
  const [idx, setIdx]     = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [visible, setVisible] = useState(false)
  const startRef  = useRef(null)
  const timerRef  = useRef(null)
  const quipTimer = useRef(null)

  useEffect(() => {
    if (active) {
      startRef.current = Date.now()
      setElapsed(0)
      setIdx(0)
      setVisible(true)

      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current)
      }, 100)

      quipTimer.current = setInterval(() => {
        setIdx(i => (i+1) % quips.length)
      }, 3200)
    } else {
      clearInterval(timerRef.current)
      clearInterval(quipTimer.current)
      // Fade out
      setTimeout(() => setVisible(false), 300)
    }
    return () => {
      clearInterval(timerRef.current)
      clearInterval(quipTimer.current)
    }
  }, [active])

  if (!visible && !active) return null

  // ── Inline mode ─────────────────────────────────────────────────────────────
  if (inline) {
    return (
      <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:20, background: dark?'rgba(255,255,255,.08)':'#f0fbfc', border:`1px solid ${TEAL}40`, opacity: active?1:0, transition:'opacity .3s' }}>
        <Sparkles size={13} color={TEAL} style={{ animation:'pulse 1.5s ease infinite', flexShrink:0 }}/>
        <span style={{ fontSize:13, fontWeight:700, color: dark?TEAL:'#0e7490', maxWidth:280, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {quips[idx]}
        </span>
        <DotWave/>
        <span style={{ fontSize:12, fontWeight:800, color: dark?'rgba(255,255,255,.4)':'#9ca3af', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
          {formatTime(elapsed)}
        </span>
        {onStop && (
          <button onClick={onStop} style={{ border:'none', background:'none', cursor:'pointer', color:RED, padding:'0 2px', display:'flex', alignItems:'center' }}>
            <StopCircle size={13}/>
          </button>
        )}
      </div>
    )
  }

  // ── Full box mode ────────────────────────────────────────────────────────────
  const bg      = dark ? '#0a0a0a'           : '#fff'
  const border  = dark ? 'rgba(91,198,208,.25)' : `${TEAL}40`
  const textCol = dark ? 'rgba(255,255,255,.9)' : '#111'
  const subCol  = dark ? 'rgba(255,255,255,.4)' : '#374151'

  return (
    <div style={{ borderRadius:16, border:`1.5px solid ${border}`, background:bg, padding:'18px 20px', opacity:active?1:0, transform:active?'translateY(0)':'translateY(6px)', transition:'opacity .3s, transform .3s', overflow:'hidden', position:'relative' }}>
      {/* Animated teal glow bar at top */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${TEAL}, ${RED}, ${TEAL})`, backgroundSize:'200% 100%', animation:'barSlide 2s linear infinite' }}/>

      <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
        {/* Animated icon */}
        <div style={{ width:40, height:40, borderRadius:12, background:`${TEAL}18`, border:`1px solid ${TEAL}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Sparkles size={20} color={TEAL} style={{ animation:'spin 3s linear infinite' }}/>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Label */}
          <div style={{ fontSize:12, fontWeight:800, color:TEAL, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 }}>
            {label || 'AI is working'}
          </div>

          {/* Quip — animated */}
          <div style={{ fontSize:15, fontWeight:700, color:textCol, display:'flex', alignItems:'center', gap:6, minHeight:24 }}>
            <span style={{ animation:'fadeSlide .4s ease both', key:idx }}>
              {quips[idx]}
            </span>
            <DotWave/>
          </div>

          {/* Footer: timer + stop */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:10 }}>
            {/* Stopwatch */}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:RED, animation:'pulse 1s ease infinite' }}/>
              <span style={{ fontSize:13, fontWeight:800, color:subCol, fontVariantNumeric:'tabular-nums' }}>
                {formatTime(elapsed)}
              </span>
            </div>
            {/* Progress dots */}
            <div style={{ flex:1, height:3, background: dark?'rgba(255,255,255,.08)':'#f3f4f6', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:'60%', background:`linear-gradient(90deg, ${TEAL}, ${RED})`, borderRadius:2, animation:'barSlide 1.8s ease-in-out infinite alternate' }}/>
            </div>
            {onStop && (
              <button onClick={onStop}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, border:`1px solid ${RED}40`, background:'transparent', color:RED, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                <StopCircle size={11}/> Stop
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes barSlide { from { background-position: 0% 0%; } to { background-position: 200% 0%; } }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
      `}</style>
    </div>
  )
}
