"use client"
import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Loader2, Copy, Check, ChevronDown, ChevronRight, Key, Mail, ExternalLink,
  ArrowUp,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────
const TEAL = '#00C2CB'
const TEAL_DARK = '#0099A8'
const BLK = '#111'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const DEFAULT_AGENCY_EMAIL = 'access@momentamarketing.com'
const DEFAULT_AGENCY_NAME = 'Momenta Marketing'

// ─────────────────────────────────────────────────────────────
// Category definitions — drive the sticky nav + section layout
// ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'google',       emoji: '🔵', label: 'Google' },
  { id: 'social',       emoji: '📱', label: 'Social Media' },
  { id: 'website',      emoji: '🌐', label: 'Website & Hosting' },
  { id: 'advertising',  emoji: '📊', label: 'Advertising' },
  { id: 'email_crm',    emoji: '📧', label: 'Email & CRM' },
  { id: 'ecommerce',    emoji: '🛍️', label: 'E-Commerce' },
  { id: 'other',        emoji: '🔧', label: 'Other Tools' },
]

// ─────────────────────────────────────────────────────────────
// Platform data
//
// Each entry has either:
//   - A full `instructions` string: shown immediately in the expanded card
//   - No `instructions`: the card has a "Get step-by-step instructions" button
//                        that calls /api/access-guide and renders the result
//
// Core common platforms ship with hard-coded instructions. The long
// tail uses the AI lookup button so we don't ship stale step-by-step
// content for every tool in existence.
// ─────────────────────────────────────────────────────────────
const PLATFORMS = [
  // ── GOOGLE ────────────────────────────────────────────
  {
    id: 'google_ads',
    category: 'google',
    label: 'Google Ads',
    emoji: '🔵',
    access_level: 'Admin (via MCC) or Standard',
    summary: 'MCC manager link is preferred — no login sharing needed.',
    instructions: `PREFERRED — Manager link (MCC):
1. Log into ads.google.com
2. Click the Tools icon (🔧) in the top right
3. Under "Setup" click "Access and security"
4. Click the blue "+" button → "Invite user"
5. Enter: access@momentamarketing.com
6. Choose access level: "Admin" (or "Standard" if you prefer)
7. Click "Send invitation"

Alternative — Send us your Customer ID:
1. In Google Ads, your Customer ID is at the top right (format: 123-456-7890)
2. Reply to your onboarding email with that ID
3. We'll send a manager request from our MCC — you'll see it appear under Tools → Access and security → Managers
4. Click "Accept" on the request`,
    notes: 'If you also run a YouTube channel, we need access to that separately.',
  },
  {
    id: 'ga4',
    category: 'google',
    label: 'Google Analytics 4',
    emoji: '📈',
    access_level: 'Editor or Administrator',
    summary: 'Add us at the Property level (not Account level unless needed).',
    instructions: `1. Go to analytics.google.com
2. Click "Admin" (gear icon, bottom left)
3. In the "Property" column, click "Property Access Management"
4. Click the blue "+" button in the top right → "Add users"
5. Email address: access@momentamarketing.com
6. Check "Editor" (or "Administrator" if you want us to manage settings)
7. Uncheck "Notify new users by email" is optional
8. Click "Add"

Bonus: if you have multiple properties, add us to each one you want us to manage.`,
    notes: null,
  },
  {
    id: 'search_console',
    category: 'google',
    label: 'Google Search Console',
    emoji: '🔎',
    access_level: 'Owner (preferred) or Full user',
    summary: 'Essential for SEO work — we need this on day one.',
    instructions: `1. Go to search.google.com/search-console
2. Select your property from the top-left dropdown
3. Click "Settings" (gear icon) in the left sidebar
4. Click "Users and permissions"
5. Click "Add user" (top right)
6. Email: access@momentamarketing.com
7. Permission: "Owner" (preferred) or "Full"
8. Click "Add"`,
    notes: 'Owner permission is preferred so we can verify additional domains if needed.',
  },
  {
    id: 'gtm',
    category: 'google',
    label: 'Google Tag Manager',
    emoji: '🏷️',
    access_level: 'Publish',
    summary: 'Required for installing pixels and conversion tracking.',
    instructions: `1. Go to tagmanager.google.com
2. Select your account/container
3. Click "Admin" tab
4. Under the "Container" column, click "User Management"
5. Click "+" top right → "Add new user"
6. Email: access@momentamarketing.com
7. Container access: check "Publish" (this includes Read, Edit, and Approve)
8. Click "Invitation" to send`,
    notes: null,
  },
  {
    id: 'gbp',
    category: 'google',
    label: 'Google Business Profile',
    emoji: '📍',
    access_level: 'Manager',
    summary: 'Needed for posts, review responses, and photo uploads.',
    instructions: `1. Go to business.google.com (or search "my business" while signed in)
2. Select the business location
3. Click the "Menu" icon (⋮) next to your profile → "Business Profile settings"
4. Click "People and access"
5. Click "Add"
6. Email: access@momentamarketing.com
7. Role: "Manager" (gives us post/edit/respond without ownership transfer)
8. Click "Invite"`,
    notes: 'If you have multiple locations, repeat for each — or give us access to the parent account.',
  },
  {
    id: 'merchant_center',
    category: 'google',
    label: 'Google Merchant Center',
    emoji: '🛒',
    access_level: 'Admin',
    summary: 'Required for Google Shopping ads.',
  },
  {
    id: 'youtube',
    category: 'google',
    label: 'YouTube Studio',
    emoji: '▶️',
    access_level: 'Editor or Manager',
    summary: 'Needed for channel management and video SEO.',
  },

  // ── SOCIAL MEDIA ──────────────────────────────────────
  {
    id: 'meta_business',
    category: 'social',
    label: 'Meta Business Suite (Facebook + Instagram)',
    emoji: '📘',
    access_level: 'Full control / Partner access',
    summary: 'The cleanest way to give us Facebook AND Instagram in one step.',
    instructions: `PREFERRED — Partner Access:
1. Go to business.facebook.com
2. Click the gear icon (⚙️) → "Business settings"
3. In the left sidebar, click "Partners"
4. Click "Add" → "Give a partner access to your assets"
5. Enter our Business Manager ID: we'll send this to you — reply to your onboarding email
6. Select the assets to share: Facebook Page, Instagram Account, Ad Account, Pixel
7. Check "Full control" for each
8. Click "Save Changes"

Alternative — Add us as a user:
1. In Business Settings → "People" → "Add"
2. Email: access@momentamarketing.com
3. Access level: Full control
4. Assign to the assets (Page, Instagram, Ad Account)
5. Click "Invite"`,
    notes: 'Partner Access is cleaner because it gives us access without needing a personal Facebook login tied to our team.',
  },
  {
    id: 'facebook_page',
    category: 'social',
    label: 'Facebook Page (standalone)',
    emoji: '📘',
    access_level: 'Admin or Editor',
    summary: "Only needed if you don't use Meta Business Suite.",
  },
  {
    id: 'instagram',
    category: 'social',
    label: 'Instagram Business Account',
    emoji: '📸',
    access_level: 'Full access via Meta Business Suite',
    summary: 'Easiest route: link via Meta Business Suite above.',
  },
  {
    id: 'linkedin_page',
    category: 'social',
    label: 'LinkedIn Company Page',
    emoji: '💼',
    access_level: 'Super Admin or Content Admin',
    summary: 'Admin access required for page management.',
    instructions: `1. Go to linkedin.com and navigate to your Company Page
2. Click "Admin tools" (top right, visible only to page admins)
3. Click "Manage admins"
4. Click the "Page admins" tab
5. Click "+ Add admin"
6. Search for: Momenta Marketing (or send us your page URL and we'll send a connection request first)
7. Role: "Super admin" or "Content admin"
8. Click "Save"`,
    notes: 'LinkedIn requires the invited user to be a 1st-degree connection, so we may need to connect first.',
  },
  {
    id: 'tiktok_business',
    category: 'social',
    label: 'TikTok Business Center',
    emoji: '🎵',
    access_level: 'Admin',
    summary: 'Covers both TikTok profile + TikTok Ads Manager.',
  },
  {
    id: 'pinterest',
    category: 'social',
    label: 'Pinterest Business Account',
    emoji: '📌',
    access_level: 'Admin',
  },
  {
    id: 'twitter_x',
    category: 'social',
    label: 'Twitter / X',
    emoji: '🐦',
    access_level: 'Delegate access',
  },

  // ── WEBSITE & HOSTING ──────────────────────────────────
  {
    id: 'wordpress',
    category: 'website',
    label: 'WordPress',
    emoji: '🏠',
    access_level: 'Administrator',
    summary: 'Needed for plugin installs, theme edits, and SEO work.',
    instructions: `1. Log into your WordPress admin (usually at yoursite.com/wp-admin)
2. In the left sidebar, click "Users" → "Add New"
3. Username: momenta-access (or anything unique)
4. Email: access@momentamarketing.com
5. First/Last name: Momenta Team
6. Password: click "Generate password" — you don't need to write it down; we'll reset it
7. UNCHECK "Send User Notification" is optional
8. Role: "Administrator"
9. Click "Add New User"

We'll receive an email with a password reset link and take it from there.`,
    notes: 'If you use WordPress.com (hosted, not self-hosted), the flow is slightly different — let us know and we\'ll send specific steps.',
  },
  {
    id: 'webflow',
    category: 'website',
    label: 'Webflow',
    emoji: '🌊',
    access_level: 'Editor (content) or Designer (design changes)',
    instructions: `1. Log into webflow.com
2. Go to your Workspace dashboard
3. Click "Settings" (top right)
4. Click "Members" in the left sidebar
5. Click "Invite member"
6. Email: access@momentamarketing.com
7. Role: "Designer" if we need to edit design/layout; "Editor" if just content
8. Click "Send invite"`,
    notes: 'Webflow charges per seat — check your plan before adding users if you\'re on a small plan.',
  },
  {
    id: 'squarespace',
    category: 'website',
    label: 'Squarespace',
    emoji: '⬜',
    access_level: 'Administrator or Content Editor',
  },
  {
    id: 'wix',
    category: 'website',
    label: 'Wix',
    emoji: '🔶',
    access_level: 'Admin or Content Manager',
    summary: 'Wix uses "Roles & Permissions" — we need at least Admin for SEO changes.',
  },
  {
    id: 'shopify',
    category: 'website',
    label: 'Shopify',
    emoji: '🛍️',
    access_level: 'Collaborator or Staff (full access)',
    summary: 'Collaborator request is the recommended flow — it does not count against your staff limit.',
    instructions: `PREFERRED — Collaborator access (does not count against staff limit):
1. Reply to your onboarding email and ask for our Collaborator Request Code
2. In your Shopify admin, go to Settings → Users and permissions
3. Click "Manage collaborators"
4. Enter the Collaborator Request Code we sent
5. Accept the request when it arrives

Alternative — Staff account:
1. Settings → Users and permissions
2. Click "Add staff"
3. Email: access@momentamarketing.com
4. Permissions: check "Full access" (or at minimum: Products, Orders, Customers, Analytics, Marketing, Apps)
5. Click "Send invite"`,
    notes: null,
  },
  {
    id: 'godaddy',
    category: 'website',
    label: 'GoDaddy (domain / hosting)',
    emoji: '🦖',
    access_level: 'Products, Domains, Billing (as needed)',
    summary: 'Use "Delegate Access" — never share login credentials.',
  },
  {
    id: 'cloudflare',
    category: 'website',
    label: 'Cloudflare',
    emoji: '☁️',
    access_level: 'Administrator',
  },

  // ── ADVERTISING ───────────────────────────────────────
  {
    id: 'meta_ads',
    category: 'advertising',
    label: 'Meta Ads Manager',
    emoji: '📘',
    access_level: 'Full control',
    summary: 'Easiest via Meta Business Suite Partner Access (see Social Media above).',
  },
  {
    id: 'microsoft_ads',
    category: 'advertising',
    label: 'Microsoft / Bing Ads',
    emoji: '🟦',
    access_level: 'Super Admin',
  },
  {
    id: 'linkedin_ads',
    category: 'advertising',
    label: 'LinkedIn Ads (Campaign Manager)',
    emoji: '💼',
    access_level: 'Account Manager',
  },
  {
    id: 'tiktok_ads',
    category: 'advertising',
    label: 'TikTok Ads Manager',
    emoji: '🎵',
    access_level: 'Admin',
  },
  {
    id: 'pinterest_ads',
    category: 'advertising',
    label: 'Pinterest Ads',
    emoji: '📌',
    access_level: 'Admin',
  },

  // ── EMAIL & CRM ───────────────────────────────────────
  {
    id: 'mailchimp',
    category: 'email_crm',
    label: 'Mailchimp',
    emoji: '📮',
    access_level: 'Manager or Admin',
    instructions: `1. Log into mailchimp.com
2. Click the profile icon (bottom left) → "Account & billing"
3. Click "Settings" → "Users"
4. Click "Invite a User" (top right)
5. Email: access@momentamarketing.com
6. User type: "Manager" (can create/send) or "Admin" (full access)
7. Click "Send Invite"`,
    notes: null,
  },
  {
    id: 'klaviyo',
    category: 'email_crm',
    label: 'Klaviyo',
    emoji: '💙',
    access_level: 'Admin or Manager',
    instructions: `1. Log into klaviyo.com
2. Click account name (top right) → "Users"
3. Click "Add New User"
4. Email: access@momentamarketing.com
5. Role: "Manager" (preferred) or "Admin"
6. Click "Add User"

The user receives an email to set their password.`,
    notes: null,
  },
  {
    id: 'hubspot',
    category: 'email_crm',
    label: 'HubSpot',
    emoji: '🟠',
    access_level: 'Super Admin or Custom',
    instructions: `1. Log into HubSpot
2. Click the Settings icon (⚙️) in the top navigation
3. In the left sidebar, click "Users & Teams"
4. Click "Create user" (top right)
5. Email: access@momentamarketing.com
6. Click "Next" and select permissions:
   — For full access: "Super Admin"
   — For limited: grant Marketing Hub + CMS + Reports permissions at minimum
7. Click "Send invite"`,
    notes: 'Super Admin is cleanest; Custom roles can get tricky with HubSpot\'s granular permissions.',
  },
  {
    id: 'salesforce',
    category: 'email_crm',
    label: 'Salesforce',
    emoji: '☁️',
    access_level: 'Standard User or System Admin',
  },
  {
    id: 'ghl',
    category: 'email_crm',
    label: 'GoHighLevel',
    emoji: '🎯',
    access_level: 'Admin',
  },
  {
    id: 'constant_contact',
    category: 'email_crm',
    label: 'Constant Contact',
    emoji: '✉️',
    access_level: 'Account Manager',
  },
  {
    id: 'activecampaign',
    category: 'email_crm',
    label: 'ActiveCampaign',
    emoji: '🟦',
    access_level: 'Admin',
  },

  // ── E-COMMERCE ────────────────────────────────────────
  {
    id: 'woocommerce',
    category: 'ecommerce',
    label: 'WooCommerce (WordPress)',
    emoji: '🛒',
    access_level: 'WordPress Administrator',
    summary: 'Granted via WordPress admin — see WordPress card above.',
  },
  {
    id: 'bigcommerce',
    category: 'ecommerce',
    label: 'BigCommerce',
    emoji: '🛒',
    access_level: 'Administrator',
  },
  {
    id: 'amazon_seller',
    category: 'ecommerce',
    label: 'Amazon Seller Central',
    emoji: '📦',
    access_level: 'User Permissions (Advertising + Reports)',
  },
  {
    id: 'etsy',
    category: 'ecommerce',
    label: 'Etsy Shop Manager',
    emoji: '🧵',
    access_level: 'Shop owner delegate',
  },
  {
    id: 'stripe',
    category: 'ecommerce',
    label: 'Stripe Dashboard',
    emoji: '💳',
    access_level: 'Developer or Analyst',
  },

  // ── OTHER ─────────────────────────────────────────────
  {
    id: 'yelp',
    category: 'other',
    label: 'Yelp for Business',
    emoji: '🍽️',
    access_level: 'Account Manager',
  },
  {
    id: 'angi',
    category: 'other',
    label: 'Angi / HomeAdvisor',
    emoji: '🏠',
    access_level: 'Pro Center Admin',
  },
  {
    id: 'houzz',
    category: 'other',
    label: 'Houzz Pro',
    emoji: '🏡',
    access_level: 'Team Member',
  },
  {
    id: 'thumbtack',
    category: 'other',
    label: 'Thumbtack',
    emoji: '📌',
    access_level: 'Pro Account access',
  },
  {
    id: 'callrail',
    category: 'other',
    label: 'CallRail',
    emoji: '📞',
    access_level: 'Manager',
  },
  {
    id: 'podium',
    category: 'other',
    label: 'Podium',
    emoji: '💬',
    access_level: 'Team Member',
  },
  {
    id: 'yext',
    category: 'other',
    label: 'Yext',
    emoji: '📋',
    access_level: 'Admin',
  },
]

