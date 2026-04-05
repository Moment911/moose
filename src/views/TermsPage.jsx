"use client"
import { useState } from 'react'

const CO   = 'Koto LLC'
const APP  = 'Koto'
const URL  = 'hellokoto.com'
const ADDR = 'Boca Raton, Florida, United States'
const EMAIL = 'legal@hellokoto.com'
const DATE = 'April 5, 2026'

const RED  = '#ea2729'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Georgia',serif"

function H1({ children }) {
  return <h1 style={{ fontSize:36, fontWeight:900, color:BLK, margin:'0 0 8px', fontFamily:FH, letterSpacing:'-.03em' }}>{children}</h1>
}
function H2({ id, children }) {
  return <h2 id={id} style={{ fontSize:20, fontWeight:800, color:BLK, margin:'40px 0 12px', fontFamily:FH, paddingTop:8, borderTop:'2px solid #f3f4f6' }}>{children}</h2>
}
function H3({ children }) {
  return <h3 style={{ fontSize:16, fontWeight:700, color:BLK, margin:'20px 0 8px', fontFamily:FH }}>{children}</h3>
}
function P({ children }) {
  return <p style={{ fontSize:15, color:'#374151', lineHeight:1.8, margin:'0 0 14px', fontFamily:FB }}>{children}</p>
}
function Li({ children }) {
  return <li style={{ fontSize:15, color:'#374151', lineHeight:1.8, margin:'0 0 6px', fontFamily:FB }}>{children}</li>
}
function Box({ color='#fef2f2', border='#fecaca', children }) {
  return <div style={{ padding:'16px 20px', background:color, borderRadius:12, border:`1px solid ${border}`, margin:'16px 0' }}>{children}</div>
}

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('')

  const sections = [
    { id:'acceptance',     label:'1. Acceptance of Terms' },
    { id:'services',       label:'2. Description of Services' },
    { id:'accounts',       label:'3. Accounts & Registration' },
    { id:'subscription',   label:'4. Subscription, Billing & Payments' },
    { id:'trial',          label:'5. Free Trial' },
    { id:'refunds',        label:'6. Refund Policy' },
    { id:'communications', label:'7. Communications & Marketing Consent' },
    { id:'conduct',        label:'8. Acceptable Use & Prohibited Conduct' },
    { id:'ip',             label:'9. Intellectual Property' },
    { id:'data',           label:'10. Data & Privacy' },
    { id:'thirdparty',     label:'11. Third-Party Services' },
    { id:'disclaimer',     label:'12. Disclaimer of Warranties' },
    { id:'liability',      label:'13. Limitation of Liability' },
    { id:'indemnity',      label:'14. Indemnification' },
    { id:'termination',    label:'15. Termination' },
    { id:'disputes',       label:'16. Disputes & Governing Law' },
    { id:'changes',        label:'17. Changes to Terms' },
    { id:'contact',        label:'18. Contact Information' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:FH }}>

      {/* Top bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'14px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/koto_logo.svg" alt="Koto" style={{ height:28, width:'auto' }}/>
        </div>
        <div style={{ display:'flex', gap:16 }}>
          <a href="/privacy" style={{ fontSize:14, color:'#6b7280', fontWeight:600, textDecoration:'none' }}>Privacy Policy</a>
          <a href="/" style={{ fontSize:14, color:RED, fontWeight:700, textDecoration:'none' }}>← Back to App</a>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'48px 24px', display:'grid', gridTemplateColumns:'240px 1fr', gap:48, alignItems:'start' }}>

        {/* Sidebar nav */}
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Contents</div>
          {sections.map(s => (
            <a key={s.id} href={'#'+s.id}
              style={{ display:'block', fontSize:13, color: activeSection===s.id ? RED : '#6b7280', fontWeight: activeSection===s.id ? 700 : 500, padding:'5px 0', textDecoration:'none', borderLeft:`2px solid ${activeSection===s.id ? RED : 'transparent'}`, paddingLeft:10, marginLeft:-10, transition:'all .15s' }}
              onClick={() => setActiveSection(s.id)}>
              {s.label}
            </a>
          ))}
        </div>

        {/* Content */}
        <div>
          <div style={{ marginBottom:32 }}>
            <H1>Terms of Service</H1>
            <p style={{ fontSize:14, color:'#9ca3af', margin:'4px 0 0', fontFamily:FB }}>Last updated: {DATE} · Effective immediately upon account creation</p>
          </div>

          <Box color='#fef2f2' border='#fecaca'>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:RED, fontFamily:FH }}>PLEASE READ THESE TERMS CAREFULLY.</p>
            <p style={{ margin:'6px 0 0', fontSize:14, color:'#7f1d1d', fontFamily:FB, lineHeight:1.7 }}>
              By accessing or using {APP} (hellokoto.com), creating an account, or clicking "I Agree," you agree to be legally bound by these Terms of Service. If you do not agree, do not use the platform. These Terms contain a binding arbitration clause and class action waiver. Your continued use constitutes ongoing acceptance.
            </p>
          </Box>

          {/* 1. Acceptance */}
          <H2 id="acceptance">1. Acceptance of Terms</H2>
          <P>These Terms of Service ("Terms") constitute a legally binding agreement between you ("Agency," "Client," "Subscriber," or "you") and {CO} ("Koto," "we," "us," or "our"), a company registered in the State of Florida, governing your access to and use of the {APP} platform, website at {URL}, application programming interfaces, mobile applications, and all related tools, services, and content (collectively, the "Services").</P>
          <P>By creating an account, subscribing to a plan, or using any part of the Services, you represent and warrant that: (a) you are at least 18 years of age; (b) you have the legal authority to enter into this agreement on behalf of yourself or the entity you represent; (c) you have read, understood, and agree to be bound by these Terms and our Privacy Policy, incorporated herein by reference; and (d) if you are agreeing on behalf of a company or other legal entity, you represent that you have the authority to bind such entity.</P>
          <P>Koto reserves the right to modify these Terms at any time. Continued use of the Services after any modification constitutes acceptance of the revised Terms.</P>

          {/* 2. Services */}
          <H2 id="services">2. Description of Services</H2>
          <P>{APP} is a B2B software-as-a-service (SaaS) platform designed for marketing agencies and their clients. The Services include but are not limited to: AI-powered marketing tools, local SEO analysis and reporting, Google Business Profile management tools, review management, client portal and onboarding tools, lead intelligence (Scout), desk ticketing, content generation, keyword analysis, performance reporting, white-label tools, and any additional features added from time to time.</P>
          <P>Koto reserves the right to: (a) modify, suspend, or discontinue any feature or the entire Service at any time with or without notice; (b) impose limits on certain features or restrict access; (c) release subsequent versions of the Service with different features. We are not liable to you or any third party for any modification, suspension, or discontinuation of the Services.</P>

          {/* 3. Accounts */}
          <H2 id="accounts">3. Accounts & Registration</H2>
          <P>You must create an account to access the Services. You agree to: (a) provide accurate, current, and complete information; (b) maintain and promptly update your account information; (c) keep your password secure and confidential; (d) accept responsibility for all activities under your account; (e) notify us immediately at {EMAIL} of any unauthorized access.</P>
          <P>Koto reserves the right to refuse registration, cancel accounts, or remove content at our sole discretion, without notice, and without liability. One agency may register only one primary account unless expressly permitted in writing by Koto. Sub-accounts for team members are governed by your subscription tier.</P>
          <P>You may not share login credentials. Accounts are non-transferable. Koto is not responsible for any loss resulting from unauthorized account access due to your failure to safeguard credentials.</P>

          {/* 4. Billing */}
          <H2 id="subscription">4. Subscription, Billing & Payments</H2>
          <H3>4.1 Subscription Plans</H3>
          <P>Access to the Services requires a paid subscription. Current plan options, pricing, and included features are displayed at {URL}/billing and {URL}/signup, and are subject to change with 30 days' notice. Your subscription begins upon successful payment processing and continues on a month-to-month basis unless you select an annual plan or terminate in accordance with Section 15.</P>
          <H3>4.2 Payment Authorization</H3>
          <P>By providing a payment method, you authorize {CO} and our payment processor (Stripe, Inc.) to charge your payment method on the applicable recurring billing cycle. All fees are in U.S. dollars. You authorize us to charge your payment method for: (a) the applicable subscription fee; (b) any applicable taxes, including sales tax where required; (c) overage fees if applicable; and (d) any amounts owed under these Terms.</P>
          <H3>4.3 Automatic Renewal</H3>
          <P>Your subscription automatically renews at the end of each billing cycle unless you cancel at least 24 hours before the next renewal date. You acknowledge that your subscription is subject to automatic renewal and that {CO} is authorized to charge your payment method for the renewal amount without further authorization. It is your responsibility to cancel before the renewal date.</P>
          <H3>4.4 Failed Payments</H3>
          <P>If a payment fails, we may: (a) retry the charge; (b) downgrade or suspend your account; (c) terminate your account after reasonable notice. You remain responsible for all amounts owed. A $25 returned payment fee may apply. Disputed chargebacks that are found to be invalid will result in immediate account termination and may be referred to collections.</P>
          <H3>4.5 Price Changes</H3>
          <P>Koto reserves the right to change subscription pricing at any time. We will provide at least 30 days' email notice before price changes take effect for existing subscribers. Your continued use after the price change effective date constitutes acceptance of the new pricing.</P>

          {/* 5. Free Trial */}
          <H2 id="trial">5. Free Trial</H2>
          <Box color='#f0fdf4' border='#bbf7d0'>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#15803d', fontFamily:FH }}>7-Day Free Trial</p>
            <p style={{ margin:'6px 0 0', fontSize:14, color:'#166534', fontFamily:FB, lineHeight:1.7 }}>
              New subscribers receive a 7-day free trial with full access to the Services. A valid credit card is required to start your trial. You will not be charged during the trial period. If you do not cancel before the trial ends, your subscription begins automatically and your payment method is charged the applicable plan fee. No reminder is sent before the trial converts.
            </p>
          </Box>
          <P>One free trial per person, business, email address, credit card, or IP address. Koto reserves the right to determine trial eligibility in its sole discretion. Abuse of the trial policy (including creating multiple accounts to obtain additional trials) may result in immediate termination of all associated accounts and forfeiture of any data. Trial features may differ from paid plan features at Koto's discretion.</P>
          <P>Upon trial expiration, if you do not upgrade, your account is downgraded and access to your data may be restricted. Data is retained for 30 days post-trial before deletion. Koto is not responsible for data loss due to failure to convert a trial.</P>

          {/* 6. Refunds */}
          <H2 id="refunds">6. Refund Policy</H2>
          <Box color='#fef2f2' border='#fecaca'>
            <p style={{ margin:0, fontSize:14, fontWeight:800, color:RED, fontFamily:FH }}>NO REFUNDS ON MONTHLY SUBSCRIPTIONS</p>
            <p style={{ margin:'8px 0 0', fontSize:14, color:'#7f1d1d', fontFamily:FB, lineHeight:1.7 }}>
              All monthly subscription fees are non-refundable. Once a payment has been processed for a billing cycle, no refund will be issued for that period under any circumstances, including but not limited to: unused service, dissatisfaction, feature changes, account cancellation mid-cycle, or any other reason. Your subscription remains active until the end of the paid billing period.
            </p>
          </Box>
          <H3>6.1 Annual or Prepaid Plans</H3>
          <P>If you have prepaid for multiple months or an annual subscription and elect to cancel before the end of the prepaid term, you may request a prorated refund subject to the following conditions:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>A non-refundable <strong>$100 service fee</strong> will be deducted from any refund amount to cover ancillary prepaid expenses, anticipated usage costs, and administrative expenses incurred by Koto on your behalf (including but not limited to: AI API usage, Google API costs, third-party data subscriptions, onboarding resources, and infrastructure commitments).</Li>
            <Li>The refund is calculated based on the number of full, unused calendar months remaining in your prepaid term, minus the $100 service fee.</Li>
            <Li>Partial months are not refunded under any circumstances.</Li>
            <Li>Refund requests must be submitted to {EMAIL} within 30 days of cancellation. Requests after 30 days will not be honored.</Li>
            <Li>Refunds are processed within 10 business days and returned to the original payment method only.</Li>
            <Li>Accounts that have violated these Terms are not eligible for any refund.</Li>
          </ul>
          <H3>6.2 Chargebacks</H3>
          <P>If you initiate a chargeback or dispute with your bank or credit card company for any charge that is not fraudulent, Koto reserves the right to: (a) immediately terminate your account; (b) pursue collection of all amounts owed plus a $50 chargeback processing fee; (c) report the debt to credit reporting agencies; (d) take legal action to recover amounts owed. Initiating a chargeback does not constitute a valid cancellation of your subscription.</P>
          <H3>6.3 No Exceptions</H3>
          <P>Koto does not make exceptions to this refund policy regardless of usage, reason, or circumstance. By subscribing, you expressly acknowledge and agree to these terms.</P>

          {/* 7. Communications */}
          <H2 id="communications">7. Communications, Marketing Consent & TCPA/CAN-SPAM Compliance</H2>
          <Box color='#eff6ff' border='#bfdbfe'>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#1e40af', fontFamily:FH }}>Your Consent to Receive Communications</p>
            <p style={{ margin:'6px 0 0', fontSize:14, color:'#1e3a8a', fontFamily:FB, lineHeight:1.7 }}>
              By creating an account, you expressly consent to receive communications from {CO} by email, SMS/text message, and phone call regarding your account, the Services, product updates, marketing offers, and promotional content. Standard message and data rates may apply.
            </p>
          </Box>
          <H3>7.1 Email Communications</H3>
          <P>By providing your email address, you consent to receive: (a) transactional emails necessary for account operation; (b) marketing and promotional emails from Koto and our partners; (c) product announcements, feature updates, and newsletters; (d) survey and feedback requests. Transactional emails cannot be opted out of while your account is active. You may opt out of marketing emails at any time via the unsubscribe link in each email, though processing may take up to 10 business days.</P>
          <H3>7.2 SMS / Text Message Communications</H3>
          <P>By providing your mobile phone number, you expressly consent to receive automated and non-automated SMS and MMS text messages from {CO} at the number provided, including: account alerts, billing notifications, security codes, promotional offers, product updates, and other marketing content. Message frequency varies. Message and data rates may apply. To opt out of marketing SMS, reply STOP to any message. For help, reply HELP. Opting out of marketing SMS does not affect transactional messages required for account operation.</P>
          <H3>7.3 Phone Calls</H3>
          <P>By providing your phone number, you consent to receive autodialed, pre-recorded, or manually dialed phone calls from {CO} and its agents at the number provided for account, billing, sales, customer service, and marketing purposes. You may revoke consent to marketing calls at any time by contacting us at {EMAIL}, though revocation does not apply to calls made before the opt-out is processed.</P>
          <H3>7.4 Client Communications</H3>
          <P>If you use {APP} to send communications to your own clients on your behalf (reviews, reports, onboarding, SMS, email), you represent and warrant that: (a) you have obtained all legally required consents from your clients; (b) you are solely responsible for compliance with all applicable laws including CAN-SPAM, TCPA, GDPR, CCPA, and any other applicable law; (c) Koto is not responsible for any communications sent through the platform on your behalf; (d) you will indemnify and hold Koto harmless from any claims arising from your communications.</P>
          <H3>7.5 Do Not Call / Do Not Email</H3>
          <P>Koto maintains internal do-not-contact lists separate from any regulatory lists. Removal requests are processed within 10 business days. Even after removal, you may receive service-critical communications. Koto is not responsible for communications sent before your opt-out is processed.</P>

          {/* 8. Acceptable Use */}
          <H2 id="conduct">8. Acceptable Use & Prohibited Conduct</H2>
          <P>You agree not to, and will not permit any third party to:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Use the Services for any unlawful, fraudulent, or malicious purpose</Li>
            <Li>Violate any applicable local, state, national, or international law or regulation</Li>
            <Li>Infringe upon the intellectual property or privacy rights of any third party</Li>
            <Li>Reverse engineer, decompile, disassemble, or attempt to derive source code from the platform</Li>
            <Li>Transmit any viruses, malware, or other harmful code</Li>
            <Li>Attempt to gain unauthorized access to any part of the Services or systems</Li>
            <Li>Use automated scripts to scrape, extract, or harvest data from the platform</Li>
            <Li>Resell, sublicense, or commercially exploit the Services without express written permission</Li>
            <Li>Impersonate any person or entity, or falsely represent your affiliation</Li>
            <Li>Send spam, unsolicited communications, or violate anti-spam laws</Li>
            <Li>Interfere with the proper operation of the Services or infrastructure</Li>
            <Li>Use the Services to store or process protected health information (PHI) without a HIPAA Business Associate Agreement</Li>
            <Li>Circumvent any technical measures or access controls</Li>
          </ul>
          <P>Koto reserves the right to terminate accounts found to be in violation of this section without notice and without refund.</P>

          {/* 9. IP */}
          <H2 id="ip">9. Intellectual Property</H2>
          <P>All content, features, functionality, software, and infrastructure of the {APP} platform, including but not limited to text, graphics, logos, icons, AI models, algorithms, source code, and trade secrets, are the exclusive property of {CO} and are protected by United States and international copyright, trademark, patent, and other intellectual property laws. You acquire no ownership rights by using the Services.</P>
          <P>Koto grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Services solely for your internal business purposes in accordance with these Terms. This license terminates immediately upon termination of your account.</P>
          <H3>9.1 Your Content</H3>
          <P>You retain ownership of content you submit to the Services ("Your Content"). By submitting content, you grant Koto a worldwide, royalty-free, non-exclusive license to use, store, reproduce, modify, and display Your Content solely as necessary to provide the Services. You represent that you have all rights necessary to grant this license and that Your Content does not infringe any third-party rights.</P>
          <H3>9.2 Feedback</H3>
          <P>Any feedback, suggestions, or ideas you provide to Koto regarding the Services ("Feedback") are provided voluntarily and become the exclusive property of Koto, which may use such Feedback without restriction, attribution, or compensation to you.</P>

          {/* 10. Data */}
          <H2 id="data">10. Data & Privacy</H2>
          <P>Our collection and use of your personal information is governed by our Privacy Policy, available at {URL}/privacy, incorporated herein by reference. By using the Services, you consent to all data practices described therein.</P>
          <P>You are responsible for ensuring that any personal data of your clients that you upload to the platform is handled in compliance with all applicable privacy laws. Koto processes such data as a data processor on your behalf, and you serve as the data controller.</P>
          <P>Upon termination of your account, Koto will retain your data for 30 days, during which you may request export. After 30 days, all data may be permanently deleted. Koto is not liable for any data loss after account termination.</P>

          {/* 11. Third Party */}
          <H2 id="thirdparty">11. Third-Party Services & Integrations</H2>
          <P>{APP} integrates with third-party services including Google (Search Console, Analytics, Business Profile, Places API), Stripe, Anthropic AI, and others. Your use of these integrations is subject to the respective third-party terms and privacy policies. Koto does not control and is not responsible for the availability, accuracy, content, products, or services of third-party providers.</P>
          <P>AI-generated content produced by the platform (including responses, reports, keyword suggestions, and audit results) is provided for informational purposes only. Koto makes no warranties regarding the accuracy, completeness, or fitness for any particular purpose of AI-generated content. You are solely responsible for reviewing and validating any AI output before use.</P>

          {/* 12. Disclaimer */}
          <H2 id="disclaimer">12. Disclaimer of Warranties</H2>
          <Box color='#f9fafb' border='#e5e7eb'>
            <P>THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, TITLE, ACCURACY, OR AVAILABILITY. KOTO DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES. NO ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED FROM KOTO OR THROUGH THE SERVICES WILL CREATE ANY WARRANTY NOT EXPRESSLY STATED HEREIN.</P>
          </Box>
          <P>Koto does not guarantee any specific results from use of the Services, including improvements in search rankings, review volume, client acquisition, or revenue. Marketing results vary and are outside Koto's control.</P>

          {/* 13. Liability */}
          <H2 id="liability">13. Limitation of Liability</H2>
          <Box color='#fef2f2' border='#fecaca'>
            <P>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL {CO.toUpperCase()}, ITS OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AGENTS, LICENSORS, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, BUSINESS OPPORTUNITY, OR REVENUE, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICES, EVEN IF KOTO HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</P>
            <P style={{ margin:0 }}>KOTO'S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING UNDER OR RELATED TO THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT YOU PAID TO KOTO IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE CLAIM; OR (B) ONE HUNDRED DOLLARS ($100).</P>
          </Box>
          <P>Some jurisdictions do not allow the exclusion or limitation of certain damages. In such jurisdictions, Koto's liability is limited to the fullest extent permitted by law.</P>

          {/* 14. Indemnity */}
          <H2 id="indemnity">14. Indemnification</H2>
          <P>You agree to defend, indemnify, and hold harmless {CO}, its affiliates, officers, directors, employees, contractors, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, debt, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Services; (b) your violation of these Terms; (c) your violation of any third-party rights, including intellectual property or privacy rights; (d) any content you submit to the platform; (e) any communications you send through the platform to your clients; (f) your violation of any applicable law or regulation; or (g) any dispute between you and your clients arising from services delivered using the Koto platform.</P>

          {/* 15. Termination */}
          <H2 id="termination">15. Termination</H2>
          <H3>15.1 By You</H3>
          <P>You may cancel your subscription at any time by accessing your account settings or contacting {EMAIL}. Cancellation takes effect at the end of the current billing period. You will continue to have access to the Services through the end of the paid period. No prorated refunds are issued for monthly subscriptions.</P>
          <H3>15.2 By Koto</H3>
          <P>Koto may suspend or terminate your account and access to the Services immediately and without notice if: (a) you breach any provision of these Terms; (b) we determine, in our sole discretion, that your use is harmful to Koto or other users; (c) payment fails and is not remedied; (d) we are required to do so by law; or (e) we decide to discontinue the Services. Upon termination by Koto for cause, no refunds of any kind will be issued.</P>
          <H3>15.3 Effect of Termination</H3>
          <P>Upon termination, your license to use the Services is revoked immediately. Sections 9, 12, 13, 14, 16, and all accrued payment obligations survive termination.</P>

          {/* 16. Disputes */}
          <H2 id="disputes">16. Disputes, Arbitration & Governing Law</H2>
          <H3>16.1 Governing Law</H3>
          <P>These Terms are governed by the laws of the State of Florida, without regard to conflict of law principles. You consent to exclusive jurisdiction in Palm Beach County, Florida for any dispute not subject to arbitration.</P>
          <H3>16.2 Binding Arbitration</H3>
          <P>EXCEPT FOR CLAIMS FOR INJUNCTIVE RELIEF OR CLAIMS WHERE THE AMOUNT IN CONTROVERSY IS LESS THAN $10,000, ANY DISPUTE ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES WILL BE RESOLVED THROUGH FINAL AND BINDING ARBITRATION ADMINISTERED BY THE AMERICAN ARBITRATION ASSOCIATION (AAA) UNDER ITS COMMERCIAL ARBITRATION RULES. THE ARBITRATION WILL BE CONDUCTED IN PALM BEACH COUNTY, FLORIDA, IN ENGLISH. THE DECISION OF THE ARBITRATOR IS FINAL AND BINDING.</P>
          <H3>16.3 Class Action Waiver</H3>
          <P>YOU AND KOTO AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. The arbitrator may not consolidate claims of multiple parties.</P>
          <H3>16.4 Time Limitation</H3>
          <P>Any claim against Koto must be filed within one (1) year of the event giving rise to the claim. Claims filed after this period are permanently barred.</P>

          {/* 17. Changes */}
          <H2 id="changes">17. Changes to These Terms</H2>
          <P>Koto reserves the right to modify these Terms at any time. We will provide notice of material changes by: (a) email to your registered address; (b) posting a notice on the platform; or (c) updating the "Last Updated" date. Your continued use of the Services after the effective date of any change constitutes your acceptance of the revised Terms. If you disagree with any change, your sole remedy is to cancel your subscription and cease using the Services.</P>

          {/* 18. Contact */}
          <H2 id="contact">18. Contact Information</H2>
          <P>{CO} operates the {APP} platform.</P>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Legal / Terms inquiries:</strong> {EMAIL}</Li>
            <Li><strong>Billing disputes:</strong> billing@hellokoto.com</Li>
            <Li><strong>Privacy:</strong> privacy@hellokoto.com</Li>
            <Li><strong>General support:</strong> support@hellokoto.com</Li>
            <Li><strong>Address:</strong> {ADDR}</Li>
            <Li><strong>Website:</strong> {URL}</Li>
          </ul>

          <div style={{ marginTop:48, padding:'20px 24px', background:'#f3f4f6', borderRadius:12, fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.7 }}>
            These Terms of Service were last updated on {DATE}. If you have any questions or concerns, please contact us before using the Services. By using {APP}, you confirm that you have read, understood, and agree to be bound by these Terms.
          </div>
        </div>
      </div>
    </div>
  )
}
