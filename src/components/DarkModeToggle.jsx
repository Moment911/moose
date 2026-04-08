'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const R   = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b';
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

const STORAGE_KEY = 'koto_dark_mode';

const LIGHT_VARS = {
  '--bg-primary': '#ffffff',
  '--bg-secondary': '#F9F9F9',
  '--bg-card': '#ffffff',
  '--text-primary': '#0a0a0a',
  '--text-secondary': '#6b7280',
  '--border': '#e5e7eb',
};

const DARK_VARS = {
  '--bg-primary': '#0a0a0a',
  '--bg-secondary': '#1a1a1a',
  '--bg-card': '#111111',
  '--text-primary': '#F9F9F9',
  '--text-secondary': '#9ca3af',
  '--border': '#2a2a2a',
};

function applyTheme(isDark) {
  const root = document.documentElement;
  const vars = isDark ? DARK_VARS : LIGHT_VARS;

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  // Read preference on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const isDark = stored === 'true';
        setDark(isDark);
        applyTheme(isDark);
      } else {
        applyTheme(false);
      }
    } catch {
      applyTheme(false);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: dark ? '#1a1a1a' : GRY,
        transition: 'all 300ms ease',
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = dark ? '#2a2a2a' : '#e5e7eb';
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = dark ? '#1a1a1a' : GRY;
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {dark ? (
        <Sun size={14} color={AMB} style={{ transition: 'all 300ms ease' }} />
      ) : (
        <Moon size={14} color={BLK} style={{ transition: 'all 300ms ease' }} />
      )}
    </button>
  );
}