// ─────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────
const ACCESS_FAQS = [
  {
    q: "Why do you need admin access? Can't you do it with less?",
    a: "We request admin or manager-level access because most marketing tasks — installing pixels, managing ads, posting content, updating listings — require elevated permissions. Viewer-only access means we can see data but can't actually do the work. We never abuse this access and you can revoke it at any time.",
  },
  {
    q: 'Is it safe to add your email to my accounts?',
    a: 'Yes. We use access@momentamarketing.com as our team access email. You can verify this is legitimate by checking with your account manager. You can revoke our access at any time by removing us from the user list — no need to change passwords or any other credentials.',
  },
  {
    q: "What if I don't have admin access to my own accounts?",
    a: "This is more common than you think. If someone else set up your accounts (a previous employee, web developer, or agency), you may need to contact them or reach out to the platform's support team to regain ownership. Let your account manager know and we can often help troubleshoot this.",
  },
  {
    q: 'Do I need to do all of this before our kickoff call?',
    a: "No — we recommend completing access setup before the kickoff call so we can hit the ground running, but it's not required. We'll walk through any outstanding items together. The most important ones to complete first are Google Ads, GA4, and your website/hosting.",
  },
  {
    q: "I use a platform that's not on this list. What do I do?",
    a: "Use the AI assistant at the top of this page — type in the platform name and it will find the right instructions. If the AI doesn't know, email us at access@momentamarketing.com and we'll figure it out together.",
  },
  {
    q: 'What if I already gave a previous agency access?',
    a: 'Please remove their access before or immediately after adding ours. Having multiple agency users can cause confusion and sometimes conflicts. In most platforms you can see the full list of users and remove anyone who should no longer have access.',
  },
  {
    q: 'My Google account shows a warning when I try to add you. Is that normal?',
    a: 'Yes, Google sometimes shows a warning when adding a new user, especially for billing-related permissions. This is normal and safe to proceed through. If you see a specific error message, take a screenshot and send it to us.',
  },
  {
    q: "I set up everything but you're saying you don't have access. What happened?",
    a: "A few common reasons: (1) The invitation may not have been accepted yet — check if there's a pending invitation. (2) You may have added a different email — make sure it's access@momentamarketing.com exactly. (3) The access level may not be sufficient — make sure it's Admin or Manager, not Viewer. Reply to your setup email and we'll sort it out quickly.",
  },
  {
    q: 'Can I grant access to just some platforms and not others?',
    a: "Absolutely. Grant access only to the platforms that are part of your project scope. If you're not sure what's included, check your proposal or ask your account manager.",
  },
  {
    q: 'What happens to our access when we stop working together?',
    a: "When the engagement ends, you remove our access from each platform — it's as simple as deleting a user. We'll remind you to do this as part of our offboarding process. We do not retain any access after the engagement ends.",
  },
]

