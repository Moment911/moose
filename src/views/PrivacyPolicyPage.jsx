"use client";
export default function PrivacyPolicyPage() {
  const lastUpdated = 'April 2, 2026'
  const companyName = 'Moose AI LLC'
  const appName = 'Moose AI'
  const email = 'privacy@moose.ai'
  const website = 'moose.ai'
  const address = 'Boca Raton, Florida, United States'

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width={32} height={32} viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#ea2729"/><path d="M12 10L12 30L28 30L28 26L16 26L16 10Z" fill="white"/><circle cx="28" cy="14" r="4" fill="white" opacity="0.6"/></svg>
          <div><p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>Moose AI</p><p style={{ margin: 0, fontSize: 13, color: '#374151' }}>by Moose</p></div>
        </div>
        <a href="/" style={{ fontSize: 15, color: '#ea2729', fontWeight: 700, textDecoration: 'none' }}>← Back to App</a>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#111827', margin: '0 0 12px' }}>Privacy Policy</h1>
          <p style={{ fontSize: 15, color: '#374151', margin: 0 }}>Last updated: {lastUpdated}</p>
          <div style={{ marginTop: 16, padding: '14px 18px', background: '#FFF7ED', borderRadius: 10, border: '1px solid #FED7AA' }}>
            <p style={{ margin: 0, fontSize: 15, color: '#92400E', lineHeight: 1.6 }}>This Privacy Policy describes how {companyName} ("we," "us," or "our") collects, uses, and shares information about you when you use {appName} and our related services.</p>
          </div>
        </div>

        <Section id="s1" title="1. Who We Are">
          <P>{companyName} operates {appName}, a marketing intelligence and agency management platform. Our registered business address is {address}. Contact us at {email} for privacy questions.</P>
          <P>Moose AI is a SaaS platform for marketing agencies providing project management, design review, email marketing, sales intelligence, and SEO/PPC analysis.</P>
        </Section>

        <Section id="s2" title="2. Information We Collect">
          <H4>2.1 Information You Provide</H4>
          <UL items={['Account information (name, email, password)', 'Business information (company name, website, industry)', 'Client and project data you upload or create', 'Communications you send us', 'Content you create (designs, campaigns, tasks, messages)']} />
          <H4>2.2 Information From Google Services (When Connected)</H4>
          <P>With your explicit permission, we access:</P>
          <UL items={['Google Search Console: Search queries, rankings, impressions, clicks for your websites', 'Google Analytics 4: Traffic data, sessions, user behavior, conversions', 'Google Ads: Campaign performance, keyword data, spend, conversions', 'Google Business Profile: Business info, reviews, insights, local search data', 'Google Account Profile: Your name and email to identify your account']} />
          <P>We only access Google data you explicitly authorize. You can revoke access at any time.</P>
          <H4>2.3 Automatically Collected Information</H4>
          <UL items={['Log data (IP address, browser type, pages visited)', 'Device information (device type, operating system)', 'Usage data (features used, actions taken)', 'Cookies and similar technologies (see Section 9)']} />
        </Section>

        <Section id="s3" title="3. How We Use Google User Data">
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#065F46' }}>Our commitment regarding Google data:</p>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: '#047857', lineHeight: 1.6 }}>Moose AI's use and transfer of information received from Google APIs adheres to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements. We do not sell Google user data. We do not use Google data for advertising. We only use Google data to provide and improve our services to you.</p>
          </div>
          <P>We use Google user data solely for:</P>
          <UL items={['SEO Analysis: Analyzing Search Console data to identify keyword opportunities and content gaps', 'Traffic Insights: Using GA4 data to understand website traffic and conversion performance', 'PPC Optimization: Analyzing Google Ads data to find wasted spend and optimization opportunities', 'GMB Management: Reading Google Business Profile data to assess review performance and local SEO', 'Report Generation: Compiling your Google data into readable reports and dashboards', 'AI Analysis: Passing data to AI models (Anthropic Claude, OpenAI GPT-4) for strategic recommendations — processed in real-time, not used to train models']} />
          <P><strong>We do NOT use your Google data to:</strong></P>
          <UL items={['Serve advertisements to you or third parties', 'Sell or transfer to third parties for their independent use', 'Determine creditworthiness or for lending purposes', 'Train machine learning or AI models', 'Any purpose not directly related to providing our services']} />
        </Section>

        <Section id="s4" title="4. How We Share Your Information">
          <P>We do not sell your personal information. We share information only in these limited circumstances:</P>
          <UL items={['Service Providers: Supabase (database/auth), Vercel (hosting), Anthropic (AI), OpenAI (AI), Resend (email)', 'Your Team: Information is visible to authorized workspace members', 'Your Clients: Shared project reviews or reports are accessible to those clients', 'Legal Requirements: If required by law, court order, or governmental authority', 'Business Transfers: In the event of merger/acquisition, with advance notice', 'With Your Consent: For any other purpose with your explicit consent']} />
        </Section>

        <Section id="s5" title="5. Data Retention">
          <UL items={['Account data: Retained until you delete your account plus 30 days', 'Google API data: Cached up to 24 hours, then refreshed', 'Project and client data: Retained until you delete it or close your account', 'Log data: Retained for 90 days', 'Backup data: May persist up to 30 days after deletion']} />
          <P>When you delete your account, we delete or anonymize your personal information within 30 days. Request deletion at {email}.</P>
        </Section>

        <Section id="s6" title="6. Data Security">
          <UL items={['All data encrypted in transit using TLS 1.2+', 'Data at rest encrypted using AES-256', 'Google OAuth tokens stored encrypted', 'Row-level security policies ensure data isolation', 'Access to production restricted to authorized personnel', 'Regular security reviews conducted', 'OAuth tokens can be revoked from Google Account settings at any time']} />
          <P>In the event of a data breach affecting your information, we will notify you within 72 hours as required by applicable law.</P>
        </Section>

        <Section id="s7" title="7. Your Rights and Choices">
          <UL items={['Access: Request a copy of your personal information', 'Correction: Request correction of inaccurate information', 'Deletion: Request deletion (right to be forgotten)', 'Portability: Request data in machine-readable format', 'Restriction: Request restriction of processing', 'Objection: Object to processing for certain purposes', 'Withdraw Consent: Withdraw consent at any time']} />
          <H4>Revoking Google Access</H4>
          <UL items={['Go to Google Account → Security → Third-party apps → Remove Moose AI', 'Disconnect from within Moose AI\'s SEO Hub settings', 'Contact ' + email + ' for immediate revocation']} />
          <H4>California Privacy Rights (CCPA)</H4>
          <P>California residents have additional rights under CCPA including the right to know, delete, and opt-out of sale (we do not sell personal information). Contact {email}.</P>
          <H4>GDPR Rights (EU/UK Users)</H4>
          <P>EU/UK users have rights under GDPR including access, rectification, erasure, restriction, and portability. Our legal basis is legitimate interests and contract performance. Contact {email}.</P>
        </Section>

        <Section id="s8" title="8. Google API Services">
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E40AF' }}>Google API Services User Data Policy Compliance</p>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: '#1D4ED8', lineHeight: 1.6 }}>Moose AI's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontWeight: 700 }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
          </div>
          <UL items={['Limited Use: Only use Google data to provide features you requested', 'No Data Selling: Never sell Google user data', 'No Advertising: Do not use Google data for ads', 'No Unauthorized Transfers: No transfers except to provide services', 'Minimum Necessary: Request only minimum permissions needed', 'Transparency: Clearly disclose what data we access and why', 'User Control: Revoke access at any time', 'Secure Storage: OAuth tokens stored with encryption']} />
        </Section>

        <Section id="s9" title="9. Cookies and Tracking">
          <P>Essential Cookies (required): Authentication, session, and security cookies.</P>
          <P>We do NOT use: Third-party advertising cookies, cross-site tracking, or fingerprinting.</P>
          <P>Control cookies through your browser settings. Disabling essential cookies may prevent the service from functioning.</P>
        </Section>

        <Section id="s10" title="10. Children's Privacy">
          <P>Moose AI is not directed at children under 13 (or 16 in the EU). We do not knowingly collect information from children. Contact {email} if you believe we have.</P>
        </Section>

        <Section id="s11" title="11. Changes to This Policy">
          <P>We may update this policy periodically. For material changes we will: update the date, send email notification, display notice in-app, and for Google data changes, request consent again.</P>
        </Section>

        <Section id="s12" title="12. Contact Us">
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[{ l: 'Company', v: companyName }, { l: 'App', v: appName + ' Platform' }, { l: 'Email', v: email, href: 'mailto:' + email }, { l: 'Website', v: website, href: 'https://' + website }, { l: 'Address', v: address }, { l: 'Response Time', v: 'Within 30 days' }].map(i => (
              <div key={i.l}><p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>{i.l}</p>{i.href ? <a href={i.href} style={{ fontSize: 15, color: '#ea2729', fontWeight: 600 }}>{i.v}</a> : <p style={{ margin: 0, fontSize: 15, color: '#111827', fontWeight: 600 }}>{i.v}</p>}</div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: '16px 20px', background: '#FFF7ED', borderRadius: 10, border: '1px solid #FED7AA' }}>
            <p style={{ margin: 0, fontSize: 15, color: '#92400E', lineHeight: 1.6 }}><strong>For Google data access issues:</strong> Revoke Moose AI's access directly through your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: '#B45309', fontWeight: 700 }}>Google Account permissions page</a>.</p>
          </div>
        </Section>

        <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
          <p style={{ fontSize: 15, color: '#4b5563' }}>© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '28px 32px', marginBottom: 20, scrollMarginTop: 80 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: '#111827', paddingBottom: 12, borderBottom: '2px solid #FFF7ED' }}>{title}</h2>
      {children}
    </section>
  )
}

function P({ children }) { return <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, margin: '0 0 14px' }}>{children}</p> }
function H4({ children }) { return <h4 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '20px 0 8px' }}>{children}</h4> }
function UL({ items }) { return <ul style={{ fontSize: 15, color: '#374151', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 14px' }}>{items.map((i, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: i }} />)}</ul> }
