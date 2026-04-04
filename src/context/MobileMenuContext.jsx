import { createContext, useContext, useState, useCallback } from 'react'

const MobileMenuContext = createContext(null)

export function MobileMenuProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const openMenu = useCallback(() => setIsOpen(true), [])
  const closeMenu = useCallback(() => setIsOpen(false), [])
  const toggleMenu = useCallback(() => setIsOpen(v => !v), [])
  return (
    <MobileMenuContext.Provider value={{ isOpen, openMenu, closeMenu, toggleMenu }}>
      {children}
    </MobileMenuContext.Provider>
  )
}

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext)
  // Return safe defaults if not wrapped in provider (e.g. login page)
  if (!ctx) return { isOpen: false, openMenu: () => {}, closeMenu: () => {}, toggleMenu: () => {} }
  return ctx
}
