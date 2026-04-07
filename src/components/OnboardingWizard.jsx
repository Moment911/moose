"use client"

import { useState, useEffect } from 'react'
import {
  Sparkles, Globe, Star, Target, ChevronRight, ChevronLeft,
  Check, X, Loader2, Zap, BarChart2, Phone
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const R = '#ea2729'
const T = '#5bc6d0'
const BLK = '#0a0a0a'
const GRY = '#f2f2f0'
const GRN = '#16a34a'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const confettiColors = [
  R, T, GRN, '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
  '#0ea5e9', '#a855f7', '#22c55e', '#eab308', '#ef4444',
  '#3b82f6', '#d946ef', '#10b981'
]

const confettiKeyframes = `
@keyframes confetti-fall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
`

export default function OnboardingWizard({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 2 state
  const [wpUrl, setWpUrl] = useState('')
  const [wpApiKey, setWpApiKey] = useState('')
  const [wpConnected, setWpConnected] = useState(false)
  const [wpError, setWpError] = useState('')

  // Step 3 state
  const [businessName, setBusinessName] = useState('')
  const [service, setService] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  // Step 4 state
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  if (!open) return null

  async function connectWordPress() {
    if (!wpUrl || !wpApiKey) {
      toast.error('Please enter both URL and API key')
      return
    }
    setLoading(true)
    setWpError('')
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', url: wpUrl, api_key: wpApiKey })
      })
      const data = await res.json()
      if (data.error) {
        setWpError(data.error)
        toast.error('Connection failed')
      } else {
        setWpConnected(true)
        toast.success('WordPress connected!')
      }
    } catch (err) {
      setWpError('Failed to connect. Check your URL and API key.')
      toast.error('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  function saveBusinessInfo() {
    sessionStorage.setItem('koto-business', JSON.stringify({
      business_name: businessName,
      service,
      phone,
      city,
      state
    }))
  }

  async function generatePage() {
    if (!service || !city || !state) {
      toast.error('Please fill in your business info first')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_research',
          keyword: service,
          city,
          state
        })
      })
      const data = await res.json()
      if (data.error) {
        toast.error('Generation failed')
      } else {
        const wc = data.word_count || data.content?.split(/\s+/).length || 0
        setWordCount(wc)
        setGenerated(true)
        toast.success('Page generated!')
      }
    } catch (err) {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function completeOnboarding() {
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id)
      toast.success('Welcome to Koto!')
      onClose()
      navigate('/dashboard')
    } catch (err) {
      toast.error('Something went wrong')
    }
  }

  function nextStep() {
    if (step === 3) saveBusinessInfo()
    if (step < 5) setStep(step + 1)
  }

  function prevStep() {
    if (step > 1) setStep(step - 1)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    fontSize: '15px',
    fontFamily: FB,
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: '#fff',
    color: BLK
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: FH,
    color: '#6b7280'
  }

  function renderProgressBar() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: FH,
              backgroundColor: s < step ? GRN : s === step ? R : '#e5e7eb',
              color: s <= step ? '#fff' : '#9ca3af',
              transition: 'all 0.3s'
            }}>
              {s < step ? <Check size={16} /> : s}
            </div>
            {s < 5 && (
              <div style={{
                width: '40px',
                height: '3px',
                borderRadius: '2px',
                backgroundColor: s < step ? GRN : '#e5e7eb',
                transition: 'all 0.3s'
              }} />
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderStep1() {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>
          <Zap size={48} color={R} style={{ margin: '0 auto' }} />
        </div>
        <h2 style={{ fontFamily: FH, fontSize: '28px', fontWeight: 800, color: BLK, marginBottom: '8px' }}>
          Welcome to Koto
        </h2>
        <p style={{ fontFamily: FB, fontSize: '15px', color: '#6b7280', marginBottom: '32px' }}>
          Everything you need to grow your local business online
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
          {[
            { icon: <Sparkles size={24} color={T} />, title: 'AI Page Builder', desc: 'Generate geo-targeted SEO pages for any city' },
            { icon: <Star size={24} color='#f59e0b' />, title: 'Review Management', desc: 'Collect and respond to reviews automatically' },
            { icon: <Target size={24} color={R} />, title: 'Scout Intelligence', desc: 'Find new leads with AI-powered prospecting' }
          ].map((card, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              padding: '20px',
              borderRadius: '14px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              textAlign: 'left',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontFamily: FH, fontWeight: 700, fontSize: '15px', color: BLK, marginBottom: '4px' }}>
                  {card.title}
                </div>
                <div style={{ fontFamily: FB, fontSize: '13px', color: '#6b7280' }}>
                  {card.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderStep2() {
    return (
      <div style={{ textAlign: 'center' }}>
        <Globe size={40} color={T} style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: FH, fontSize: '24px', fontWeight: 800, color: BLK, marginBottom: '8px' }}>
          Connect Your First Website
        </h2>
        <p style={{ fontFamily: FB, fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
          Link your WordPress site to start publishing pages
        </p>
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>WordPress URL</label>
            <input
              type="url"
              placeholder="https://yoursite.com"
              value={wpUrl}
              onChange={e => setWpUrl(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>API Key</label>
            <input
              type="text"
              placeholder="Enter your REST API key"
              value={wpApiKey}
              onChange={e => setWpApiKey(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            onClick={connectWordPress}
            disabled={loading || wpConnected}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: wpConnected ? GRN : R,
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              fontFamily: FH,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Connecting...</> :
             wpConnected ? <><Check size={18} /> Connected!</> :
             'Connect Site'}
          </button>
          {wpError && (
            <p style={{ color: R, fontSize: '13px', fontFamily: FB, marginTop: '12px', textAlign: 'center' }}>
              {wpError}
            </p>
          )}
          {!wpConnected && (
            <button
              onClick={nextStep}
              style={{
                display: 'block',
                margin: '16px auto 0',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '14px',
                fontFamily: FB,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderStep3() {
    return (
      <div style={{ textAlign: 'center' }}>
        <BarChart2 size={40} color={T} style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: FH, fontSize: '24px', fontWeight: 800, color: BLK, marginBottom: '8px' }}>
          Tell Us About Your Business
        </h2>
        <p style={{ fontFamily: FB, fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
          We'll use this to generate your first page
        </p>
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Business Name</label>
            <input
              type="text"
              placeholder="Acme Plumbing"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>What do you do?</label>
            <input
              type="text"
              placeholder="Plumbing, HVAC, Roofing..."
              value={service}
              onChange={e => setService(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} color="#9ca3af" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '40px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>City</label>
              <input
                type="text"
                placeholder="Austin"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>State</label>
              <input
                type="text"
                placeholder="TX"
                value={state}
                onChange={e => setState(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderStep4() {
    return (
      <div style={{ textAlign: 'center' }}>
        <Sparkles size={40} color={T} style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: FH, fontSize: '24px', fontWeight: 800, color: BLK, marginBottom: '8px' }}>
          Generate Your First Page
        </h2>
        <p style={{ fontFamily: FB, fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
          AI will create a geo-targeted SEO page for your business
        </p>
        <div style={{
          maxWidth: '400px',
          margin: '0 auto',
          padding: '20px',
          borderRadius: '14px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          {service && <div style={{ fontFamily: FB, fontSize: '14px', color: BLK, marginBottom: '6px' }}><strong>Service:</strong> {service}</div>}
          {city && state && <div style={{ fontFamily: FB, fontSize: '14px', color: BLK, marginBottom: '6px' }}><strong>Location:</strong> {city}, {state}</div>}
          {businessName && <div style={{ fontFamily: FB, fontSize: '14px', color: BLK }}><strong>Business:</strong> {businessName}</div>}
        </div>
        {!generated ? (
          <>
            <button
              onClick={generatePage}
              disabled={generating}
              style={{
                padding: '14px 40px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: R,
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: FH,
                cursor: generating ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {generating ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  AI is thinking...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate Page
                </>
              )}
            </button>
            {generating && (
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '6px'
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: T,
                      animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`
                    }} />
                  ))}
                </div>
                <style>{`
                  @keyframes pulse {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                  }
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
            <button
              onClick={nextStep}
              style={{
                display: 'block',
                margin: '16px auto 0',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '14px',
                fontFamily: FB,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Skip
            </button>
          </>
        ) : (
          <div style={{
            padding: '20px',
            borderRadius: '14px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <Check size={32} color={GRN} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontFamily: FH, fontSize: '18px', fontWeight: 700, color: GRN, marginBottom: '4px' }}>
              Page generated!
            </div>
            <div style={{ fontFamily: FB, fontSize: '14px', color: '#6b7280' }}>
              {wordCount > 0 ? `${wordCount.toLocaleString()} words of SEO content created` : 'Your page is ready'}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderStep5() {
    return (
      <div style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <style>{confettiKeyframes}</style>
        {confettiColors.map((color, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${6 + Math.random() * 8}px`,
              height: `${6 + Math.random() * 8}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              backgroundColor: color,
              left: `${Math.random() * 100}%`,
              top: '-20px',
              animation: `confetti-fall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
              opacity: 0.8,
              pointerEvents: 'none'
            }}
          />
        ))}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#f0fdf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <Check size={32} color={GRN} />
        </div>
        <h2 style={{ fontFamily: FH, fontSize: '28px', fontWeight: 800, color: BLK, marginBottom: '8px' }}>
          You're All Set!
        </h2>
        <p style={{ fontFamily: FB, fontSize: '15px', color: '#6b7280', marginBottom: '32px' }}>
          Your account is ready. Here's what you can do next:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px', margin: '0 auto 32px' }}>
          {[
            { label: 'Open Page Builder', icon: <Sparkles size={18} />, path: '/page-builder', color: T },
            { label: 'Find Leads with Scout', icon: <Target size={18} />, path: '/scout', color: R },
            { label: 'Manage Reviews', icon: <Star size={18} />, path: '/reviews', color: '#f59e0b' }
          ].map((link, i) => (
            <button
              key={i}
              onClick={() => { onClose(); navigate(link.path); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontFamily: FH,
                fontSize: '14px',
                fontWeight: 600,
                color: BLK,
                transition: 'all 0.2s',
                width: '100%'
              }}
            >
              <span style={{ color: link.color }}>{link.icon}</span>
              {link.label}
              <ChevronRight size={16} color="#9ca3af" style={{ marginLeft: 'auto' }} />
            </button>
          ))}
        </div>
        <button
          onClick={completeOnboarding}
          style={{
            padding: '14px 48px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: R,
            color: '#fff',
            fontSize: '16px',
            fontWeight: 700,
            fontFamily: FH,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  const steps = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: GRY,
        borderRadius: '20px',
        padding: '40px 36px 32px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        margin: '16px'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#9ca3af',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        {/* Progress bar */}
        {renderProgressBar()}

        {/* Step content */}
        {steps[step - 1]()}

        {/* Navigation buttons */}
        {step < 5 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={prevStep}
              disabled={step === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                color: step === 1 ? '#d1d5db' : BLK,
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: FH,
                cursor: step === 1 ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <span style={{ fontFamily: FB, fontSize: '13px', color: '#9ca3af' }}>
              Step {step} of 5
            </span>
            <button
              onClick={nextStep}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: R,
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: FH,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {step === 1 ? 'Get Started' : 'Next'}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
