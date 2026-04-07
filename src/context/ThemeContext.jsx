"use client"

import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({ isDark: false, toggleDark: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('koto-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = saved ? saved === 'dark' : prefersDark
    setIsDark(dark)
    applyTheme(dark)
  }, [])

  function applyTheme(dark) {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      root.style.setProperty('--bg', '#0a0a0a')
      root.style.setProperty('--card', '#141414')
      root.style.setProperty('--text', '#f2f2f0')
      root.style.setProperty('--text-secondary', '#9ca3af')
      root.style.setProperty('--border', '#2a2a2a')
      root.style.setProperty('--sidebar', '#111111')
    } else {
      root.classList.remove('dark')
      root.style.setProperty('--bg', '#f2f2f0')
      root.style.setProperty('--card', '#ffffff')
      root.style.setProperty('--text', '#0a0a0a')
      root.style.setProperty('--text-secondary', '#6b7280')
      root.style.setProperty('--border', '#e5e7eb')
      root.style.setProperty('--sidebar', '#ffffff')
    }
  }

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('koto-theme', next ? 'dark' : 'light')
    applyTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
