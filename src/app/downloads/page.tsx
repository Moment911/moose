"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Apple, Monitor, HardDrive, Globe as Chrome, Brain, CheckCircle, Zap, Bell, Keyboard } from 'lucide-react'

const DOWNLOADS = {
  macos_arm: {
    label: 'macOS Apple Silicon',
    description: 'M1 / M2 / M3 / M4 Macs',
    filename: 'KotoIQ-1.0.0-arm64.dmg',
    icon: Apple,
    note: '~10 MB',
  },
  macos_intel: {
    label: 'macOS Intel',
    description: 'Intel-based Macs',
    filename: 'KotoIQ-1.0.0-x64.dmg',
    icon: Apple,
    note: '~10 MB',
  },
  windows: {
    label: 'Windows',
    description: 'Windows 10 / 11 (64-bit)',
    filename: 'KotoIQ-1.0.0-setup.exe',
    icon: Monitor,
    note: '~8 MB · .msi also available',
  },
  linux_deb: {
    label: 'Linux (.deb)',
    description: 'Ubuntu / Debian / Mint',
    filename: 'kotoiq_1.0.0_amd64.deb',
    icon: HardDrive,
    note: '~12 MB',
  },
  linux_appimage: {
    label: 'Linux (.AppImage)',
    description: 'Any Linux distro',
    filename: 'KotoIQ-1.0.0.AppImage',
    icon: HardDrive,
    note: '~15 MB',
  },
}

export default function DownloadsPage() {
  const [platform, setPlatform] = useState<keyof typeof DOWNLOADS>('macos_arm')

  useEffect(() => {
    const ua = navigator.userAgent
    const platformStr = navigator.platform || ''
    if (/Mac/i.test(platformStr)) {
      // Detect Apple Silicon vs Intel
      const isAppleSilicon = /Apple|ARM/i.test(ua) || (navigator as any).userAgentData?.platform === 'macOS'
      setPlatform(isAppleSilicon ? 'macos_arm' : 'macos_intel')
    } else if (/Win/i.test(platformStr)) {
      setPlatform('windows')
    } else if (/Linux/i.test(platformStr)) {
      setPlatform('linux_deb')
    }
  }, [])

  const recommended = DOWNLOADS[platform]
  const RecIcon = recommended.icon

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fafafa 0%, #f3f4f6 100%)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px', background: '#14b8a614', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#0f766e', marginBottom: 16 }}>
            <Brain size={14} /> Native Desktop App
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: '#111', letterSpacing: '-.03em', margin: 0, marginBottom: 12 }}>
            KotoIQ for Desktop
          </h1>
          <p style={{ fontSize: 18, color: '#374151', margin: 0, maxWidth: 520, marginInline: 'auto', lineHeight: 1.5 }}>
            The full SEO intelligence platform as a native app. Faster, always-on, with system tray, keyboard shortcuts, and native notifications.
          </p>
        </div>

        {/* Recommended download — big card */}
        <div style={{ background: '#111', borderRadius: 20, padding: '32px 40px', color: '#fff', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#14b8a6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RecIcon size={32} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>Recommended for your system</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{recommended.label}</div>
              <div style={{ fontSize: 13, color: '#a3e635', marginTop: 2 }}>{recommended.description} · {recommended.note}</div>
            </div>
          </div>
          <a href={`/api/desktop/download/${platform}`} download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, background: '#14b8a6', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
            <Download size={18} /> Download {recommended.filename.split('-').pop()}
          </a>
        </div>

        {/* All platforms grid */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>All Platforms</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {Object.entries(DOWNLOADS).map(([key, d]) => {
              const Icon = d.icon
              return (
                <a key={key} href={`/api/desktop/download/${key}`} download style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, textDecoration: 'none', color: '#111', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <Icon size={24} color="#374151" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{d.label}</div>
                    <div style={{ fontSize: 12, color: '#374151' }}>{d.description}</div>
                  </div>
                  <Download size={16} color="#14b8a6" />
                </a>
              )
            })}
          </div>
        </div>

        {/* Features */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 40px', border: '1px solid #e5e7eb', marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 20 }}>Why the Desktop App?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              { icon: Zap, title: 'Faster than browser', body: 'Native webview, less overhead than Chrome tabs. Dedicated RAM for KotoIQ.' },
              { icon: Bell, title: 'Native notifications', body: 'Ranking alerts, competitor moves, daily digests — in your system notification center.' },
              { icon: Keyboard, title: 'Keyboard shortcuts', body: '⌘1-4 to jump tabs, ⌘/ to open Ask KotoIQ, ⌘N for new window. Menu bar everywhere.' },
              { icon: CheckCircle, title: 'System tray access', body: 'Quick menu always in your menu bar / system tray. Jump to any tool in one click.' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: '#14b8a614', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={18} color="#14b8a6" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 3, lineHeight: 1.5 }}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chrome Extension */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#ef444414', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Chrome size={28} color="#ef4444" />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>KotoIQ Chrome Extension</div>
            <div style={{ fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 1.5 }}>
              Right-click any page → Run On-Page Audit, Extract Topical Map, Score AEO, Check Plagiarism. Use it on prospects before pitches.
            </div>
          </div>
          <a href="/api/desktop/chrome-extension" download style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: '#111', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Download size={14} /> Download .zip
          </a>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 13, color: '#374151' }}>
          <Link href="/kotoiq" style={{ color: '#14b8a6', fontWeight: 700, textDecoration: 'none' }}>← Back to KotoIQ</Link>
        </div>
      </div>
    </div>
  )
}
