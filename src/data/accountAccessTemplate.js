export const ACCESS_SECTIONS = [
  {
    id: 'brand_assets', label: 'Brand & Assets', icon: '🎨', color: '#8b5cf6',
    items: [
      { id: 'image_library',    label: 'Image Asset Library',       type: 'file_link',   access_level: 'N/A',            instructions: 'Share link to image library (Google Drive, Dropbox, etc.)', priority: 'high' },
      { id: 'brand_guidelines', label: 'Branding Guidelines',       type: 'file_link',   access_level: 'N/A',            instructions: 'Share brand guidelines document link', priority: 'high' },
    ]
  },
  {
    id: 'website', label: 'Website', icon: '🌐', color: '#3b82f6',
    items: [
      { id: 'wordpress_admin',  label: 'WordPress / Website Admin', type: 'credentials', access_level: 'Administrator',  instructions: 'Invite agency email as Administrator (or Editor if Admin not possible)', priority: 'high' },
      { id: 'hosting',          label: 'Hosting Environment',       type: 'credentials', access_level: 'Admin',          instructions: 'Provide hosting panel login (cPanel, WP Engine, etc.)', priority: 'high' },
      { id: 'dns_domain',       label: 'DNS / Domain Registrar',    type: 'credentials', access_level: 'Admin/IT',       instructions: 'Provide domain registrar login or add DNS records as instructed', priority: 'high' },
      { id: 'form_routing',     label: 'Web Form Routing Doc',      type: 'file_link',   access_level: 'N/A',            instructions: 'Share document of form types and email routing', priority: 'high' },
      { id: 'youtube',          label: 'YouTube Channel',           type: 'invite',      access_level: 'Manager',        instructions: 'Invite agency email as Manager (or Owner if linking to Google Ads)', priority: 'high', link: 'https://support.google.com/youtube/answer/9481328' },
      { id: 'vimeo',            label: 'Vimeo Account',             type: 'credentials', access_level: 'Standard User',  instructions: 'Provide login credentials or invite agency email', priority: 'mid' },
    ]
  },
  {
    id: 'analytics', label: 'Reporting & Analytics', icon: '📊', color: '#f59e0b',
    items: [
      { id: 'ga4',              label: 'Google Analytics 4 (GA4)',  type: 'invite',      access_level: 'Admin / Editor', instructions: 'Admin > Account Access Management > Add agency email as Admin. If not possible: Editor access.', priority: 'high', link: 'https://support.google.com/analytics/answer/9305587' },
      { id: 'search_console',   label: 'Google Search Console',     type: 'invite',      access_level: 'Owner',          instructions: 'Settings > Users and Permissions > Add User > Add agency email as Owner', priority: 'high' },
      { id: 'gtm',              label: 'Google Tag Manager',        type: 'invite',      access_level: 'Admin / Publish',instructions: 'Admin > User Management > Add agency email as Admin to all containers', priority: 'high', link: 'https://support.google.com/tagmanager/answer/6107011' },
      { id: 'call_tracking',    label: 'Call Tracking Provider',    type: 'setup',       access_level: 'Admin',          instructions: 'Agency will set up CallRail. Provide source-of-truth phone numbers for all locations.', priority: 'high' },
      { id: 'call_numbers',     label: 'Call Tracking Source of Truth', type: 'file_link', access_level: 'N/A',          instructions: 'Provide list of direct phone numbers for all locations', priority: 'high' },
    ]
  },
  {
    id: 'seo', label: 'SEO & Local Listings', icon: '📍', color: '#10b981',
    items: [
      { id: 'gbp',              label: 'Google Business Profile',   type: 'invite',      access_level: 'Owner/Manager',  instructions: 'Add agency email as Owner. Add specialist email as Manager.', priority: 'high' },
      { id: 'bing_places',      label: 'Microsoft Bing Places',     type: 'credentials', access_level: 'Admin',          instructions: 'Provide login credentials at bingplaces.com', priority: 'mid' },
      { id: 'local_listings',   label: 'Local Listing Platform (Yext, Moz)', type: 'invite', access_level: 'Admin',      instructions: 'Invite agency email as Admin to existing listing platform', priority: 'mid' },
      { id: 'rep_management',   label: 'Reputation Management Platform', type: 'invite', access_level: 'Manager',        instructions: 'Invite agency email as Manager/Editor', priority: 'low' },
    ]
  },
  {
    id: 'paid_media', label: 'Paid Media & Advertising', icon: '💰', color: '#ef4444',
    items: [
      { id: 'credit_card',      label: 'Credit Card for Ad Spend',  type: 'call',        access_level: 'N/A',            instructions: 'When ready, call agency to provide credit card number securely over the phone', priority: 'high' },
      { id: 'google_ads',       label: 'Google Ads',                type: 'invite',      access_level: 'Manager',        instructions: 'Share Google Ads Customer ID. Agency will send link request. Approve and assign Manager access.', priority: 'high', link: 'https://support.google.com/google-ads/answer/7459601' },
      { id: 'meta_ads',         label: 'Meta Ads Manager',          type: 'invite',      access_level: 'Admin',          instructions: 'Add agency as Partner. Provide FULL CONTROL to all ad accounts and pages.', priority: 'high', link: 'https://www.facebook.com/business/help/1717412048538897' },
      { id: 'meta_bm',          label: 'Meta Business Manager',     type: 'invite',      access_level: 'Admin',          instructions: 'Add agency as Partner with FULL CONTROL to all ad accounts and pages.', priority: 'high' },
      { id: 'tiktok_ads',       label: 'TikTok Ads Manager',        type: 'invite',      access_level: 'Admin',          instructions: 'Share TikTok Ads account ID and invite agency as Admin', priority: 'mid' },
      { id: 'hootsuite',        label: 'Hootsuite',                 type: 'invite',      access_level: 'Admin',          instructions: 'Invite agency email as Admin', priority: 'low', link: 'https://help.hootsuite.com/hc/en-us/articles/4402753190043' },
    ]
  },
  {
    id: 'crm_automation', label: 'CRM & Marketing Automation', icon: '⚙️', color: '#6b7280',
    items: [
      { id: 'crm_api',          label: 'CRM (API Access)',          type: 'credentials', access_level: 'Full API',       instructions: 'Contact CRM account rep and ask them to grant API access to agency', priority: 'high' },
      { id: 'crm_user',         label: 'CRM (User Access)',         type: 'invite',      access_level: 'Admin',          instructions: 'Invite agency email as Admin user in your CRM', priority: 'high' },
      { id: 'email_platform',   label: 'Email Marketing Platform',  type: 'invite',      access_level: 'Admin',          instructions: 'Invite agency email as Admin (Mailchimp, Klaviyo, Constant Contact, etc.)', priority: 'high' },
    ]
  },
  {
    id: 'social_media', label: 'Social Media Management', icon: '📱', color: '#ec4899',
    items: [
      { id: 'facebook_page',    label: 'Facebook Page',             type: 'invite',      access_level: 'Admin',          instructions: 'Add agency email as Page Admin via Page Settings > Page Roles', priority: 'high' },
      { id: 'instagram',        label: 'Instagram Business Account',type: 'invite',      access_level: 'Admin',          instructions: 'Connect to Facebook Page and grant agency access through Meta Business Suite', priority: 'high' },
      { id: 'linkedin_page',    label: 'LinkedIn Company Page',     type: 'invite',      access_level: 'Super Admin',    instructions: 'Page Admin View > Manage Admins > Add agency email as Super Admin', priority: 'mid' },
      { id: 'twitter_x',        label: 'Twitter / X Account',       type: 'credentials', access_level: 'Admin',          instructions: 'Provide login credentials or add via Twitter Ads account access', priority: 'mid' },
    ]
  },
]

export const PRIORITY_CONFIG = {
  high: { label: 'High',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  mid:  { label: 'Mid',    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  low:  { label: 'Low',    color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
}

export const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#9ca3af', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  complete:    { label: 'Complete',    color: '#16a34a', bg: '#f0fdf4' },
  na:          { label: 'N/A',         color: '#6b7280', bg: '#f3f4f6' },
  blocked:     { label: 'Blocked',     color: '#dc2626', bg: '#fef2f2' },
}

export const TYPE_CONFIG = {
  credentials: { label: 'Login / Password', icon: '🔑' },
  invite:      { label: 'Email Invite',     icon: '📧' },
  file_link:   { label: 'Share Link',       icon: '🔗' },
  setup:       { label: 'Agency Sets Up',   icon: '⚙️' },
  call:        { label: 'Phone Call',       icon: '📞' },
}