// ─────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────
export default function AccessGuidePage() {
  const [searchParams] = useSearchParams()
  const agencyEmail = searchParams.get('agency_email') || DEFAULT_AGENCY_EMAIL
  const agencyName = searchParams.get('agency_name') || DEFAULT_AGENCY_NAME

  // AI assistant state
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // Platform cards
  const [expanded, setExpanded] = useState({})
  const [lookups, setLookups] = useState({})    // platform id → { loading, result }
  const [copiedId, setCopiedId] = useState(null)

  // FAQ accordion
  const [faqOpen, setFaqOpen] = useState({})

  // Back-to-top button
  const [showBackToTop, setShowBackToTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const platformsByCategory = useMemo(() => {
    const groups = {}
    for (const cat of CATEGORIES) groups[cat.id] = []
    for (const p of PLATFORMS) {
      if (groups[p.category]) groups[p.category].push(p)
    }
    return groups
  }, [])

  async function handleAIQuery() {
    const q = aiQuery.trim()
    if (!q || aiLoading) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/access-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_instructions',
          query: q,
          agency_email: agencyEmail,
          agency_name: agencyName,
        }),
      })
      const data = await res.json()
      setAiResult(data)
    } catch {
      setAiResult({
        platform: 'Unknown',
        instructions: `Something went wrong. Please email ${agencyEmail} directly and we'll help you.`,
        invite_email: agencyEmail,
      })
    }
    setAiLoading(false)
  }

  async function handleLookupPlatform(platform) {
    setLookups((prev) => ({ ...prev, [platform.id]: { loading: true } }))
    try {
      const res = await fetch('/api/access-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_instructions',
          query: `I need to grant access to ${platform.label}`,
          agency_email: agencyEmail,
          agency_name: agencyName,
        }),
      })
      const data = await res.json()
      setLookups((prev) => ({ ...prev, [platform.id]: { loading: false, result: data } }))
    } catch {
      setLookups((prev) => ({
        ...prev,
        [platform.id]: {
          loading: false,
          result: {
            platform: platform.label,
            instructions: `Something went wrong. Please email ${agencyEmail} directly.`,
            invite_email: agencyEmail,
          },
        },
      }))
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      toast.success('Copied')
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => toast.error('Copy failed'))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F6', fontFamily: FB, color: BLK }}>
      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, padding: '48px 40px', color: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 12, fontFamily: FH }}>
            {agencyName} · Access Setup Guide
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 12px', fontFamily: FH, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            How to Grant Us Access to Your Platforms
          </h1>
          <p style={{ fontSize: 16, opacity: 0.92, lineHeight: 1.7, maxWidth: 620, margin: 0 }}>
            We never need your passwords. Each platform has a secure way to add team members. Follow the instructions below for the platforms you use — or use our AI assistant if you're not sure which platform you have.
          </p>
          <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <HeroBadge>✓ No passwords required</HeroBadge>
            <HeroBadge>✓ Revocable at any time</HeroBadge>
            <HeroBadge>📧 {agencyEmail}</HeroBadge>
          </div>
        </div>
      </div>

      {/* ── AI ASSISTANT ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 40px 0' }}>
        <div style={{
          background: `linear-gradient(135deg, #f0fffe, #e6fcfd)`,
          border: `2px solid ${TEAL}50`, borderRadius: 16,
          padding: '24px 28px', marginBottom: 40,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 6, fontFamily: FH }}>
            🤖 Not sure how to do this? Ask our AI assistant
          </div>
          <div style={{ fontSize: 14, color: MUTED, marginBottom: 16 }}>
            Tell us what platform or tool you're using and we'll find the exact steps for you.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAIQuery()}
              placeholder='e.g. "I use Wix for my website" or "I advertise on Pinterest"'
              style={{
                flex: '1 1 240px', padding: '12px 16px', borderRadius: 10,
                border: `1.5px solid ${TEAL}50`, fontSize: 14, outline: 'none',
                fontFamily: FB,
              }}
            />
            <button
              onClick={handleAIQuery}
              disabled={aiLoading || !aiQuery.trim()}
              style={{
                padding: '12px 24px', background: TEAL, color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: aiLoading || !aiQuery.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', fontFamily: FH,
                opacity: aiLoading || !aiQuery.trim() ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {aiLoading ? <Loader2 size={14} className="spin" /> : null}
              {aiLoading ? 'Finding steps…' : 'Get Instructions →'}
            </button>
          </div>

          {aiResult && (
            <div style={{
              marginTop: 20, background: '#fff', borderRadius: 12,
              padding: '20px 24px', border: `1px solid ${BORDER}`,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 800, color: TEAL, textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: 12, fontFamily: FH,
              }}>
                Here's how to grant access for {aiResult.platform}
                {aiResult.access_level && (
                  <span style={{ color: MUTED, marginLeft: 8, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                    · {aiResult.access_level}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, color: BLK, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: FB }}>
                {aiResult.instructions}
              </div>
              {aiResult.invite_email && (
                <div style={{
                  marginTop: 16, padding: '10px 14px', background: '#f0fffe',
                  borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center',
                  gap: 10, flexWrap: 'wrap',
                }}>
                  <Mail size={14} color={TEAL} />
                  Invite this email: <strong style={{ color: TEAL }}>{aiResult.invite_email}</strong>
                  <button
                    onClick={() => copyToClipboard(aiResult.invite_email, 'ai_email')}
                    style={{
                      marginLeft: 'auto', padding: '4px 10px', borderRadius: 6,
                      border: `1px solid ${TEAL}`, background: 'transparent',
                      color: TEAL, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {copiedId === 'ai_email' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
              )}
              {aiResult.notes && (
                <div style={{ marginTop: 12, fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
                  Note: {aiResult.notes}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => copyToClipboard(aiResult.instructions, 'ai_instructions')}
                  style={{
                    padding: '8px 16px', background: 'transparent', color: MUTED,
                    border: `1px solid ${BORDER}`, borderRadius: 8,
                    fontSize: 13, cursor: 'pointer', display: 'inline-flex',
                    alignItems: 'center', gap: 6, fontFamily: FH, fontWeight: 600,
                  }}
                >
                  <Copy size={13} />
                  {copiedId === 'ai_instructions' ? 'Copied!' : 'Copy instructions'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STICKY CATEGORY NAV ── */}
      <div style={{
        position: 'sticky', top: 0, background: '#fff',
        borderBottom: `1px solid ${BORDER}`, zIndex: 10,
        padding: '12px 40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: '#f3f4f6', color: '#374151',
                textDecoration: 'none', fontFamily: FH,
                whiteSpace: 'nowrap',
              }}
            >
              {cat.emoji} {cat.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── PLATFORM SECTIONS ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 40px 40px' }}>
        {CATEGORIES.map((cat) => {
          const platforms = platformsByCategory[cat.id] || []
          if (platforms.length === 0) return null
          return (
            <div key={cat.id} id={cat.id} style={{ marginBottom: 48, scrollMarginTop: 80 }}>
              <div style={{
                fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 6, fontFamily: FH,
              }}>
                {cat.emoji} {cat.label}
              </div>
              <h2 style={{
                fontSize: 26, fontWeight: 900, margin: '0 0 20px',
                fontFamily: FH, letterSpacing: '-0.02em',
              }}>
                {cat.label}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {platforms.map((p) => (
                  <PlatformCard
                    key={p.id}
                    platform={p}
                    expanded={!!expanded[p.id]}
                    onToggle={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    lookup={lookups[p.id]}
                    onLookup={() => handleLookupPlatform(p)}
                    onCopy={(text) => copyToClipboard(text, p.id)}
                    copied={copiedId === p.id}
                    agencyEmail={agencyEmail}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* ── FAQ ── */}
        <div style={{ marginTop: 60 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase',
            letterSpacing: '.08em', marginBottom: 6, fontFamily: FH,
          }}>
            ❓ Frequently Asked Questions
          </div>
          <h2 style={{
            fontSize: 26, fontWeight: 900, margin: '0 0 20px',
            fontFamily: FH, letterSpacing: '-0.02em',
          }}>
            Common questions about access
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACCESS_FAQS.map((item, i) => {
              const open = !!faqOpen[i]
              return (
                <div
                  key={i}
                  style={{
                    background: '#fff', border: `1px solid ${BORDER}`,
                    borderRadius: 10, overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFaqOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: 10, padding: '16px 20px', background: 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK,
                    }}
                  >
                    {open ? <ChevronDown size={16} color={TEAL} /> : <ChevronRight size={16} color={MUTED} />}
                    <span style={{ flex: 1 }}>{item.q}</span>
                  </button>
                  {open && (
                    <div style={{
                      padding: '4px 20px 18px 46px', fontSize: 14,
                      color: '#374151', lineHeight: 1.7, fontFamily: FB,
                    }}>
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── STILL STUCK FOOTER ── */}
        <div style={{
          marginTop: 48, padding: '28px 32px', borderRadius: 14,
          background: `linear-gradient(135deg, #f0fffe, #fff)`,
          border: `1px solid ${TEAL}30`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 6, fontFamily: FH }}>
            Still stuck on something?
          </div>
          <div style={{ fontSize: 14, color: MUTED, marginBottom: 14, lineHeight: 1.6 }}>
            Reply to your setup email or send us a note at <strong style={{ color: TEAL }}>{agencyEmail}</strong>. We've walked hundreds of clients through this — every platform is solvable.
          </div>
          <a
            href={`mailto:${agencyEmail}?subject=Access%20setup%20help`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 10, background: TEAL, color: '#fff',
              textDecoration: 'none', fontFamily: FH, fontWeight: 700, fontSize: 14,
            }}
          >
            <Mail size={14} /> Email {agencyEmail}
          </a>
        </div>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 50,
            width: 44, height: 44, borderRadius: '50%',
            background: TEAL, color: '#fff', border: 'none',
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,194,203,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Back to top"
        >
          <ArrowUp size={18} />
        </button>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Platform card
// ─────────────────────────────────────────────────────────────
function PlatformCard({ platform, expanded, onToggle, lookup, onLookup, onCopy, copied, agencyEmail }) {
  const hasHardcoded = !!platform.instructions
  const lookupResult = lookup?.result
  const lookupLoading = !!lookup?.loading

  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 12, padding: '16px 20px', background: 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={16} color={TEAL} /> : <ChevronRight size={16} color={MUTED} />}
        <span style={{ fontSize: 20 }}>{platform.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
            {platform.label}
          </div>
          {platform.summary && !expanded && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{platform.summary}</div>
          )}
        </div>
        {platform.access_level && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: '#f0fffe', color: TEAL, border: `1px solid ${TEAL}30`,
            whiteSpace: 'nowrap', fontFamily: FH, textTransform: 'uppercase',
            letterSpacing: '.04em',
          }}>
            {platform.access_level}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{
          padding: '4px 20px 20px 46px', borderTop: `1px solid #f3f4f6`,
        }}>
          {hasHardcoded ? (
            <>
              <div style={{ fontSize: 14, color: BLK, lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: FB, marginTop: 12 }}>
                {platform.instructions}
              </div>
              {platform.notes && (
                <div style={{ marginTop: 10, fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
                  Note: {platform.notes}
                </div>
              )}
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => onCopy(platform.instructions)}
                  style={{
                    padding: '8px 14px', background: 'transparent', color: MUTED,
                    border: `1px solid ${BORDER}`, borderRadius: 8,
                    fontSize: 12, cursor: 'pointer', display: 'inline-flex',
                    alignItems: 'center', gap: 6, fontFamily: FH, fontWeight: 600,
                  }}
                >
                  <Copy size={12} />
                  {copied ? 'Copied!' : 'Copy instructions'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 12 }}>
              {!lookupResult && !lookupLoading && (
                <div>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 1.6 }}>
                    Click below and our AI will fetch the exact step-by-step instructions for granting access to {platform.label}.
                  </div>
                  <button
                    onClick={onLookup}
                    style={{
                      padding: '10px 18px', background: TEAL, color: '#fff',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', fontFamily: FH, display: 'inline-flex',
                      alignItems: 'center', gap: 6,
                    }}
                  >
                    Get step-by-step instructions →
                  </button>
                </div>
              )}

              {lookupLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
                  <Loader2 size={14} className="spin" /> Looking up exact steps…
                </div>
              )}

              {lookupResult && (
                <div>
                  <div style={{ fontSize: 14, color: BLK, lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: FB }}>
                    {lookupResult.instructions}
                  </div>
                  {lookupResult.invite_email && (
                    <div style={{
                      marginTop: 12, padding: '8px 12px', background: '#f0fffe',
                      borderRadius: 8, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}>
                      <Mail size={12} color={TEAL} /> Invite: <strong style={{ color: TEAL }}>{lookupResult.invite_email}</strong>
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => onCopy(lookupResult.instructions)}
                      style={{
                        padding: '8px 14px', background: 'transparent', color: MUTED,
                        border: `1px solid ${BORDER}`, borderRadius: 8,
                        fontSize: 12, cursor: 'pointer', display: 'inline-flex',
                        alignItems: 'center', gap: 6, fontFamily: FH, fontWeight: 600,
                      }}
                    >
                      <Copy size={12} />
                      {copied ? 'Copied!' : 'Copy instructions'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HeroBadge({ children }) {
  return (
    <span style={{
      background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)',
      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
      color: '#fff',
    }}>
      {children}
    </span>
  )
}
