"use client";
import { useState, useRef } from 'react'

export default function Tooltip({ children, text, position = 'top' }) {
  const [show, setShow] = useState(false)
  const timer = useRef(null)

  function enter() { timer.current = setTimeout(() => setShow(true), 500) }
  function leave() { clearTimeout(timer.current); setShow(false) }

  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className="relative inline-flex" onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {show && text && (
        <div className={`absolute ${pos[position] || pos.top} z-50 pointer-events-none`}>
          <div className="bg-gray-900 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap font-medium max-w-[200px]" style={{ lineHeight: 1.4 }}>
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
